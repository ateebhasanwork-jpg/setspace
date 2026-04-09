import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, attendanceTable, qualityChecksTable, scheduleSlotsTable } from "@workspace/db/schema";
import { and, gte, lte } from "drizzle-orm";
import { getCachedUsers, getCached, invalidateByPrefix } from "../lib/cache";

const router: IRouter = Router();

/**
 * GET /api/leaderboard?month=<1-12>&year=<YYYY>
 *
 * 4-metric scoring:
 *   On-Time Tasks    40%  — % of assigned Done tasks completed on or before due date
 *   Quality Score    25%  — avg star rating × 20  (5 stars → 100 pts)
 *   Attendance       20%  — days present / scheduled working days
 *   Punctuality      15%  — % of scheduled days clocked in on time (within 10 min)
 *
 * Result cached 5 min.
 */
router.get("/leaderboard", async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const cacheKey = `leaderboard:${year}-${month}`;

    const data = await getCached(cacheKey, 5 * 60_000, async () => {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const [users, allAttendance, allQuality, allTasks, allSlots] = await Promise.all([
        getCachedUsers(),
        db.select().from(attendanceTable).where(
          and(gte(attendanceTable.clockIn, startDate), lte(attendanceTable.clockIn, endDate))
        ),
        db.select().from(qualityChecksTable).where(
          and(gte(qualityChecksTable.createdAt, startDate), lte(qualityChecksTable.createdAt, endDate))
        ),
        db.select().from(tasksTable).where(
          and(gte(tasksTable.completedAt, startDate), lte(tasksTable.completedAt, endDate))
        ),
        db.select().from(scheduleSlotsTable),
      ]);

      // Index schedule slots by "userId:dayOfWeek"
      const slotMap: Record<string, { loginHour: number; loginMinute: number; shiftHours: number }> = {};
      for (const s of allSlots) {
        slotMap[`${s.userId}:${s.dayOfWeek}`] = s;
      }

      // Count working days (Mon–Fri) in the month
      let workingDays = 0;
      const d = new Date(startDate);
      while (d <= endDate) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) workingDays++;
        d.setDate(d.getDate() + 1);
      }

      const attendanceByUser = groupBy(allAttendance, a => a.userId);
      const qualityByUser = groupBy(allQuality, q => q.submitterId);
      const tasksByUser = groupBy(allTasks, t => t.assigneeId ?? "");

      const leaderboard = users.map(user => {
        // ── On-time tasks (40%) ──
        const tasks = tasksByUser[user.id] ?? [];
        const completedTasks = tasks.filter(t => t.completedAt);
        const onTimeTasks = completedTasks.filter(t => !t.dueDate || t.completedAt! <= t.dueDate);
        const onTimeScore = completedTasks.length > 0
          ? (onTimeTasks.length / completedTasks.length) * 100
          : 50; // neutral if no tasks

        // ── Quality (25%) ──
        const qualityChecks = qualityByUser[user.id] ?? [];
        const avgRating = qualityChecks.length > 0
          ? qualityChecks.reduce((sum, q) => sum + q.rating, 0) / qualityChecks.length
          : 0;
        const qualityScore = avgRating * 20;
        const avgRevisions = qualityChecks.length > 0
          ? Math.round((qualityChecks.reduce((sum, q) => sum + (q.revisionCount ?? 0), 0) / qualityChecks.length) * 10) / 10
          : 0;

        // ── Attendance (20%) ──
        const attendanceRecords = attendanceByUser[user.id] ?? [];

        // Use scheduled working days for this user (or fall back to Mon-Fri)
        const userScheduledDows = new Set(
          allSlots.filter(s => s.userId === user.id).map(s => s.dayOfWeek)
        );
        let userWorkingDays = workingDays; // default Mon-Fri count
        if (userScheduledDows.size > 0) {
          // Recount using user's specific schedule days
          userWorkingDays = 0;
          const c = new Date(startDate);
          while (c <= endDate) {
            if (userScheduledDows.has(c.getDay())) userWorkingDays++;
            c.setDate(c.getDate() + 1);
          }
        }
        const attendanceScore = userWorkingDays > 0
          ? Math.min((attendanceRecords.length / userWorkingDays) * 100, 100)
          : 0;

        // ── Punctuality (15%) — on-time clock-ins ──
        let onTimeLogins = 0;
        let scheduledLoginDays = 0;
        for (const rec of attendanceRecords) {
          const dow = rec.clockIn.getDay();
          const slot = slotMap[`${user.id}:${dow}`];
          if (!slot) continue; // no schedule for this day → skip
          scheduledLoginDays++;
          const scheduled = new Date(rec.clockIn);
          scheduled.setHours(slot.loginHour, slot.loginMinute, 0, 0);
          const diffSeconds = (rec.clockIn.getTime() - scheduled.getTime()) / 1000;
          if (diffSeconds <= 10 * 60) onTimeLogins++;
        }
        const punctualityScore = scheduledLoginDays > 0
          ? (onTimeLogins / scheduledLoginDays) * 100
          : 75; // neutral if no schedule

        // ── Composite ──
        const score = onTimeScore * 0.40 + qualityScore * 0.25 + attendanceScore * 0.20 + punctualityScore * 0.15;

        return {
          userId: user.id,
          user,
          score: Math.round(score * 10) / 10,
          onTimeScore: Math.round(onTimeScore * 10) / 10,
          qualityScore: Math.round(qualityScore * 10) / 10,
          attendanceScore: Math.round(attendanceScore * 10) / 10,
          punctualityScore: Math.round(punctualityScore * 10) / 10,
          onTimeLogins,
          scheduledLoginDays,
          kpiScore: 0,
          avgRevisions,
          completedTasks: completedTasks.length,
          onTimeTasks: onTimeTasks.length,
          presentDays: attendanceRecords.length,
          workingDays: userWorkingDays,
          month, year, rank: 0,
        };
      });

      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard.forEach((entry, i) => { entry.rank = i + 1; });
      return leaderboard;
    });

    res.json(data);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to compute leaderboard" });
  }
});

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

export { invalidateByPrefix };
export default router;
