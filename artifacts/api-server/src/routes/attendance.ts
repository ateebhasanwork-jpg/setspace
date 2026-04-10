import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { getCachedUsers, getUserMap, getCachedScheduleSlots, invalidateByPrefix, getCached } from "../lib/cache";

const ATTENDANCE_TTL_MS = 2 * 60_000; // 2 minutes

const router: IRouter = Router();

// All employee schedules are in Pakistan Standard Time (UTC+5)
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Day-of-week (0=Sun … 6=Sat) in PKT for any UTC Date */
function pktDow(d: Date): number {
  return new Date(d.getTime() + PKT_OFFSET_MS).getUTCDay();
}

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

type ScheduleSlot = { dayOfWeek: number; loginHour: number; loginMinute: number; shiftHours: number };

function computeLate(
  clockIn: Date,
  slot: ScheduleSlot | undefined
): { isLate: boolean; lateMinutes: number } {
  if (!slot) return { isLate: false, lateMinutes: 0 };

  // Shift clock-in to PKT so we work in the employee's local calendar date
  const clockInPKT = new Date(clockIn.getTime() + PKT_OFFSET_MS);

  // Build the scheduled moment in PKT: same PKT calendar date, loginHour:loginMinute
  const scheduledPKT = new Date(clockInPKT);
  scheduledPKT.setUTCHours(slot.loginHour, slot.loginMinute, 0, 0);

  // Convert back to real UTC for comparison
  const scheduledUTC = new Date(scheduledPKT.getTime() - PKT_OFFSET_MS);

  const diffSeconds = (clockIn.getTime() - scheduledUTC.getTime()) / 1000;
  const isLate = diffSeconds > 10 * 60; // >10 min grace
  const lateMinutes = isLate ? Math.round(diffSeconds / 60) : 0;
  return { isLate, lateMinutes };
}

function formatRecord(
  r: typeof attendanceTable.$inferSelect,
  slot: ScheduleSlot | undefined
) {
  const totalSeconds = computeTotalSeconds(r);
  const { isLate, lateMinutes } = computeLate(r.clockIn, slot);
  const scheduledShiftHours = slot?.shiftHours ?? 4;
  return {
    ...r,
    clockIn: r.clockIn.toISOString(),
    clockOut: r.clockOut?.toISOString() ?? null,
    lastClockIn: r.lastClockIn?.toISOString() ?? null,
    accumulatedSeconds: r.accumulatedSeconds ?? 0,
    totalSeconds,
    createdAt: r.createdAt.toISOString(),
    isLate,
    lateMinutes,
    scheduledShiftHours,
  };
}

/**
 * GET /api/attendance[?userId=<id>][?date=<YYYY-MM-DD>]
 */
router.get("/attendance", async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const date = req.query.date as string | undefined;
    const cacheKey = `attendance:${userId ?? "all"}:${date ?? "all"}`;

    const result = await getCached(cacheKey, ATTENDANCE_TTL_MS, async () => {
      const conditions: ReturnType<typeof eq>[] = [];
      if (userId) conditions.push(eq(attendanceTable.userId, userId));
      if (date) conditions.push(eq(attendanceTable.date, date));

      const [records, users, allSlots] = await Promise.all([
        conditions.length > 0
          ? db.select().from(attendanceTable).where(and(...conditions)).orderBy(attendanceTable.date)
          : db.select().from(attendanceTable).orderBy(attendanceTable.date),
        getCachedUsers(),
        getCachedScheduleSlots(),
      ]);

      const slotMap: Record<string, ScheduleSlot> = {};
      for (const s of allSlots) {
        slotMap[`${s.userId}:${s.dayOfWeek}`] = s;
      }

      const userMap = getUserMap(users);
      return records.map(r => {
        const dow = pktDow(r.clockIn);
        const slot = slotMap[`${r.userId}:${dow}`];
        return { ...formatRecord(r, slot), user: userMap[r.userId] ?? null };
      });
    });

    res.json(result);
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

    const dow = pktDow(record.clockIn);
    const allSlots = await getCachedScheduleSlots();
    const slot = allSlots.find(s => s.userId === req.user.id && s.dayOfWeek === dow);
    res.json(formatRecord(record, slot));
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

    const now = new Date();
    const dow = pktDow(now);
    const allSlots = await getCachedScheduleSlots();
    const slot = allSlots.find(s => s.userId === req.user.id && s.dayOfWeek === dow);

    if (!existing) {
      const [record] = await db.insert(attendanceTable).values({
        userId: req.user.id,
        clockIn: now,
        lastClockIn: now,
        date: today,
        status: "present",
        accumulatedSeconds: 0,
      }).returning();
      invalidateByPrefix("leaderboard:");
      invalidateByPrefix("attendance:");
      res.status(201).json(formatRecord(record, slot));
      return;
    }

    if (!existing.clockOut) { res.status(400).json({ error: "Already clocked in" }); return; }

    const [updated] = await db.update(attendanceTable)
      .set({ lastClockIn: now, clockOut: null })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    invalidateByPrefix("leaderboard:");
    invalidateByPrefix("attendance:");
    res.json(formatRecord(updated, slot));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.post("/attendance/clock-out", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const today = todayStr();
    let [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!existing) {
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
    invalidateByPrefix("attendance:");

    const dow = pktDow(updated.clockIn);
    const allSlots2 = await getCachedScheduleSlots();
    const slot = allSlots2.find(s => s.userId === req.user.id && s.dayOfWeek === dow);
    res.json(formatRecord(updated, slot));
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
