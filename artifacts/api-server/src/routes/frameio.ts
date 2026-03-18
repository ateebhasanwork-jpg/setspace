import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { listProjects, isFrameioConfigured, getToken } from "../lib/frameio";

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
