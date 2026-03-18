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

// Global auth guard — allow: health, auth/login/callback/logout, mobile auth, public review, and storage objects
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  const isPublic =
    path === "/healthz" ||
    path === "/login" ||
    path === "/callback" ||
    path === "/logout" ||
    path.startsWith("/auth/") ||
    path.startsWith("/mobile-auth/") ||
    /^\/review\/[^/]+/.test(path) ||
    (path.startsWith("/storage/objects/") && !!req.query.reviewToken); // token validated in storage.ts

  if (isPublic || req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
});

app.use("/api", router);

export default app;
