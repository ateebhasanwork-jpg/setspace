import { useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const FAVICON_URL = `${BASE}/favicon.png`;

function drawBadgedFavicon(img: HTMLImageElement, count: number): string {
  const SIZE = 32;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0, SIZE, SIZE);

  if (count > 0) {
    const DOT = 10;
    const X = SIZE - DOT / 2 - 1;
    const Y = DOT / 2 + 1;

    ctx.beginPath();
    ctx.arc(X, Y, DOT / 2 + 1, 0, 2 * Math.PI);
    ctx.fillStyle = "#111827";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(X, Y, DOT / 2, 0, 2 * Math.PI);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}

export function useFaviconBadge(count: number) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const originalHrefRef = useRef<string | null>(null);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) return;

    if (!originalHrefRef.current) {
      originalHrefRef.current = link.href;
    }

    if (!imgRef.current) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = FAVICON_URL;
      img.onload = () => {
        imgRef.current = img;
        link.href = drawBadgedFavicon(img, count);
      };
      return;
    }

    link.href = count > 0
      ? drawBadgedFavicon(imgRef.current, count)
      : (originalHrefRef.current ?? FAVICON_URL);
  }, [count]);
}
