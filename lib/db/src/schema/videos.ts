import { pgTable, text, timestamp, integer, serial, boolean, real } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { tasksTable } from "./tasks";

export const videoProjectsTable = pgTable("video_projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientName: text("client_name"),
  description: text("description"),
  taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  createdById: text("created_by_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type VideoProject = typeof videoProjectsTable.$inferSelect;

export const videoVersionsTable = pgTable("video_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => videoProjectsTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("pending"),
  uploadedById: text("uploaded_by_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  shareToken: text("share_token"),
  framioAssetId: text("framio_asset_id"),
  framioReviewLink: text("framio_review_link"),
  framioSyncStatus: text("framio_sync_status").notNull().default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VideoVersion = typeof videoVersionsTable.$inferSelect;

export const videoCommentsTable = pgTable("video_comments", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id").notNull().references(() => videoVersionsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  authorType: text("author_type").notNull().default("internal"),
  content: text("content").notNull(),
  timestampSeconds: real("timestamp_seconds"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VideoComment = typeof videoCommentsTable.$inferSelect;

export const videoShareTokensTable = pgTable("video_share_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  versionId: integer("version_id").notNull().references(() => videoVersionsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VideoShareToken = typeof videoShareTokensTable.$inferSelect;
