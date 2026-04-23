import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  useListMessages,
  useCreateMessage,
  getListMessagesQueryKey,
  useGetCurrentUser,
  useListUsers,
  type Message,
  type User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Send,
  CornerDownRight,
  X,
  Hash,
  User as UserIcon,
  AtSign,
  SmilePlus,
  Paperclip,
  FileText,
  ImageIcon,
  Video,
  Mic,
  Square,
} from "lucide-react";
import { playMessageSound } from "@/lib/sounds";
import { getUserTextColor } from "@/lib/user-colors";

type ReactionGroup = { emoji: string; count: number; userIds: string[] };
type LocalMessage = Message & { _optimistic?: boolean; reactions?: ReactionGroup[] };

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "👏", "🎉", "😢"];

interface DM {
  id: number;
  content: string;
  senderId: string;
  receiverId: string;
  isRead: boolean;
  createdAt: string;
  sender?: User | null;
  receiver?: User | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reactions?: ReactionGroup[];
  _optimistic?: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const ZOOM_QUICK_MEETING_URL = "https://us05web.zoom.us/j/81984894883?pwd=yfzSWbj8RbIHi78wy9rjA0gSs7xJWY.1";

function resolveProfileImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `/api/storage/objects/${url.replace(/^\/objects\//, "")}`;
}

function resolveAttachmentUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${BASE}/api/storage/objects/${path.replace(/^\/objects\//, "")}`;
}

async function uploadFile(file: File): Promise<{ objectPath: string; name: string }> {
  const res = await fetch(`${BASE}/api/storage/upload`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return { objectPath: data.objectPath, name: file.name };
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg|bmp)$/i;
const AUDIO_EXTS = /\.(webm|ogg|mp4|m4a|wav|opus)$/i;

function AttachmentPreview({ url, name, isMe }: { url: string; name: string; isMe: boolean }) {
  const src = resolveAttachmentUrl(url);
  const isImage = IMAGE_EXTS.test(name);
  const isAudio = AUDIO_EXTS.test(name) || name.startsWith("voice-note");
  if (isImage) {
    return (
      <img
        src={src} alt={name}
        className="max-w-[240px] max-h-[200px] rounded-xl object-cover mt-2 cursor-pointer border border-white/10"
        onClick={() => window.open(src, "_blank")}
      />
    );
  }
  if (isAudio) {
    return (
      <div className={`mt-2 rounded-xl overflow-hidden border ${isMe ? "border-white/20" : "border-white/10"}`}>
        <audio controls src={src} className="w-full max-w-[260px] h-10" style={{ colorScheme: "dark" }} />
      </div>
    );
  }
  return (
    <a
      href={src} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
        isMe
          ? "border-white/30 text-white/80 hover:text-white hover:bg-white/10"
          : "border-white/15 text-foreground hover:bg-white/10"
      }`}
    >
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate max-w-[200px]">{name}</span>
    </a>
  );
}

/** Voice recorder hook */
function useVoiceRecorder(onRecorded: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ext = mimeType.includes("webm") ? "webm" : "ogg";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-note.${ext}`, { type: mimeType });
        onRecorded(file);
        setSeconds(0);
      };
      mr.start(200);
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied.");
    }
  }, [onRecorded]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }, []);

  return { recording, seconds, start, stop };
}

function formatRecordTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-[11px] font-medium text-muted-foreground/70 px-2 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

