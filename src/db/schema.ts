import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull().default(""),
  city: text("city").notNull().default(""),
  logo: text("logo"), // data URL (png/jpg)
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("teacher"), // admin | teacher
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_uq").on(t.username)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  level: text("level").notNull().default(""),
  academicYear: text("academic_year").notNull().default(""),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    birthDate: date("birth_date"),
    gender: text("gender"), // M | F
    nationalId: text("national_id"),
    notes: text("notes").notNull().default(""),
    photo: text("photo"), // data URL (jpg/png/webp) or relative path
    extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("students_class_idx").on(t.classId),
    index("students_inst_idx").on(t.institutionId),
    uniqueIndex("students_nid_uq").on(t.institutionId, t.nationalId),
  ],
);

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("academic"), // academic | behavioral
  sortOrder: integer("sort_order").notNull().default(0),
});

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("skills_subject_idx").on(t.subjectId)],
);

export const periods = pgTable("periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Append-only: a new evaluation never overwrites an old one.
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => periods.id, { onDelete: "set null" }),
    levelKey: text("level_key").notNull(),
    score: numeric("score", { precision: 8, scale: 2 }).notNull().default("0"),
    note: text("note").notNull().default(""),
    evaluatedBy: uuid("evaluated_by").references(() => users.id, { onDelete: "set null" }),
    evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
  },
  (t) => [
    index("eval_student_idx").on(t.studentId),
    index("eval_skill_idx").on(t.skillId),
    index("eval_period_idx").on(t.periodId),
  ],
);

export const aiAnalyses = pgTable("ai_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // student | class
  targetId: uuid("target_id").notNull(),
  periodId: uuid("period_id"),
  source: text("source").notNull(), // ai | rules
  provider: text("provider").notNull().default(""),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // students | digitization | legacy
  filename: text("filename").notNull().default(""),
  total: integer("total").notNull().default(0),
  imported: integer("imported").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  report: jsonb("report").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const importMappings = pgTable("import_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exportLogs = pgTable("export_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // student | class | bulk | backup
  format: text("format").notNull(),
  scope: text("scope").notNull().default(""),
  count: integer("count").notNull().default(0),
  filename: text("filename").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull().default(0),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id").notNull(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull().default(""),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
