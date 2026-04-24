import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salariesTable, tasksTable, attendanceTable, appSettingsTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getCachedUsers } from "../lib/cache";
import { requireAdminOrHR } from "../middleware/roles";
import { broadcastSseToUser } from "../lib/sse";

const router: IRouter = Router();

function monthBounds(year: number, month: number) {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59),
  };
}

/**
 * GET /api/salaries?month=<1-12>&year=<YYYY>
 * Returns all employees with their salary config + computed deduction flags for the given month.
 * Admin/HR only.
 */
router.get("/salaries", requireAdminOrHR, async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const { startDate, endDate } = monthBounds(year, month);

    const [users, salaries, tasks, attendance, trackingRows] = await Promise.all([
      getCachedUsers(),
      db.select().from(salariesTable),
      db.select().from(tasksTable).where(
        and(gte(tasksTable.updatedAt, startDate), lte(tasksTable.updatedAt, endDate))
      ),
      db.select().from(attendanceTable).where(
        and(gte(attendanceTable.clockIn, startDate), lte(attendanceTable.clockIn, endDate))
      ),
      db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "kpiTrackingStartDate")).limit(1),
    ]);

    // Effective start: max(first of month, kpiTrackingStartDate setting)
    const rawTracking = trackingRows[0]?.value ?? null;
    const trackingDate = rawTracking ? new Date(rawTracking) : null;
    // Strip time so comparison is date-only
    const effectiveStart: Date = (() => {
      if (trackingDate && !isNaN(trackingDate.getTime()) && trackingDate > startDate) {
        return new Date(trackingDate.getFullYear(), trackingDate.getMonth(), trackingDate.getDate());
      }
      return new Date(startDate);
    })();

    const salaryByUser = Object.fromEntries(salaries.map(s => [s.userId, s]));

    // Compute global working days for the month starting from effectiveStart (Mon–Fri)
    let globalWorkingDays = 0;
    const d = new Date(effectiveStart);
    while (d <= endDate) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) globalWorkingDays++;
      d.setDate(d.getDate() + 1);
    }

    const result = users.map(user => {
      const salary = salaryByUser[user.id] ?? null;

      // Per-employee working days: use override if set, otherwise auto Mon–Fri from effectiveStart
      const workingDays = salary?.workingDaysOverride ?? globalWorkingDays;
      const kpiThreshold = salary?.kpiThreshold ?? 2;
      const dependabilityThreshold = salary?.dependabilityThreshold ?? 2;

      // Count absences: working days in [effectiveStart, today] where no attendance record
      const todayCap = new Date();
      todayCap.setHours(23, 59, 59, 999);
      const effectiveEnd = endDate < todayCap ? endDate : todayCap;

      const presentDates = new Set(
        attendance
          .filter(a => a.userId === user.id)
          .map(a => a.date)
      );
      let absences = 0;
      const c = new Date(effectiveStart);
      while (c <= effectiveEnd) {
        const dow = c.getDay();
        if (dow !== 0 && dow !== 6) {
          const dateStr = c.toISOString().split("T")[0];
          if (!presentDates.has(dateStr)) absences++;
        }
        c.setDate(c.getDate() + 1);
      }
      // Cap absences at workingDays if override is set (can't be absent more than working days)
      if (salary?.workingDaysOverride != null) {
        absences = Math.min(absences, workingDays);
      }

      // Count late tasks: Done tasks where completedAt > dueDate
      const userTasks = tasks.filter(t => t.assigneeId === user.id && t.status === "Done" && t.completedAt && t.dueDate);
      const lateTasks = userTasks.filter(t => t.completedAt! > t.dueDate!).length;

      const dependabilityTriggered = dependabilityThreshold > 0 && absences >= dependabilityThreshold;
      const kpiTriggered = kpiThreshold > 0 && lateTasks >= kpiThreshold;

      const basicSalary = salary?.basicSalary ?? 0;
      const overtimePayment = salary?.overtimePayment ?? 0;
      const dependabilityDeduction = dependabilityTriggered ? (salary?.dependabilityDeductionAmount ?? 0) : 0;
      const kpiDeduction = kpiTriggered ? (salary?.kpiDeductionAmount ?? 0) : 0;
      const netSalary = basicSalary + overtimePayment - dependabilityDeduction - kpiDeduction;

      return {
        user,
        salary,
        absences,
        workingDays,
        kpiThreshold,
        dependabilityThreshold,
        lateTasks,
        dependabilityTriggered,
        kpiTriggered,
        basicSalary,
        overtimePayment,
        dependabilityDeduction,
        kpiDeduction,
        netSalary,
      };
    });

    res.json({
      rows: result,
      trackingStartDate: rawTracking ?? null,
    });
  } catch (err) {
    console.error("Salaries error:", err);
    res.status(500).json({ error: "Failed to fetch salary data" });
  }
});

