import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { getCachedUsers, getUserMap, invalidateByPrefix } from "../lib/cache";

const router: IRouter = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function computeTotalSeconds(r: typeof attendanceTable.$inferSelect): number {
  const base = r.accumulatedSeconds ?? 0;
  if (!r.clockOut) {
    const sessionStart = r.lastClockIn ?? r.clockIn;
    const elapsed = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    return base + elapsed;
  }
  return base;
}

function formatRecord(r: typeof attendanceTable.$inferSelect) {
  return {
    ...r,
    clockIn: r.clockIn.toISOString(),
    clockOut: r.clockOut?.toISOString() ?? null,
    lastClockIn: r.lastClockIn?.toISOString() ?? null,
    accumulatedSeconds: r.accumulatedSeconds ?? 0,
    totalSeconds: computeTotalSeconds(r),
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * GET /api/attendance[?userId=<id>][?date=<YYYY-MM-DD>]
 * Filters pushed to DB instead of fetching everything then filtering in JS.
 */
router.get("/attendance", async (req, res) => {
  try {
    const conditions: ReturnType<typeof eq>[] = [];
    if (req.query.userId) conditions.push(eq(attendanceTable.userId, req.query.userId as string));
    if (req.query.date) conditions.push(eq(attendanceTable.date, req.query.date as string));

    const [records, users] = await Promise.all([
      conditions.length > 0
        ? db.select().from(attendanceTable).where(and(...conditions)).orderBy(attendanceTable.date)
        : db.select().from(attendanceTable).orderBy(attendanceTable.date),
      getCachedUsers(),
    ]);

    const userMap = getUserMap(users);
    res.json(records.map(r => ({ ...formatRecord(r), user: userMap[r.userId] ?? null })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list attendance" });
  }
});

router.get("/attendance/today", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [record] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, todayStr())));
    if (!record) { res.status(404).json({ error: "No attendance record for today" }); return; }
    res.json(formatRecord(record));
  } catch (err) {
    res.status(500).json({ error: "Failed to get today's attendance" });
  }
});

router.post("/attendance/clock-in", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const today = todayStr();
    const [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));

    if (!existing) {
      const now = new Date();
      const [record] = await db.insert(attendanceTable).values({
        userId: req.user.id,
        clockIn: now,
        lastClockIn: now,
        date: today,
        status: "present",
        accumulatedSeconds: 0,
      }).returning();
      invalidateByPrefix("leaderboard:");
      res.status(201).json(formatRecord(record));
      return;
    }

    if (!existing.clockOut) { res.status(400).json({ error: "Already clocked in" }); return; }

    const now = new Date();
    const [updated] = await db.update(attendanceTable)
      .set({ lastClockIn: now, clockOut: null })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    invalidateByPrefix("leaderboard:");
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.post("/attendance/clock-out", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    // First try today; if nothing open, pick the most recent open record (day-boundary fix)
    const today = todayStr();
    let [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!existing) {
      // Look for any open session from a previous day
      const open = await db.select().from(attendanceTable)
        .where(eq(attendanceTable.userId, req.user.id))
        .orderBy(attendanceTable.clockIn);
      const openRecord = open.filter(r => !r.clockOut).pop();
      if (!openRecord) { res.status(404).json({ error: "No open clock-in found" }); return; }
      existing = openRecord;
    }
    if (existing.clockOut) { res.status(400).json({ error: "Already clocked out" }); return; }

    const sessionStart = existing.lastClockIn ?? existing.clockIn;
    const now = new Date();
    const sessionSeconds = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
    const newAccumulated = (existing.accumulatedSeconds ?? 0) + sessionSeconds;

    const [updated] = await db.update(attendanceTable)
      .set({ clockOut: now, accumulatedSeconds: newAccumulated })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    invalidateByPrefix("leaderboard:");
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

router.delete("/attendance/:id", requireAdminOrHR, async (req, res) => {
  try {
    await db.delete(attendanceTable).where(eq(attendanceTable.id, parseInt(String(req.params.id))));
    invalidateByPrefix("leaderboard:");
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete attendance record" });
  }
});

export default router;
