import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { invalidateUsers } from "../lib/cache";

const router: IRouter = Router();


function setSessionCookie(res: Response, sid: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

// Current authenticated user — always do a fresh DB read so fields like
// profileSetup are up-to-date rather than stale session data.
router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.json({ isAuthenticated: false });
    return;
  }
  try {
    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    if (!fresh) { res.json({ isAuthenticated: false }); return; }
    res.json({
      ...fresh,
      createdAt: fresh.createdAt.toISOString(),
      updatedAt: fresh.updatedAt.toISOString(),
      isAuthenticated: true,
    });
  } catch {
    // Fall back to session data on DB error
    res.json({ ...req.user, isAuthenticated: true });
  }
});

// Check if first-time setup is needed (no users in DB yet)
router.get("/setup/needed", async (_req: Request, res: Response) => {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    res.json({ needed: users.length === 0 });
  } catch {
    res.status(500).json({ error: "Failed to check setup status" });
  }
});

// Create first admin account (only works when DB has no users)
router.post("/setup", async (req: Request, res: Response) => {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Setup already complete. Please log in." });
      return;
    }
    const { username, password, firstName, lastName } = req.body as Record<string, string>;
    if (!username || !password || !firstName || !lastName) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      id: randomUUID(),
      username: username.toLowerCase().trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: "admin",
      passwordHash,
    }).returning();

    invalidateUsers();

    const sessionData: SessionData = {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
      access_token: "",
    };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ ...user, isAuthenticated: true });
  } catch (err) {
    console.error("Setup error:", err);
    res.status(500).json({ error: "Setup failed. Please try again." });
  }
});

// One-time password initialization: users migrated from Replit OIDC have no passwordHash yet.
// This endpoint lets them set their first password. Only works when the account has NO existing password.
router.post("/setup/init-password", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as Record<string, string>;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase().trim()));
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    if (user.passwordHash) {
      res.status(400).json({ error: "This account already has a password. Use the login form." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const sessionData: SessionData = {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
      access_token: "",
    };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ ...user, isAuthenticated: true });
  } catch {
    res.status(500).json({ error: "Failed to initialize password." });
  }
});

// Login with username + password
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as Record<string, string>;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase().trim()));

    if (!user) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    // User exists but has no password — migrated from Replit OIDC
    if (!user.passwordHash) {
      res.status(401).json({ error: "This account has no password set yet. Please initialize your password.", code: "NO_PASSWORD" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    const sessionData: SessionData = {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
      access_token: "",
    };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ ...user, isAuthenticated: true });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// Logout
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

// Mobile: bearer-token based login
router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const { username, password } = req.body as Record<string, string>;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase().trim()));
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    const sessionData: SessionData = {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
      access_token: "",
    };
    const sid = await createSession(sessionData);
    res.json({ token: sid });
  } catch (err) {
    console.error("Mobile token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json({ success: true });
});

export default router;
