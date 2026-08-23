CREATE TYPE "public"."AuthProvider" AS ENUM('local', 'google');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" "AuthProvider" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_provider_key" UNIQUE("provider","provider_id");