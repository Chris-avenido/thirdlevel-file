-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SEQUENCE "public"."authorization_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."third_level_officials_masterlist_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."third_level_officials_profiling_application_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."third_level_officials_updates_TLOUid_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_accomplishment_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_education_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_eligibility_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_other_courses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_position_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tlo_training_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "authorization_codes" (
	"id" integer PRIMARY KEY DEFAULT nextval('authorization_codes_id_seq'::regclass) NOT NULL,
	"code" varchar NOT NULL,
	"role" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notable_achievements" (
	"index_number" integer PRIMARY KEY NOT NULL,
	"achievement" text NOT NULL,
	"delete_flg" integer DEFAULT 0,
	"create_date" timestamp DEFAULT CURRENT_TIMESTAMP,
	"edit_date" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "third_level_officials_masterlist" (
	"id" integer PRIMARY KEY DEFAULT nextval('third_level_officials_masterlist_id_seq'::regclass) NOT NULL,
	"tlid" text,
	"sort_index" integer,
	"strand" text,
	"office" text,
	"name" text,
	"position" text,
	"email" text,
	"alt_email_1" text,
	"alt_email_2" text,
	"contact_details" text,
	"alt_contact_details_1" text,
	"alt_contact_details_2" text,
	"assignment_date" date,
	"remarks" text,
	"status" text,
	"change_type" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "third_level_officials_profiles" (
	"tlid" text PRIMARY KEY NOT NULL,
	"last_name" text,
	"first_name" text,
	"middle_name" text,
	"suffix" text,
	"gender" text,
	"date_of_birth" date,
	"age" smallint,
	"civil_status" text,
	"position_title" text,
	"appointment_date" date,
	"emt_passer" boolean,
	"emt_date" date,
	"ces_stage" text,
	"ces_conferment_date" date,
	"total_years_third_level" numeric,
	"previous_positions" jsonb DEFAULT '[]'::jsonb,
	"relevant_trainings" jsonb DEFAULT '[]'::jsonb,
	"permanent_address" text,
	"highest_education" text,
	"education_program" text,
	"education_year_graduated" smallint,
	"notable_achievements" text,
	"performance_rating_ipcrf" text,
	"performance_rating_cespes" text,
	"photo_binary_id" uuid,
	"pds_binary_id" uuid,
	"profile_word_binary_id" uuid,
	"profile_ppt_binary_id" uuid,
	"service_records_binary_id" uuid,
	"pending_admin_case" text,
	"ombudsman_case" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "third_level_official_masterlist" (
	"TLOid" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"middle_name" text,
	"suffix" text,
	"gender" text,
	"date_of_birth" date,
	"civil_status" text,
	"position_title" text,
	"office" text,
	"strand" text,
	"status" text,
	"email" text,
	"alt_email_1" text,
	"alt_email_2" text,
	"contact_details" text,
	"alt_contact_details_1" text,
	"alt_contact_details_2" text,
	"permanent_address" text,
	"emt_passer" boolean,
	"emt_date" date,
	"ces_stage" text,
	"ces_conferment_date" date,
	"total_years_third_level" numeric,
	"managerial_experience_total" text,
	"performance_rating_1" text,
	"performance_rating_1_period" text,
	"performance_rating_2" text,
	"performance_rating_2_period" text,
	"cespes_1_rating" varchar,
	"cespes_2_rating" varchar,
	"cespes_rating_1_period" varchar,
	"cespes_rating_2_period" varchar,
	"notable_achievements" jsonb DEFAULT '[]'::jsonb,
	"total_training_hours" numeric,
	"performance_rating_ipcrf" text,
	"performance_rating_cespes" text,
	"photo_binary_id" uuid,
	"pds_binary_id" uuid,
	"profile_word_binary_id" uuid,
	"profile_ppt_binary_id" uuid,
	"service_records_binary_id" uuid,
	"pending_admin_case" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"appointment_date" date,
	"age" smallint,
	"dpa_consented_at" timestamp with time zone,
	"effectivity_date" timestamp,
	"reassign_target_tloid" varchar,
	"reassign_assignee_tloid" varchar,
	"region" varchar,
	"sandiganbayan_clearance_binary_id" varchar,
	"nbi_clearance_binary_id" varchar,
	"csc_clearance_binary_id" varchar,
	"ombudsman_clearance_binary_id" varchar,
	"guilty_admin_details" text,
	"criminally_charged_details" text,
	"convicted_crime_details" text,
	"designation" text,
	"is_oic" boolean DEFAULT false,
	"division" varchar,
	"sort_index" integer DEFAULT 0,
	"ombudsman_case" text,
	"nationality" text,
	"religion" text,
	"blood_type" text,
	"dependents" text,
	"height" text,
	"weight" text,
	"temporary_address" varchar,
	"executive_summary_binary_id" text,
	"performance_rating_3" text,
	"performance_rating_3_period" text,
	"employment_status" text,
	"assignment" text,
	"date_of_assignment" text,
	"is_testaccount" boolean DEFAULT false NOT NULL,
	"reassignment_order_binary_id" uuid,
	"appointment_status" text,
	"plantilla_item_no" text
);
--> statement-breakpoint
CREATE TABLE "third_level_officials_updates" (
	"TLOUid" bigint PRIMARY KEY DEFAULT nextval('"third_level_officials_updates_TLOUid_seq"'::regclass) NOT NULL,
	"TLOid" text NOT NULL,
	"change_type" text,
	"updated_by" text,
	"remarks" text,
	"sort_index" integer,
	"last_name" text,
	"first_name" text,
	"middle_name" text,
	"suffix" text,
	"gender" text,
	"date_of_birth" date,
	"civil_status" text,
	"strand" text,
	"office" text,
	"designation" text,
	"assignment" text,
	"date_of_assignment" text,
	"position_title" text,
	"status" text,
	"email" text,
	"alt_email_1" text,
	"alt_email_2" text,
	"contact_details" text,
	"alt_contact_details_1" text,
	"alt_contact_details_2" text,
	"permanent_address" text,
	"emt_passer" boolean,
	"emt_date" date,
	"ces_stage" text,
	"ces_conferment_date" date,
	"previous_positions" jsonb DEFAULT '[]'::jsonb,
	"total_years_third_level" numeric,
	"highest_education" text,
	"education_program" text,
	"education_year_graduated" smallint,
	"relevant_trainings" jsonb DEFAULT '[]'::jsonb,
	"notable_achievements" text,
	"performance_rating_ipcrf" text,
	"performance_rating_cespes" text,
	"photo_binary_id" uuid,
	"pds_binary_id" uuid,
	"profile_word_binary_id" uuid,
	"profile_ppt_binary_id" uuid,
	"service_records_binary_id" uuid,
	"pending_admin_case" text,
	"ombudsman_case" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"tlid" text,
	"effectivity_date" timestamp,
	"vacate_reason" varchar,
	"region" varchar,
	"division" varchar
);
--> statement-breakpoint
CREATE TABLE "tlo_education_records" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_education_records_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"level" varchar NOT NULL,
	"degree" text DEFAULT '' NOT NULL,
	"institution" text,
	"year_graduated" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"personnel_id" uuid
);
--> statement-breakpoint
CREATE TABLE "third_level_officials_profiling_application" (
	"application_id" bigint PRIMARY KEY DEFAULT nextval('third_level_officials_profiling_application_application_id_seq'::regclass) NOT NULL,
	"app_tloid" text,
	"profiling_status" text,
	"application_status" text,
	"position_applied_for" text,
	"target_tloid" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"denial_reason" text,
	"last_name" text,
	"first_name" text,
	"middle_name" text,
	"suffix" text,
	"gender" text,
	"date_of_birth" date,
	"civil_status" text,
	"strand" text,
	"office" text,
	"designation" text,
	"assignment" text,
	"date_of_assignment" text,
	"position_title" text,
	"status" text,
	"email" text,
	"alt_email_1" text,
	"alt_email_2" text,
	"contact_details" text,
	"alt_contact_details_1" text,
	"alt_contact_details_2" text,
	"permanent_address" text,
	"emt_passer" boolean,
	"emt_date" date,
	"ces_stage" text,
	"ces_conferment_date" date,
	"total_years_third_level" numeric,
	"managerial_experience_total" varchar,
	"performance_rating_1" varchar,
	"performance_rating_1_period" varchar,
	"performance_rating_2" varchar,
	"performance_rating_2_period" varchar,
	"cespes_1_rating" varchar,
	"cespes_2_rating" varchar,
	"cespes_rating_1_period" varchar,
	"cespes_rating_2_period" varchar,
	"notable_achievements" jsonb DEFAULT '[]'::jsonb,
	"total_training_hours" numeric,
	"performance_rating_ipcrf" text,
	"performance_rating_cespes" text,
	"photo_binary_id" uuid,
	"pds_binary_id" uuid,
	"profile_word_binary_id" uuid,
	"profile_ppt_binary_id" uuid,
	"service_records_binary_id" uuid,
	"pending_admin_case" text,
	"dpa_consented_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"target_TLOid" text,
	"sandiganbayan_clearance_binary_id" varchar,
	"nbi_clearance_binary_id" varchar,
	"csc_clearance_binary_id" varchar,
	"ombudsman_clearance_binary_id" varchar,
	"guilty_admin_details" text,
	"criminally_charged_details" text,
	"convicted_crime_details" text,
	"is_oic" boolean DEFAULT false,
	"age" integer,
	"appointment_date" timestamp,
	"blood_type" text,
	"dependents" text,
	"height" text,
	"weight" text,
	"temporary_address" varchar,
	"executive_summary_binary_id" text,
	"performance_rating_3" text,
	"performance_rating_3_period" text,
	"nationality" text,
	"employment_status" text,
	"religion" text,
	"education_degrees" jsonb,
	"is_testaccount" boolean DEFAULT false NOT NULL,
	"appointment_status" text
);
--> statement-breakpoint
CREATE TABLE "tlo_other_courses" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_other_courses_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"course_title" text DEFAULT '' NOT NULL,
	"details" text,
	"institution" text,
	"date_from" date,
	"date_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"delete_flg" varchar DEFAULT 'No' NOT NULL,
	"personnel_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tlo_personnel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_tlo_id" varchar(50),
	"prefix" varchar(50),
	"first_name" varchar(150) NOT NULL,
	"middle_name" varchar(150),
	"last_name" varchar(150) NOT NULL,
	"suffix" varchar(50),
	"gender" varchar(20),
	"date_of_birth" date,
	"civil_status" varchar(50),
	"email" varchar(255),
	"alt_email_1" varchar(255),
	"alt_email_2" varchar(255),
	"contact_details" varchar(255),
	"alt_contact_details_1" varchar(255),
	"alt_contact_details_2" varchar(255),
	"permanent_address" text,
	"temporary_address" text,
	"nationality" text,
	"religion" text,
	"blood_type" text,
	"dependents" text,
	"height" text,
	"weight" text,
	"age" smallint,
	"dpa_consented_at" timestamp with time zone,
	"emt_passer" boolean,
	"emt_date" date,
	"ces_stage" text,
	"ces_conferment_date" date,
	"total_years_third_level" numeric,
	"managerial_experience_total" text,
	"performance_rating_1" text,
	"performance_rating_1_period" text,
	"performance_rating_2" text,
	"performance_rating_2_period" text,
	"performance_rating_3" text,
	"performance_rating_3_period" text,
	"cespes_1_rating" text,
	"cespes_2_rating" text,
	"cespes_rating_1_period" text,
	"cespes_rating_2_period" text,
	"performance_rating_ipcrf" text,
	"performance_rating_cespes" text,
	"pending_admin_case" text,
	"ombudsman_case" text,
	"guilty_admin_details" text,
	"criminally_charged_details" text,
	"convicted_crime_details" text,
	"sandiganbayan_clearance_binary_id" varchar(255),
	"nbi_clearance_binary_id" varchar(255),
	"csc_clearance_binary_id" varchar(255),
	"ombudsman_clearance_binary_id" varchar(255),
	"photo_binary_id" uuid,
	"pds_binary_id" uuid,
	"profile_word_binary_id" uuid,
	"profile_ppt_binary_id" uuid,
	"service_records_binary_id" uuid,
	"executive_summary_binary_id" text,
	"notable_achievements" jsonb DEFAULT '[]'::jsonb,
	"total_training_hours" numeric,
	"is_testaccount" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tlo_users" (
	"uid" text PRIMARY KEY NOT NULL,
	"email" text,
	"role" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"first_name" text,
	"last_name" text,
	"region" text,
	"division" text,
	"province" text,
	"city" text,
	"barangay" text,
	"office" text,
	"position" text,
	"disabled" boolean DEFAULT false,
	"contact_number" text,
	"alt_email" text,
	"account_category" text,
	"password_hash" text,
	"password_salt" text,
	"hash_version" text DEFAULT 'firebase',
	"passcode" text,
	"iern" text,
	"registrant_type" text,
	"school_id" text,
	"has_seen_nexus_tutorial" boolean DEFAULT false,
	"registration_status" varchar DEFAULT 'Valid',
	"is_testaccount" boolean DEFAULT false NOT NULL,
	"assigned_region" text,
	"assigned_division" text,
	"division_multiple" text[] DEFAULT '{""}',
	"assignment" text,
	"date_of_assignment" text
);
--> statement-breakpoint
CREATE TABLE "unified_binaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" text,
	"mime_type" text,
	"size_bytes" integer,
	"azure_blob_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"email" varchar PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"expires_at" timestamp DEFAULT (now() + '00:10:00'::interval)
);
--> statement-breakpoint
CREATE TABLE "tlo_accomplishment_records" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_accomplishment_records_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"award_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"delete_flg" varchar DEFAULT 'No' NOT NULL,
	"personnel_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tlo_items" (
	"item_number" varchar(100) PRIMARY KEY NOT NULL,
	"position_title" varchar(255) NOT NULL,
	"salary_grade" varchar(20),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tlo_eligibility_records" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_eligibility_records_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"eligibility_type" text DEFAULT '' NOT NULL,
	"rating" varchar,
	"conferment_date" date,
	"place_of_assignment" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"delete_flg" varchar DEFAULT 'No' NOT NULL,
	"personnel_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tlo_training_records" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_training_records_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"training_name" text DEFAULT '' NOT NULL,
	"hours" integer,
	"inclusive_date_start" date,
	"inclusive_date_end" date,
	"conducted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"delete_flg" varchar DEFAULT 'No' NOT NULL,
	"personnel_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tlo_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" uuid NOT NULL,
	"item_number" varchar(100),
	"region" varchar(255),
	"division" varchar(255),
	"office" varchar(255),
	"strand" varchar(255),
	"designation" text,
	"assignment_type" varchar(50) DEFAULT 'Permanent' NOT NULL,
	"status" varchar(50) DEFAULT 'Active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"reassignment_order_binary_id" uuid,
	"remarks" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"oic" boolean DEFAULT false NOT NULL,
	"position_title" varchar(255),
	CONSTRAINT "chk_tlo_assignments_status" CHECK ((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying, 'Ended'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "tlo_position_history" (
	"id" integer PRIMARY KEY DEFAULT nextval('tlo_position_history_id_seq'::regclass) NOT NULL,
	"source_table" varchar NOT NULL,
	"tlo_id" varchar NOT NULL,
	"position_name" text DEFAULT '' NOT NULL,
	"office" text,
	"strand" text,
	"division" text,
	"region" text,
	"inclusive_date_start" date,
	"inclusive_date_end" date,
	"oic_positions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"delete_flg" varchar DEFAULT 'No' NOT NULL,
	"reassignment_order_binary_id" uuid,
	"status" varchar(50) DEFAULT 'Inactive' NOT NULL,
	"oic" boolean DEFAULT false NOT NULL,
	"designation" text,
	CONSTRAINT "chk_tlo_position_history_status" CHECK ((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "ces_plantilla" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_row_number" integer NOT NULL,
	"office_bureau_division" text,
	"region" text,
	"position_title" text,
	"dbm_item_no" text,
	"salary_grade" varchar(10),
	"incumbent_name" text,
	"status_of_appointment" text,
	"is_vacant" boolean DEFAULT false,
	"is_section_header" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ces_plantilla_report_source_row_number_key" UNIQUE("source_row_number")
);
--> statement-breakpoint
ALTER TABLE "tlo_education_records" ADD CONSTRAINT "tlo_education_records_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_other_courses" ADD CONSTRAINT "tlo_other_courses_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_accomplishment_records" ADD CONSTRAINT "tlo_accomplishment_records_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_eligibility_records" ADD CONSTRAINT "tlo_eligibility_records_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_training_records" ADD CONSTRAINT "tlo_training_records_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_assignments" ADD CONSTRAINT "tlo_assignments_item_number_fkey" FOREIGN KEY ("item_number") REFERENCES "public"."tlo_items"("item_number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tlo_assignments" ADD CONSTRAINT "tlo_assignments_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "public"."tlo_personnel"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authorization_codes_code_key" ON "authorization_codes" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_masterlist_is_testaccount" ON "third_level_official_masterlist" USING btree ("is_testaccount" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_masterlist_status" ON "third_level_official_masterlist" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_masterlist_strand" ON "third_level_official_masterlist" USING btree ("strand" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlm_updates_tlid" ON "third_level_officials_updates" USING btree ("tlid" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_updates_tloid" ON "third_level_officials_updates" USING btree ("TLOid" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_edu_level" ON "tlo_education_records" USING btree ("level" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_edu_personnel" ON "tlo_education_records" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_edu_source_tloid" ON "tlo_education_records" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_app_is_testaccount" ON "third_level_officials_profiling_application" USING btree ("is_testaccount" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_tlopa_email" ON "third_level_officials_profiling_application" USING btree (lower(email) text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlopa_status" ON "third_level_officials_profiling_application" USING btree ("application_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_other_courses_delete_flg" ON "tlo_other_courses" USING btree ("delete_flg" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_courses_source_tloid" ON "tlo_other_courses" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_other_personnel" ON "tlo_other_courses" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_personnel_is_testaccount" ON "tlo_personnel" USING btree ("is_testaccount" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_users_division_multiple" ON "tlo_users" USING gin ("division_multiple" array_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_users_email" ON "tlo_users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_users_email_lower" ON "tlo_users" USING btree (lower(email) text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_users_iern" ON "tlo_users" USING btree ("iern" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_users_is_testaccount" ON "tlo_users" USING btree ("is_testaccount" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tlo_users_school_id" ON "tlo_users" USING btree ("school_id" text_ops) WHERE (school_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tlo_users_school_id_valid" ON "tlo_users" USING btree ("school_id" text_ops) WHERE (((registration_status)::text = 'Valid'::text) AND (school_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unified_binaries_hash" ON "unified_binaries" USING btree ("hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_accomplishment_delete_flg" ON "tlo_accomplishment_records" USING btree ("delete_flg" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_accomp_personnel" ON "tlo_accomplishment_records" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_accomp_source_tloid" ON "tlo_accomplishment_records" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_eligibility_delete_flg" ON "tlo_eligibility_records" USING btree ("delete_flg" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_elig_personnel" ON "tlo_eligibility_records" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_elig_source_tloid" ON "tlo_eligibility_records" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_elig_type" ON "tlo_eligibility_records" USING btree ("eligibility_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_train_hours" ON "tlo_training_records" USING btree ("tlo_id" text_ops,"hours" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_train_personnel" ON "tlo_training_records" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_train_source_tloid" ON "tlo_training_records" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_training_delete_flg" ON "tlo_training_records" USING btree ("delete_flg" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_assignments_item" ON "tlo_assignments" USING btree ("item_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_assignments_personnel" ON "tlo_assignments" USING btree ("personnel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_assignments_status" ON "tlo_assignments" USING btree ("status" text_ops,"assignment_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_assignments_status_oic" ON "tlo_assignments" USING btree ("status" bool_ops,"oic" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_assignments_title" ON "tlo_assignments" USING btree ("position_title" text_ops);--> statement-breakpoint
CREATE INDEX "idx_position_history_delete_flg" ON "tlo_position_history" USING btree ("delete_flg" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_pos_dates" ON "tlo_position_history" USING btree ("tlo_id" date_ops,"inclusive_date_start" date_ops,"inclusive_date_end" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_pos_source_tloid" ON "tlo_position_history" USING btree ("source_table" text_ops,"tlo_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tlo_pos_status_oic" ON "tlo_position_history" USING btree ("status" text_ops,"oic" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ces_plantilla_dbm_item_no" ON "ces_plantilla" USING btree ("dbm_item_no" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ces_plantilla_is_vacant" ON "ces_plantilla" USING btree ("is_vacant" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_ces_plantilla_position" ON "ces_plantilla" USING btree ("position_title" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ces_plantilla_region" ON "ces_plantilla" USING btree ("region" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ces_plantilla_source_row" ON "ces_plantilla" USING btree ("source_row_number" int4_ops);
*/