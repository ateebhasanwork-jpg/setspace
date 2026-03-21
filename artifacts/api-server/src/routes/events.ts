import { Router } from "express";
import { addSseClient, removeSseClient } from "../lib/sse";

const router = Router();

router.get("/events", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).end();
    return;
  }

  const userId = req.user.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("event: connected\ndata: {}\n\n");

  addSseClient(res, userId);

  // Send an SSE comment every 30 s to keep the connection alive through
  // proxies (typical timeout is 60 s).  Reduced from 20 s to cut idle
  // write overhead by 33 %.
  const heartbeat = setInterval(() => {
    try {
      res.write(":\n\n");
    } catch {
      removeSseClient(res, userId);
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on("close", () => {
    removeSseClient(res, userId);
    clearInterval(heartbeat);
  });
});

export default router;
