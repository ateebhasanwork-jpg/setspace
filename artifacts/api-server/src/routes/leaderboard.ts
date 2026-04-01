import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, attendanceTable, qualityChecksTable, kpiEntriesTable, kpisTable } from "@workspace/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getCachedUsers, getUserMap, getCached, invalidateByPrefix } from "../lib/cache";

const router: IRouter = Router();

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * GET /api/leaderboard?month=<1-12>&year=<YYYY>
 *
 * Before: 1 users SELECT + (4 queries × N users) = 41 queries for 10 users.
 * After : 6 bulk queries total, all computation done in JS, result cached 5 min.
 * With 8 concurrent users: 6 queries (first user) + 0 queries × 7 (cache hit).
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

      // 6 bulk queries instead of 1 + (4 × N)
      const [users, allKpiEntries, allKpis, allAttendance, allQuality, allTasks] = await Promise.all([
        getCachedUsers(),
        db.select().from(kpiEntriesTable).where(and(gte(kpiEntriesTable.recordedAt, startDate), lte(kpiEntriesTable.recordedAt, endDate))),
        db.select().from(kpisTable),
        db.select().from(attendanceTable).where(and(eq(attendanceTable.status, "present"), gte(attendanceTable.clockIn, startDate), lte(attendanceTable.clockIn, endDate))),
        db.select().from(qualityChecksTable).where(and(gte(qualityChecksTable.createdAt, startDate), lte(qualityChecksTable.createdAt, endDate))),
        db.select().from(tasksTable).where(and(gte(tasksTable.completedAt, startDate), lte(tasksTable.completedAt, endDate))),
      ]);

      // Group all data by userId in JS — zero additional queries
      const kpiEntriesByUser = groupBy(allKpiEntries, e => e.userId);
      const kpisByUser = groupBy(allKpis, k => k.userId);
      const attendanceByUser = groupBy(allAttendance, a => a.userId);
      const qualityByUser = groupBy(allQuality, q => q.submitterId);
      const tasksByUser = groupBy(allTasks, t => t.assigneeId ?? "");

      const leaderboard = users.map(user => {
        // KPI score
        const kpis = kpisByUser[user.id] ?? [];
        const kpiEntries = kpiEntriesByUser[user.id] ?? [];
        let kpiScore = 0;
        if (kpis.length > 0) {
          const achievements = kpis.map(kpi => {
            const total = kpiEntries
              .filter(e => e.kpiId === kpi.id)
              .reduce((sum, e) => sum + parseFloat(e.actualValue), 0);
            if (total === 0) return 0;
            return Math.min((total / parseFloat(kpi.targetValue)) * 100, 100);
          });
          kpiScore = achievements.reduce((a, b) => a + b, 0) / kpis.length;
        }

        // Attendance score
        const attendanceRecords = attendanceByUser[user.id] ?? [];
        const workingDays = 22;
        const attendanceScore = Math.min((attendanceRecords.length / workingDays) * 100, 100);

        // Quality score
        const qualityChecks = qualityByUser[user.id] ?? [];
        const qualityScore = qualityChecks.length > 0
          ? (qualityChecks.reduce((sum, q) => sum + q.rating, 0) / qualityChecks.length) * 20
          : 0;
        const avgRevisions = qualityChecks.length > 0
          ? Math.round((qualityChecks.reduce((sum, q) => sum + (q.revisionCount ?? 0), 0) / qualityChecks.length) * 10) / 10
          : 0;

        // On-time score
        const tasks = tasksByUser[user.id] ?? [];
        const completedTasks = tasks.filter(t => t.completedAt);
        const onTimeTasks = completedTasks.filter(t => {
          if (!t.dueDate) return true;
          return toDateStr(t.completedAt) <= toDateStr(t.dueDate);
        });
        const onTimeScore = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 50;

        const score = kpiScore * 0.35 + attendanceScore * 0.25 + qualityScore * 0.25 + onTimeScore * 0.15;

        return {
          userId: user.id,
          user,
          score: Math.round(score * 10) / 10,
          kpiScore: Math.round(kpiScore * 10) / 10,
          attendanceScore: Math.round(attendanceScore * 10) / 10,
          qualityScore: Math.round(qualityScore * 10) / 10,
          onTimeScore: Math.round(onTimeScore * 10) / 10,
          avgRevisions,
          completedTasks: completedTasks.length,
          onTimeTasks: onTimeTasks.length,
          presentDays: attendanceRecords.length,
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
