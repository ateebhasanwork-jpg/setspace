/**
 * Frame.io API v2 integration
 *
 * Required environment variable:
 *   FRAMEIO_API_TOKEN  – developer token from developer.frame.io
 *
 * The root asset ID (upload destination) is stored in the app_settings DB table
 * under the key "frameio_root_asset_id". Users select it through the UI.
 */

const FRAMEIO_BASE = "https://api.frame.io/v2";

export function getToken(): string | null {
  return process.env.FRAMEIO_API_TOKEN || null;
}

export function isFrameioConfigured(): boolean {
  return !!getToken();
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface FrameioProject {
  id: string;
  name: string;
  root_asset_id: string;
}

export interface FrameioTeam {
  id: string;
  name: string;
}

/** Fetch all teams (workspaces) the token has access to. */
export async function listTeams(): Promise<FrameioTeam[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${FRAMEIO_BASE}/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as FrameioTeam[];
    return data;
  } catch {
    return [];
  }
}

/** Fetch all projects across all teams. */
export async function listProjects(): Promise<(FrameioProject & { teamName: string })[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const teams = await listTeams();
    const allProjects: (FrameioProject & { teamName: string })[] = [];
    for (const team of teams) {
      const res = await fetch(`${FRAMEIO_BASE}/teams/${team.id}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const projects = await res.json() as FrameioProject[];
      for (const p of projects) {
        allProjects.push({ ...p, teamName: team.name });
      }
    }
    return allProjects;
  } catch {
    return [];
  }
}

export interface FrameioAsset {
  id: string;
  name: string;
  upload_urls: string[];
  link?: string;
}

/** Create a placeholder asset on Frame.io and get S3 upload URLs. */
export async function createFrameioAsset(
  rootAssetId: string,
  fileName: string,
  fileSize: number,
  mimeType: string
): Promise<FrameioAsset | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${FRAMEIO_BASE}/assets/${rootAssetId}/children`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name: fileName,
        type: "file",
        filetype: mimeType,
        filesize: fileSize,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Frame.io createAsset failed (${res.status}):`, text);
      return null;
    }

    return await res.json() as FrameioAsset;
  } catch (err) {
    console.error("Frame.io createAsset error:", err);
    return null;
  }
}

/** Upload a Buffer to Frame.io using its pre-signed S3 URLs (handles chunking). */
export async function uploadBufferToFrameio(
  uploadUrls: string[],
  buffer: Buffer,
  mimeType: string
): Promise<boolean> {
  try {
    const chunkSize = Math.ceil(buffer.length / uploadUrls.length);
    const results = await Promise.all(
      uploadUrls.map((url, i) => {
        const start = i * chunkSize;
        const chunk = buffer.subarray(start, Math.min(start + chunkSize, buffer.length));
        return fetch(url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: chunk,
        });
      })
    );
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      console.error(`Frame.io: ${failed.length} chunk(s) failed`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Frame.io uploadChunks error:", err);
    return false;
  }
}

/** Get a shareable review link for an asset (presentation or direct link). */
export async function getFrameioReviewLink(assetId: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const presRes = await fetch(`${FRAMEIO_BASE}/assets/${assetId}/presentations`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ allow_approvals: true, allow_comments: true }),
    });
    if (presRes.ok) {
      const pres = await presRes.json() as { short_url?: string; url?: string };
      const link = pres.short_url || pres.url;
      if (link) return link;
    }
    const assetRes = await fetch(`${FRAMEIO_BASE}/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (assetRes.ok) {
      const asset = await assetRes.json() as { link?: string };
      return asset.link || null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Full pipeline: upload buffer to Frame.io, return { assetId, reviewLink }. */
export async function syncToFrameio(
  rootAssetId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ assetId: string; reviewLink: string | null } | null> {
  const asset = await createFrameioAsset(rootAssetId, fileName, fileSize, mimeType);
  if (!asset) return null;

  const ok = await uploadBufferToFrameio(asset.upload_urls, fileBuffer, mimeType);
  if (!ok) return null;

  await new Promise(r => setTimeout(r, 2000));
  const reviewLink = await getFrameioReviewLink(asset.id);
  return { assetId: asset.id, reviewLink };
}
