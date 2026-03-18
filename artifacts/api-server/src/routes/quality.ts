import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { qualityChecksTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";

const router: IRouter = Router();

router.get("/quality-checks", async (req, res) => {
  try {
    const checks = await db.select().from(qualityChecksTable).orderBy(qualityChecksTable.createdAt);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    let result = checks.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      reviewer: userMap[c.reviewerId] ?? null,
      submitter: userMap[c.submitterId] ?? null,
    }));
    if (req.query.taskId) result = result.filter(c => c.taskId === parseInt(req.query.taskId as string));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list quality checks" });
  }
});

router.post("/quality-checks", requireAdminOrHR, async (req, res) => {
  try {
    const { taskId, submitterId, rating, feedback, status, videoVersionId } = req.body;
    const [check] = await db.insert(qualityChecksTable).values({
      taskId: taskId ?? null,
      reviewerId: req.user!.id,
      submitterId,
      rating,
      feedback: feedback ?? null,
      status: status ?? "pending",
      videoVersionId: videoVersionId ?? null,
    }).returning();
    res.status(201).json({ ...check, createdAt: check.createdAt.toISOString(), updatedAt: check.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create quality check" });
  }
});

router.patch("/quality-checks/:checkId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.checkId));
    const { rating, feedback, status } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (rating !== undefined) updates.rating = rating;
    if (feedback !== undefined) updates.feedback = feedback;
    if (status !== undefined) updates.status = status;
    const [updated] = await db.update(qualityChecksTable).set(updates).where(eq(qualityChecksTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Quality check not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update quality check" });
  }
});

export default router;
