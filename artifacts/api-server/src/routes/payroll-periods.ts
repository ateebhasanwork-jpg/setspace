import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { payrollPeriodsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";

const router: IRouter = Router();

router.get("/payroll-periods", requireAdminOrHR, async (_req, res) => {
  try {
    const periods = await db
      .select()
      .from(payrollPeriodsTable)
      .orderBy(payrollPeriodsTable.startDate);
    res.json(periods);
  } catch (err) {
    console.error("Payroll periods fetch error:", err);
    res.status(500).json({ error: "Failed to fetch payroll periods" });
  }
});

router.post("/payroll-periods", requireAdminOrHR, async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body as {
      name?: string;
      startDate?: string;
      endDate?: string;
    };
    if (!name?.trim() || !startDate || !endDate) {
      return res.status(400).json({ error: "name, startDate and endDate are required" });
    }
    const [created] = await db
      .insert(payrollPeriodsTable)
      .values({ name: name.trim(), startDate, endDate })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    console.error("Payroll period create error:", err);
    res.status(500).json({ error: "Failed to create payroll period" });
  }
});

router.patch("/payroll-periods/:id", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, startDate, endDate } = req.body as {
      name?: string;
      startDate?: string;
      endDate?: string;
    };
    const updates: Partial<{ name: string; startDate: string; endDate: string }> = {};
    if (name !== undefined) updates.name = name.trim();
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    const [updated] = await db
      .update(payrollPeriodsTable)
      .set(updates)
      .where(eq(payrollPeriodsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Period not found" });
    res.json(updated);
  } catch (err) {
    console.error("Payroll period update error:", err);
    res.status(500).json({ error: "Failed to update payroll period" });
  }
});

router.delete("/payroll-periods/:id", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Payroll period delete error:", err);
    res.status(500).json({ error: "Failed to delete payroll period" });
  }
});

export default router;
