import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const salariesTable = pgTable("salaries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  basicSalary: integer("basic_salary").notNull().default(0),
  overtimePayment: integer("overtime_payment").notNull().default(0),
  dependabilityDeductionAmount: integer("dependability_deduction_amount").notNull().default(0),
  kpiDeductionAmount: integer("kpi_deduction_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Salary = typeof salariesTable.$inferSelect;