function Avatar({
  name,
  profileImage,
  size = "sm",
  visible = true,
}: {
  name?: string | null;
  profileImage?: string | null;
  size?: "sm" | "md";
  visible?: boolean;
}) {
  const photo = resolveProfileImage(profileImage);
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  if (!visible) return <div className={`${cls} rounded-full shrink-0 opacity-0`} />;
  if (photo)
    return (
      <img src={photo} alt="" className={`${cls} rounded-full object-cover border border-white/10 shrink-0`} />
    );
  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-indigo-600/40 border border-indigo-500/20`}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

/** Render @mentions as highlighted spans */
function MessageContent({
  content,
  users,
  currentUserId,
}: {
  content: string;
  users?: User[];
  currentUserId?: string;
}) {
  const parts = content.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@") && users) {
          const name = part.slice(1).toLowerCase();
          const matched = users.find(
            (u) =>
              (u.firstName ?? "").toLowerCase() === name ||
              (u.username ?? "").toLowerCase() === name ||
              `${(u.firstName ?? "").toLowerCase()}${(u.lastName ?? "").toLowerCase()}` === name
          );
          if (matched) {
            const isMe = matched.id === currentUserId;
            return (
              <span
                key={i}
                className={`font-semibold rounded-sm px-0.5 ${
                  isMe
                    ? "bg-indigo-500/30 text-indigo-200"
                    : "text-indigo-300"
                }`}
              >
                {part}
              </span>
            );
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/** Small quoted block shown at top of a reply bubble */
function QuotedReply({ parent, isMe }: { parent: LocalMessage; isMe: boolean }) {
  const author = parent.author as (typeof parent.author & { firstName?: string | null }) | undefined;
  return (
    <div
      className={`flex gap-2 mb-2 pb-2 border-b text-[11px] leading-snug ${
        isMe
          ? "border-white/20 text-white/60"
          : "border-indigo-500/30 text-muted-foreground"
      }`}
    >
      <div className={`w-0.5 rounded-full shrink-0 ${isMe ? "bg-white/40" : "bg-indigo-400"}`} />
      <div className="min-w-0">
        <span className={`font-semibold block ${isMe ? "text-white/80" : "text-indigo-300"}`}>
          {author?.firstName ?? "Unknown"}
        </span>
        <span className="line-clamp-2 opacity-80">
          {parent.content.length > 100 ? parent.content.slice(0, 100) + "…" : parent.content}
        </span>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isMe,
  showAvatar,
  onReply,
  onReact,
  parentMsg,
  users,
  currentUserId,
}: {
  msg: LocalMessage;
  isMe: boolean;
  showAvatar: boolean;
  onReply: (m: LocalMessage) => void;
  onReact: (msgId: number, emoji: string) => void;
  parentMsg?: LocalMessage | null;
  users?: User[];
  currentUserId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const author = msg.author as (typeof msg.author & { profileImage?: string | null }) | undefined;

  // Close picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const reactions = msg.reactions ?? [];

  return (
    <div
      className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${msg._optimistic ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
    >
      {!isMe && showAvatar && (
        <span className={`text-xs font-semibold mb-1 ml-11 ${getUserTextColor(msg.senderId)}`}>
          {author?.firstName} {author?.lastName}
        </span>
      )}
      <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
        {!isMe && (
          <Avatar
            name={author?.firstName}
            profileImage={author?.profileImage}
            visible={showAvatar}
          />
        )}
        <div className="flex flex-col gap-1">
          <div
            className={`p-4 rounded-2xl ${
              isMe
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-white/10 text-foreground border border-white/5 rounded-bl-sm"
            }`}
          >
            {/* Quoted reply preview */}
            {parentMsg && <QuotedReply parent={parentMsg} isMe={isMe} />}
            {msg.content && (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                <MessageContent content={msg.content} users={users} currentUserId={currentUserId} />
              </p>
            )}
            {msg.attachmentUrl && msg.attachmentName && (
              <AttachmentPreview url={msg.attachmentUrl} name={msg.attachmentName} isMe={isMe} />
            )}
            <span
              className={`text-[10px] block mt-2 text-right ${
                isMe ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Reaction pills */}
          {reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start ml-1"}`}>
              {reactions.map((r) => {
                const iReacted = currentUserId ? r.userIds.includes(currentUserId) : false;
                return (
                  <button
                    key={r.emoji}
                    onClick={() => onReact(msg.id, r.emoji)}
                    title={`${r.count} reaction${r.count !== 1 ? "s" : ""}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all ${
                      iReacted
                        ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200"
                        : "bg-white/8 border-white/10 text-foreground hover:bg-white/15"
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[11px] font-medium">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action bar: reply + react */}
          {!msg._optimistic && (
            <div className={`flex items-center gap-2 ${isMe ? "self-end" : "self-start ml-1"}`}>
              <button
                onClick={() => onReply(msg)}
                className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity ${
                  hovered ? "opacity-100" : "opacity-0"
                }`}
              >
                <CornerDownRight className="w-3 h-3" /> Reply
              </button>

              {/* Emoji picker trigger */}
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-indigo-400 transition-all ${
                    hovered || pickerOpen ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {pickerOpen && (
                  <div
                    className={`absolute z-50 bottom-full mb-1.5 bg-card border border-white/10 rounded-xl shadow-xl p-2 flex gap-1 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                  >
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          onReact(msg.id, e);
                          setPickerOpen(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DMBubble({
  msg,
  isMe,
  onReact,
  currentUserId,
}: {
  msg: DM;
  isMe: boolean;
  onReact: (dmId: number, emoji: string) => void;
  currentUserId: string;
}) {
  const sender = msg.sender as (typeof msg.sender & { profileImage?: string | null }) | undefined;
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const reactions = msg.reactions ?? [];

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  return (
    <div
      className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${msg._optimistic ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
        {!isMe && <Avatar name={sender?.firstName} profileImage={sender?.profileImage} />}
        <div className="flex flex-col gap-1">
          <div
            className={`p-4 rounded-2xl ${
              isMe
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-white/10 text-foreground border border-white/5 rounded-bl-sm"
            }`}
          >
            {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
            {msg.attachmentUrl && msg.attachmentName && (
              <AttachmentPreview url={msg.attachmentUrl} name={msg.attachmentName} isMe={isMe} />
            )}
            <span
              className={`text-[10px] block mt-2 text-right ${
                isMe ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Reaction pills */}
          {reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start ml-1"}`}>
              {reactions.map((r) => {
                const iReacted = r.userIds.includes(currentUserId);
                return (
                  <button
                    key={r.emoji}
                    onClick={() => onReact(msg.id, r.emoji)}
                    title={`${r.count} reaction${r.count !== 1 ? "s" : ""}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all ${
                      iReacted
                        ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200"
                        : "bg-white/8 border-white/10 text-foreground hover:bg-white/15"
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[11px] font-medium">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action bar: react */}
          {!msg._optimistic && (
            <div className={`flex items-center gap-2 ${isMe ? "self-end" : "self-start ml-1"}`}>
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-indigo-400 transition-all ${
                    hovered || pickerOpen ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {pickerOpen && (
                  <div
                    className={`absolute z-50 bottom-full mb-1.5 bg-card border border-white/10 rounded-xl shadow-xl p-2 flex gap-1 ${
                      isMe ? "right-0" : "left-0"
                    }`}
                  >
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          onReact(msg.id, e);
                          setPickerOpen(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** @mention autocomplete dropdown */
function MentionDropdown({
  query,
  users,
  currentUserId,
  onSelect,
}: {
  query: string;
  users: User[];
  currentUserId: string;
  onSelect: (u: User) => void;
}) {
  const filtered = users
    .filter(
      (u) =>
        u.id !== currentUserId &&
        (`${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(query.toLowerCase()) ||
          (u.username ?? "").toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 6);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
        <AtSign className="w-3 h-3 text-indigo-400" />
        <span className="text-[11px] text-muted-foreground font-medium">Mention someone</span>
      </div>
      {filtered.map((u) => (
        <button
          key={u.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(u);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-indigo-600/20 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-200 shrink-0">
            {u.firstName?.[0]}{u.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-foreground">{u.firstName} {u.lastName}</span>
            {u.title && <span className="text-[10px] text-muted-foreground block truncate">{u.title}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function GroupChat({ user, users }: { user: User; users: User[] }) {
  // SSE "messages" event in use-live-events.ts invalidates this query on every new message
  const { data: messages } = useListMessages(undefined, {
    query: { queryKey: getListMessagesQueryKey() },
  });
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);
  const sendRef = useRef<(f?: File) => void>(() => {});
  const voice = useVoiceRecorder((file) => { sendRef.current(file); });

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (!messages) return;
    const real = (messages as LocalMessage[]).filter((m) => !m._optimistic);
    if (!real.length) return;
    const latest = real[real.length - 1];
    if (isInitialRef.current) {
      lastSeenIdRef.current = latest.id;
      isInitialRef.current = false;
      // Delay so the browser has painted all message rows before we measure scrollHeight
      setTimeout(() => scrollToBottom(false), 60);
      return;
    }
    if (lastSeenIdRef.current === null || latest.id > lastSeenIdRef.current) {
      const newFromOthers = real.filter(
        (m) => m.id > (lastSeenIdRef.current ?? 0) && m.authorId !== user.id
      );
      if (newFromOthers.length > 0) {
        playMessageSound();
        if (isNearBottom()) scrollToBottom();
      }
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
            authorId: user.id,
            parentId: (data.parentId as number | undefined) ?? null,
            createdAt: new Date().toISOString(),
            _optimistic: true,
          };
          return old ? [...old, optimistic] : [optimistic];
        });
        setTimeout(() => scrollToBottom(), 30);
        return { previous };
      },
      onError: (_err, _vars, ctx: { previous: unknown } | undefined) =>
        queryClient.setQueryData(getListMessagesQueryKey(), ctx?.previous),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        setTimeout(() => scrollToBottom(), 100);
      },
      onSettled: () => {
        setContent("");
        if (inputRef.current) inputRef.current.style.height = "auto";
        setReplyTo(null);
        setMentionSearch(null);
        inputRef.current?.focus();
      },
    },
  });

  const allMessages =
    (messages as LocalMessage[] | undefined)
      ?.slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) ?? [];

  const messageMap = Object.fromEntries(allMessages.map((m) => [m.id, m]));
  const topLevel = allMessages.filter((m) => !m.parentId);
  const repliesById: Record<number, LocalMessage[]> = {};
  for (const m of allMessages) {
    if (m.parentId) {
      if (!repliesById[m.parentId]) repliesById[m.parentId] = [];
      repliesById[m.parentId].push(m);
    }
  }

  const send = async (fileArg?: File) => {
    sendRef.current = send;
    const trimmed = content.trim();
    const fileToSend = fileArg ?? pendingFile;
    if ((!trimmed && !fileToSend) || mut.isPending || uploading) return;
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (fileToSend) {
      setUploading(true);
      try {
        const result = await uploadFile(fileToSend);
        attachmentUrl = result.objectPath;
        attachmentName = result.name;
      } catch {
        setUploading(false);
        return;
      }
      setUploading(false);
      if (!fileArg) setPendingFile(null);
      else setPendingFile(null);
    }
    setContent("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMentionSearch(null);
    mut.mutate({ data: { content: trimmed, parentId: replyTo?.id ?? undefined, attachmentUrl, attachmentName } as Parameters<typeof mut.mutate>[0]["data"] });
  };

  const handleContentChange = useCallback(
    (val: string) => {
      setContent(val);
      // Detect @mention: find the last @ not preceded by a non-space, with no space after it
      const lastAt = val.lastIndexOf("@");
      if (lastAt !== -1 && !val.slice(lastAt).includes(" ")) {
        setMentionSearch(val.slice(lastAt + 1));
      } else {
        setMentionSearch(null);
      }
    },
    []
  );

  const selectMention = useCallback(
    (u: User) => {
      const lastAt = content.lastIndexOf("@");
      const before = content.slice(0, lastAt);
      setContent(`${before}@${u.firstName} `);
      setMentionSearch(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [content]
  );

  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    await fetch(`${BASE}/api/messages/${msgId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
      credentials: "include",
    });
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
  }, [queryClient]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {topLevel.map((msg, i, arr) => {
          const isMe = msg.authorId === user.id;
          const prevMsg = arr[i - 1];
          const showAvatar = !isMe && prevMsg?.authorId !== msg.authorId;
          const replies = repliesById[msg.id] ?? [];
          const msgDate = formatDateLabel(msg.createdAt);
          const prevDate = prevMsg ? formatDateLabel(prevMsg.createdAt) : null;
          const showDate = msgDate !== prevDate;
          return (
            <div key={msg.id}>
              {showDate && <DateSeparator label={msgDate} />}
              <MessageBubble
                msg={msg}
                isMe={isMe}
                showAvatar={showAvatar}
                onReply={setReplyTo}
                onReact={handleReact}
                users={users}
                currentUserId={user.id}
              />
              {replies.length > 0 && (
                <div className="ml-10 mt-2 pl-4 border-l-2 border-white/10 space-y-3">
                  {replies.map((reply) => {
                    const replyIsMe = reply.authorId === user.id;
                    const replyAuthor = reply.author as (typeof reply.author & { profileImage?: string | null }) | undefined;
                    return (
                      <div
                        key={reply.id}
                        className={`flex flex-col ${replyIsMe ? "items-end" : "items-start"} ${reply._optimistic ? "opacity-60" : ""}`}
                      >
                        {!replyIsMe && (
                          <span className="text-[11px] font-semibold text-muted-foreground mb-1">
                            {replyAuthor?.firstName} {replyAuthor?.lastName}
                          </span>
                        )}
                        <div
                          className={`p-3 rounded-xl text-sm max-w-[85%] ${
                            replyIsMe
                              ? "bg-primary/80 text-primary-foreground"
                              : "bg-white/8 text-foreground border border-white/5"
                          }`}
                        >
                          {/* Show quoted parent in each reply */}
                          {reply.parentId && messageMap[reply.parentId] && (
                            <QuotedReply
                              parent={messageMap[reply.parentId]}
                              isMe={replyIsMe}
                            />
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">
                            <MessageContent
                              content={reply.content}
                              users={users}
                              currentUserId={user.id}
                            />
                          </p>
                          <span
                            className={`text-[10px] block mt-1 text-right ${
                              replyIsMe ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(reply.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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

      {/* Reply banner */}
      {replyTo && (
        <div className="px-4 pt-3 pb-2 flex items-center gap-3 bg-black/20 border-t border-white/5 text-sm text-muted-foreground shrink-0">
          <CornerDownRight className="w-4 h-4 shrink-0 text-indigo-400" />
          <div className="flex-1 min-w-0">
            <span className="text-indigo-400 font-semibold text-xs">
              Replying to {(replyTo.author as User | undefined)?.firstName ?? "message"}
            </span>
            <p className="truncate text-xs text-foreground/70 mt-0.5">
              {replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? "…" : ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 bg-black/20 border-t border-white/5 shrink-0">
        <div className="relative">
          {/* Mention autocomplete */}
          {mentionSearch !== null && (
            <MentionDropdown
              query={mentionSearch}
              users={users}
              currentUserId={user.id}
              onSelect={selectMention}
            />
          )}
          {/* Recording indicator */}
          {voice.recording && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-red-400 text-xs font-medium">Recording {formatRecordTime(voice.seconds)}</span>
              <button onClick={voice.stop} className="ml-auto text-red-400 hover:text-red-300 flex items-center gap-1 text-xs">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>
          )}
          {/* Pending attachment preview */}
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-white/8 border border-white/10 text-sm">
              {IMAGE_EXTS.test(pendingFile.name)
                ? <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                : pendingFile.name.startsWith("voice-note")
                ? <Mic className="w-4 h-4 text-green-400 shrink-0" />
                : <FileText className="w-4 h-4 text-indigo-400 shrink-0" />}
              <span className="flex-1 truncate text-foreground text-xs">{pendingFile.name.startsWith("voice-note") ? "Voice note ready" : pendingFile.name}</span>
              <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={voice.recording}
              className="h-12 w-10 flex items-center justify-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors shrink-0 disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={voice.recording ? voice.stop : voice.start}
              disabled={uploading}
              className={`h-12 w-10 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                voice.recording
                  ? "border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "border-white/10 text-muted-foreground hover:text-green-400 hover:bg-white/8"
              }`}
              title={voice.recording ? "Stop recording" : "Record voice note"}
            >
              {voice.recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={content}
              rows={1}
              onChange={(e) => {
                handleContentChange(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && mentionSearch !== null) {
                  setMentionSearch(null);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey && mentionSearch === null) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={replyTo ? "Write a reply… (@ to mention)" : "Type a message… (@ to mention)"}
              className="flex-1 bg-card/50 border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl resize-none px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground leading-5"
              style={{ minHeight: "48px", maxHeight: "120px" }}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={(!content.trim() && !pendingFile) || uploading || voice.recording}
              className="h-12 w-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 p-0"
            >
              {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DMConversation({ otherUser, me }: { otherUser: User; me: User }) {
  const [dms, setDms] = useState<DM[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);
  const voice = useVoiceRecorder((file) => { dmSendRef.current(file); });

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  };

  const fetchDMs = async () => {
    try {
      const isInitial = isInitialRef.current;
      // On SSE updates (not the first load), only fetch messages newer than the last seen id
      const sinceId = isInitial ? null : lastSeenIdRef.current;
      const url = sinceId !== null
        ? `${BASE}/api/dm/${otherUser.id}?since=${sinceId}`
        : `${BASE}/api/dm/${otherUser.id}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as DM[];

      setDms((prev) => {
        if (isInitial) {
          isInitialRef.current = false;
          if (data.length) lastSeenIdRef.current = data[data.length - 1].id;
          setTimeout(() => scrollToBottom(false), 60);
          return data;
        }

        // Incremental update: data only contains truly new messages
        if (data.length === 0) return prev;

        const newFromOther = data.filter(m => m.senderId === otherUser.id);
        if (newFromOther.length > 0) {
          playMessageSound();
          if (isNearBottom()) scrollToBottom();
        }
        if (data.length) lastSeenIdRef.current = data[data.length - 1].id;

        // Append new messages, guard against duplicates from optimistic updates
        const existingIds = new Set(prev.filter(m => m.id > 0).map(m => m.id));
        const toAdd = data.filter(m => !existingIds.has(m.id));
        return toAdd.length > 0 ? [...prev.filter(m => m.id > 0 || m._optimistic), ...toAdd] : prev;
      });
    } catch {}
  };

  useEffect(() => {
    isInitialRef.current = true;
    setDms([]);
    fetchDMs();
    // SSE "dm" event triggers fetchDMs instantly — no polling needed
    const sseHandler = () => fetchDMs();
    window.addEventListener("sse:dm", sseHandler);
    return () => { window.removeEventListener("sse:dm", sseHandler); };
  }, [otherUser.id]);


  const dmSendRef = useRef<(f?: File) => void>(() => {});
  const send = async (fileArg?: File) => {
    dmSendRef.current = send;
    const trimmed = content.trim();
    const fileToSend = fileArg ?? pendingFile;
    if ((!trimmed && !fileToSend) || sending) return;

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let fileForOptimistic: File | null = fileToSend;

    if (fileToSend) {
      setSending(true);
      try {
        const result = await uploadFile(fileToSend);
        attachmentUrl = result.objectPath;
        attachmentName = result.name;
      } catch {
        setSending(false);
        return;
      }
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    setContent("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);
    const optimistic: DM = {
      id: -Date.now(),
      content: trimmed,
      senderId: me.id,
      receiverId: otherUser.id,
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: me,
      receiver: otherUser,
      attachmentUrl: attachmentUrl ?? null,
      attachmentName: attachmentName ?? fileForOptimistic?.name ?? null,
      _optimistic: true,
    };
    setDms((prev) => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(), 30);
    try {
      const res = await fetch(`${BASE}/api/dm/${otherUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, attachmentUrl, attachmentName }),
        credentials: "include",
      });
      if (res.ok) await fetchDMs();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleReact = async (dmId: number, emoji: string) => {
    // Optimistic update
    setDms(prev => prev.map(m => {
      if (m.id !== dmId) return m;
      const existing = (m.reactions ?? []).find(r => r.emoji === emoji);
      const alreadyReacted = existing?.userIds.includes(me.id);
      let newReactions: ReactionGroup[];
      if (alreadyReacted) {
        newReactions = (m.reactions ?? []).map(r =>
          r.emoji !== emoji ? r : { ...r, count: r.count - 1, userIds: r.userIds.filter(id => id !== me.id) }
        ).filter(r => r.count > 0);
      } else if (existing) {
        newReactions = (m.reactions ?? []).map(r =>
          r.emoji !== emoji ? r : { ...r, count: r.count + 1, userIds: [...r.userIds, me.id] }
        );
      } else {
        newReactions = [...(m.reactions ?? []), { emoji, count: 1, userIds: [me.id] }];
      }
      return { ...m, reactions: newReactions };
    }));
    await fetch(`${BASE}/api/dm-reactions/${dmId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
      credentials: "include",
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {dms.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <UserIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">
              Start a private conversation with {otherUser.firstName}
            </p>
          </div>
        )}
        {dms.map((msg, i, arr) => {
          const msgDate = formatDateLabel(msg.createdAt);
          const prevDate = i > 0 ? formatDateLabel(arr[i - 1].createdAt) : null;
          const showDate = msgDate !== prevDate;
          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateSeparator label={msgDate} />}
              <DMBubble msg={msg} isMe={msg.senderId === me.id} onReact={handleReact} currentUserId={me.id} />
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 bg-black/20 border-t border-white/5 shrink-0">
        {/* Recording indicator */}
        {voice.recording && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-red-400 text-xs font-medium">Recording {formatRecordTime(voice.seconds)}</span>
            <button onClick={voice.stop} className="ml-auto text-red-400 hover:text-red-300 flex items-center gap-1 text-xs">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          </div>
        )}
        {/* Pending attachment preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-white/8 border border-white/10 text-sm">
            {IMAGE_EXTS.test(pendingFile.name)
              ? <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
              : pendingFile.name.startsWith("voice-note")
              ? <Mic className="w-4 h-4 text-green-400 shrink-0" />
              : <FileText className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span className="flex-1 truncate text-foreground text-xs">{pendingFile.name.startsWith("voice-note") ? "Voice note ready" : pendingFile.name}</span>
            <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); }}
        />
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex gap-2"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={voice.recording}
            className="h-12 w-10 flex items-center justify-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors shrink-0 disabled:opacity-40"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={voice.recording ? voice.stop : voice.start}
            className={`h-12 w-10 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
              voice.recording
                ? "border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                : "border-white/10 text-muted-foreground hover:text-green-400 hover:bg-white/8"
            }`}
            title={voice.recording ? "Stop recording" : "Record voice note"}
          >
            {voice.recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <textarea
            ref={inputRef}
            value={content}
            rows={1}
            onChange={(e) => {
              setContent(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={`Message ${otherUser.firstName}…`}
            className="flex-1 bg-card/50 border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl resize-none px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground leading-5"
            style={{ minHeight: "48px", maxHeight: "120px" }}
            autoComplete="off"
          />
          <Button
            type="submit"
            disabled={(!content.trim() && !pendingFile) || sending || voice.recording}
            className="h-12 w-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 p-0"
          >
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function TeamChat() {
  const { data: user } = useGetCurrentUser();
  const { data: users } = useListUsers();
  const [view, setView] = useState<"group" | string>("group");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [groupUnread, setGroupUnread] = useState(0);
  const lastGroupMsgIdRef = useRef<number | null>(null);
  const groupInitRef = useRef(true);

  // SSE "messages" event invalidates this query instantly — no polling needed
  const { data: groupMessages } = useListMessages(undefined, {
    query: { queryKey: getListMessagesQueryKey() },
  });

  useEffect(() => {
    if (!groupMessages || !user) return;
    const all = (groupMessages as LocalMessage[]);
    if (!all.length) return;
    const sorted = [...all].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const latest = sorted[sorted.length - 1];

    if (groupInitRef.current) {
      lastGroupMsgIdRef.current = latest.id;
      groupInitRef.current = false;
      return;
    }

    if (latest.id > (lastGroupMsgIdRef.current ?? 0)) {
      if (view !== "group") {
        const newFromOthers = sorted.filter(
          (m) => m.id > (lastGroupMsgIdRef.current ?? 0) && m.authorId !== user.id
        );
        if (newFromOthers.length > 0) {
          setGroupUnread((prev) => prev + newFromOthers.length);
        }
      }
      lastGroupMsgIdRef.current = latest.id;
    }
  }, [groupMessages, user, view]);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${BASE}/api/dm-unread`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { bySender: Record<string, number> };
        setUnreadByUser(data.bySender);
      } catch {}
    };
    fetchUnread();
    // React instantly to SSE push — no polling needed
    const sseHandler = () => fetchUnread();
    window.addEventListener("sse:dm", sseHandler);
    return () => window.removeEventListener("sse:dm", sseHandler);
  }, []);

  const otherUsers = (users ?? []).filter((u) => u.id !== user?.id);
  const currentDMUser = view !== "group" ? otherUsers.find((u) => u.id === view) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-400" />
          Team Chat
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Group channel and direct messages</p>
      </div>

      <div className="flex gap-4 h-[640px]">
        {/* Sidebar */}
        <div className="w-52 shrink-0 flex flex-col border border-white/8 rounded-xl bg-white/2 overflow-hidden">
          <div className="p-4 border-b border-white/8 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chat</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70 px-3 py-2">Channels</p>
            <button
              onClick={() => { setView("group"); setGroupUnread(0); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "group"
                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/30"
                  : groupUnread > 0
                  ? "text-white bg-indigo-600/10 border border-indigo-500/20"
                  : "text-muted-foreground hover:text-indigo-300 hover:bg-indigo-500/10"
              }`}
            >
              <div className="relative shrink-0">
                <Hash className="w-4 h-4 text-indigo-400" />
                {groupUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-indigo-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold px-0.5">
                    {groupUnread > 99 ? "99+" : groupUnread}
                  </span>
                )}
              </div>
              <span className="truncate flex-1 text-left">Team Channel</span>
              {groupUnread > 0 && view !== "group" && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
              )}
            </button>

            <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-400/70 px-3 pt-4 pb-2">Direct Messages</p>
            {otherUsers.map((u) => {
              const unread = unreadByUser[u.id] ?? 0;
              const isActive = view === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setView(u.id);
                    setUnreadByUser((prev) => ({ ...prev, [u.id]: 0 }));
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-teal-600/25 text-teal-200 border border-teal-500/25"
                      : "text-muted-foreground hover:text-teal-300 hover:bg-teal-500/10"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-6 h-6 rounded-full bg-teal-600/30 border border-teal-500/20 flex items-center justify-center text-[10px] font-bold text-teal-200">
                      {u.firstName?.[0]}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <span className="truncate flex-1 text-left">{u.firstName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <Card className="flex-1 glass-panel overflow-hidden flex flex-col">
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-white/5 shrink-0 flex items-center gap-2">
            {view === "group" ? (
              <>
                <Hash className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm">Team Channel</span>
                <span className="text-xs text-muted-foreground ml-1">— Type @ to mention someone</span>
              </>
            ) : (
              <>
                <UserIcon className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm">{currentDMUser?.firstName} {currentDMUser?.lastName}</span>
                {currentDMUser?.title && (
                  <span className="text-xs text-muted-foreground ml-1">— {currentDMUser.title}</span>
                )}
              </>
            )}
            <div className="ml-auto">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs h-7 px-3"
                onClick={() => window.open(ZOOM_QUICK_MEETING_URL, "_blank")}
              >
                <Video className="w-3.5 h-3.5" />
                Join Zoom
              </Button>
            </div>
          </div>

          {user && view === "group" && (
            <GroupChat user={user} users={users ?? []} />
          )}
          {user && currentDMUser && (
            <DMConversation key={currentDMUser.id} otherUser={currentDMUser} me={user} />
          )}
        </Card>
      </div>
    </div>
  );
}
