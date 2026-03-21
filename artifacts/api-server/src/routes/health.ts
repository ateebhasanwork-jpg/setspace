import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getActiveClientCount } from "../lib/sse";
import { secondsSinceLastActivity, isServerIdle } from "../lib/idle";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    idle: isServerIdle(),
    activeSseClients: getActiveClientCount(),
    secondsSinceLastActivity: secondsSinceLastActivity(),
    dbPool: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
  });
});

export default router;
