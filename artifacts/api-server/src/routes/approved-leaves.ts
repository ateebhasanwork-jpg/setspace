import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { approvedLeavesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";

const router: IRouter = Router();

/**
 * GET /api/approved-leaves/:userId
 * Returns all approved leaves for a given employee. Admin/HR only.
 */
router.get("/approved-leaves/:userId", requireAdminOrHR, async (req, res) => {
  try {
    const { userId } = req.params;
    const leaves = await db.select().from(approvedLeavesTable)
      .where(eq(approvedLeavesTable.userId, userId))
      .orderBy(approvedLeavesTable.date);
    res.json(leaves);
  } catch (err) {
    console.error("Approved leaves GET error:", err);
    res.status(500).json({ error: "Failed to fetch approved leaves" });
  }
});

/**
 * POST /api/approved-leaves
 * Add an approved leave day for an employee. Admin/HR only.
 * Body: { userId, date (YYYY-MM-DD), note? }
 */
router.post("/approved-leaves", requireAdminOrHR, async (req, res) => {
  try {
    const { userId, date, note } = req.body as { userId: string; date: string; note?: string };
    if (!userId || !date) return res.status(400).json({ error: "userId and date are required" });

    // Prevent duplicates
    const existing = await db.select().from(approvedLeavesTable)
      .where(and(eq(approvedLeavesTable.userId, userId), eq(approvedLeavesTable.date, date)));
    if (existing.length > 0) return res.json(existing[0]);

    const [created] = await db.insert(approvedLeavesTable)
      .values({ userId, date, note: note ?? null })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    console.error("Approved leaves POST error:", err);
    res.status(500).json({ error: "Failed to add approved leave" });
  }
});

/**
 * DELETE /api/approved-leaves/:id
 * Remove an approved leave entry by its ID. Admin/HR only.
 */
router.delete("/approved-leaves/:id", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(approvedLeavesTable).where(eq(approvedLeavesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Approved leaves DELETE error:", err);
    res.status(500).json({ error: "Failed to delete approved leave" });
  }
});

export default router;
