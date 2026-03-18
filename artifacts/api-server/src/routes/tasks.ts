import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const result = tasks.map(t => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      assignee: t.assigneeId ? userMap[t.assigneeId] ?? null : null,
    }));
    if (req.query.assigneeId) {
      return res.json(result.filter(t => t.assigneeId === req.query.assigneeId));
    }
    if (req.query.status) {
      return res.json(result.filter(t => t.status === req.query.status));
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const { title, description, status, priority, assigneeId, dueDate } = req.body;
    const [task] = await db.insert(tasksTable).values({
      title,
      description: description ?? null,
      status: status ?? "todo",
      priority: priority ?? "medium",
      assigneeId: assigneeId ?? null,
      createdById: req.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
    }).returning();
    res.status(201).json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(req.params.taskId);
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get task" });
  }
});

router.patch("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(req.params.taskId);
    const { title, description, status, priority, assigneeId, dueDate, completedAt } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;

    const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(req.params.taskId);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
