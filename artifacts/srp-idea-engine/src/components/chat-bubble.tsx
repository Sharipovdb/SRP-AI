import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Hexagon } from "lucide-react";
import type { ConversationMessage } from "@workspace/api-client-react";

interface ChatBubbleProps {
  message: Partial<ConversationMessage>;
  isStreaming?: boolean;
  compact?: boolean;
}

export function ChatBubble({ message, isStreaming = false, compact = false }: ChatBubbleProps) {
  const isAI = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: compact ? 8 : 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={cn("flex w-full", compact ? "gap-2" : "gap-4", isAI ? "justify-start" : "justify-end")}
    >
      {isAI && (
        <div className={cn(
          "rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shrink-0 shadow-inner shadow-primary/10",
          compact ? "w-6 h-6 mt-0.5" : "w-10 h-10 mt-1 rounded-xl"
        )}>
          <Hexagon className={cn("text-primary", compact ? "w-3 h-3" : "w-5 h-5")} fill="currentColor" fillOpacity={0.2} />
        </div>
      )}

      <div className={cn(
        "rounded-2xl relative overflow-hidden group",
        compact ? "max-w-[88%] p-3 text-sm shadow-sm" : "max-w-[85%] sm:max-w-[75%] p-5 shadow-lg",
        isAI
          ? cn("border text-card-foreground rounded-tl-sm", compact ? "bg-white/6 border-white/10" : "bg-card border-border shadow-black/40")
          : cn("rounded-tr-sm", compact ? "bg-primary/90 text-black shadow-primary/10" : "bg-primary text-primary-foreground shadow-primary/20")
      )}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className={cn(
          "prose max-w-none prose-p:leading-relaxed prose-pre:my-0",
          compact ? "prose-xs" : "prose-sm md:prose-base",
          isAI
            ? compact
              ? "prose-invert prose-p:text-white/75 prose-strong:text-primary"
              : "prose-invert prose-p:text-foreground/90 prose-strong:text-primary"
            : compact
              ? "prose-p:text-black prose-strong:text-black"
              : "prose-p:text-primary-foreground prose-strong:text-white"
        )}>
          <ReactMarkdown>{message.content || ""}</ReactMarkdown>
        </div>

        {isStreaming && (
          <div className={cn("flex gap-1.5 items-center", compact ? "mt-1.5 h-3" : "mt-3 h-4")}>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className={cn("rounded-full bg-primary animate-bounce", compact ? "w-1 h-1" : "w-1.5 h-1.5")}
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
