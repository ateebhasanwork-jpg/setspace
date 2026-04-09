import { pgTable, serial, text, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const scheduleSlotsTable = pgTable("schedule_slots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  loginHour: integer("login_hour").notNull(),
  loginMinute: integer("login_minute").notNull().default(0),
  shiftHours: integer("shift_hours").notNull().default(4),
}, (t) => ({
  uniq: unique().on(t.userId, t.dayOfWeek),
}));

export type ScheduleSlot = typeof scheduleSlotsTable.$inferSelect;
