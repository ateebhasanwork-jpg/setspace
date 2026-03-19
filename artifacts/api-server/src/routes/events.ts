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

  const heartbeat = setInterval(() => {
    try {
      res.write(":\n\n");
    } catch {
      removeSseClient(res, userId);
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on("close", () => {
    removeSseClient(res, userId);
    clearInterval(heartbeat);
  });
});

export default router;
