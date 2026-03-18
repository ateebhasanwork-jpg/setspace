import React, { useState, useEffect, useRef } from "react";
import { useListMessages, useCreateMessage, getListMessagesQueryKey, useGetCurrentUser, useListUsers, type Message, type User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, CornerDownRight, X, Hash, User as UserIcon } from "lucide-react";
import { playMessageSound } from "@/lib/sounds";

type LocalMessage = Message & { _optimistic?: boolean };

interface DM {
  id: number;
  content: string;
  senderId: string;
  receiverId: string;
  isRead: boolean;
  createdAt: string;
  sender?: User | null;
  receiver?: User | null;
  _optimistic?: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function MessageBubble({ msg, isMe, showAvatar, onReply }: { msg: LocalMessage; isMe: boolean; showAvatar: boolean; onReply: (msg: LocalMessage) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${msg._optimistic ? "opacity-60" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {!isMe && showAvatar && <span className="text-xs font-semibold text-muted-foreground mb-1 ml-11">{msg.author?.firstName} {msg.author?.lastName}</span>}
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
          {!msg._optimistic && (
            <button onClick={() => onReply(msg)} className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity ${hovered ? "opacity-100" : "opacity-0"} ${isMe ? "self-end" : "self-start ml-1"}`}>
              <CornerDownRight className="w-3 h-3" /> Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DMBubble({ msg, isMe }: { msg: DM; isMe: boolean }) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${msg._optimistic ? "opacity-60" : ""}`}>
      <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
        {!isMe && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-white/15">
            {msg.sender?.firstName?.[0]}
          </div>
        )}
        <div className={`p-4 rounded-2xl ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white/10 text-foreground border border-white/5 rounded-bl-sm"}`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <span className={`text-[10px] block mt-2 text-right ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupChat({ user }: { user: User }) {
  const { data: messages } = useListMessages(undefined, { query: { queryKey: getListMessagesQueryKey(), refetchInterval: 3000 } });
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (!messages) return;
    const real = (messages as LocalMessage[]).filter(m => !m._optimistic);
    if (!real.length) return;
    const latest = real[real.length - 1];
    if (isInitialRef.current) { lastSeenIdRef.current = latest.id; isInitialRef.current = false; return; }
    if (lastSeenIdRef.current === null || latest.id > lastSeenIdRef.current) {
      const newFromOthers = real.filter(m => m.id > (lastSeenIdRef.current ?? 0) && m.authorId !== user.id);
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
          const optimistic: LocalMessage = { id: -Date.now(), content: data.content, authorId: user.id, parentId: (data.parentId as number | undefined) ?? null, createdAt: new Date().toISOString(), _optimistic: true };
          return old ? [...old, optimistic] : [optimistic];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        return { previous };
      },
      onError: (_err, _vars, ctx: { previous: unknown } | undefined) => queryClient.setQueryData(getListMessagesQueryKey(), ctx?.previous),
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() }); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); },
      onSettled: () => { setContent(""); setReplyTo(null); inputRef.current?.focus(); },
    }
  });

  useEffect(() => { bottomRef.current?.scrollIntoView(); }, []);

  const allMessages = (messages as LocalMessage[] | undefined)?.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) ?? [];
  const topLevel = allMessages.filter(m => !m.parentId);
  const repliesById: Record<number, LocalMessage[]> = {};
  for (const m of allMessages) { if (m.parentId) { if (!repliesById[m.parentId]) repliesById[m.parentId] = []; repliesById[m.parentId].push(m); } }

  const send = () => {
    const trimmed = content.trim();
    if (!trimmed || mut.isPending) return;
    setContent("");
    mut.mutate({ data: { content: trimmed, parentId: replyTo?.id ?? undefined } });
  };

  return (
    <Card className="glass-panel flex-1 flex flex-col min-h-0 overflow-hidden shadow-2xl">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {topLevel.map((msg, i, arr) => {
          const isMe = msg.authorId === user.id;
          const prevMsg = arr[i - 1];
          const showAvatar = !isMe && prevMsg?.authorId !== msg.authorId;
          const replies = repliesById[msg.id] ?? [];
          return (
            <div key={msg.id}>
              <MessageBubble msg={msg} isMe={isMe} showAvatar={showAvatar} onReply={setReplyTo} />
              {replies.length > 0 && (
                <div className="ml-10 mt-2 pl-4 border-l-2 border-white/10 space-y-3">
                  {replies.map(reply => {
                    const replyIsMe = reply.authorId === user.id;
                    return (
                      <div key={reply.id} className={`flex flex-col ${replyIsMe ? "items-end" : "items-start"} ${reply._optimistic ? "opacity-60" : ""}`}>
                        {!replyIsMe && <span className="text-[11px] font-semibold text-muted-foreground mb-1">{reply.author?.firstName} {reply.author?.lastName}</span>}
                        <div className={`p-3 rounded-xl text-sm max-w-[85%] ${replyIsMe ? "bg-primary/80 text-primary-foreground" : "bg-white/8 text-foreground border border-white/5"}`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                          <span className={`text-[10px] block mt-1 text-right ${replyIsMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(reply.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
          <span className="truncate flex-1">Replying to: <span className="text-foreground">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}</span></span>
          <button onClick={() => setReplyTo(null)} className="shrink-0 hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="p-4 bg-black/20 border-t border-white/5">
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-3">
          <Input ref={inputRef} value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={replyTo ? "Write a reply…" : "Type a message…"} className="flex-1 bg-card/50 border-white/10 focus-visible:ring-primary h-12 rounded-xl" autoComplete="off" />
          <Button type="submit" disabled={!content.trim()} className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0 p-0"><Send className="w-5 h-5" /></Button>
        </form>
      </div>
    </Card>
  );
}

function DMConversation({ otherUser, me }: { otherUser: User; me: User }) {
  const [dms, setDms] = useState<DM[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);

  const fetchDMs = async () => {
    try {
      const res = await fetch(`${BASE}/api/dm/${otherUser.id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as DM[];
      setDms(prev => {
        if (isInitialRef.current) {
          isInitialRef.current = false;
          if (data.length) lastSeenIdRef.current = data[data.length - 1].id;
          return data;
        }
        const newFromOther = data.filter(m => m.senderId === otherUser.id && m.id > (lastSeenIdRef.current ?? 0));
        if (newFromOther.length > 0) { playMessageSound(); }
        if (data.length) lastSeenIdRef.current = data[data.length - 1].id;
        return data;
      });
    } catch {}
  };

  useEffect(() => {
    isInitialRef.current = true;
    setDms([]);
    fetchDMs();
    const id = setInterval(fetchDMs, 3000);
    return () => clearInterval(id);
  }, [otherUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView(); }, [otherUser.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dms.length]);

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setContent("");
    setSending(true);
    const optimistic: DM = { id: -Date.now(), content: trimmed, senderId: me.id, receiverId: otherUser.id, isRead: false, createdAt: new Date().toISOString(), sender: me, receiver: otherUser, _optimistic: true };
    setDms(prev => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    try {
      const res = await fetch(`${BASE}/api/dm/${otherUser.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: trimmed }), credentials: "include" });
      if (res.ok) { await fetchDMs(); }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <Card className="glass-panel flex-1 flex flex-col min-h-0 overflow-hidden shadow-2xl">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {dms.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <UserIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Start a private conversation with {otherUser.firstName}</p>
          </div>
        )}
        {dms.map(msg => <DMBubble key={msg.id} msg={msg} isMe={msg.senderId === me.id} />)}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 bg-black/20 border-t border-white/5">
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-3">
          <Input ref={inputRef} value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Message ${otherUser.firstName}…`} className="flex-1 bg-card/50 border-white/10 focus-visible:ring-primary h-12 rounded-xl" autoComplete="off" />
          <Button type="submit" disabled={!content.trim() || sending} className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0 p-0"><Send className="w-5 h-5" /></Button>
        </form>
      </div>
    </Card>
  );
}

export default function TeamChat() {
  const { data: user } = useGetCurrentUser();
  const { data: users } = useListUsers();
  const [view, setView] = useState<"group" | string>("group");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${BASE}/api/dm-unread`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { bySender: Record<string, number> };
        setUnreadByUser(data.bySender);
      } catch {}
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 4000);
    return () => clearInterval(id);
  }, []);

