import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import path from "path";

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

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "artifacts/setspace/dist/public");
  app.use(express.static(frontendDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
