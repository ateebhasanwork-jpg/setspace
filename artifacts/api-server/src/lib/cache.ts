/**
 * Shared in-memory cache for the API server.
 *
 * Two layers:
 *   1. User cache  (60 s TTL) — eliminates redundant users SELECT on every route.
 *   2. Result cache (configurable TTL) — caches full shaped API responses so
 *      multiple users hitting the same endpoint in the same window share a
 *      single DB round-trip instead of each paying separately.
 *
 * Invalidation rules:
 *   • User writes (PATCH/DELETE /users)   → invalidateUsers()
 *   • Task writes                         → invalidateResult("tasks"), invalidateByPrefix("leaderboard:")
 *   • Quality check writes                → invalidateByPrefix("leaderboard:"), invalidateResult("quality-checks")
 *   • Attendance writes                   → invalidateByPrefix("leaderboard:")
 *   • KPI entry writes                    → invalidateByPrefix("leaderboard:")
 *   • Meeting writes                      → invalidateResult("meetings")
 */

import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

// ─── User cache ──────────────────────────────────────────────────────────────

export type CachedUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  profileImage: string | null;
  department: string | null;
  title: string | null;
};

const USER_TTL_MS = 5 * 60_000; // 5 minutes — users change rarely

let usersCache: CachedUser[] | null = null;
let usersCachedAt = 0;

const USER_FIELDS = {
  id: usersTable.id,
  username: usersTable.username,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  email: usersTable.email,
  role: usersTable.role,
  profileImage: usersTable.profileImage,
  department: usersTable.department,
  title: usersTable.title,
};

export async function getCachedUsers(): Promise<CachedUser[]> {
  if (usersCache && Date.now() - usersCachedAt < USER_TTL_MS) return usersCache;
  const rows = await db.select(USER_FIELDS).from(usersTable);
  usersCache = rows as CachedUser[];
  usersCachedAt = Date.now();
  return usersCache;
}

export async function getCachedUser(id: string): Promise<CachedUser | undefined> {
  return (await getCachedUsers()).find(u => u.id === id);
}

export function getUserMap(users: CachedUser[]): Record<string, CachedUser> {
  return Object.fromEntries(users.map(u => [u.id, u]));
}

export function invalidateUsers(): void {
  usersCache = null;
  usersCachedAt = 0;
}

export function displayName(u: CachedUser | null | undefined): string {
  if (!u) return "Someone";
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Someone";
}

// ─── Result cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  cachedAt: number;
  ttl: number;
}

const resultStore = new Map<string, CacheEntry>();

/**
 * Fetch from result cache or compute fresh.
 *
 * @param key    Cache key (e.g. "meetings", "leaderboard:2025-11")
 * @param ttlMs  How long to keep the entry (milliseconds)
 * @param fetch  Async function to produce fresh data when cache is cold
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetch: () => Promise<T>
): Promise<T> {
  const entry = resultStore.get(key);
  if (entry && Date.now() - entry.cachedAt < entry.ttl) {
    return entry.data as T;
  }
  const data = await fetch();
  resultStore.set(key, { data, cachedAt: Date.now(), ttl: ttlMs });
  return data;
}

export function invalidateResult(key: string): void {
  resultStore.delete(key);
}

/** Invalidate all cache entries whose key starts with the given prefix. */
export function invalidateByPrefix(prefix: string): void {
  for (const key of resultStore.keys()) {
    if (key.startsWith(prefix)) resultStore.delete(key);
  }
}
