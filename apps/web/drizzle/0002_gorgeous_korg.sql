ALTER TABLE "cities" ADD CONSTRAINT "cities_province_name_key" UNIQUE("province_id","name");--> statement-breakpoint
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_name_unique" UNIQUE("name");