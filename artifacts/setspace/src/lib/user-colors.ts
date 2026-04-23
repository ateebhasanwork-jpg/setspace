import type { CSSProperties } from "react";

const PALETTE = [
  { bg: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.30)",  text: "#93c5fd" },  // blue
  { bg: "rgba(16,185,129,0.18)",  border: "rgba(16,185,129,0.30)",  text: "#6ee7b7" },  // emerald
  { bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.30)",  text: "#c4b5fd" },  // violet
  { bg: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.30)",  text: "#fcd34d" },  // amber
  { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.30)",   text: "#fca5a5" },  // rose
  { bg: "rgba(6,182,212,0.18)",   border: "rgba(6,182,212,0.30)",   text: "#67e8f9" },  // cyan
  { bg: "rgba(217,70,239,0.18)",  border: "rgba(217,70,239,0.30)",  text: "#f0abfc" },  // fuchsia
  { bg: "rgba(132,204,22,0.18)",  border: "rgba(132,204,22,0.30)",  text: "#bef264" },  // lime
  { bg: "rgba(249,115,22,0.18)",  border: "rgba(249,115,22,0.30)",  text: "#fdba74" },  // orange
  { bg: "rgba(20,184,166,0.18)",  border: "rgba(20,184,166,0.30)",  text: "#5eead4" },  // teal
  { bg: "rgba(236,72,153,0.18)",  border: "rgba(236,72,153,0.30)",  text: "#f9a8d4" },  // pink
  { bg: "rgba(14,165,233,0.18)",  border: "rgba(14,165,233,0.30)",  text: "#7dd3fc" },  // sky
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Inline style for avatar circles — works regardless of Tailwind purging */
export function getUserAvatarStyle(userId: string): CSSProperties {
  const c = PALETTE[hashId(userId) % PALETTE.length];
  return { backgroundColor: c.bg, borderColor: c.border, color: c.text };
}

/** CSS color string for sender name labels */
export function getUserNameColor(userId: string): string {
  return PALETTE[hashId(userId) % PALETTE.length].text;
}

// Legacy Tailwind-class exports kept for any remaining usages
export function getUserTextColor(_userId: string): string { return ""; }
export function getUserBgColor(_userId: string): string { return ""; }
export function getUserAvatarClasses(_userId: string): string { return ""; }
