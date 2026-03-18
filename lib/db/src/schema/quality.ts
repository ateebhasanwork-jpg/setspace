import { pgTable, text, timestamp, integer, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { tasksTable } from "./tasks";

export const qualityChecksTable = pgTable("quality_checks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  reviewerId: text("reviewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  submitterId: text("submitter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  status: text("status").notNull().default("pending"),
  videoVersionId: integer("video_version_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type QualityCheck = typeof qualityChecksTable.$inferSelect;
