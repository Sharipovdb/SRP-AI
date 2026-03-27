import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Send, Mail, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStartConversation, useGetConversation, useCaptureContact, useGeneratePrototype } from "@workspace/api-client-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatBubble } from "@/components/chat-bubble";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem("srp_session_id"));
  const [initialInput, setInitialInput] = useState("");
  const [input, setInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prototypeId, setPrototypeId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const startMutation = useStartConversation();
  const captureMutation = useCaptureContact();
  const generateMutation = useGeneratePrototype();

  const { data: conversation, isLoading: isLoadingConv } = useGetConversation(sessionId || "", {
    query: { enabled: !!sessionId, retry: 1 }
  });

  const { sendMessage, isStreaming, streamedText } = useChatStream(sessionId);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, streamedText, isStreaming]);

  // Clean up invalid session
  useEffect(() => {
    if (!isLoadingConv && sessionId && !conversation) {
      localStorage.removeItem("srp_session_id");
      setSessionId(null);
    }
  }, [isLoadingConv, sessionId, conversation]);

  const messages = conversation?.messages || [];
  const showGeneratePrompt = !conversation?.emailCaptured && messages.length >= 4 && !showEmailForm && !generating && !prototypeId;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialInput.trim()) return;

    try {
      const res = await startMutation.mutateAsync({ data: { source: "web", referrerUrl: window.location.href } });
      localStorage.setItem("srp_session_id", res.sessionId);
      setSessionId(res.sessionId);
      
      // Delay slightly so query cache registers the new session before sending the stream
      setTimeout(() => {
        sendMessage(initialInput);
      }, 300);
    } catch (err) {
      toast({ title: "Failed to connect", description: "Please try again later.", variant: "destructive" });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    if (!email || !sessionId) return;

    setGenerating(true);
    try {
      const res = await captureMutation.mutateAsync({
        sessionId,
        data: { email }
      });
      if (res.prototypeId) {
        await generateMutation.mutateAsync({ id: res.prototypeId });
        setPrototypeId(res.prototypeId);
      } else {
        toast({ title: "Email saved", description: "We will be in touch shortly!" });
      }
    } catch (err) {
      toast({ title: "Error securing concept", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-4xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <div className="w-20 h-20 mx-auto mb-8 bg-card border border-border/80 shadow-2xl shadow-primary/10 rounded-2xl flex items-center justify-center overflow-hidden">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-12 h-12" />
            </div>
            
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/5 uppercase tracking-widest text-[10px] py-1.5 px-3">
              SRP Pre-Sales Engine
            </Badge>

            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground tracking-tight mb-6 leading-[1.1]">
              Turn your software idea into a <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-400 to-amber-200 drop-shadow-sm">visual concept</span>
              <br />— in minutes.
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto font-light leading-relaxed">
              Chat with our AI strategist to shape your requirements. We'll instantly generate a bespoke technical summary or interactive prototype.
            </p>

            <form onSubmit={handleStart} className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-amber-400/30 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
              <Input
                value={initialInput}
                onChange={e => setInitialInput(e.target.value)}
                placeholder="I want to build an application that..."
                className="relative h-16 text-lg bg-card/90 backdrop-blur-xl border-border focus-visible:ring-primary shadow-xl rounded-xl px-6"
              />
              <Button type="submit" size="lg" className="relative h-16 px-8 text-lg font-semibold shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 bg-primary text-primary-foreground shrink-0 rounded-xl" disabled={startMutation.isPending}>
                {startMutation.isPending ? "Connecting..." : "Start Mapping"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background flex justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="" className="w-full h-full object-cover opacity-[0.04]" />
      </div>

      <div className="w-full max-w-3xl flex flex-col h-screen relative z-10 shadow-[0_0_80px_rgba(0,0,0,0.5)] border-x border-border/40 bg-background/95 backdrop-blur-3xl">
        <header className="shrink-0 h-16 border-b border-border/50 flex items-center justify-between px-6 bg-card/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden shadow-sm">
               <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-5 h-5" />
             </div>
             <div>
               <h2 className="font-semibold text-foreground leading-none">SRP Advisor</h2>
               <div className="flex items-center gap-1.5 mt-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">AI Strategist</p>
               </div>
             </div>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary transition-colors text-xs font-medium">
            Speak with a human
          </Button>
        </header>

        <ScrollArea className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="space-y-6 pb-12">
            {conversation?.initialMessage && (
              <ChatBubble message={{ id: 'init', role: 'assistant', content: conversation.initialMessage }} />
            )}

            {messages.map(msg => (
               <ChatBubble key={msg.id} message={msg} />
            ))}

            {isStreaming && (
               <ChatBubble message={{ id: 'stream', role: 'assistant', content: streamedText }} isStreaming />
            )}
            <div ref={scrollRef} className="h-4" />
          </div>
        </ScrollArea>

        <footer className="shrink-0 p-4 md:p-6 border-t border-border/50 bg-card/80 backdrop-blur-2xl relative z-20">
          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="py-10 flex flex-col items-center justify-center text-center"
              >
                <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6 shadow-lg shadow-primary/20" />
                <h3 className="text-2xl font-display font-bold text-foreground">Drafting your concept</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">Synthesizing requirements and generating technical assets. This takes about a minute...</p>
              </motion.div>
            ) : prototypeId ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-2xl shadow-xl shadow-primary/5"
              >
                <div className="w-16 h-16 bg-primary/20 text-primary border border-primary/30 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground mb-2">Your concept is ready!</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md px-4">We've generated a bespoke technical concept based on our conversation.</p>
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold shadow-xl hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all duration-300 bg-primary text-primary-foreground rounded-xl" onClick={() => setLocation(`/preview/${prototypeId}`)}>
                  View Your Concept <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            ) : showEmailForm ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-card border border-border p-6 rounded-2xl shadow-2xl"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary mt-1 shadow-inner">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Where should we send your concept?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Enter your work email to instantly generate and receive your personalized prototype.</p>
                  </div>
                </div>
                <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    className="h-14 text-base bg-background border-border/80 focus-visible:ring-primary rounded-xl"
                  />
                  <Button type="submit" size="lg" className="h-14 px-8 rounded-xl bg-primary text-primary-foreground hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold" disabled={captureMutation.isPending}>
                    {captureMutation.isPending ? "Generating..." : "Generate Concept"}
                  </Button>
                </form>
                <div className="mt-4 text-center sm:text-left">
                  <button type="button" onClick={() => setShowEmailForm(false)} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                    Cancel and return to chat
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {showGeneratePrompt && (
                  <div className="mb-6 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowEmailForm(true)}
                      className="bg-primary/5 border-primary/30 text-primary hover:bg-primary/15 hover:text-primary shadow-lg shadow-primary/5 animate-in fade-in slide-in-from-bottom-4 font-semibold rounded-full px-6 py-6"
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Ready to generate your concept?
                    </Button>
                  </div>
                )}
                <form onSubmit={handleSend} className="relative flex items-end gap-3 bg-background border border-border rounded-2xl p-2 shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Type your message..."
                    className="min-h-[56px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none px-4 py-3.5 text-base"
                    disabled={isStreaming}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isStreaming}
                    className={cn(
                      "h-12 w-12 shrink-0 rounded-xl transition-all duration-300 mb-0.5 mr-0.5",
                      input.trim() ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:shadow-primary/40" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3 text-muted-foreground/60" />
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Secure & Confidential</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </div>
    </div>
  );
}
