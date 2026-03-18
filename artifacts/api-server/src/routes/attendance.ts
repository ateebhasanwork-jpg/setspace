import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function computeTotalSeconds(r: typeof attendanceTable.$inferSelect): number {
  const base = r.accumulatedSeconds ?? 0;
  if (!r.clockOut) {
    // Currently clocked in — add live session
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

router.get("/attendance", async (req, res) => {
  try {
    const records = await db.select().from(attendanceTable).orderBy(attendanceTable.date);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    let result = records.map(r => ({ ...formatRecord(r), user: userMap[r.userId] ?? null }));
    if (req.query.userId) result = result.filter(r => r.userId === req.query.userId);
    if (req.query.date) result = result.filter(r => r.date === req.query.date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list attendance" });
  }
});

router.get("/attendance/today", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const today = todayStr();
    const [record] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!record) {
      res.status(404).json({ error: "No attendance record for today" });
      return;
    }
    res.json(formatRecord(record));
  } catch (err) {
    res.status(500).json({ error: "Failed to get today's attendance" });
  }
});

router.post("/attendance/clock-in", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const today = todayStr();
    const [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));

    if (!existing) {
      // First clock-in of the day
      const now = new Date();
      const [record] = await db.insert(attendanceTable).values({
        userId: req.user.id,
        clockIn: now,
        lastClockIn: now,
        date: today,
        status: "present",
        accumulatedSeconds: 0,
      }).returning();
      res.status(201).json(formatRecord(record));
      return;
    }

    if (!existing.clockOut) {
      // Already actively clocked in
      res.status(400).json({ error: "Already clocked in" });
      return;
    }

    // Re-clock-in: resume the day — keep clockIn (first clock-in for on-time tracking)
    // but update lastClockIn to now and clear clockOut
    const now = new Date();
    const [updated] = await db.update(attendanceTable)
      .set({ lastClockIn: now, clockOut: null })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.post("/attendance/clock-out", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const today = todayStr();
    const [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!existing) {
      res.status(404).json({ error: "No clock-in found for today" });
      return;
    }
    if (existing.clockOut) {
      res.status(400).json({ error: "Already clocked out" });
      return;
    }

    // Compute how long this session lasted and add to accumulated
    const sessionStart = existing.lastClockIn ?? existing.clockIn;
    const now = new Date();
    const sessionSeconds = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
    const newAccumulated = (existing.accumulatedSeconds ?? 0) + sessionSeconds;

    const [updated] = await db.update(attendanceTable)
      .set({ clockOut: now, accumulatedSeconds: newAccumulated })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

export default router;
