import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { qualityChecksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { notifyUser } from "../lib/notify";
import { getCachedUsers, getUserMap, getCached, invalidateByPrefix, invalidateResult } from "../lib/cache";

const router: IRouter = Router();

router.get("/quality-checks", async (req, res) => {
  try {
    const all = await getCached("quality-checks", 5 * 60_000, async () => {
      const [checks, users] = await Promise.all([
        db.select().from(qualityChecksTable).orderBy(qualityChecksTable.createdAt),
        getCachedUsers(),
      ]);
      const userMap = getUserMap(users);
      return checks.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        reviewer: userMap[c.reviewerId] ?? null,
        submitter: userMap[c.submitterId] ?? null,
      }));
    });
    const result = req.query.taskId
      ? all.filter((c: { taskId: number | null }) => c.taskId === parseInt(req.query.taskId as string))
      : all;
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
      await notifyUser(submitterId, {
        type: "quality_evaluation",
        title: "You received an evaluation",
        body: `Rating: ${stars}${revNote}${feedback ? ` — "${feedback.slice(0, 80)}${feedback.length > 80 ? "…" : ""}"` : ""}`,
        linkUrl: "/quality",
      }).catch(() => {});
    }

    // Quality data affects leaderboard scores
    invalidateResult("quality-checks");
    invalidateByPrefix("leaderboard:");

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
    if (!updated) { res.status(404).json({ error: "Quality check not found" }); return; }

    if (existing && updated.submitterId !== req.user!.id) {
      const ratingChanged = rating !== undefined && rating !== existing.rating;
      const feedbackChanged = feedback !== undefined && feedback !== existing.feedback;
      if (ratingChanged || feedbackChanged) {
        const stars = "★".repeat(updated.rating) + "☆".repeat(5 - updated.rating);
        const revNote = updated.revisionCount > 0 ? ` · ${updated.revisionCount} revision${updated.revisionCount > 1 ? "s" : ""}` : "";
        await notifyUser(updated.submitterId, {
          type: "quality_evaluation",
          title: "Your evaluation was updated",
          body: `Rating: ${stars}${revNote}${updated.feedback ? ` — "${updated.feedback.slice(0, 80)}${updated.feedback.length > 80 ? "…" : ""}"` : ""}`,
          linkUrl: "/quality",
        }).catch(() => {});
      }
    }

    invalidateResult("quality-checks");
    invalidateByPrefix("leaderboard:");

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update quality check" });
  }
});

router.delete("/quality-checks/:checkId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.checkId));
    await db.delete(qualityChecksTable).where(eq(qualityChecksTable.id, id));
    invalidateResult("quality-checks");
    invalidateByPrefix("leaderboard:");
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete quality check" });
  }
});

export default router;
