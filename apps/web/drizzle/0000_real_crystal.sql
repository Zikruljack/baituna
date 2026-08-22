CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."AuditAction" AS ENUM('CREATE', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."MosqueStatus" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('super_admin', 'mosque_admin', 'public_user');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"action" "AuditAction" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"province_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friday_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mosque_id" uuid NOT NULL,
	"assignment_date" date NOT NULL,
	"khatib_person_id" uuid,
	"imam_person_id" uuid,
	"muazzin_person_id" uuid,
	CONSTRAINT "friday_assignments_mosque_date_key" UNIQUE("mosque_id","assignment_date")
);
--> statement-breakpoint
CREATE TABLE "mosques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"city_id" uuid NOT NULL,
	"province_id" uuid NOT NULL,
	"mukim_id" uuid,
	"status" "MosqueStatus" DEFAULT 'pending' NOT NULL,
	"admin_user_id" uuid,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "mukims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mosque_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"active" boolean GENERATED ALWAYS AS (("deleted_at" IS NULL)) STORED,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "UserRole" DEFAULT 'public_user' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_mosque_id_mosques_id_fk" FOREIGN KEY ("mosque_id") REFERENCES "public"."mosques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_khatib_person_id_people_id_fk" FOREIGN KEY ("khatib_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_imam_person_id_people_id_fk" FOREIGN KEY ("imam_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_muazzin_person_id_people_id_fk" FOREIGN KEY ("muazzin_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_mukim_id_mukims_id_fk" FOREIGN KEY ("mukim_id") REFERENCES "public"."mukims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mukims" ADD CONSTRAINT "mukims_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_mosque_id_mosques_id_fk" FOREIGN KEY ("mosque_id") REFERENCES "public"."mosques"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Drizzle schema uses reusable audit columns. These audit foreign keys are
-- deliberately expressed in SQL so the User self-reference and every audited
-- entity remain enforced by PostgreSQL without duplicating relation metadata.
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "cities" ADD CONSTRAINT "cities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "cities" ADD CONSTRAINT "cities_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "cities" ADD CONSTRAINT "cities_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mukims" ADD CONSTRAINT "mukims_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mukims" ADD CONSTRAINT "mukims_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mukims" ADD CONSTRAINT "mukims_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "people" ADD CONSTRAINT "people_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "people" ADD CONSTRAINT "people_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "friday_assignments" ADD CONSTRAINT "friday_assignments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
CREATE INDEX "cities_province_id_idx" ON "cities" ("province_id");
CREATE INDEX "mukims_city_id_idx" ON "mukims" ("city_id");
CREATE INDEX "mosques_city_id_idx" ON "mosques" ("city_id");
CREATE INDEX "mosques_province_id_idx" ON "mosques" ("province_id");
CREATE INDEX "mosques_mukim_id_idx" ON "mosques" ("mukim_id");
CREATE INDEX "mosques_admin_user_id_idx" ON "mosques" ("admin_user_id");
CREATE INDEX "mosques_latitude_longitude_idx" ON "mosques" ("latitude", "longitude");
CREATE INDEX "people_mosque_id_idx" ON "people" ("mosque_id");
CREATE INDEX "friday_assignments_khatib_person_id_idx" ON "friday_assignments" ("khatib_person_id");
CREATE INDEX "friday_assignments_imam_person_id_idx" ON "friday_assignments" ("imam_person_id");
CREATE INDEX "friday_assignments_muazzin_person_id_idx" ON "friday_assignments" ("muazzin_person_id");
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs" ("table_name", "record_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
