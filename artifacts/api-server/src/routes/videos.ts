import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videoProjectsTable, videoVersionsTable, videoCommentsTable, videoShareTokensTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

async function getVersionWithUploader(versionId: number) {
  const [version] = await db.select().from(videoVersionsTable).where(eq(videoVersionsTable.id, versionId));
  if (!version) return null;
  const [uploader] = version.uploadedById
    ? await db.select().from(usersTable).where(eq(usersTable.id, version.uploadedById))
    : [null];
  return {
    ...version,
    createdAt: version.createdAt.toISOString(),
    uploadedBy: uploader ? { ...uploader, createdAt: uploader.createdAt.toISOString(), updatedAt: uploader.updatedAt.toISOString() } : null
  };
}

// Video Projects
router.get("/video-projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const projects = await db.select().from(videoProjectsTable).orderBy(videoProjectsTable.updatedAt);
    const result = await Promise.all(projects.map(async p => {
      const versions = await db.select().from(videoVersionsTable).where(eq(videoVersionsTable.projectId, p.id))
        .orderBy(videoVersionsTable.versionNumber);
      const latest = versions[versions.length - 1];
      return {
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        latestVersionId: latest?.id ?? null,
        latestVersionNumber: latest?.versionNumber ?? null,
        latestVersionStatus: latest?.status ?? null
      };
    }));
    if (req.query.taskId) {
      res.json(result.filter(p => p.taskId === parseInt(req.query.taskId as string)).reverse());
      return;
    }
    res.json(result.reverse());
  } catch (err) {
    res.status(500).json({ error: "Failed to list video projects" });
  }
});

router.post("/video-projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { title, clientName, description, taskId } = req.body;
    const [project] = await db.insert(videoProjectsTable).values({
      title, clientName: clientName ?? null, description: description ?? null,
      taskId: taskId ?? null, createdById: req.user.id
    }).returning();
    res.status(201).json({ ...project, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create video project" });
  }
});

router.get("/video-projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.projectId);
    const [project] = await db.select().from(videoProjectsTable).where(eq(videoProjectsTable.id, id));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const versions = await db.select().from(videoVersionsTable).where(eq(videoVersionsTable.projectId, id))
      .orderBy(videoVersionsTable.versionNumber);
    const versionsWithUploaders = await Promise.all(versions.map(v => getVersionWithUploader(v.id)));
    res.json({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      versions: versionsWithUploaders
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get video project" });
  }
});

router.patch("/video-projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.projectId);
    const { title, clientName, description, status } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (clientName !== undefined) updates.clientName = clientName;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    const [updated] = await db.update(videoProjectsTable).set(updates).where(eq(videoProjectsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update video project" });
  }
});

router.delete("/video-projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.delete(videoProjectsTable).where(eq(videoProjectsTable.id, parseInt(req.params.projectId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete video project" });
  }
});

// Video Versions
router.post("/video-projects/:projectId/versions", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const projectId = parseInt(req.params.projectId);
    const { objectPath, fileName, fileSize } = req.body;
    const existingVersions = await db.select().from(videoVersionsTable).where(eq(videoVersionsTable.projectId, projectId));
    const versionNumber = existingVersions.length + 1;
    const [version] = await db.insert(videoVersionsTable).values({
      projectId, versionNumber, objectPath, fileName, fileSize,
      uploadedById: req.user.id, status: "pending"
    }).returning();
    await db.update(videoProjectsTable).set({ updatedAt: new Date() }).where(eq(videoProjectsTable.id, projectId));
    const result = await getVersionWithUploader(version.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to create video version" });
  }
});

router.post("/video-versions/:versionId/approve", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.versionId);
    const [updated] = await db.update(videoVersionsTable).set({ status: "approved" }).where(eq(videoVersionsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    const result = await getVersionWithUploader(updated.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to approve version" });
  }
});

router.post("/video-versions/:versionId/request-revision", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.versionId);
    const [updated] = await db.update(videoVersionsTable).set({ status: "needs_revision" }).where(eq(videoVersionsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    const result = await getVersionWithUploader(updated.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to request revision" });
  }
});

// Video Comments (internal)
router.get("/video-versions/:versionId/comments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const versionId = parseInt(req.params.versionId);
    const comments = await db.select().from(videoCommentsTable)
      .where(eq(videoCommentsTable.versionId, versionId))
      .orderBy(videoCommentsTable.createdAt);
    res.json(comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list comments" });
  }
});

router.post("/video-versions/:versionId/comments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const versionId = parseInt(req.params.versionId);
    const { content, timestampSeconds } = req.body;
    const [comment] = await db.insert(videoCommentsTable).values({
      versionId, authorId: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorType: "internal", content,
      timestampSeconds: timestampSeconds ?? null
    }).returning();
    res.status(201).json({ ...comment, createdAt: comment.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create comment" });
  }
});

router.post("/video-comments/:commentId/resolve", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.commentId);
    const [updated] = await db.update(videoCommentsTable).set({ isResolved: true }).where(eq(videoCommentsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve comment" });
  }
});

// Share Tokens
router.post("/video-versions/:versionId/share-token", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const versionId = parseInt(req.params.versionId);
    const token = crypto.randomBytes(32).toString("hex");
    await db.delete(videoShareTokensTable).where(eq(videoShareTokensTable.versionId, versionId));
    const [shareToken] = await db.insert(videoShareTokensTable).values({ token, versionId }).returning();
    await db.update(videoVersionsTable).set({ shareToken: token }).where(eq(videoVersionsTable.id, versionId));
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const shareUrl = `${protocol}://${host}/review/${token}`;
    res.status(201).json({ token, shareUrl, versionId, expiresAt: null });
  } catch (err) {
    res.status(500).json({ error: "Failed to create share token" });
  }
});

// Public Review Routes (no auth required — accessed by external clients)
router.get("/review/:token", async (req, res) => {
  try {
    const [shareToken] = await db.select().from(videoShareTokensTable).where(eq(videoShareTokensTable.token, req.params.token));
    if (!shareToken) {
      res.status(404).json({ error: "Invalid or expired link" });
      return;
    }
    const [version] = await db.select().from(videoVersionsTable).where(eq(videoVersionsTable.id, shareToken.versionId));
    if (!version) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    const [project] = await db.select().from(videoProjectsTable).where(eq(videoProjectsTable.id, version.projectId));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const comments = await db.select().from(videoCommentsTable).where(eq(videoCommentsTable.versionId, version.id)).orderBy(videoCommentsTable.createdAt);
    res.json({
      projectTitle: project.title,
      clientName: project.clientName ?? null,
      versionNumber: version.versionNumber,
      objectPath: version.objectPath,
      fileName: version.fileName,
      comments: comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get review data" });
  }
});

router.post("/review/:token/comments", async (req, res) => {
  try {
    const [shareToken] = await db.select().from(videoShareTokensTable).where(eq(videoShareTokensTable.token, req.params.token));
    if (!shareToken) {
      res.status(404).json({ error: "Invalid link" });
      return;
    }
    const { content, authorName, timestampSeconds } = req.body;
    const [comment] = await db.insert(videoCommentsTable).values({
      versionId: shareToken.versionId,
      authorId: null,
      authorName: authorName || "Client",
      authorType: "client",
      content,
      timestampSeconds: timestampSeconds ?? null
    }).returning();
    res.status(201).json({ ...comment, createdAt: comment.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create comment" });
  }
});

export default router;
