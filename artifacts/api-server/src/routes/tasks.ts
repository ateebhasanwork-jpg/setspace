import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { broadcastSse } from "../lib/sse";
import { notifyUser } from "../lib/notify";
import { getCachedUsers, getUserMap, getCached, invalidateByPrefix, invalidateResult } from "../lib/cache";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const result = await getCached("tasks", 60_000, async () => {
      const [tasks, users] = await Promise.all([
        db.select().from(tasksTable).orderBy(tasksTable.createdAt),
        getCachedUsers(),
      ]);
      const userMap = getUserMap(users);
      return tasks.map(t => {
        const completedOnTime =
          t.completedAt != null && t.dueDate != null
            ? t.completedAt.toISOString().slice(0, 10) <= t.dueDate.toISOString().slice(0, 10)
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
    });
    if (req.query.assigneeId) {
      res.json(result.filter((t: { assigneeId: string | null }) => t.assigneeId === req.query.assigneeId));
      return;
    }
    if (req.query.status) {
      res.json(result.filter((t: { status: string }) => t.status === req.query.status));
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", requireAdminOrHR, async (req, res) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate, externalLink, attachmentUrl, attachmentName } = req.body;
    const [task] = await db.insert(tasksTable).values({
      title,
      description: description ?? null,
      status: status ?? "To Do",
      priority: priority ?? "medium",
      assigneeId: assigneeId ?? null,
      createdById: req.user!.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      externalLink: externalLink ?? null,
      attachmentUrl: attachmentUrl ?? null,
      attachmentName: attachmentName ?? null,
    }).returning();

    if (assigneeId && assigneeId !== req.user!.id) {
      notifyUser(assigneeId, { type: "task_assigned", title: "New Task Assigned", body: `You've been assigned: "${title}"`, linkUrl: "/tasks" }).catch(() => {});
    }

    invalidateResult("tasks");
    broadcastSse("tasks", { action: "created", taskId: task.id });
    res.status(201).json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get task" });
  }
});

router.patch("/tasks/:taskId", async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    const { title, description, status, priority, assigneeId, dueDate, completedAt, externalLink, attachmentUrl, attachmentName } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (externalLink !== undefined) updates.externalLink = externalLink || null;
    if (attachmentUrl !== undefined) updates.attachmentUrl = attachmentUrl || null;
    if (attachmentName !== undefined) updates.attachmentName = attachmentName || null;
    if (status !== undefined) {
      updates.status = status;
      if (status === "Done") {
        const existing = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
        if (existing[0] && !existing[0].completedAt) updates.completedAt = new Date();
      } else {
        updates.completedAt = null;
      }
    }
    if (priority !== undefined) updates.priority = priority;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;

    const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Task not found" }); return; }

    const newAssignee = assigneeId !== undefined ? assigneeId : null;
    const prevAssignee = existing?.assigneeId ?? null;
    if (newAssignee && newAssignee !== prevAssignee && newAssignee !== req.user!.id) {
      notifyUser(newAssignee, { type: "task_assigned", title: "Task Assigned to You", body: `You've been assigned: "${updated.title}"`, linkUrl: "/tasks" }).catch(() => {});
    }

    const statusChanged = status !== undefined && status !== existing?.status;
    if (statusChanged && updated.assigneeId && updated.assigneeId !== req.user!.id) {
      const statusLabel: Record<string, string> = { "In Progress": "moved to In Progress", "Review": "sent to Review", "Done": "marked as Done", "To Do": "moved back to To Do" };
      const label = statusLabel[status] ?? `updated to ${status}`;
      notifyUser(updated.assigneeId, { type: "task_status", title: `Task ${label}`, body: `"${updated.title}" has been ${label}.`, linkUrl: "/tasks" }).catch(() => {});
    }

    if (status === "Done" && existing?.status !== "Done" && updated.createdById && updated.createdById !== req.user!.id) {
      notifyUser(updated.createdById, { type: "task_completed", title: "Task Completed", body: `"${updated.title}" has been marked as done.`, linkUrl: "/tasks" }).catch(() => {});
    }

    // Task completion affects on-time scores on the leaderboard
    if (status === "Done" || (completedAt !== undefined)) {
      invalidateByPrefix("leaderboard:");
    }

    invalidateResult("tasks");
    broadcastSse("tasks", { action: "updated", taskId: updated.id });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:taskId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.taskId));
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    invalidateResult("tasks");
    broadcastSse("tasks", { action: "deleted", taskId: id });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
