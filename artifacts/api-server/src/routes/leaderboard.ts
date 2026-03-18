import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, tasksTable, attendanceTable, qualityChecksTable, kpiEntriesTable, kpisTable } from "@workspace/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;
    const year = parseInt(req.query.year as string) || now.getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const users = await db.select().from(usersTable);

    const leaderboard = await Promise.all(users.map(async (user) => {
      // KPI score: average % achievement across all KPIs
      const kpiEntries = await db.select().from(kpiEntriesTable).where(
        and(eq(kpiEntriesTable.userId, user.id), gte(kpiEntriesTable.recordedAt, startDate), lte(kpiEntriesTable.recordedAt, endDate))
      );
      const kpis = await db.select().from(kpisTable).where(eq(kpisTable.userId, user.id));
      let kpiScore = 0;
      if (kpis.length > 0 && kpiEntries.length > 0) {
        const achievements = kpis.map(kpi => {
          const entry = kpiEntries.find(e => e.kpiId === kpi.id);
          if (!entry) return 0;
          return Math.min((parseFloat(entry.actualValue) / parseFloat(kpi.targetValue)) * 100, 100);
        });
        kpiScore = achievements.reduce((a, b) => a + b, 0) / kpis.length;
      }

      // Attendance score: days present / working days * 100
      const attendanceRecords = await db.select().from(attendanceTable).where(
        and(eq(attendanceTable.userId, user.id), eq(attendanceTable.status, "present"), gte(attendanceTable.clockIn, startDate), lte(attendanceTable.clockIn, endDate))
      );
      const workingDays = 22;
      const attendanceScore = Math.min((attendanceRecords.length / workingDays) * 100, 100);

      // Quality score: average rating * 20
      const qualityChecks = await db.select().from(qualityChecksTable).where(
        and(eq(qualityChecksTable.submitterId, user.id), gte(qualityChecksTable.createdAt, startDate), lte(qualityChecksTable.createdAt, endDate))
      );
      const qualityScore = qualityChecks.length > 0
        ? (qualityChecks.reduce((sum, q) => sum + q.rating, 0) / qualityChecks.length) * 20
        : 0;

      // On-time score: completed tasks on time / total completed tasks
      const tasks = await db.select().from(tasksTable).where(
        and(eq(tasksTable.assigneeId, user.id), gte(tasksTable.completedAt, startDate), lte(tasksTable.completedAt, endDate))
      );
      const completedTasks = tasks.filter(t => t.completedAt);
      const onTimeTasks = completedTasks.filter(t => !t.dueDate || (t.completedAt! <= t.dueDate));
      const onTimeScore = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 50;

      const score = kpiScore * 0.35 + attendanceScore * 0.25 + qualityScore * 0.25 + onTimeScore * 0.15;

      return {
        userId: user.id,
        user: { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
        score: Math.round(score * 10) / 10,
        kpiScore: Math.round(kpiScore * 10) / 10,
        attendanceScore: Math.round(attendanceScore * 10) / 10,
        qualityScore: Math.round(qualityScore * 10) / 10,
        onTimeScore: Math.round(onTimeScore * 10) / 10,
        month, year, rank: 0
      };
    }));

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute leaderboard" });
  }
});

export default router;
