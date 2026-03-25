/**
 * Lightweight in-memory cache for hot, infrequently-changing data.
 *
 * Users are queried on nearly every message/DM/task route.  A 60-second
 * cache eliminates the vast majority of those redundant round-trips.
 *
 * Call invalidateUsers() whenever a user record is written so the next
 * request gets fresh data.
 */

import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

const USER_TTL_MS = 60_000;

let usersCache: CachedUser[] | null = null;
let usersCachedAt = 0;

const SELECTED = {
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
  const rows = await db.select(SELECTED).from(usersTable);
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
