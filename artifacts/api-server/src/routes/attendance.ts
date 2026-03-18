import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatRecord(r: typeof attendanceTable.$inferSelect) {
  return {
    ...r,
    clockIn: r.clockIn.toISOString(),
    clockOut: r.clockOut?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString()
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
    const existing = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (existing.length > 0) {
      res.status(400).json({ error: "Already clocked in today" });
      return;
    }
    const [record] = await db.insert(attendanceTable).values({
      userId: req.user.id,
      clockIn: new Date(),
      date: today,
      status: "present"
    }).returning();
    res.status(201).json(formatRecord(record));
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
    const [updated] = await db.update(attendanceTable)
      .set({ clockOut: new Date() })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

export default router;
