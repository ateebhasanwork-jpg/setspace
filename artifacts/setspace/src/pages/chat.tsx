import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  useListMessages,
  useCreateMessage,
  getListMessagesQueryKey,
  getListNotificationsQueryKey,
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
  Trash2,
  Play,
  Pause,
  Check,
  CheckCheck,
} from "lucide-react";
import { playMessageSound } from "@/lib/sounds";
import { getUserAvatarStyle, getUserNameColor, getUserNameColorLight } from "@/lib/user-colors";

type ReactionGroup = { emoji: string; count: number; userIds: string[] };
type ReadByUser = { userId: string; firstName?: string | null; lastName?: string | null; profileImage?: string | null };
type LocalMessage = Message & { _optimistic?: boolean; reactions?: ReactionGroup[]; readBy?: ReadByUser[] };

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

/** WhatsApp-style inline voice note player */
function VoiceNotePlayer({ url, isMe }: { url: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const bars = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => {
      const h = 4 + Math.abs(Math.sin(i * 2.3 + 1.1) * 12 + Math.cos(i * 1.7 + 0.5) * 5);
      return Math.max(3, Math.min(18, h));
    }), []);

  const activeColor = isMe ? "#FFFFFF" : "#111111";
  const inactiveColor = isMe ? "rgba(255,255,255,0.28)" : "#D1D5DB";
  const textColor = isMe ? "rgba(255,255,255,0.60)" : "#6B7280";

  return (
    <div className="flex items-center gap-2.5 mt-2" style={{ minWidth: 210, maxWidth: 240 }}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
      />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-75 active:scale-95"
        style={{ background: isMe ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.09)" }}
      >
        {playing
          ? <Pause className="w-4 h-4" style={{ color: activeColor }} />
          : <Play className="w-4 h-4 ml-0.5" style={{ color: activeColor }} />
        }
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          className="flex items-center gap-[2px] cursor-pointer"
          style={{ height: 22 }}
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            audioRef.current.currentTime = ratio * duration;
          }}
        >
          {bars.map((h, i) => {
            const active = i / bars.length <= progress;
            return (
              <div
                key={i}
                style={{
                  width: 2.5,
                  height: h,
                  borderRadius: 2,
                  background: active ? activeColor : inactiveColor,
                  flexShrink: 0,
                  transition: "background 0.08s",
                }}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 10, color: textColor, lineHeight: 1 }}>
          {currentTime > 0 ? formatTime(currentTime) : (duration > 0 ? formatTime(duration) : "0:00")}
        </span>
      </div>
    </div>
  );
}

function AttachmentPreview({ url, name, isMe }: { url: string; name: string; isMe: boolean }) {
  const src = resolveAttachmentUrl(url);
  const isImage = IMAGE_EXTS.test(name);
  const isAudio = AUDIO_EXTS.test(name) || name.startsWith("voice-note");
  if (isImage) {
    return (
      <img
        src={src} alt={name}
        className="max-w-[240px] max-h-[200px] rounded-xl object-cover mt-2 cursor-pointer border border-border"
        onClick={() => window.open(src, "_blank")}
      />
    );
  }
  if (isAudio) {
    return <VoiceNotePlayer url={src} isMe={isMe} />;
  }
  return (
    <a
      href={src} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent transition-colors"
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
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "ogg";
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

function DateSeparator({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px" style={{ background: light ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)" }} />
      <span
        className="text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full shrink-0"
        style={light
          ? { background: "#D1D5DB", color: "#6B7280" }
          : { background: "rgb(18, 22, 38)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: light ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)" }} />
    </div>
  );
}

