import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { invalidateUsers, getCachedUsers } from "../lib/cache";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await getCachedUsers();
    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Create a new user (admin only)
router.post("/users", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ error: "Admins only" }); return; }
  try {
    const { username, password, firstName, lastName, role, department, title } = req.body as Record<string, string>;
    if (!username || !password || !firstName || !lastName) {
      res.status(400).json({ error: "username, password, firstName, and lastName are required." });
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
      role: (role as "admin" | "hr" | "employee") || "employee",
      department: department || null,
      title: title || null,
      passwordHash,
    }).returning();
    invalidateUsers();
    res.status(201).json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ error: "Username already taken." });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

router.delete("/users/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ error: "Admins only" }); return; }
  if (req.params.userId === req.user.id) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.userId));
    invalidateUsers();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.patch("/users/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const isSelf = req.user.id === req.params.userId;
  const isManager = req.user.role === "admin" || req.user.role === "hr";
  if (!isSelf && !isManager) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { firstName, lastName, role, department, title, profileImage, profileSetup } = req.body;
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (department !== undefined) updateFields.department = department;
    if (title !== undefined) updateFields.title = title;
    if (profileImage !== undefined) updateFields.profileImage = profileImage;
    if (profileSetup !== undefined && isSelf) updateFields.profileSetup = profileSetup;
    if (role !== undefined && isManager) updateFields.role = role;

    const [updated] = await db
      .update(usersTable)
      .set(updateFields)
      .where(eq(usersTable.id, req.params.userId))
      .returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    invalidateUsers();
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Change own password
router.post("/users/me/password", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { currentPassword, newPassword } = req.body as Record<string, string>;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    if (!user?.passwordHash) {
      res.status(400).json({ error: "No password set for this account." });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, req.user.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Admin: reset another user's password
router.post("/users/:userId/password", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ error: "Admins only" }); return; }
  try {
    const { newPassword } = req.body as Record<string, string>;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "newPassword must be at least 6 characters." });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, req.params.userId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
