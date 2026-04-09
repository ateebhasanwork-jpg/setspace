import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { salariesTable, tasksTable, attendanceTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getCachedUsers, getUserMap } from "../lib/cache";
import { requireAdminOrHR } from "../middleware/roles";

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

    const [users, salaries, tasks, attendance] = await Promise.all([
      getCachedUsers(),
      db.select().from(salariesTable),
      db.select().from(tasksTable).where(
        and(gte(tasksTable.updatedAt, startDate), lte(tasksTable.updatedAt, endDate))
      ),
      db.select().from(attendanceTable).where(
        and(gte(attendanceTable.clockIn, startDate), lte(attendanceTable.clockIn, endDate))
      ),
    ]);

    const salaryByUser = Object.fromEntries(salaries.map(s => [s.userId, s]));

    // Compute working days for the month (Mon–Fri)
    let workingDays = 0;
    const d = new Date(startDate);
    while (d <= endDate) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
      d.setDate(d.getDate() + 1);
    }

    const result = users.map(user => {
      const salary = salaryByUser[user.id] ?? null;

      // Count absences: working days where the user has no attendance record
      const presentDates = new Set(
        attendance
          .filter(a => a.userId === user.id)
          .map(a => a.date)
      );
      let absences = 0;
      const c = new Date(startDate);
      while (c <= endDate) {
        const dow = c.getDay();
        if (dow !== 0 && dow !== 6) {
          const dateStr = c.toISOString().split("T")[0];
          if (!presentDates.has(dateStr)) absences++;
        }
        c.setDate(c.getDate() + 1);
      }

      // Count late tasks: Done tasks where completedAt > dueDate
      const userTasks = tasks.filter(t => t.assigneeId === user.id && t.status === "Done" && t.completedAt && t.dueDate);
      const lateTasks = userTasks.filter(t => t.completedAt! > t.dueDate!).length;

      const dependabilityTriggered = absences >= 2;
      const kpiTriggered = lateTasks >= 2;

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

    res.json(result);
  } catch (err) {
    console.error("Salaries error:", err);
    res.status(500).json({ error: "Failed to fetch salary data" });
  }
});

/**
 * PUT /api/salaries/:userId
 * Upsert salary config for a user. Admin/HR only.
 */
router.put("/salaries/:userId", requireAdminOrHR, async (req, res) => {
  try {
    const { userId } = req.params;
    const { basicSalary, overtimePayment, dependabilityDeductionAmount, kpiDeductionAmount } = req.body as {
      basicSalary?: number;
      overtimePayment?: number;
      dependabilityDeductionAmount?: number;
      kpiDeductionAmount?: number;
    };

    const [existing] = await db.select().from(salariesTable).where(eq(salariesTable.userId, userId));

    if (existing) {
      const [updated] = await db.update(salariesTable)
        .set({
          basicSalary: basicSalary ?? existing.basicSalary,
          overtimePayment: overtimePayment ?? existing.overtimePayment,
          dependabilityDeductionAmount: dependabilityDeductionAmount ?? existing.dependabilityDeductionAmount,
          kpiDeductionAmount: kpiDeductionAmount ?? existing.kpiDeductionAmount,
          updatedAt: new Date(),
        })
        .where(eq(salariesTable.userId, userId))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(salariesTable).values({
        userId,
        basicSalary: basicSalary ?? 0,
        overtimePayment: overtimePayment ?? 0,
        dependabilityDeductionAmount: dependabilityDeductionAmount ?? 0,
        kpiDeductionAmount: kpiDeductionAmount ?? 0,
      }).returning();
      res.status(201).json(created);
    }
  } catch (err) {
    console.error("Salary upsert error:", err);
    res.status(500).json({ error: "Failed to save salary" });
  }
});

export default router;
