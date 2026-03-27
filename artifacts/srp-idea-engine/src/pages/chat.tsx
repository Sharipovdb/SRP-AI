import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mail, CheckCircle2, Lock, Clock, ArrowRight, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useStartConversation,
  useGetConversation,
  useCaptureContact,
  useGetPrototype,
  getGetConversationQueryKey,
  getGetPrototypeQueryKey,
} from "@workspace/api-client-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatBubble } from "@/components/chat-bubble";
import { cn } from "@/lib/utils";

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const SESSION_KEY = "srp_session_id";

async function tryResumeFromCookie(): Promise<string | null> {
  try {
    const res = await fetch("/api/conversations/current", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.sessionId) {
        localStorage.setItem(SESSION_KEY, data.sessionId);
        return data.sessionId;
      }
    }
  } catch {}
  return null;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [initialInput, setInitialInput] = useState("");
  const [input, setInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [idleNudge, setIdleNudge] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prototypeId, setPrototypeId] = useState<string | null>(null);

  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMutation = useStartConversation();
  const captureMutation = useCaptureContact();

  const { data: conversation, isLoading: isLoadingConv } = useGetConversation(sessionId || "", {
    query: { queryKey: getGetConversationQueryKey(sessionId || ""), enabled: !!sessionId, retry: 1 },
    request: { credentials: "include" },
  });

  const { data: prototypeData } = useGetPrototype(prototypeId || "", {
    query: { queryKey: getGetPrototypeQueryKey(prototypeId || ""), enabled: !!prototypeId },
  });

  const { sendMessage, isStreaming, streamedText, suggestions, setSuggestions } = useChatStream(sessionId);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSessionId(stored);
      setSessionLoading(false);
    } else {
      tryResumeFromCookie().then((id) => {
        if (id) setSessionId(id);
        setSessionLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, streamedText, isStreaming]);

  useEffect(() => {
    if (!isLoadingConv && sessionId && !conversation) {
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    }
  }, [isLoadingConv, sessionId, conversation]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIdleNudge(false);
    if (sessionId && !showEmailForm && !prototypeId && !generating) {
      const messages = conversation?.messages || [];
      if (!conversation?.emailCaptured && messages.length >= 2) {
        idleTimerRef.current = setTimeout(() => setIdleNudge(true), IDLE_TIMEOUT_MS);
      }
    }
  }, [sessionId, showEmailForm, prototypeId, generating, conversation]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [resetIdleTimer]);

  const messages = conversation?.messages || [];
  const showGeneratePrompt =
    !conversation?.emailCaptured && messages.length >= 4 && !showEmailForm && !generating && !prototypeId && !idleNudge;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialInput.trim()) return;
    try {
      const res = await startMutation.mutateAsync({
        data: { source: "web", referrerUrl: window.location.href },
        request: { credentials: "include" },
      } as Parameters<typeof startMutation.mutateAsync>[0]);
      localStorage.setItem(SESSION_KEY, res.sessionId);
      setSessionId(res.sessionId);
      await sendMessage(initialInput, res.sessionId);
    } catch {
      toast({ title: "Failed to connect", description: "Please try again later.", variant: "destructive" });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    setSuggestions([]);
    resetIdleTimer();
    await sendMessage(text);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isStreaming) return;
    setSuggestions([]);
    resetIdleTimer();
    await sendMessage(suggestion);
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    if (!email || !sessionId) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIdleNudge(false);
    setGenerating(true);
    try {
      const res = await captureMutation.mutateAsync({
        sessionId,
        data: { email },
        request: { credentials: "include" },
      } as Parameters<typeof captureMutation.mutateAsync>[0]);
      if (res.prototypeId) {
        setPrototypeId(res.prototypeId);
      } else {
        toast({ title: "Email saved", description: "We will be in touch shortly!" });
      }
    } catch {
      toast({ title: "Error securing concept", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,11,0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(30,58,138,0.15),transparent_60%)]" />

        <div className="relative z-10 w-full max-w-2xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="w-16 h-16 mx-auto mb-8 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-9 h-9" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>

            <Badge className="mb-6 bg-primary/15 text-primary border border-primary/30 uppercase tracking-widest text-[10px] py-1 px-3 font-bold">
              SRP Pre-Sales Engine
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-5 leading-[1.1]">
              Turn your idea into a{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-200">
                visual concept
              </span>
            </h1>

            <p className="text-base text-white/50 mb-10 max-w-lg mx-auto leading-relaxed">
              Two quick questions. Then we generate a clickable prototype — just for you.
            </p>

            <form onSubmit={handleStart} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
              <Input
                value={initialInput}
                onChange={(e) => setInitialInput(e.target.value)}
                placeholder="I want to build an app that..."
                className="h-14 text-base bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-primary focus-visible:border-primary/50 rounded-xl px-5"
              />
              <Button
                type="submit"
                size="lg"
                disabled={startMutation.isPending || !initialInput.trim()}
                className="h-14 px-7 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shrink-0 shadow-xl shadow-amber-500/20 transition-all hover:-translate-y-0.5"
              >
                {startMutation.isPending ? "Starting..." : "Start"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>

            <p className="mt-6 text-xs text-white/25 tracking-wide">No sign-up required · Results in ~60 seconds</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Split chat + preview layout ───────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">

      {/* ── LEFT: Chat sidebar ─────────────────────────────────────────── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-white/8 bg-[#0d1224] h-full">

        {/* Chat header */}
        <div className="shrink-0 h-14 border-b border-white/8 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="SRP" className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white leading-none">SRP Advisor</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">AI Strategist</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { localStorage.removeItem(SESSION_KEY); setSessionId(null); }}
            className="text-[11px] text-white/30 hover:text-white/60 transition-colors font-medium"
          >
            New chat
          </button>
        </div>

        {/* Messages */}
        <ScrollArea
          className="flex-1 overflow-y-auto"
          onMouseMove={resetIdleTimer}
          onKeyDown={resetIdleTimer}
        >
          <div className="p-4 space-y-4 pb-6">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} compact />
            ))}
            {isStreaming && (
              <ChatBubble message={{ id: "stream", role: "assistant", content: streamedText }} isStreaming compact />
            )}
            <div ref={scrollRef} className="h-1" />
          </div>
        </ScrollArea>

        {/* Footer: input / email / done states */}
        <div className="shrink-0 border-t border-white/8 p-3">
          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 flex flex-col items-center text-center"
              >
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                <p className="text-sm font-semibold text-white">Building your concept…</p>
                <p className="text-xs text-white/40 mt-1">Takes about a minute</p>
              </motion.div>

            ) : prototypeId ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-4 flex flex-col items-center text-center"
              >
                <div className="w-9 h-9 bg-green-500/15 text-green-400 border border-green-500/25 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-white mb-1">Concept ready!</p>
                <p className="text-[11px] text-white/40 mb-3">Previewing on the right →</p>
                <a
                  href={`/preview/${prototypeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Open full page <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>

            ) : showEmailForm || idleNudge ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="bg-white/4 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("p-2 rounded-lg border", idleNudge ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-primary/10 border-primary/20 text-primary")}>
                    {idleNudge ? <Clock className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">
                      {idleNudge ? "Still thinking?" : "Ready to generate?"}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">Enter your email to unlock the prototype</p>
                  </div>
                </div>
                <form onSubmit={handleEmailSubmit} className="space-y-2">
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    className="h-10 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-primary rounded-lg"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg text-sm"
                    disabled={captureMutation.isPending}
                  >
                    {captureMutation.isPending ? "Generating…" : "Generate My Concept"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => { setShowEmailForm(false); setIdleNudge(false); resetIdleTimer(); }}
                  className="mt-2 text-[11px] text-white/30 hover:text-white/60 transition-colors w-full text-center"
                >
                  Not now
                </button>
              </motion.div>

            ) : (
              <motion.div key="chat-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {showGeneratePrompt && (
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(true)}
                    className="w-full mb-2 py-2.5 rounded-xl text-xs font-bold text-primary border border-primary/30 bg-primary/8 hover:bg-primary/15 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate my concept now
                  </button>
                )}

                <AnimatePresence>
                  {suggestions.length > 0 && !isStreaming && (
                    <motion.div
                      key="chips"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex flex-wrap gap-1.5 mb-2"
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-primary/35 bg-primary/8 text-primary hover:bg-primary/18 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form
                  onSubmit={handleSend}
                  className="flex items-end gap-2 bg-white/4 border border-white/10 rounded-xl p-2 focus-within:border-primary/40 transition-all"
                >
                  <Textarea
                    value={input}
                    onChange={(e) => { setInput(e.target.value); resetIdleTimer(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Type your message…"
                    className="min-h-[40px] max-h-28 resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none px-2 py-1.5 text-sm text-white placeholder:text-white/25"
                    disabled={isStreaming}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isStreaming}
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-lg transition-all mb-0.5",
                      input.trim()
                        ? "bg-primary text-black shadow-lg hover:-translate-y-0.5"
                        : "bg-white/8 text-white/30"
                    )}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>

                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <Lock className="w-2.5 h-2.5 text-white/20" />
                  <p className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">Secure & Confidential</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT: Live preview panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#070b18]">

        {/* Preview toolbar */}
        <div className="shrink-0 h-14 border-b border-white/8 flex items-center justify-between px-5 bg-[#0a0f1e]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              prototypeId ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : generating ? "bg-amber-400 animate-pulse" : "bg-white/20"
            )} />
            <span className="text-[13px] font-semibold text-white/70">
              {prototypeId ? "Live Prototype Preview" : generating ? "Generating concept…" : "Preview will appear here"}
            </span>
          </div>
          {prototypeId && (
            <div className="flex items-center gap-2">
              <a
                href={`/preview/${prototypeId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
              >
                <ExternalLink className="w-3 h-3" /> Full page
              </a>
            </div>
          )}
        </div>

        {/* Preview content */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div
                key="gen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-primary/15 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h3 className="mt-8 text-xl font-bold text-white">Crafting your concept</h3>
                <p className="mt-2 text-sm text-white/40 max-w-sm text-center">
                  Analyzing your requirements and generating a tailored visual prototype…
                </p>
                <div className="mt-6 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </motion.div>

            ) : prototypeId && prototypeData?.htmlContent ? (
              <motion.div
                key="prototype"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-white"
              >
                <iframe
                  srcDoc={prototypeData.htmlContent}
                  className="w-full h-full border-0"
                  title="Prototype Preview"
                  sandbox="allow-scripts allow-forms"
                />
              </motion.div>

            ) : prototypeId && !prototypeData?.htmlContent ? (
              <motion.div
                key="loading-proto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <RefreshCw className="w-8 h-8 text-white/20 animate-spin mb-4" />
                <p className="text-white/40 text-sm">Loading prototype…</p>
              </motion.div>

            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center px-8"
              >
                {/* Faint grid background */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                  backgroundSize: "40px 40px"
                }} />

                {/* Preview teaser */}
                <div className="relative z-10 max-w-md text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/5">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Your concept preview</h2>
                  <p className="text-sm text-white/35 leading-relaxed mb-8">
                    Answer the questions on the left, then enter your email. A clickable prototype or technical summary will appear here — instantly generated for your specific idea.
                  </p>

                  {/* Mock browser chrome */}
                  <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden shadow-2xl">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/8 bg-white/2">
                      <div className="w-2 h-2 rounded-full bg-red-500/40" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                      <div className="w-2 h-2 rounded-full bg-green-500/40" />
                      <div className="flex-1 mx-2 h-4 bg-white/5 rounded-sm" />
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="h-6 bg-white/5 rounded w-2/3" />
                      <div className="h-4 bg-white/3 rounded w-full" />
                      <div className="h-4 bg-white/3 rounded w-5/6" />
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-16 bg-white/4 rounded-lg border border-white/5" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
