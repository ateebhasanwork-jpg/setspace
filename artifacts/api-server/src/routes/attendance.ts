import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

router.get("/attendance", async (req, res) => {
  try {
    const records = await db.select().from(attendanceTable).orderBy(attendanceTable.date);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    let result = records.map(r => ({
      ...r,
      clockIn: r.clockIn.toISOString(),
      clockOut: r.clockOut?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: userMap[r.userId] ?? null
    }));
    if (req.query.userId) result = result.filter(r => r.userId === req.query.userId);
    if (req.query.date) result = result.filter(r => r.date === req.query.date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list attendance" });
  }
});

router.get("/attendance/today", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const today = todayStr();
    const [record] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!record) return res.status(404).json({ error: "No attendance record for today" });
    res.json({ ...record, clockIn: record.clockIn.toISOString(), clockOut: record.clockOut?.toISOString() ?? null, createdAt: record.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get today's attendance" });
  }
});

router.post("/attendance/clock-in", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const today = todayStr();
    const existing = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (existing.length > 0) return res.status(400).json({ error: "Already clocked in today" });
    const [record] = await db.insert(attendanceTable).values({
      userId: req.user.id,
      clockIn: new Date(),
      date: today,
      status: "present"
    }).returning();
    res.status(201).json({ ...record, clockIn: record.clockIn.toISOString(), clockOut: null, createdAt: record.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.post("/attendance/clock-out", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const today = todayStr();
    const [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.user.id), eq(attendanceTable.date, today)));
    if (!existing) return res.status(404).json({ error: "No clock-in found for today" });
    const [updated] = await db.update(attendanceTable)
      .set({ clockOut: new Date() })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
    res.json({ ...updated, clockIn: updated.clockIn.toISOString(), clockOut: updated.clockOut?.toISOString() ?? null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

export default router;
