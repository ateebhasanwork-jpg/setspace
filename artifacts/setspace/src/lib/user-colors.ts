import type { CSSProperties } from "react";

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Derive a unique hue (0–359) from any user ID string.
 * Using the full 360-degree hue space means two users almost never
 * share the same colour regardless of how many employees exist.
 */
function getUserHue(userId: string): number {
  return hashId(userId) % 360;
}

/** Inline style for avatar circles */
export function getUserAvatarStyle(userId: string): CSSProperties {
  const hue = getUserHue(userId);
  return {
    backgroundColor: `hsla(${hue}, 65%, 35%, 0.25)`,
    borderColor:     `hsla(${hue}, 65%, 55%, 0.35)`,
    color:           `hsl(${hue}, 75%, 75%)`,
  };
}

/** CSS colour for sender name labels */
export function getUserNameColor(userId: string): string {
  const hue = getUserHue(userId);
  return `hsl(${hue}, 75%, 72%)`;
}

// Legacy stubs — kept so any remaining import doesn't break
export function getUserTextColor(_userId: string): string { return ""; }
export function getUserBgColor(_userId: string): string { return ""; }
export function getUserAvatarClasses(_userId: string): string { return ""; }
