import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { db, videoShareTokensTable, videoVersionsTable } from "@workspace/db";

const router: IRouter = Router();

const STORAGE_CONFIGURED = !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const objectStorageService = STORAGE_CONFIGURED ? new ObjectStorageService() : null;

// Local filesystem fallback — used when GCS is not configured (self-hosted).
const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!STORAGE_CONFIGURED) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

/**
 * POST /storage/upload
 *
 * Direct server-side upload: the client streams the file body here.
 * On Replit: piped to GCS.
 * On self-hosted (no GCS): saved to local filesystem.
 */
router.post("/storage/upload", async (req: Request, res: Response) => {
  const contentType = (req.headers["content-type"] as string) || "application/octet-stream";
  const fileName = (req.headers["x-file-name"] as string) || "upload";
  const contentLength = parseInt((req.headers["content-length"] as string) || "0", 10);

  if (!STORAGE_CONFIGURED) {
    // Local fallback
    try {
      const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
      const filename = `${randomUUID()}.${ext}`;
      const filePath = path.join(LOCAL_UPLOAD_DIR, filename);
      const writeStream = fs.createWriteStream(filePath);
      req.pipe(writeStream);
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
      const objectPath = `/objects/${filename}`;
      res.json({ objectPath, metadata: { name: fileName, size: contentLength, contentType } });
    } catch (error) {
      console.error("Local upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
    return;
  }

  try {
    const objectPath = await objectStorageService!.uploadStreamToStorage(req, contentType);
    res.json({ objectPath, metadata: { name: fileName, size: contentLength, contentType } });
  } catch (error) {
    console.error("Direct upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!STORAGE_CONFIGURED) {
    res.status(503).json({ error: "Presigned URLs are not supported on this server. Use /storage/upload instead." });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService!.getObjectEntityUploadURL();
    const objectPath = objectStorageService!.normalizeObjectEntityPath(uploadURL);
    res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath, metadata: { name, size, contentType } }));
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  if (!STORAGE_CONFIGURED) {
    res.status(503).json({ error: "File storage is not configured on this server." });
    return;
  }
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService!.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    await serveGCSFileWithRangeSupport(req, res, file);
  } catch (error) {
    console.error("Error serving public object:", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities with full Range request support.
 * On Replit: served from GCS.
 * On self-hosted: served from local filesystem.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  const raw = req.params.path;
  const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

  // Auth check (allow review tokens for video sharing)
  if (!req.isAuthenticated()) {
    if (!STORAGE_CONFIGURED) {
      // Local files require auth
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const reviewToken = typeof req.query.reviewToken === "string" ? req.query.reviewToken : null;
    if (!reviewToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [shareRow] = await db
      .select({ versionId: videoShareTokensTable.versionId })
      .from(videoShareTokensTable)
      .where(eq(videoShareTokensTable.token, reviewToken))
      .limit(1);
    if (!shareRow) {
      res.status(403).json({ error: "Invalid review token" });
      return;
    }
    const objectPath = `/objects/${wildcardPath}`;
    const [version] = await db
      .select({ objectPath: videoVersionsTable.objectPath })
      .from(videoVersionsTable)
      .where(eq(videoVersionsTable.id, shareRow.versionId))
      .limit(1);
    if (!version || version.objectPath !== objectPath) {
      res.status(403).json({ error: "Token does not grant access to this resource" });
      return;
    }
  }

  if (!STORAGE_CONFIGURED) {
    // Local filesystem fallback
    const filePath = path.join(LOCAL_UPLOAD_DIR, wildcardPath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.sendFile(path.resolve(filePath));
    return;
  }

  try {
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService!.getObjectEntityFile(objectPath);
    await serveGCSFileWithRangeSupport(req, res, objectFile);
  } catch (error) {
    console.error("Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * Serve a GCS file with proper HTTP Range request support.
 */
async function serveGCSFileWithRangeSupport(req: Request, res: Response, file: import("@google-cloud/storage").File) {
  const [metadata] = await file.getMetadata();
  const fileSize = parseInt(String(metadata.size ?? 0), 10);
  const contentType = (metadata.contentType as string) || "application/octet-stream";

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);

  const rangeHeader = req.headers["range"];

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;

    if (start > end || start >= fileSize) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    });

    const readStream = file.createReadStream({ start, end });
    readStream.on("error", (err) => {
      console.error("Read stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    });

    const readStream = file.createReadStream();
    readStream.on("error", (err) => {
      console.error("Read stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  }
}

export default router;
