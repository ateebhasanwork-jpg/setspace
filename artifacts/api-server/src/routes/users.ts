import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { invalidateUsers, getCachedUsers } from "../lib/cache";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  try {
    // Serve from cache — avoids a DB round-trip when multiple users load the page concurrently
    const users = await getCachedUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
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
  } catch (err) {
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

    // Invalidate user cache so the updated profile is reflected everywhere immediately
    invalidateUsers();

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
