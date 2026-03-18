/**
 * Frame.io API v2 integration
 *
 * Required environment variables:
 *   FRAMEIO_API_TOKEN      – developer token from developer.frame.io
 *   FRAMEIO_ROOT_ASSET_ID  – the asset ID of the Frame.io folder where videos are uploaded
 *
 * If either variable is missing, all methods return null gracefully —
 * the rest of the app continues to work without Frame.io.
 */

const FRAMEIO_BASE = "https://api.frame.io/v2";

function getConfig(): { token: string; rootAssetId: string } | null {
  const token = process.env.FRAMEIO_API_TOKEN;
  const rootAssetId = process.env.FRAMEIO_ROOT_ASSET_ID;
  if (!token || !rootAssetId) return null;
  return { token, rootAssetId };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface FrameioAsset {
  id: string;
  name: string;
  upload_urls: string[];
  link?: string;
}

/**
 * Step 1: Create a placeholder asset on Frame.io and get S3 upload URLs.
 */
export async function createFrameioAsset(
  fileName: string,
  fileSize: number,
  mimeType: string
): Promise<FrameioAsset | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(`${FRAMEIO_BASE}/assets/${cfg.rootAssetId}/children`, {
      method: "POST",
      headers: authHeaders(cfg.token),
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

    const data = await res.json() as FrameioAsset;
    return data;
  } catch (err) {
    console.error("Frame.io createAsset error:", err);
    return null;
  }
}

/**
 * Step 2: Upload a Buffer/Uint8Array to Frame.io using the pre-signed S3 URLs.
 * Frame.io splits large uploads across multiple URLs — this handles chunking.
 */
export async function uploadBufferToFrameio(
  uploadUrls: string[],
  buffer: Buffer,
  mimeType: string
): Promise<boolean> {
  try {
    const chunkSize = Math.ceil(buffer.length / uploadUrls.length);
    const uploads = uploadUrls.map((url, i) => {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunk = buffer.subarray(start, end);
      return fetch(url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: chunk,
      });
    });

    const results = await Promise.all(uploads);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      console.error(`Frame.io: ${failed.length} chunk(s) failed to upload`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Frame.io uploadChunks error:", err);
    return false;
  }
}

/**
 * Get the review/presentation link for a Frame.io asset.
 * Returns the web link to the review page.
 */
export async function getFrameioReviewLink(assetId: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  try {
    // First try to get a presentation link
    const presRes = await fetch(`${FRAMEIO_BASE}/assets/${assetId}/presentations`, {
      method: "POST",
      headers: authHeaders(cfg.token),
      body: JSON.stringify({ allow_approvals: true, allow_comments: true }),
    });

    if (presRes.ok) {
      const pres = await presRes.json() as { short_url?: string; url?: string };
      const link = pres.short_url || pres.url;
      if (link) return link;
    }

    // Fall back to the asset's own share link
    const assetRes = await fetch(`${FRAMEIO_BASE}/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });

    if (assetRes.ok) {
      const asset = await assetRes.json() as { link?: string };
      return asset.link || null;
    }

    return null;
  } catch (err) {
    console.error("Frame.io getReviewLink error:", err);
    return null;
  }
}

/**
 * Full pipeline: read a file from a Buffer, upload to Frame.io, return { assetId, reviewLink }.
 * This is the main function called after a GCS upload completes.
 */
export async function syncToFrameio(
  fileName: string,
  fileSize: number,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ assetId: string; reviewLink: string | null } | null> {
  const cfg = getConfig();
  if (!cfg) {
    return null;
  }

  const asset = await createFrameioAsset(fileName, fileSize, mimeType);
  if (!asset) return null;

  const uploaded = await uploadBufferToFrameio(asset.upload_urls, fileBuffer, mimeType);
  if (!uploaded) return null;

  // Give Frame.io a moment to process before fetching the review link
  await new Promise(r => setTimeout(r, 2000));
  const reviewLink = await getFrameioReviewLink(asset.id);

  return { assetId: asset.id, reviewLink };
}

export function isFrameioConfigured(): boolean {
  return getConfig() !== null;
}
