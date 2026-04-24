import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const payrollPeriodsTable = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PayrollPeriod = typeof payrollPeriodsTable.$inferSelect;
