import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { listProjects, isFrameioConfigured, getToken, listAssetChildren, getAsset, getOrCreateReviewLink, deleteAsset } from "../lib/frameio";

const router: IRouter = Router();

const SETTING_ROOT_ASSET_ID = "frameio_root_asset_id";
const SETTING_ROOT_ASSET_NAME = "frameio_root_asset_name";

/** GET /api/frameio/status — is Frame.io configured? */
router.get("/frameio/status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const configured = isFrameioConfigured();
    const rootAssetRow = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, SETTING_ROOT_ASSET_ID)).limit(1);
    const nameRow = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, SETTING_ROOT_ASSET_NAME)).limit(1);
    res.json({
      configured,
      rootAssetId: rootAssetRow[0]?.value || null,
      rootAssetName: nameRow[0]?.value || null,
    });
  } catch {
    res.status(500).json({ error: "Failed to get status" });
  }
});

/** GET /api/frameio/projects — list all Frame.io projects the token can access */
router.get("/frameio/projects", requireAdminOrHR, async (req: Request, res: Response) => {
  try {
    if (!isFrameioConfigured()) {
      res.status(400).json({ error: "FRAMEIO_API_TOKEN not set" });
      return;
    }
    const projects = await listProjects();
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Failed to list Frame.io projects" });
  }
});

/** POST /api/frameio/settings — save selected root asset (project) */
router.post("/frameio/settings", requireAdminOrHR, async (req: Request, res: Response) => {
  try {
    const { rootAssetId, rootAssetName } = req.body as { rootAssetId: string; rootAssetName: string };
    if (!rootAssetId) { res.status(400).json({ error: "rootAssetId required" }); return; }

    await db.insert(appSettingsTable)
      .values({ key: SETTING_ROOT_ASSET_ID, value: rootAssetId })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: rootAssetId, updatedAt: new Date() } });

    if (rootAssetName) {
      await db.insert(appSettingsTable)
        .values({ key: SETTING_ROOT_ASSET_NAME, value: rootAssetName })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: rootAssetName, updatedAt: new Date() } });
    }

    res.json({ ok: true, rootAssetId, rootAssetName });
  } catch {
    res.status(500).json({ error: "Failed to save Frame.io settings" });
  }
});

/** GET /api/frameio/assets/:assetId/children — browse folder contents */
router.get("/frameio/assets/:assetId/children", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    if (!isFrameioConfigured()) { res.status(400).json({ error: "Frame.io not configured" }); return; }
    const { assetId } = req.params as { assetId: string };
    const page = parseInt((req.query as Record<string, string>).page || "1");
    const children = await listAssetChildren(assetId, page, 50);
    res.json(children);
  } catch {
    res.status(500).json({ error: "Failed to list Frame.io assets" });
  }
});

/** GET /api/frameio/assets/:assetId — get a single asset (includes link) */
router.get("/frameio/assets/:assetId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    if (!isFrameioConfigured()) { res.status(400).json({ error: "Frame.io not configured" }); return; }
    const { assetId } = req.params as { assetId: string };
    const asset = await getAsset(assetId);
    if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
    res.json(asset);
  } catch {
    res.status(500).json({ error: "Failed to get Frame.io asset" });
  }
});

/** GET /api/frameio/assets/:assetId/review-link — get or create an embeddable review link */
router.get("/frameio/assets/:assetId/review-link", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    if (!isFrameioConfigured()) { res.status(400).json({ error: "Frame.io not configured" }); return; }
    const { assetId } = req.params as { assetId: string };
    const link = await getOrCreateReviewLink(assetId);
    if (!link) { res.status(404).json({ error: "Could not generate review link" }); return; }
    res.json({ link });
  } catch {
    res.status(500).json({ error: "Failed to get review link" });
  }
});

/** DELETE /api/frameio/assets/:assetId — delete an asset from Frame.io */
router.delete("/frameio/assets/:assetId", requireAdminOrHR, async (req: Request, res: Response) => {
  try {
    if (!isFrameioConfigured()) { res.status(400).json({ error: "Frame.io not configured" }); return; }
    const { assetId } = req.params as { assetId: string };
    const ok = await deleteAsset(assetId);
    if (!ok) { res.status(500).json({ error: "Frame.io delete failed" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete Frame.io asset" });
  }
});

/** Helper used by the video sync code — reads root asset ID from DB */
export async function getFrameioRootAssetId(): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, SETTING_ROOT_ASSET_ID)).limit(1);
    return row?.value || null;
  } catch {
    return null;
  }
}

export default router;
