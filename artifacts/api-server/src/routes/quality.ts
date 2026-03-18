import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { qualityChecksTable, usersTable, notificationsTable } from "@workspace/db/schema";
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
    const { taskId, submitterId, rating, feedback, status, videoVersionId, revisionCount } = req.body;
    const [check] = await db.insert(qualityChecksTable).values({
      taskId: taskId ?? null,
      reviewerId: req.user!.id,
      submitterId,
      rating,
      feedback: feedback ?? null,
      status: status ?? "pending",
      videoVersionId: videoVersionId ?? null,
      revisionCount: revisionCount ?? 0,
    }).returning();

    if (submitterId && submitterId !== req.user!.id) {
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const revNote = revisionCount > 0 ? ` · ${revisionCount} revision${revisionCount > 1 ? "s" : ""}` : "";
      await db.insert(notificationsTable).values({
        userId: submitterId,
        type: "quality_evaluation",
        title: "You received an evaluation",
        body: `Rating: ${stars}${revNote}${feedback ? ` — "${feedback.slice(0, 80)}${feedback.length > 80 ? "…" : ""}"` : ""}`,
        linkUrl: "/quality-checks",
      }).catch(() => {});
    }

    res.status(201).json({ ...check, createdAt: check.createdAt.toISOString(), updatedAt: check.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create quality check" });
  }
});

router.patch("/quality-checks/:checkId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.checkId));
    const { rating, feedback, status, revisionCount } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (rating !== undefined) updates.rating = rating;
    if (feedback !== undefined) updates.feedback = feedback;
    if (status !== undefined) updates.status = status;
    if (revisionCount !== undefined) updates.revisionCount = revisionCount;

    const [existing] = await db.select().from(qualityChecksTable).where(eq(qualityChecksTable.id, id));
    const [updated] = await db.update(qualityChecksTable).set(updates).where(eq(qualityChecksTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Quality check not found" });
      return;
    }

    if (existing && updated.submitterId !== req.user!.id) {
      const ratingChanged = rating !== undefined && rating !== existing.rating;
      const feedbackChanged = feedback !== undefined && feedback !== existing.feedback;
      if (ratingChanged || feedbackChanged) {
        const stars = "★".repeat(updated.rating) + "☆".repeat(5 - updated.rating);
        const revNote = updated.revisionCount > 0 ? ` · ${updated.revisionCount} revision${updated.revisionCount > 1 ? "s" : ""}` : "";
        await db.insert(notificationsTable).values({
          userId: updated.submitterId,
          type: "quality_evaluation",
          title: "Your evaluation was updated",
          body: `Rating: ${stars}${revNote}${updated.feedback ? ` — "${updated.feedback.slice(0, 80)}${updated.feedback.length > 80 ? "…" : ""}"` : ""}`,
          linkUrl: "/quality-checks",
        }).catch(() => {});
      }
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update quality check" });
  }
});

router.delete("/quality-checks/:checkId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.checkId));
    await db.delete(qualityChecksTable).where(eq(qualityChecksTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete quality check" });
  }
});

export default router;
