import { useRoute, Link } from "wouter";
import { useGetPrototype, getGetPrototypeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, ShieldCheck, FileText, MousePointer } from "lucide-react";

export default function PreviewPage() {
  const [, params] = useRoute("/preview/:id");
  const id = params?.id;
  const view = new URLSearchParams(window.location.search).get("view");
  const showSummary = view === "summary";

  const { data: prototype, isLoading, error } = useGetPrototype(id || "", {
    query: { queryKey: getGetPrototypeQueryKey(id || ""), enabled: !!id }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-display font-bold text-foreground">Decrypting Concept</h2>
        <p className="text-muted-foreground mt-2">Loading secure prototype environment...</p>
      </div>
    );
  }

  if (error || !prototype) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-3xl font-display font-bold mb-4">Concept Not Found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">This secure concept link may have expired or the ID is incorrect. Please request a new concept.</p>
        <Link href="/" className="text-primary hover:text-primary/80 font-semibold flex items-center transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Return to Idea Engine
        </Link>
      </div>
    );
  }

  const content = showSummary ? prototype.technicalSummaryHtml : prototype.htmlContent;
  const label = showSummary ? "Technical Concept Summary" : "Interactive UI Concept";
  const hasBoth = !!(prototype.htmlContent && prototype.technicalSummaryHtml);
  const toggleHref = showSummary
    ? `/preview/${id}`
    : `/preview/${id}?view=summary`;
  const toggleLabel = showSummary ? "View Interactive Prototype" : "View Technical Summary";
  const ToggleIcon = showSummary ? MousePointer : FileText;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-20 border-b border-border/80 bg-card/90 backdrop-blur-xl flex items-center justify-between px-6 md:px-10 shrink-0 z-20 relative shadow-md">
         <div className="flex items-center gap-5">
           <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-10 h-10" />
           <Separator orientation="vertical" className="h-8 bg-border" />
           <div>
             <div className="flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-green-500" />
               <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Secure Asset</span>
             </div>
             <Badge variant="outline" className="mt-1 text-primary border-primary/30 bg-primary/10 uppercase tracking-widest text-[10px] font-bold py-0.5">
               {label}
             </Badge>
           </div>
         </div>
         <div className="flex items-center gap-3">
           {hasBoth && (
             <Link href={toggleHref}>
               <Button variant="outline" className="border-border text-foreground hover:bg-muted font-semibold h-11 px-5 rounded-xl gap-2">
                 <ToggleIcon className="w-4 h-4 opacity-70" />
                 <span className="hidden sm:inline">{toggleLabel}</span>
               </Button>
             </Link>
           )}
           <Button className="bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 h-11 px-6 rounded-xl">
             Take this further — Book a Call
           </Button>
         </div>
      </header>

      <main className="flex-1 relative bg-muted/10 overflow-auto flex justify-center">
        {content ? (
          <div className="w-full h-full max-w-7xl mx-auto shadow-2xl bg-white border-x border-border/50">
            <iframe
              srcDoc={content}
              className="w-full h-full border-0"
              title={label}
              sandbox="allow-scripts allow-forms"
            />
          </div>
        ) : (
          <div className="w-full max-w-5xl mx-auto py-12 px-4 md:px-8 text-center text-muted-foreground">
            {showSummary ? "Technical summary is not available." : "Prototype content is unavailable."}
          </div>
        )}
      </main>
    </div>
  );
}