/**
 * GET /api/salaries/me
 * Returns the logged-in user's own salary config (thresholds + working days override only, no amounts).
 */
router.get("/salaries/me", async (req, res) => {
  try {
    const session = (req as { session?: { userId?: string } }).session;
    const userId = session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const [row] = await db.select().from(salariesTable).where(eq(salariesTable.userId, userId));
    res.json({
      workingDaysOverride: row?.workingDaysOverride ?? null,
      kpiThreshold: row?.kpiThreshold ?? 2,
      dependabilityThreshold: row?.dependabilityThreshold ?? 2,
    });
  } catch (err) {
    console.error("Salary me error:", err);
    res.status(500).json({ error: "Failed to fetch salary config" });
  }
});

/**
 * PUT /api/salaries/:userId
 * Upsert salary config for a user. Admin/HR only.
 */
router.put("/salaries/:userId", requireAdminOrHR, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      basicSalary,
      overtimePayment,
      dependabilityDeductionAmount,
      kpiDeductionAmount,
      workingDaysOverride,
      kpiThreshold,
      dependabilityThreshold,
    } = req.body as {
      basicSalary?: number;
      overtimePayment?: number;
      dependabilityDeductionAmount?: number;
      kpiDeductionAmount?: number;
      workingDaysOverride?: number | null;
      kpiThreshold?: number;
      dependabilityThreshold?: number;
    };

    const [existing] = await db.select().from(salariesTable).where(eq(salariesTable.userId, userId));

    const updates = {
      basicSalary: basicSalary ?? existing?.basicSalary ?? 0,
      overtimePayment: overtimePayment ?? existing?.overtimePayment ?? 0,
      dependabilityDeductionAmount: dependabilityDeductionAmount ?? existing?.dependabilityDeductionAmount ?? 0,
      kpiDeductionAmount: kpiDeductionAmount ?? existing?.kpiDeductionAmount ?? 0,
      workingDaysOverride: workingDaysOverride !== undefined ? workingDaysOverride : (existing?.workingDaysOverride ?? null),
      kpiThreshold: kpiThreshold ?? existing?.kpiThreshold ?? 2,
      dependabilityThreshold: dependabilityThreshold ?? existing?.dependabilityThreshold ?? 2,
      updatedAt: new Date(),
    };

    let saved;
    if (existing) {
      const [updated] = await db.update(salariesTable)
        .set(updates)
        .where(eq(salariesTable.userId, userId))
        .returning();
      saved = updated;
      res.json(updated);
    } else {
      const [created] = await db.insert(salariesTable).values({ userId, ...updates }).returning();
      saved = created;
      res.status(201).json(created);
    }

    // Notify the employee in real time so their view refreshes immediately
    if (saved) broadcastSseToUser(userId, "salary-config", {});
  } catch (err) {
    console.error("Salary upsert error:", err);
    res.status(500).json({ error: "Failed to save salary" });
  }
});

/**
 * DELETE /api/salaries/:userId
 * Removes the salary config for a user (resets to defaults). Admin/HR only.
 */
router.delete("/salaries/:userId", requireAdminOrHR, async (req, res) => {
  try {
    const { userId } = req.params;
    await db.delete(salariesTable).where(eq(salariesTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    console.error("Salary delete error:", err);
    res.status(500).json({ error: "Failed to delete salary config" });
  }
});

export default router;
