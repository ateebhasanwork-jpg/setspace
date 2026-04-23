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
