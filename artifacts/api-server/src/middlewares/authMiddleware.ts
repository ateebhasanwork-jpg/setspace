import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  getSession,
  updateSession,
  type SessionUser,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends SessionUser {
      role: string;
      username: string;
      department?: string | null;
      title?: string | null;
      profileSetup?: boolean | null;
    }

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Rolling session: extend expiry on every request.
  // Only write once per 10 minutes to avoid excessive DB writes.
  const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  updateSession(sid, session).catch(() => {});

  // Always fetch fresh user from DB so role/profile changes take effect immediately.
  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id));

  if (!dbUser) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    profileImage: dbUser.profileImage,
    role: dbUser.role,
    department: dbUser.department,
    title: dbUser.title,
    profileSetup: dbUser.profileSetup,
  };
  next();
}