  const otherUsers = (users ?? []).filter(u => u.id !== user?.id);
  const currentDMUser = view !== "group" ? otherUsers.find(u => u.id === view) : null;

  return (
    <div className="h-full flex gap-6 pt-2 pb-6 min-h-0">
      {/* Sidebar */}
      <div className="w-56 shrink-0 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">Channels</p>
        <button
          onClick={() => setView("group")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${view === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
        >
          <Hash className="w-4 h-4 shrink-0" /> Team Channel
        </button>

        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mt-4 mb-2">Direct Messages</p>
        {otherUsers.map(u => {
          const unread = unreadByUser[u.id] ?? 0;
          const isActive = view === u.id;
          return (
            <button
              key={u.id}
              onClick={() => { setView(u.id); setUnreadByUser(prev => ({ ...prev, [u.id]: 0 })); }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">
                {u.firstName?.[0]}
              </div>
              <span className="truncate flex-1 text-left">{u.firstName} {u.lastName}</span>
              {unread > 0 && !isActive && (
                <span className="shrink-0 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            {view === "group" ? (
              <><MessageSquare className="w-6 h-6 text-primary" /> Team Channel</>
            ) : (
              <><UserIcon className="w-6 h-6 text-primary" /> {currentDMUser?.firstName} {currentDMUser?.lastName}</>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {view === "group" ? "General discussion and quick updates." : "Private conversation"}
          </p>
        </div>

        {user && view === "group" && <GroupChat user={user} />}
        {user && currentDMUser && <DMConversation key={currentDMUser.id} otherUser={currentDMUser} me={user} />}
      </div>
    </div>
  );
}
