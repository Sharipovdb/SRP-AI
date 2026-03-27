import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Hexagon } from "lucide-react";
import type { ConversationMessage } from "@workspace/api-client-react";

interface ChatBubbleProps {
  message: Partial<ConversationMessage>;
  isStreaming?: boolean;
}

export function ChatBubble({ message, isStreaming = false }: ChatBubbleProps) {
  const isAI = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "flex w-full gap-4",
        isAI ? "justify-start" : "justify-end"
      )}
    >
      {isAI && (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shrink-0 mt-1 shadow-inner shadow-primary/20">
          <Hexagon className="w-5 h-5 text-primary" fill="currentColor" fillOpacity={0.2} />
        </div>
      )}
      <div className={cn(
        "max-w-[85%] sm:max-w-[75%] rounded-2xl p-5 shadow-lg relative overflow-hidden group",
        isAI
          ? "bg-card border border-border text-card-foreground rounded-tl-sm shadow-black/40"
          : "bg-primary text-primary-foreground rounded-tr-sm shadow-primary/20"
      )}>
        {/* Subtle glass reflection effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <div className={cn(
          "prose prose-sm md:prose-base max-w-none prose-p:leading-relaxed prose-pre:my-0",
          isAI ? "prose-invert prose-p:text-foreground/90 prose-strong:text-primary" : "prose-p:text-primary-foreground prose-strong:text-white"
        )}>
          <ReactMarkdown>{message.content || ""}</ReactMarkdown>
        </div>
        
        {isStreaming && (
          <div className="mt-3 flex gap-1.5 items-center h-4">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
