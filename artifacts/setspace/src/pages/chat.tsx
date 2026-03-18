import React, { useState, useEffect, useRef } from "react";
import { useListMessages, useCreateMessage, getListMessagesQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";

export default function TeamChat() {
  const { data: messages } = useListMessages();
  const { data: user } = useGetCurrentUser();
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const mut = useCreateMessage({
    mutation: {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  });

  useEffect(() => {
    // Auto scroll to bottom initially
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    mut.mutate({ data: { content } });
  };

  return (
    <div className="h-full flex flex-col pt-2 pb-6">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary" /> Team Channel
        </h1>
        <p className="text-muted-foreground mt-1">General discussion and quick updates.</p>
      </div>

      <Card className="glass-panel flex-1 flex flex-col min-h-0 overflow-hidden shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages?.slice().reverse().map((msg, i, arr) => {
            const isMe = msg.authorId === user?.id;
            const prevMsg = arr[i - 1];
            const showAvatar = !isMe && prevMsg?.authorId !== msg.authorId;

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && showAvatar && (
                  <span className="text-xs font-semibold text-muted-foreground mb-1 ml-11">{msg.author?.firstName} {msg.author?.lastName}</span>
                )}
                <div className="flex items-end gap-2 max-w-[75%]">
                  {!isMe && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${showAvatar ? 'bg-gradient-to-br from-primary to-accent' : 'opacity-0'}`}>
                      {msg.author?.firstName?.[0]}
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white/10 text-foreground border border-white/5 rounded-bl-sm'}`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <span className={`text-[10px] block mt-2 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 bg-black/20 border-t border-white/5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input 
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="Type a message..." 
              className="flex-1 bg-card/50 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
            />
            <Button type="submit" disabled={mut.isPending || !content.trim()} className="h-12 w-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 shrink-0 p-0">
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
