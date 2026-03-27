import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Filter, ShieldAlert, ArrowRight, Save } from "lucide-react";
import { useListLeads, useGetLead, useUpdateLead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const ADMIN_TOKEN = "srp-admin-2024";

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="relative w-10 h-10 flex items-center justify-center bg-background rounded-full shadow-inner border border-border/50">
      <svg className="w-full h-full -rotate-90 transform p-1" viewBox="0 0 36 36">
        <path className="text-muted stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path className={cn(color, "stroke-current transition-all duration-1000 ease-out")} strokeWidth="3" strokeDasharray={`${score}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
      </svg>
      <span className="absolute text-[11px] font-bold text-foreground">{score}</span>
    </div>
  );
};

function LeadDetails({ leadId, adminHeaders }: { leadId: string; adminHeaders: Record<string, string> }) {
  const { data: lead, isLoading } = useGetLead(leadId, {
    request: { headers: adminHeaders },
  });
  const updateMutation = useUpdateLead({
    request: { headers: adminHeaders },
  });
  const { toast } = useToast();

  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  React.useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNotes(lead.notes || "");
    }
  }, [lead]);

  if (isLoading || !lead) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading lead dossier...</div>;
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: leadId, data: { status, notes } });
      toast({ title: "Lead updated successfully" });
    } catch (err) {
      toast({ title: "Failed to update lead", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 md:p-8 grid grid-cols-1 xl:grid-cols-3 gap-8 bg-muted/10 border-x border-b border-border/50 rounded-b-xl shadow-inner">
       <div className="space-y-8 xl:col-span-2">
         <div>
           <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Idea Summary
           </h4>
           <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
             <p className="text-foreground leading-relaxed">{lead.ideaSummary || "Awaiting final synthesis."}</p>
           </div>
         </div>

         {lead.prototypeUrl && (
           <div>
             <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Generated Asset
             </h4>
             <Link href={`/preview/${lead.prototypeUrl.split('/').pop()}`} className="inline-flex items-center justify-between w-full sm:w-auto min-w-[250px] bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/40 px-5 py-3 rounded-xl font-semibold transition-all group shadow-sm">
               {lead.prototypeType === 'clickable_web' ? 'Interactive Concept' : 'Technical Summary'}
               <ArrowRight className="w-4 h-4 ml-4 group-hover:translate-x-1 transition-transform" />
             </Link>
           </div>
         )}

         <div>
           <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Raw Transcript
           </h4>
           <div className="bg-card border border-border rounded-xl p-5 h-80 overflow-y-auto space-y-5 shadow-inner">
             {lead.messages?.map(m => (
               <div key={m.id} className={cn("text-sm p-4 rounded-xl max-w-[85%]", m.role === "assistant" ? "bg-muted text-muted-foreground mr-auto rounded-tl-sm" : "bg-primary/10 border border-primary/20 text-foreground ml-auto rounded-tr-sm")}>
                 <span className="font-bold text-[10px] uppercase opacity-50 mb-1.5 block tracking-wider">{m.role}</span>
                 {m.content}
               </div>
             ))}
           </div>
         </div>
       </div>

       <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-lg h-fit">
         <h4 className="text-sm font-display font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-4">
           Sales Workflow
         </h4>

         <div className="space-y-3">
           <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pipeline Status</label>
           <Select value={status} onValueChange={setStatus}>
             <SelectTrigger className="bg-background h-12 rounded-xl border-border/80">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="started">Started</SelectItem>
               <SelectItem value="contact_captured">Contact Captured</SelectItem>
               <SelectItem value="generating_prototype">Generating Prototype</SelectItem>
               <SelectItem value="prototype_sent">Prototype Sent</SelectItem>
               <SelectItem value="consultant_requested">Consultant Requested</SelectItem>
               <SelectItem value="converted">Converted</SelectItem>
             </SelectContent>
           </Select>
         </div>

         <div className="space-y-3">
           <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Internal Notes</label>
           <Textarea
             value={notes}
             onChange={e => setNotes(e.target.value)}
             placeholder="Add strategic notes, budget signals, or context..."
             className="resize-none h-40 bg-background rounded-xl border-border/80 p-4"
           />
         </div>

         <Button onClick={handleSave} className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all" disabled={updateMutation.isPending}>
           {updateMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
         </Button>
       </div>
    </div>
  );
}

export default function AdminPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const [segment, setSegment] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const adminHeaders = { "x-admin-token": ADMIN_TOKEN };

  const { data: listResponse, isLoading } = useListLeads(
    {
      segment: segment === "all" ? undefined : segment,
      limit: 50,
    },
    {
      request: { headers: adminHeaders },
      query: { enabled: token === ADMIN_TOKEN },
    }
  );

  if (token !== ADMIN_TOKEN) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="w-20 h-20 text-destructive mb-6 opacity-80" />
        <h1 className="text-4xl font-display font-bold text-foreground mb-4">Secure Area</h1>
        <p className="text-lg text-muted-foreground">Valid administrator credentials required.</p>
      </div>
    );
  }

  const leads = listResponse?.leads || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border bg-card hidden lg:flex flex-col z-10 shadow-xl">
        <div className="h-20 flex items-center px-6 border-b border-border/50">
           <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-8 h-8 mr-3" />
           <span className="font-display font-bold tracking-tight text-xl">SRP Sales</span>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <Button variant="secondary" className="w-full justify-start font-semibold bg-primary/10 text-primary hover:bg-primary/20 h-12 rounded-xl">
            Lead Pipeline
          </Button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-6 md:px-10 z-10">
          <h1 className="text-2xl font-bold font-display tracking-tight">Intelligence Dashboard</h1>
          <div className="flex items-center gap-4">
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-[200px] h-11 bg-background border-border shadow-sm rounded-xl">
                <Filter className="w-4 h-4 mr-2 text-primary" />
                <SelectValue placeholder="Filter Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="high_fit">High Fit Focus</SelectItem>
                <SelectItem value="medium_fit">Medium Fit</SelectItem>
                <SelectItem value="low_fit">Low Fit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-10 overflow-auto bg-background relative">
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

           <div className="relative z-10">
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
               <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                 <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Pipeline Volume</CardTitle></CardHeader>
                 <CardContent><div className="text-4xl font-bold font-display">{listResponse?.total || 0}</div></CardContent>
               </Card>
               <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                 <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">High-Fit Prospects</CardTitle></CardHeader>
                 <CardContent><div className="text-4xl font-bold font-display">{leads.filter(l => l.qualificationSegment === 'high_fit').length}</div></CardContent>
               </Card>
               <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                 <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Prototypes Sent</CardTitle></CardHeader>
                 <CardContent><div className="text-4xl font-bold font-display">{leads.filter(l => l.prototypeUrl).length}</div></CardContent>
               </Card>
             </div>

             <Card className="bg-card border-border shadow-xl overflow-hidden rounded-2xl">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-muted/40">
                     <TableRow className="border-border hover:bg-transparent">
                       <TableHead className="font-bold text-foreground py-5 px-6">Prospect</TableHead>
                       <TableHead className="font-bold text-foreground py-5">Intel Score</TableHead>
                       <TableHead className="font-bold text-foreground py-5">Classification</TableHead>
                       <TableHead className="font-bold text-foreground py-5 hidden md:table-cell">Product Sector</TableHead>
                       <TableHead className="font-bold text-foreground py-5">Funnel Stage</TableHead>
                       <TableHead className="font-bold text-foreground py-5 text-right px-6">Date</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {isLoading ? (
                       <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground animate-pulse">Scanning database...</TableCell></TableRow>
                     ) : leads.length === 0 ? (
                       <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-medium">No leads match current filters.</TableCell></TableRow>
                     ) : leads.map(lead => (
                       <React.Fragment key={lead.id}>
                         <TableRow
                           className={cn("cursor-pointer transition-colors border-border/50", expandedId === lead.id ? "bg-muted/20 hover:bg-muted/20" : "hover:bg-muted/40")}
                           onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                         >
                           <TableCell className="px-6 py-4">
                             <div className="font-bold text-foreground text-base">{lead.name || "Anonymous Session"}</div>
                             <div className="text-sm text-muted-foreground mt-0.5">{lead.email || "No contact captured"}</div>
                           </TableCell>
                           <TableCell>
                             <ScoreRing score={lead.qualificationScore || 0} />
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className={cn(
                               "uppercase text-[10px] tracking-wider font-bold border-opacity-50 py-1 px-2",
                               lead.qualificationSegment === "high_fit" ? "text-green-500 border-green-500/50 bg-green-500/10" :
                               lead.qualificationSegment === "medium_fit" ? "text-yellow-500 border-yellow-500/50 bg-yellow-500/10" :
                               lead.qualificationSegment === "low_fit" ? "text-red-500 border-red-500/50 bg-red-500/10" :
                               "text-muted-foreground border-border bg-muted/50"
                             )}>
                               {lead.qualificationSegment?.replace("_", " ") || "Pending"}
                             </Badge>
                           </TableCell>
                           <TableCell className="hidden md:table-cell text-muted-foreground text-sm font-medium capitalize">
                             {lead.productType?.replace("_", " ") || "—"}
                           </TableCell>
                           <TableCell>
                             <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-semibold px-2 py-1">
                               {lead.status.replace(/_/g, " ")}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right text-sm text-muted-foreground font-medium px-6 whitespace-nowrap">
                             {format(new Date(lead.createdAt), "MMM d, yyyy")}
                             <ChevronDown className={cn("inline-block ml-4 w-5 h-5 transition-transform text-primary", expandedId === lead.id && "rotate-180")} />
                           </TableCell>
                         </TableRow>
                         {expandedId === lead.id && (
                           <TableRow className="border-0 hover:bg-transparent">
                             <TableCell colSpan={6} className="p-0">
                               <LeadDetails leadId={lead.id} adminHeaders={adminHeaders} />
                             </TableCell>
                           </TableRow>
                         )}
                       </React.Fragment>
                     ))}
                   </TableBody>
                 </Table>
               </div>
             </Card>
           </div>
        </div>
      </main>
    </div>
  );
}
