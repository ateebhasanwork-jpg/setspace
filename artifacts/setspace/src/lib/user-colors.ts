const TEXT_COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-violet-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-fuchsia-400",
  "text-lime-400",
  "text-orange-400",
  "text-teal-400",
  "text-pink-400",
  "text-sky-400",
];

const BG_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-sky-500",
];

// Soft avatar combos: bg/30, border/20, initials colour — all explicit for Tailwind JIT
const AVATAR_CLASSES = [
  "bg-blue-500/30 border-blue-500/20 text-blue-200",
  "bg-emerald-500/30 border-emerald-500/20 text-emerald-200",
  "bg-violet-500/30 border-violet-500/20 text-violet-200",
  "bg-amber-500/30 border-amber-500/20 text-amber-200",
  "bg-rose-500/30 border-rose-500/20 text-rose-200",
  "bg-cyan-500/30 border-cyan-500/20 text-cyan-200",
  "bg-fuchsia-500/30 border-fuchsia-500/20 text-fuchsia-200",
  "bg-lime-500/30 border-lime-500/20 text-lime-200",
  "bg-orange-500/30 border-orange-500/20 text-orange-200",
  "bg-teal-500/30 border-teal-500/20 text-teal-200",
  "bg-pink-500/30 border-pink-500/20 text-pink-200",
  "bg-sky-500/30 border-sky-500/20 text-sky-200",
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUserTextColor(userId: string): string {
  return TEXT_COLORS[hashId(userId) % TEXT_COLORS.length];
}

export function getUserBgColor(userId: string): string {
  return BG_COLORS[hashId(userId) % BG_COLORS.length];
}

/** Returns combined bg/border/text classes for avatar backgrounds */
export function getUserAvatarClasses(userId: string): string {
  return AVATAR_CLASSES[hashId(userId) % AVATAR_CLASSES.length];
}
