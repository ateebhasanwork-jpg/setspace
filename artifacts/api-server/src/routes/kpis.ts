import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kpisTable, kpiEntriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { getCached, invalidateByPrefix, invalidateResult } from "../lib/cache";

const router: IRouter = Router();

const KPIS_TTL_MS = 5 * 60_000;

function kpisKey(userId?: string) {
  return `kpis:${userId ?? "all"}`;
}
function kpiEntriesKey(userId?: string, kpiId?: string) {
  return `kpi-entries:${userId ?? "all"}:${kpiId ?? "all"}`;
}
function invalidateKpiCaches() {
  invalidateByPrefix("kpis:");
  invalidateByPrefix("kpi-entries:");
}

router.get("/kpis", async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const kpis = await getCached(kpisKey(userId), KPIS_TTL_MS, async () => {
      const rows = userId
        ? await db.select().from(kpisTable).where(eq(kpisTable.userId, userId)).orderBy(kpisTable.createdAt)
        : await db.select().from(kpisTable).orderBy(kpisTable.createdAt);
      return rows.map(k => ({ ...k, createdAt: k.createdAt.toISOString(), targetValue: parseFloat(k.targetValue) }));
    });
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: "Failed to list KPIs" });
  }
});

router.post("/kpis", requireAdminOrHR, async (req, res) => {
  try {
    const { name, description, unit, targetValue, userId, period } = req.body;
    const [kpi] = await db.insert(kpisTable).values({
      name, description: description ?? null, unit, targetValue: String(targetValue), userId, period: period ?? "monthly"
    }).returning();
    invalidateKpiCaches();
    invalidateByPrefix("leaderboard:");
    res.status(201).json({ ...kpi, createdAt: kpi.createdAt.toISOString(), targetValue: parseFloat(kpi.targetValue) });
  } catch (err) {
    res.status(500).json({ error: "Failed to create KPI" });
  }
});

router.patch("/kpis/:kpiId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.kpiId));
    const { name, description, unit, targetValue, period } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (unit !== undefined) updates.unit = unit;
    if (targetValue !== undefined) updates.targetValue = String(targetValue);
    if (period !== undefined) updates.period = period;
    const [updated] = await db.update(kpisTable).set(updates).where(eq(kpisTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "KPI not found" }); return; }
    invalidateKpiCaches();
    invalidateByPrefix("leaderboard:");
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), targetValue: parseFloat(updated.targetValue) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update KPI" });
  }
});

router.delete("/kpis/:kpiId", requireAdminOrHR, async (req, res) => {
  try {
    await db.delete(kpisTable).where(eq(kpisTable.id, parseInt(String(req.params.kpiId))));
    invalidateKpiCaches();
    invalidateByPrefix("leaderboard:");
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete KPI" });
  }
});

/**
 * GET /api/kpi-entries[?userId=<id>][?kpiId=<id>]
 * Filters pushed to DB — only fetches what's needed instead of
 * loading all rows then filtering in JavaScript.
 */
router.get("/kpi-entries", async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const kpiId = req.query.kpiId as string | undefined;

    const entries = await getCached(kpiEntriesKey(userId, kpiId), KPIS_TTL_MS, async () => {
      const conditions: ReturnType<typeof eq>[] = [];
      if (userId) conditions.push(eq(kpiEntriesTable.userId, userId));
      if (kpiId) conditions.push(eq(kpiEntriesTable.kpiId, parseInt(kpiId)));

      const [rows, kpis] = await Promise.all([
        conditions.length > 0
          ? db.select().from(kpiEntriesTable).where(and(...conditions)).orderBy(kpiEntriesTable.recordedAt)
          : db.select().from(kpiEntriesTable).orderBy(kpiEntriesTable.recordedAt),
        db.select().from(kpisTable),
      ]);

      const kpiMap = Object.fromEntries(kpis.map(k => [k.id, k]));
      return rows.map(e => ({
        ...e,
        actualValue: parseFloat(e.actualValue),
        recordedAt: e.recordedAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
        kpi: kpiMap[e.kpiId] ? { ...kpiMap[e.kpiId], targetValue: parseFloat(kpiMap[e.kpiId].targetValue) } : null,
      }));
    });

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Failed to list KPI entries" });
  }
});

router.post("/kpi-entries", requireAdminOrHR, async (req, res) => {
  try {
    const { kpiId, userId, actualValue, notes, recordedAt } = req.body;
    const [entry] = await db.insert(kpiEntriesTable).values({
      kpiId, userId, actualValue: String(actualValue), notes: notes ?? null, recordedAt: new Date(recordedAt)
    }).returning();
    invalidateResult(kpiEntriesKey(userId));
    invalidateResult(kpiEntriesKey());
    invalidateByPrefix("leaderboard:");
    res.status(201).json({
      ...entry,
      actualValue: parseFloat(entry.actualValue),
      recordedAt: entry.recordedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create KPI entry" });
  }
});

export default router;
