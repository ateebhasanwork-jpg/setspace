import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, attendanceTable, qualityChecksTable } from "@workspace/db/schema";
import { and, gte, lte } from "drizzle-orm";
import { getCachedUsers, getCached, invalidateByPrefix } from "../lib/cache";

const router: IRouter = Router();

/**
 * GET /api/leaderboard?month=<1-12>&year=<YYYY>
 *
 * 3-metric scoring:
 *   On-Time Tasks   50%  — % of assigned Done tasks completed before due date
 *   Quality Score   30%  — avg star rating × 20  (5 stars → 100 pts)
 *   Attendance      20%  — days present / working days in month × 100
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

      const [users, allAttendance, allQuality, allTasks] = await Promise.all([
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
      ]);

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
        // On-time score: % of completed tasks done before due date (tasks with no due date count as on-time)
        const tasks = tasksByUser[user.id] ?? [];
        const completedTasks = tasks.filter(t => t.completedAt);
        const onTimeTasks = completedTasks.filter(t => {
          if (!t.dueDate) return true;
          return t.completedAt! <= t.dueDate;
        });
        const onTimeScore = completedTasks.length > 0
          ? (onTimeTasks.length / completedTasks.length) * 100
          : 50; // neutral if no tasks

        // Quality score: avg rating × 20
        const qualityChecks = qualityByUser[user.id] ?? [];
        const avgRating = qualityChecks.length > 0
          ? qualityChecks.reduce((sum, q) => sum + q.rating, 0) / qualityChecks.length
          : 0;
        const qualityScore = avgRating * 20;
        const avgRevisions = qualityChecks.length > 0
          ? Math.round((qualityChecks.reduce((sum, q) => sum + (q.revisionCount ?? 0), 0) / qualityChecks.length) * 10) / 10
          : 0;

        // Attendance score: days present / working days × 100
        const attendanceRecords = attendanceByUser[user.id] ?? [];
        const attendanceScore = Math.min((attendanceRecords.length / workingDays) * 100, 100);

        // Composite score
        const score = onTimeScore * 0.5 + qualityScore * 0.3 + attendanceScore * 0.2;

        return {
          userId: user.id,
          user,
          score: Math.round(score * 10) / 10,
          onTimeScore: Math.round(onTimeScore * 10) / 10,
          qualityScore: Math.round(qualityScore * 10) / 10,
          attendanceScore: Math.round(attendanceScore * 10) / 10,
          // legacy fields kept for compatibility
          kpiScore: 0,
          avgRevisions,
          completedTasks: completedTasks.length,
          onTimeTasks: onTimeTasks.length,
          presentDays: attendanceRecords.length,
          workingDays,
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
