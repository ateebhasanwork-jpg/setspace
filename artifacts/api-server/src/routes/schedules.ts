import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduleSlotsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";
import { getCachedUsers, getCachedScheduleSlots, invalidateScheduleSlots } from "../lib/cache";

const router: IRouter = Router();

/**
 * Hardcoded employee schedules by firstName (case-insensitive).
 * dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
 */
const SCHEDULE_SEED: Array<{
  firstName?: string;
  username?: string;
  slots: Array<{ dayOfWeek: number; loginHour: number; loginMinute: number; shiftHours: number }>;
}> = [
  {
    firstName: "Abdullah",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 20, loginMinute: 0, shiftHours: 4 })),
  },
  {
    firstName: "Laiba",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 21, loginMinute: 30, shiftHours: 4 })),
  },
  {
    firstName: "Ahad",
    slots: [1, 2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, loginHour: 21, loginMinute: 30, shiftHours: 4 })),
  },
  {
    firstName: "Jafar",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 20, loginMinute: 0, shiftHours: 4 })),
  },
  {
    firstName: "Sani",
    slots: [
      ...([1, 2, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 20, loginMinute: 0, shiftHours: 4 }))),
      { dayOfWeek: 3, loginHour: 0, loginMinute: 0, shiftHours: 4 },
    ],
  },
  {
    firstName: "Zayd",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 18, loginMinute: 0, shiftHours: 6 })),
  },
  {
    firstName: "Salman",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 20, loginMinute: 0, shiftHours: 4 })),
  },
  {
    // Ateeb Hasan — Mon–Fri 5:30 PM PKT, 6-hour shift
    username: "ateebhasanwork",
    slots: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, loginHour: 17, loginMinute: 30, shiftHours: 6 })),
  },
];

/**
 * Seeds schedule slots for all known employees.
 * Safe to call multiple times — uses upsert so it won't duplicate.
 */
export async function seedSchedules() {
  try {
    const users = await getCachedUsers();
    for (const entry of SCHEDULE_SEED) {
      const user = users.find(u => {
        if (entry.username) return u.username?.toLowerCase() === entry.username.toLowerCase();
        if (entry.firstName) return (u.firstName ?? "").toLowerCase() === entry.firstName.toLowerCase();
        return false;
      });
      if (!user) continue;
      for (const slot of entry.slots) {
        await db.insert(scheduleSlotsTable)
          .values({ userId: user.id, ...slot })
          .onConflictDoUpdate({
            target: [scheduleSlotsTable.userId, scheduleSlotsTable.dayOfWeek],
            set: {
              loginHour: slot.loginHour,
              loginMinute: slot.loginMinute,
              shiftHours: slot.shiftHours,
            },
          });
      }
    }
  } catch (err) {
    console.error("[schedules] Seed error:", err);
  }
}

/** GET /api/schedules — all slots with user info (admin/HR) */
router.get("/schedules", requireAdminOrHR, async (_req, res) => {
  try {
    const [slots, users] = await Promise.all([
      getCachedScheduleSlots(),
      getCachedUsers(),
    ]);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    res.json(slots.map(s => ({ ...s, user: userMap[s.userId] ?? null })));
  } catch {
    res.status(500).json({ error: "Failed to list schedules" });
  }
});

/** PUT /api/schedules/:userId/:dayOfWeek — upsert a slot (admin/HR) */
router.put("/schedules/:userId/:dayOfWeek", requireAdminOrHR, async (req, res) => {
  try {
    const userId = req.params.userId;
    const dayOfWeek = parseInt(req.params.dayOfWeek);
    const { loginHour, loginMinute, shiftHours } = req.body as {
      loginHour: number; loginMinute: number; shiftHours: number;
    };
    await db.insert(scheduleSlotsTable)
      .values({ userId, dayOfWeek, loginHour, loginMinute: loginMinute ?? 0, shiftHours: shiftHours ?? 4 })
      .onConflictDoUpdate({
        target: [scheduleSlotsTable.userId, scheduleSlotsTable.dayOfWeek],
        set: { loginHour, loginMinute: loginMinute ?? 0, shiftHours: shiftHours ?? 4 },
      });
    invalidateScheduleSlots();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to upsert schedule" });
  }
});

/** DELETE /api/schedules/:userId/:dayOfWeek (admin/HR) */
router.delete("/schedules/:userId/:dayOfWeek", requireAdminOrHR, async (req, res) => {
  try {
    await db.delete(scheduleSlotsTable).where(
      and(
        eq(scheduleSlotsTable.userId, req.params.userId),
        eq(scheduleSlotsTable.dayOfWeek, parseInt(req.params.dayOfWeek))
      )
    );
    invalidateScheduleSlots();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

/** POST /api/schedules/seed — re-run seed (admin/HR) */
router.post("/schedules/seed", requireAdminOrHR, async (_req, res) => {
  await seedSchedules();
  invalidateScheduleSlots();
  res.json({ ok: true });
});

export default router;
