import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const result = tasks.map(t => {
      const completedOnTime =
        t.completedAt != null && t.dueDate != null
          ? t.completedAt <= t.dueDate
          : null;
      return {
        ...t,
        dueDate: t.dueDate?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        completedOnTime,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        assignee: t.assigneeId ? (userMap[t.assigneeId] ?? null) : null,
      };
    });
    if (req.query.assigneeId) {
      res.json(result.filter(t => t.assigneeId === req.query.assigneeId));
      return;
    }
    if (req.query.status) {
      res.json(result.filter(t => t.status === req.query.status));
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", requireAdminOrHR, async (req, res) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate } = req.body;
    const [task] = await db.insert(tasksTable).values({
      title,
      description: description ?? null,
      status: status ?? "To Do",
      priority: priority ?? "medium",
      assigneeId: assigneeId ?? null,
      createdById: req.user!.id,
      dueDate: dueDate ? new Date(dueDate) : null,
    }).returning();

    if (assigneeId && assigneeId !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: assigneeId,
        type: "task_assigned",
        title: "New Task Assigned",
        body: `You've been assigned: "${title}"`,
        linkUrl: "/tasks",
      }).catch(() => {});
    }

    res.status(201).json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get task" });
  }
});

router.patch("/tasks/:taskId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    const { title, description, status, priority, assigneeId, dueDate, completedAt } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      updates.status = status;
      // Auto-set completedAt when task is marked Done
      if (status === "Done") {
        const existing = await db.select().from(tasksTable).where(eq(tasksTable.id, parseInt(String(req.params.taskId))));
        if (existing[0] && !existing[0].completedAt) {
          updates.completedAt = new Date();
        }
      } else if (status !== "Done") {
        // If un-done, clear completedAt
        updates.completedAt = null;
      }
    }
    if (priority !== undefined) updates.priority = priority;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;

    const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const newAssignee = assigneeId !== undefined ? assigneeId : null;
    const prevAssignee = existing?.assigneeId ?? null;

    if (newAssignee && newAssignee !== prevAssignee && newAssignee !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: newAssignee,
        type: "task_assigned",
        title: "Task Assigned to You",
        body: `You've been assigned: "${updated.title}"`,
        linkUrl: "/tasks",
      }).catch(() => {});
    }

    if (status === "Done" && existing?.status !== "Done" && updated.createdById && updated.createdById !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: updated.createdById,
        type: "task_completed",
        title: "Task Completed",
        body: `"${updated.title}" has been marked as done.`,
        linkUrl: "/tasks",
      }).catch(() => {});
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:taskId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
