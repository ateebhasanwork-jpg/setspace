import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, scheduleSlotsTable } from "@workspace/db/schema";
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

type ScheduleSlot = { dayOfWeek: number; loginHour: number; loginMinute: number; shiftHours: number };

function computeLate(
  clockIn: Date,
  slot: ScheduleSlot | undefined
): { isLate: boolean; lateMinutes: number } {
  if (!slot) return { isLate: false, lateMinutes: 0 };

  // Build scheduled time for the same calendar date as clockIn
  const scheduled = new Date(clockIn);
  scheduled.setHours(slot.loginHour, slot.loginMinute, 0, 0);

  const diffSeconds = (clockIn.getTime() - scheduled.getTime()) / 1000;
  const isLate = diffSeconds > 10 * 60; // >10 min late
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
    const conditions: ReturnType<typeof eq>[] = [];
    if (req.query.userId) conditions.push(eq(attendanceTable.userId, req.query.userId as string));
    if (req.query.date) conditions.push(eq(attendanceTable.date, req.query.date as string));

    const [records, users, allSlots] = await Promise.all([
      conditions.length > 0
        ? db.select().from(attendanceTable).where(and(...conditions)).orderBy(attendanceTable.date)
        : db.select().from(attendanceTable).orderBy(attendanceTable.date),
      getCachedUsers(),
      db.select().from(scheduleSlotsTable),
    ]);

    // Index slots by "userId:dayOfWeek"
    const slotMap: Record<string, ScheduleSlot> = {};
    for (const s of allSlots) {
      slotMap[`${s.userId}:${s.dayOfWeek}`] = s;
    }

    const userMap = getUserMap(users);
    res.json(records.map(r => {
      const dow = r.clockIn.getDay();
      const slot = slotMap[`${r.userId}:${dow}`];
      return { ...formatRecord(r, slot), user: userMap[r.userId] ?? null };
    }));
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

    const dow = record.clockIn.getDay();
    const [slot] = await db.select().from(scheduleSlotsTable)
      .where(and(eq(scheduleSlotsTable.userId, req.user.id), eq(scheduleSlotsTable.dayOfWeek, dow)));
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
    const dow = now.getDay();
    const [slot] = await db.select().from(scheduleSlotsTable)
      .where(and(eq(scheduleSlotsTable.userId, req.user.id), eq(scheduleSlotsTable.dayOfWeek, dow)));

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
      res.status(201).json(formatRecord(record, slot));
      return;
    }

    if (!existing.clockOut) { res.status(400).json({ error: "Already clocked in" }); return; }

    const [updated] = await db.update(attendanceTable)
      .set({ lastClockIn: now, clockOut: null })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    invalidateByPrefix("leaderboard:");
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

    const dow = updated.clockIn.getDay();
    const [slot] = await db.select().from(scheduleSlotsTable)
      .where(and(eq(scheduleSlotsTable.userId, req.user.id), eq(scheduleSlotsTable.dayOfWeek, dow)));
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
