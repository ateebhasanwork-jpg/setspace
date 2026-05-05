import type { CSSProperties } from "react";

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getUserHue(userId: string): number {
  return hashId(userId) % 360;
}

/** Inline style for avatar circles */
export function getUserAvatarStyle(userId: string, lightBg = false): CSSProperties {
  const hue = getUserHue(userId);
  if (lightBg) {
    return {
      backgroundColor: `hsla(${hue}, 60%, 45%, 0.15)`,
      borderColor:     `hsla(${hue}, 60%, 40%, 0.4)`,
      color:           `hsl(${hue}, 55%, 28%)`,
    };
  }
  return {
    backgroundColor: `hsla(${hue}, 65%, 35%, 0.25)`,
    borderColor:     `hsla(${hue}, 65%, 55%, 0.35)`,
    color:           `hsl(${hue}, 75%, 75%)`,
  };
}

/** CSS colour for sender name labels on dark backgrounds */
export function getUserNameColor(userId: string): string {
  const hue = getUserHue(userId);
  return `hsl(${hue}, 75%, 72%)`;
}

/** CSS colour for sender name labels on light backgrounds */
export function getUserNameColorLight(userId: string): string {
  const hue = getUserHue(userId);
  return `hsl(${hue}, 60%, 32%)`;
}

// Legacy stubs — kept so any remaining import doesn't break
export function getUserTextColor(_userId: string): string { return ""; }
export function getUserBgColor(_userId: string): string { return ""; }
export function getUserAvatarClasses(_userId: string): string { return ""; }
