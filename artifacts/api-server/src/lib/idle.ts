/**
 * Idle activity tracker — simulates scale-to-zero behaviour.
 *
 * How it works:
 *  - Every incoming request updates `lastActivityAt`.
 *  - The DB pool is configured with `idleTimeoutMillis: 10_000` so it
 *    automatically releases connections that haven't been used for 10 s.
 *  - When no SSE clients are connected and no request has arrived in
 *    IDLE_LOG_AFTER_MS, we log the idle state once so it is visible in
 *    the deployment console.  No polling or looping is involved.
 *  - When the next request arrives the activity timestamp is refreshed
 *    and the DB pool creates a fresh connection on demand.
 */

import { getActiveClientCount } from "./sse";

const IDLE_LOG_AFTER_MS = 10 * 60_000; // 10 minutes

let lastActivityAt = Date.now();
let idleLogTimer: ReturnType<typeof setTimeout> | null = null;
let isIdle = false;

function scheduleIdleCheck() {
  if (idleLogTimer) clearTimeout(idleLogTimer);
  idleLogTimer = setTimeout(() => {
    idleLogTimer = null;
    if (getActiveClientCount() === 0) {
      isIdle = true;
      console.log("[idle] No active users for 10 min — DB connections will drain automatically.");
    }
  }, IDLE_LOG_AFTER_MS);
}

/** Call this on every incoming HTTP request. */
export function recordActivity() {
  const wasIdle = isIdle;
  isIdle = false;
  lastActivityAt = Date.now();
  if (wasIdle) {
    console.log("[idle] Activity resumed — DB pool will reconnect on next query.");
  }
  scheduleIdleCheck();
}

/** Returns how many seconds have elapsed since the last request. */
export function secondsSinceLastActivity(): number {
  return Math.floor((Date.now() - lastActivityAt) / 1000);
}

export function isServerIdle(): boolean {
  return isIdle;
}

scheduleIdleCheck();
