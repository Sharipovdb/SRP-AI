import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetConversationQueryKey, ConversationWithMessages } from "@workspace/api-client-react";

export function useChatStream(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string, sessionIdOverride?: string) => {
    const activeSessionId = sessionIdOverride ?? sessionId;
    if (!activeSessionId) return;

    setIsStreaming(true);
    setStreamedText("");
    setSuggestions([]);

    try {
      const queryKey = getGetConversationQueryKey(activeSessionId);
      queryClient.setQueryData<ConversationWithMessages | undefined>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [
              ...(old.messages || []),
              {
                id: `temp-${Date.now()}`,
                role: "user",
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }
      );

      const res = await fetch(`/api/conversations/${activeSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to send message via stream");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = "";
      let buffer = "";

      while (reader && !done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.done) {
                  done = true;
                  if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                    setSuggestions(data.suggestions);
                  }
                } else if (data.content) {
                  fullText += data.content;
                  const displayText = fullText
                    .replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/gi, "")
                    .replace(/<SUGGESTIONS>[\s\S]*/gi, "")
                    .trimEnd();
                  setStreamedText(displayText);
                }
              } catch {
              }
            }
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsStreaming(false);
      setStreamedText("");
    }
  }, [sessionId, queryClient]);

  return { sendMessage, isStreaming, streamedText, suggestions, setSuggestions };
}