function Avatar({
  name,
  profileImage,
  userId,
  size = "sm",
  visible = true,
  lightBg = false,
}: {
  name?: string | null;
  profileImage?: string | null;
  userId?: string;
  size?: "sm" | "md";
  visible?: boolean;
  lightBg?: boolean;
}) {
  const photo = resolveProfileImage(profileImage);
  const cls = size === "sm" ? "w-10 h-10 text-sm" : "w-11 h-11 text-sm";
  const avatarStyle = userId
    ? getUserAvatarStyle(userId, lightBg)
    : { backgroundColor: "rgba(99,102,241,0.18)", borderColor: "rgba(99,102,241,0.30)", color: "#a5b4fc" };
  if (!visible) return <div className={`${cls} rounded-full shrink-0 opacity-0`} />;
  if (photo)
    return (
      <img src={photo} alt="" className={`${cls} rounded-full object-cover border-2 shrink-0`} style={{ borderColor: lightBg ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.15)" }} />
    );
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center font-bold shrink-0 border-2 text-base`}
      style={avatarStyle}
    >
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

type BubblePosition = "solo" | "first" | "middle" | "last";

function getBubbleShape(isMe: boolean, pos: BubblePosition): string {
  if (isMe) {
    if (pos === "solo" || pos === "first") return "rounded-2xl rounded-br-[5px]";
    if (pos === "middle") return "rounded-2xl rounded-tr-[5px] rounded-br-[5px]";
    return "rounded-2xl rounded-tr-[5px]";
  } else {
    if (pos === "solo" || pos === "first") return "rounded-2xl rounded-bl-[5px]";
    if (pos === "middle") return "rounded-2xl rounded-tl-[5px] rounded-bl-[5px]";
    return "rounded-2xl rounded-tl-[5px]";
  }
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
            const isMentionedMe = matched.id === currentUserId;
            return (
              <span
                key={i}
                className="font-semibold rounded px-0.5"
                style={isMentionedMe
                  ? { background: "rgba(99,102,241,0.18)", color: "#3730a3" }
                  : { color: "#4338CA" }}
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
      className="flex gap-2 mb-2 pb-2 text-[11px] leading-snug"
      style={{
        borderBottom: `1px solid ${isMe ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.08)"}`,
        color: "#6B7280",
      }}
    >
      <div className="w-0.5 rounded-full shrink-0" style={{ background: isMe ? "#16a34a" : "#6366f1" }} />
      <div className="min-w-0">
        <span className="font-semibold block" style={{ color: isMe ? "#065f46" : "#4338CA" }}>
          {author?.firstName ?? "Unknown"}
        </span>
        <span className="line-clamp-2" style={{ color: "#4B5563" }}>
          {parent.content.length > 100 ? parent.content.slice(0, 100) + "…" : parent.content}
        </span>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isMe,
  canDelete,
  position,
  onReply,
  onReact,
  onDelete,
  parentMsg,
  users,
  currentUserId,
}: {
  msg: LocalMessage;
  isMe: boolean;
  canDelete?: boolean;
  position: BubblePosition;
  onReply: (m: LocalMessage) => void;
  onReact: (msgId: number, emoji: string) => void;
  onDelete: (msgId: number) => void;
  parentMsg?: LocalMessage | null;
  users?: User[];
  currentUserId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const author = msg.author as (typeof msg.author & { profileImage?: string | null }) | undefined;

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
  const showName = !isMe && (position === "solo" || position === "first");
  const showAvatar = !isMe && (position === "solo" || position === "last");
  const nameColor = getUserNameColorLight(msg.authorId);
  const shape = getBubbleShape(isMe, position);

  return (
    <div
      className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${msg._optimistic ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
    >
      {showName && (
        <span
          className="text-[13px] font-semibold mb-1 ml-[52px]"
          style={{ color: nameColor }}
        >
          {author?.firstName} {author?.lastName}
        </span>
      )}
      <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
        {!isMe && (
          <Avatar
            name={author?.firstName}
            profileImage={author?.profileImage}
            userId={msg.authorId}
            visible={showAvatar}
            lightBg
          />
        )}
        <div className="flex flex-col gap-0.5">
          <div
            className={`px-3.5 py-2.5 ${shape}`}
            style={isMe
              ? { background: "#111111", color: "#FFFFFF" }
              : { background: "#F0F2F5", color: "#111827", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
            }
          >
            {parentMsg && <QuotedReply parent={parentMsg} isMe={isMe} />}
            {msg.content && (
              <p className="text-[15px] whitespace-pre-wrap leading-[1.5]">
                <MessageContent content={msg.content} users={users} currentUserId={currentUserId} />
              </p>
            )}
            {msg.attachmentUrl && msg.attachmentName && (
              <AttachmentPreview url={msg.attachmentUrl} name={msg.attachmentName} isMe={isMe} />
            )}
            <span className="text-[11px] block mt-1 text-right" style={{ color: isMe ? "rgba(255,255,255,0.55)" : "#6B7280" }}>
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-all"
                    style={iReacted
                      ? { background: "#111111", border: "1px solid #111111", color: "#FFFFFF" }
                      : { background: "#F3F4F6", border: "1px solid #E5E7EB", color: "#374151" }}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[11px] font-medium">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Seen-by avatars — only on sender's own messages */}
          {isMe && !msg._optimistic && (() => {
            const readers = (msg.readBy ?? []).filter(r => r.userId !== currentUserId);
            if (readers.length === 0) return null;
            const MAX = 5;
            const visible = readers.slice(0, MAX);
            const extra = readers.length - MAX;
            const names = readers.map(r => r.firstName ?? "?").join(", ");
            return (
              <div
                className="flex items-center gap-1 self-end mt-0.5"
                title={`Seen by: ${names}`}
              >
                <span className="text-[9px] text-gray-400 mr-0.5">Seen</span>
                <div className="flex items-center">
                  {visible.map((r, idx) => {
                    const photo = resolveProfileImage(r.profileImage);
                    const avatarStyle = getUserAvatarStyle(r.userId, true);
                    return photo ? (
                      <img
                        key={r.userId}
                        src={photo}
                        alt={r.firstName ?? ""}
                        title={`${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()}
                        className="w-4 h-4 rounded-full object-cover border border-white"
                        style={{ marginLeft: idx === 0 ? 0 : -4, zIndex: idx }}
                      />
                    ) : (
                      <div
                        key={r.userId}
                        title={`${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()}
                        className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[7px] font-bold"
                        style={{ ...avatarStyle, marginLeft: idx === 0 ? 0 : -4, zIndex: idx }}
                      >
                        {r.firstName?.[0]}
                      </div>
                    );
                  })}
                  {extra > 0 && (
                    <div
                      className="w-4 h-4 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[7px] font-bold text-gray-500"
                      style={{ marginLeft: -4 }}
                    >
                      +{extra}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Action bar: reply + react + delete */}
          {!msg._optimistic && (
            <div className={`flex items-center gap-1.5 ${isMe ? "self-end" : "self-start ml-1"}`}>
              <button
                onClick={() => onReply(msg)}
                className="flex items-center gap-1 text-[11px] transition-opacity rounded px-1.5 py-0.5"
                style={{ color: "#6B7280", opacity: hovered ? 1 : 0, background: hovered ? "rgba(0,0,0,0.06)" : "transparent" }}
              >
                <CornerDownRight className="w-3 h-3" /> Reply
              </button>

              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className="flex items-center gap-1 text-[11px] transition-all rounded px-1.5 py-0.5"
                  style={{ color: "#6B7280", opacity: hovered || pickerOpen ? 1 : 0, background: hovered || pickerOpen ? "rgba(0,0,0,0.06)" : "transparent" }}
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {pickerOpen && (
                  <div
                    className={`absolute z-50 bottom-full mb-1.5 rounded-2xl shadow-lg p-2 flex gap-1 ${isMe ? "right-0" : "left-0"}`}
                    style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}
                  >
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          onReact(msg.id, e);
                          setPickerOpen(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg transition-colors"
                        style={{ background: "transparent" }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = "#F3F4F6")}
                        onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {canDelete && (
                <button
                  onClick={() => { if (confirm("Delete this message?")) onDelete(msg.id); }}
                  className="flex items-center gap-1 text-[11px] transition-all rounded px-1.5 py-0.5"
                  style={{ color: "#6B7280", opacity: hovered ? 1 : 0.2 }}
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
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
  onDelete,
  currentUserId,
}: {
  msg: DM;
  isMe: boolean;
  onReact: (dmId: number, emoji: string) => void;
  onDelete: (dmId: number) => void;
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
        {!isMe && <Avatar name={sender?.firstName} profileImage={sender?.profileImage} userId={msg.senderId} />}
        <div className="flex flex-col gap-1">
          <div
            className={`px-3.5 py-2.5 ${isMe ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl rounded-bl-[4px]"}`}
            style={isMe
              ? { background: "#111111", color: "#FFFFFF" }
              : { background: "#F0F2F5", color: "#111827", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
            }
          >
            {msg.content && <p className="text-[15px] whitespace-pre-wrap leading-relaxed tracking-[0.01em]">{msg.content}</p>}
            {msg.attachmentUrl && msg.attachmentName && (
              <AttachmentPreview url={msg.attachmentUrl} name={msg.attachmentName} isMe={isMe} />
            )}
            <span
              className="text-[10px] block mt-2 text-right flex items-center justify-end gap-1"
              style={{ color: isMe ? "rgba(255,255,255,0.55)" : "#6B7280" }}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {isMe && (
                msg._optimistic
                  ? <Check className="w-3 h-3 inline-block" style={{ color: "rgba(255,255,255,0.45)" }} />
                  : msg.isRead
                    ? <CheckCheck className="w-3.5 h-3.5 inline-block" style={{ color: "#4ADE80" }} />
                    : <CheckCheck className="w-3.5 h-3.5 inline-block" style={{ color: "rgba(255,255,255,0.45)" }} />
              )}
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-all"
                    style={iReacted
                      ? { background: "#111111", border: "1px solid #111111", color: "#FFFFFF" }
                      : { background: "#F3F4F6", border: "1px solid #E5E7EB", color: "#374151" }}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[11px] font-medium">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action bar: react + delete */}
          {!msg._optimistic && (
            <div className={`flex items-center gap-2 ${isMe ? "self-end" : "self-start ml-1"}`}>
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-all ${
                    hovered || pickerOpen ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {pickerOpen && (
                  <div
                    className={`absolute z-50 bottom-full mb-1.5 bg-card border border-border rounded-xl shadow-md p-2 flex gap-1 ${
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
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-accent transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete — own messages only */}
              {isMe && (
                <button
                  onClick={() => { if (confirm("Delete this message?")) onDelete(msg.id); }}
                  className={`flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-all ${
                    hovered ? "opacity-100" : "opacity-30"
                  }`}
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
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
    <div className="absolute bottom-full left-0 mb-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
        <AtSign className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium">Mention someone</span>
      </div>
      {filtered.map((u) => (
        <button
          key={u.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(u);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-[11px] font-bold text-foreground shrink-0">
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

  // When chat opens, clear any pending "message"/"mention" chat notifications so the bell resets
  useEffect(() => {
    const notifs = queryClient.getQueryData<Array<{ id: number; type?: string }>>(
      getListNotificationsQueryKey()
    ) ?? [];
    const chatNotifIds = notifs.filter(n => n.type === "message" || n.type === "mention").map(n => n.id);
    if (chatNotifIds.length === 0) return;
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    Promise.all(
      chatNotifIds.map(id =>
        fetch(`${base}/api/notifications/${id}/read`, { method: "POST", credentials: "include" }).catch(() => {})
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    });
  }, [queryClient]);

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
    } else if (lastSeenIdRef.current === null || latest.id > lastSeenIdRef.current) {
      const newFromOthers = real.filter(
        (m) => m.id > (lastSeenIdRef.current ?? 0) && m.authorId !== user.id
      );
      if (newFromOthers.length > 0) {
        playMessageSound();
        if (isNearBottom()) scrollToBottom();
      }
      lastSeenIdRef.current = latest.id;
    }
    // Mark all visible messages as read (idempotent — server uses ON CONFLICT DO NOTHING)
    const ids = real.map(m => m.id).filter(id => id > 0);
    if (ids.length > 0) {
      fetch(`${BASE}/api/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: ids }),
        credentials: "include",
      }).catch(() => {});
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

  sendRef.current = send;

  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    await fetch(`${BASE}/api/messages/${msgId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
      credentials: "include",
    });
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
  }, [queryClient]);

  const handleDeleteMessage = async (msgId: number) => {
    queryClient.setQueryData(
      getListMessagesQueryKey(),
      (old: LocalMessage[] | undefined) => old?.filter((m) => m.id !== msgId) ?? []
    );
    await fetch(`${BASE}/api/messages/${msgId}`, { method: "DELETE", credentials: "include" });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ background: "#F0F2F5" }}
      >
        {topLevel.map((msg, i, arr) => {
          const isMe = msg.authorId === user.id;
          const prevMsg = arr[i - 1];
          const nextMsg = arr[i + 1];
          const msgDate = formatDateLabel(msg.createdAt);
          const prevDate = prevMsg ? formatDateLabel(prevMsg.createdAt) : null;
          const nextDate = nextMsg ? formatDateLabel(nextMsg.createdAt) : null;
          const showDate = msgDate !== prevDate;
          const prevSameAuthor = !showDate && prevMsg?.authorId === msg.authorId;
          const nextSameAuthor = nextMsg?.authorId === msg.authorId && nextDate === msgDate;
          const position: BubblePosition = prevSameAuthor
            ? nextSameAuthor ? "middle" : "last"
            : nextSameAuthor ? "first" : "solo";
          const replies = repliesById[msg.id] ?? [];
          const isNewGroup = position === "solo" || position === "first";
          return (
            <div key={msg.id} className={isNewGroup && i > 0 && !showDate ? "mt-4" : "mt-0.5"}>
              {showDate && <div className={i > 0 ? "mt-4 mb-3" : "mb-3"}><DateSeparator label={msgDate} light /></div>}
              <MessageBubble
                msg={msg}
                isMe={isMe}
                canDelete={isMe || (user as { role?: string })?.role === "admin"}
                position={position}
                onReply={setReplyTo}
                onReact={handleReact}
                onDelete={handleDeleteMessage}
                users={users}
                currentUserId={user.id}
              />
              {replies.length > 0 && (
                <div className="ml-10 mt-2 pl-4 border-l-2 border-border space-y-3">
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
                              ? "bg-foreground text-background"
                              : "bg-muted text-foreground border border-border"
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
        <div className="px-4 pt-2.5 pb-2 flex items-center gap-3 text-sm shrink-0" style={{ background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}>
          <CornerDownRight className="w-4 h-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-xs text-foreground">
              Replying to {(replyTo.author as User | undefined)?.firstName ?? "message"}
            </span>
            <p className="truncate text-xs mt-0.5" style={{ color: "#6B7280" }}>
              {replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? "…" : ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0" style={{ color: "#9CA3AF" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-3 shrink-0" style={{ background: "#FFFFFF", borderTop: "1px solid #E5E7EB" }}>
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
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Recording {formatRecordTime(voice.seconds)}</span>
              <button onClick={voice.stop} className="ml-auto flex items-center gap-1 text-xs" style={{ color: "#DC2626" }}>
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>
          )}
          {/* Pending attachment preview */}
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-sm" style={{ background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
              {IMAGE_EXTS.test(pendingFile.name)
                ? <ImageIcon className="w-4 h-4 shrink-0 text-foreground" />
                : pendingFile.name.startsWith("voice-note")
                ? <Mic className="w-4 h-4 shrink-0 text-foreground" />
                : <FileText className="w-4 h-4 shrink-0" style={{ color: "#6B7280" }} />}
              <span className="flex-1 truncate text-xs" style={{ color: "#374151" }}>{pendingFile.name.startsWith("voice-note") ? "Voice note ready" : pendingFile.name}</span>
              <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{ color: "#9CA3AF" }}>
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
            className="flex items-end gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={voice.recording}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 disabled:opacity-40"
              style={{ color: "#6B7280" }}
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={voice.recording ? voice.stop : voice.start}
              disabled={uploading}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0"
              style={{ color: voice.recording ? "#DC2626" : "#6B7280" }}
              title={voice.recording ? "Stop recording" : "Record voice note"}
            >
              {voice.recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
                if (e.key === "Escape" && mentionSearch !== null) { setMentionSearch(null); return; }
                if (e.key === "Enter" && !e.shiftKey && mentionSearch === null) { e.preventDefault(); send(); }
              }}
              placeholder="Type a message..."
              className="flex-1 resize-none outline-none px-4 py-2.5 text-[15px] leading-[1.5]"
              style={{
                minHeight: "42px", maxHeight: "120px",
                background: "#F0F2F5", borderRadius: "24px",
                color: "#111827", border: "none",
              }}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={(!content.trim() && !pendingFile) || uploading || voice.recording}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
              style={{ background: "#111111" }}
            >
              {uploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4 text-white" />}
            </button>
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
        if (toAdd.length === 0) return prev;
        // If any of our own sent messages just arrived from the server, drop all optimistic
        // placeholders — they've been confirmed and the real rows are in toAdd
        const myNewMessages = toAdd.filter(m => m.senderId === me.id);
        const base = myNewMessages.length > 0
          ? prev.filter(m => m.id > 0)          // confirmed — remove optimistic ghosts
          : prev.filter(m => m.id > 0 || m._optimistic); // others' messages — keep pending
        return [...base, ...toAdd];
      });
    } catch {}
  };

  useEffect(() => {
    isInitialRef.current = true;
    setDms([]);
    fetchDMs();
    // SSE "dm" event triggers fetchDMs instantly — no polling needed
    const sseHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string; dmId?: number }>).detail;
      if (detail?.action === "deleted" && detail?.dmId) {
        setDms((prev) => prev.filter((m) => m.id !== detail.dmId));
        return;
      }
      fetchDMs();
    };
    window.addEventListener("sse:dm", sseHandler);

    // When the other person reads our messages, flip isRead to true for live green ticks
    const readHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ by?: string }>).detail;
      if (detail?.by === otherUser.id) {
        setDms((prev) => prev.map((m) =>
          m.senderId === otherUser.id ? m : { ...m, isRead: true }
        ));
      }
    };
    window.addEventListener("sse:dm-read", readHandler);

    return () => {
      window.removeEventListener("sse:dm", sseHandler);
      window.removeEventListener("sse:dm-read", readHandler);
    };
  }, [otherUser.id]);


  const dmSendRef = useRef<(f?: File) => void>(() => {});
  const send = async (fileArg?: File) => {
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

  dmSendRef.current = send;

  const handleDeleteDM = async (dmId: number) => {
    setDms((prev) => prev.filter((m) => m.id !== dmId));
    await fetch(`${BASE}/api/dm/message/${dmId}`, { method: "DELETE", credentials: "include" });
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-2" style={{ background: "#F5F5F5" }}>
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
              <DMBubble msg={msg} isMe={msg.senderId === me.id} onReact={handleReact} onDelete={handleDeleteDM} currentUserId={me.id} />
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-3 shrink-0" style={{ background: "#FFFFFF", borderTop: "1px solid #E5E5E5" }}>
        {/* Recording indicator */}
        {voice.recording && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-red-600 text-xs font-medium">Recording {formatRecordTime(voice.seconds)}</span>
            <button onClick={voice.stop} className="ml-auto text-red-500 hover:text-red-700 flex items-center gap-1 text-xs">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          </div>
        )}
        {/* Pending attachment preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
            {IMAGE_EXTS.test(pendingFile.name)
              ? <ImageIcon className="w-4 h-4 text-foreground shrink-0" />
              : pendingFile.name.startsWith("voice-note")
              ? <Mic className="w-4 h-4 text-foreground shrink-0" />
              : <FileText className="w-4 h-4 text-foreground shrink-0" />}
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
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={voice.recording}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 disabled:opacity-40 hover:bg-muted"
            style={{ color: "#6B7280" }}
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={voice.recording ? voice.stop : voice.start}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 hover:bg-muted"
            style={{ color: voice.recording ? "#DC2626" : "#6B7280" }}
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
            className="flex-1 focus:outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground leading-5 px-4 py-2.5"
            style={{ background: "#F5F5F5", borderRadius: "24px", border: "1px solid #E5E5E5", minHeight: "40px", maxHeight: "120px" }}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={(!content.trim() && !pendingFile) || sending || voice.recording}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: "#111111" }}
          >
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function TeamChat() {
  const { data: user } = useGetCurrentUser();
  const { data: users } = useListUsers();
  const [view, setView] = useState<"group" | string>("group");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
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
          <MessageSquare className="w-6 h-6 text-foreground" />
          Team Chat
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Group channel and direct messages</p>
      </div>

      <div className="flex gap-4" style={{ height: "calc(100vh - 11rem)" }}>
        {/* Sidebar */}
        <div className={`shrink-0 flex flex-col border border-border rounded-xl bg-card overflow-hidden w-full sm:w-52 ${mobileChatOpen ? "hidden sm:flex" : "flex"}`}>
          <div className="p-4 border-b border-border shrink-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chat</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">Channels</p>
            <button
              onClick={() => { setView("group"); setGroupUnread(0); setMobileChatOpen(true); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "group"
                  ? "bg-foreground text-background"
                  : groupUnread > 0
                  ? "text-foreground font-semibold bg-muted border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <div className="relative shrink-0">
                <Hash className="w-4 h-4" />
                {groupUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-foreground rounded-full text-[9px] text-background flex items-center justify-center font-bold px-0.5">
                    {groupUnread > 99 ? "99+" : groupUnread}
                  </span>
                )}
              </div>
              <span className={`truncate flex-1 text-left ${groupUnread > 0 && view !== "group" ? "font-bold" : ""}`}>Team Channel</span>
              {groupUnread > 0 && view !== "group" && (
                <span className="w-2 h-2 rounded-full bg-foreground shrink-0 animate-pulse" />
              )}
            </button>

            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-2">Direct Messages</p>
            {otherUsers.map((u) => {
              const unread = unreadByUser[u.id] ?? 0;
              const isActive = view === u.id;
              const avatarStyle = getUserAvatarStyle(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setView(u.id);
                    setUnreadByUser((prev) => ({ ...prev, [u.id]: 0 }));
                    setMobileChatOpen(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-muted text-foreground border border-border"
                      : unread > 0
                      ? "text-foreground font-semibold bg-muted border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <div className="relative shrink-0">
                    {resolveProfileImage((u as any).profileImage) ? (
                      <img
                        src={resolveProfileImage((u as any).profileImage)!}
                        alt={u.firstName ?? ""}
                        className="w-6 h-6 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[10px] font-bold"
                        style={avatarStyle}
                      >
                        {u.firstName?.[0]}
                      </div>
                    )}
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground rounded-full text-[9px] text-background flex items-center justify-center font-bold">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <span className={`truncate flex-1 text-left ${unread > 0 ? "font-bold" : ""}`}>{u.firstName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <Card className={`flex-1 glass-panel overflow-hidden flex-col ${mobileChatOpen ? "flex" : "hidden sm:flex"}`}>
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2 bg-card">
            <button
              onClick={() => setMobileChatOpen(false)}
              className="sm:hidden mr-1 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Back to conversations"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {view === "group" ? (
              <>
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-muted">
                  <Hash className="w-4 h-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-sm block">team-channel</span>
                  <span className="text-[11px] text-muted-foreground">{(users ?? []).length} members · Type @ to mention</span>
                </div>
              </>
            ) : (
              <>
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{currentDMUser?.firstName} {currentDMUser?.lastName}</span>
                {currentDMUser?.title && (
                  <span className="hidden sm:inline text-xs text-muted-foreground ml-1">— {currentDMUser.title}</span>
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
