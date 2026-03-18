import { pgTable, text, timestamp, integer, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  date: text("date").notNull(),
  status: text("status").notNull().default("present"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
  lastClockIn: timestamp("last_clock_in"),
});

export type AttendanceRecord = typeof attendanceTable.$inferSelect;
