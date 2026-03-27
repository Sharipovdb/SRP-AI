import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetConversationQueryKey, ConversationWithMessages } from "@workspace/api-client-react";

export function useChatStream(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return;
    
    setIsStreaming(true);
    setStreamedText("");

    try {
      // Optimistically add the user's message to the cache
      const queryKey = getGetConversationQueryKey(sessionId);
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
                createdAt: new Date().toISOString() 
              }
            ]
          };
        }
      );

      const res = await fetch(`/api/conversations/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to send message via stream");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = "";
      let buffer = "";

      // Process SSE stream robustly
      while (reader && !done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
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
                } else if (data.content) {
                  fullText += data.content;
                  setStreamedText(fullText);
                }
              } catch (e) {
                // Ignore incomplete JSON chunks silently
              }
            }
          }
        }
      }

      // Invalidate the cache to fetch the real DB messages (user + assistant)
      await queryClient.invalidateQueries({ queryKey });

    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsStreaming(false);
      setStreamedText("");
    }
  }, [sessionId, queryClient]);

  return { sendMessage, isStreaming, streamedText };
}
