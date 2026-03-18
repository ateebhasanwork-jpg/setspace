import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Global auth guard — allow only: health check, auth flow, and the public video review endpoint
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  const isPublic =
    path === "/health" ||
    path.startsWith("/auth/") ||
    /^\/review\/[^/]+$/.test(path);

  if (isPublic || req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
});

app.use("/api", router);

export default app;
