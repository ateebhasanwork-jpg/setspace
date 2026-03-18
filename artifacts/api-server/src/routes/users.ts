import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.firstName);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.patch("/users/:userId", async (req, res) => {
  try {
    const { firstName, lastName, role, department, title } = req.body;
    const [updated] = await db
      .update(usersTable)
      .set({ firstName, lastName, role, department, title, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.userId))
      .returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
