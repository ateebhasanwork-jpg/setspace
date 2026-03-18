import React, { useState, useEffect, useRef } from "react";
import { useListMessages, useCreateMessage, getListMessagesQueryKey, useGetCurrentUser, type Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, CornerDownRight, X } from "lucide-react";
import { playMessageSound } from "@/lib/sounds";

type LocalMessage = Message & { _optimistic?: boolean };

function MessageBubble({
  msg,
  isMe,
  showAvatar,
  onReply,
}: {
  msg: LocalMessage;
  isMe: boolean;
  showAvatar: boolean;
  onReply: (msg: LocalMessage) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isOptimistic = msg._optimistic;

  return (
    <div
      className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${isOptimistic ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isMe && showAvatar && (
        <span className="text-xs font-semibold text-muted-foreground mb-1 ml-11">
          {msg.author?.firstName} {msg.author?.lastName}
        </span>
      )}
      <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
        {!isMe && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${showAvatar ? "bg-white/15" : "opacity-0"}`}>
            {msg.author?.firstName?.[0]}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className={`p-4 rounded-2xl ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white/10 text-foreground border border-white/5 rounded-bl-sm"}`}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            <span className={`text-[10px] block mt-2 text-right ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {!isOptimistic && (
            <button
              onClick={() => onReply(msg)}
              className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity ${hovered ? "opacity-100" : "opacity-0"} ${isMe ? "self-end" : "self-start ml-1"}`}
            >
              <CornerDownRight className="w-3 h-3" /> Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamChat() {
  const { data: messages } = useListMessages(undefined, {
    query: { queryKey: getListMessagesQueryKey(), refetchInterval: 3000 }
  });
  const { data: user } = useGetCurrentUser();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (!messages || !user) return;
    const real = (messages as LocalMessage[]).filter(m => !m._optimistic);
    if (!real.length) return;
    const latest = real[real.length - 1];
    if (isInitialRef.current) {
      lastSeenIdRef.current = latest.id;
      isInitialRef.current = false;
      return;
    }
    if (lastSeenIdRef.current === null || latest.id > lastSeenIdRef.current) {
      const newFromOthers = real.filter(
        m => m.id > (lastSeenIdRef.current ?? 0) && m.authorId !== user.id
      );
      if (newFromOthers.length > 0) playMessageSound();
      lastSeenIdRef.current = latest.id;
    }
  }, [messages, user]);

  const mut = useCreateMessage({
    mutation: {
      onMutate: async ({ data }) => {
        await queryClient.cancelQueries({ queryKey: getListMessagesQueryKey() });
        const previous = queryClient.getQueryData(getListMessagesQueryKey());
        queryClient.setQueryData(getListMessagesQueryKey(), (old: LocalMessage[] | undefined) => {
          const optimistic: LocalMessage = {
            id: -Date.now(),
            content: data.content,
            authorId: user?.id ?? "",
            parentId: (data.parentId as number | undefined) ?? null,
            createdAt: new Date().toISOString(),
            _optimistic: true,
          };
          return old ? [...old, optimistic] : [optimistic];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        return { previous };
      },
      onError: (_err, _vars, ctx: { previous: unknown } | undefined) => {
        queryClient.setQueryData(getListMessagesQueryKey(), ctx?.previous);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      },
      onSettled: () => {
        setContent("");
        setReplyTo(null);
        inputRef.current?.focus();
      },
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const sendMessage = () => {
    const trimmed = content.trim();
    if (!trimmed || mut.isPending) return;
    setContent("");
    mut.mutate({ data: { content: trimmed, parentId: replyTo?.id ?? undefined } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const allMessages = (messages as LocalMessage[] | undefined)?.slice().sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) ?? [];

  const topLevel = allMessages.filter(m => !m.parentId);
  const repliesById: Record<number, LocalMessage[]> = {};
  for (const m of allMessages) {
    if (m.parentId) {
      if (!repliesById[m.parentId]) repliesById[m.parentId] = [];
      repliesById[m.parentId].push(m);
    }
  }

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
          {topLevel.map((msg, i, arr) => {
            const isMe = msg.authorId === user?.id;
            const prevMsg = arr[i - 1];
            const showAvatar = !isMe && prevMsg?.authorId !== msg.authorId;
            const replies = repliesById[msg.id] ?? [];

            return (
              <div key={msg.id}>
                <MessageBubble
                  msg={msg}
                  isMe={isMe}
                  showAvatar={showAvatar}
                  onReply={setReplyTo}
                />
                {replies.length > 0 && (
                  <div className="ml-10 mt-2 pl-4 border-l-2 border-white/10 space-y-3">
                    {replies.map(reply => {
                      const replyIsMe = reply.authorId === user?.id;
                      return (
                        <div key={reply.id} className={`flex flex-col ${replyIsMe ? "items-end" : "items-start"} ${reply._optimistic ? "opacity-60" : ""}`}>
                          {!replyIsMe && (
                            <span className="text-[11px] font-semibold text-muted-foreground mb-1">
                              {reply.author?.firstName} {reply.author?.lastName}
                            </span>
                          )}
                          <div className={`p-3 rounded-xl text-sm max-w-[85%] ${replyIsMe ? "bg-primary/80 text-primary-foreground" : "bg-white/8 text-foreground border border-white/5"}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                            <span className={`text-[10px] block mt-1 text-right ${replyIsMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {new Date(reply.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {replyTo && (
          <div className="px-4 pt-3 flex items-center gap-3 bg-black/20 border-t border-white/5 text-sm text-muted-foreground">
            <CornerDownRight className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate flex-1">
              Replying to: <span className="text-foreground">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="shrink-0 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-4 bg-black/20 border-t border-white/5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              ref={inputRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyTo ? "Write a reply…" : "Type a message…"}
              className="flex-1 bg-card/50 border-white/10 focus-visible:ring-primary h-12 rounded-xl"
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={!content.trim()}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0 p-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
