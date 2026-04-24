import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const salariesTable = pgTable("salaries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  basicSalary: integer("basic_salary").notNull().default(0),
  overtimeRate: integer("overtime_rate").notNull().default(0),
  dependabilityDeductionAmount: integer("dependability_deduction_amount").notNull().default(0),
  kpiDeductionAmount: integer("kpi_deduction_amount").notNull().default(0),
  /** Override total working days for this employee (null = auto Mon–Fri count) */
  workingDaysOverride: integer("working_days_override"),
  /** How many late tasks trigger the KPI deduction (default 2) */
  kpiThreshold: integer("kpi_threshold").notNull().default(2),
  /** How many absences trigger the dependability deduction (default 2) */
  dependabilityThreshold: integer("dependability_threshold").notNull().default(2),
  /** Employee-level effective start date for absence tracking (YYYY-MM-DD). Overrides period/global start. */
  effectiveStartDate: text("effective_start_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Salary = typeof salariesTable.$inferSelect;

export const approvedLeavesTable = pgTable("approved_leaves", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  /** Date string YYYY-MM-DD */
  date: text("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ApprovedLeave = typeof approvedLeavesTable.$inferSelect;
