import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kpisTable, kpiEntriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/kpis", async (req, res) => {
  try {
    const kpis = await db.select().from(kpisTable).orderBy(kpisTable.createdAt);
    res.json(kpis.map(k => ({ ...k, createdAt: k.createdAt.toISOString(), targetValue: parseFloat(k.targetValue) })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list KPIs" });
  }
});

router.post("/kpis", async (req, res) => {
  try {
    const { name, description, unit, targetValue, userId, period } = req.body;
    const [kpi] = await db.insert(kpisTable).values({
      name, description: description ?? null, unit, targetValue: String(targetValue), userId, period: period ?? "monthly"
    }).returning();
    res.status(201).json({ ...kpi, createdAt: kpi.createdAt.toISOString(), targetValue: parseFloat(kpi.targetValue) });
  } catch (err) {
    res.status(500).json({ error: "Failed to create KPI" });
  }
});

router.patch("/kpis/:kpiId", async (req, res) => {
  try {
    const id = parseInt(req.params.kpiId);
    const { name, description, unit, targetValue, period } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (unit !== undefined) updates.unit = unit;
    if (targetValue !== undefined) updates.targetValue = String(targetValue);
    if (period !== undefined) updates.period = period;
    const [updated] = await db.update(kpisTable).set(updates).where(eq(kpisTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "KPI not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), targetValue: parseFloat(updated.targetValue) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update KPI" });
  }
});

router.delete("/kpis/:kpiId", async (req, res) => {
  try {
    await db.delete(kpisTable).where(eq(kpisTable.id, parseInt(req.params.kpiId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete KPI" });
  }
});

router.get("/kpi-entries", async (req, res) => {
  try {
    let entries = await db.select().from(kpiEntriesTable).orderBy(kpiEntriesTable.recordedAt);
    if (req.query.userId) entries = entries.filter(e => e.userId === req.query.userId);
    if (req.query.kpiId) entries = entries.filter(e => e.kpiId === parseInt(req.query.kpiId as string));
    
    const kpis = await db.select().from(kpisTable);
    const kpiMap = Object.fromEntries(kpis.map(k => [k.id, k]));
    
    res.json(entries.map(e => ({
      ...e,
      actualValue: parseFloat(e.actualValue),
      recordedAt: e.recordedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
      kpi: kpiMap[e.kpiId] ? { ...kpiMap[e.kpiId], targetValue: parseFloat(kpiMap[e.kpiId].targetValue) } : null
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list KPI entries" });
  }
});

router.post("/kpi-entries", async (req, res) => {
  try {
    const { kpiId, userId, actualValue, notes, recordedAt } = req.body;
    const [entry] = await db.insert(kpiEntriesTable).values({
      kpiId, userId, actualValue: String(actualValue), notes: notes ?? null, recordedAt: new Date(recordedAt)
    }).returning();
    res.status(201).json({ ...entry, actualValue: parseFloat(entry.actualValue), recordedAt: entry.recordedAt.toISOString(), createdAt: entry.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create KPI entry" });
  }
});

export default router;
