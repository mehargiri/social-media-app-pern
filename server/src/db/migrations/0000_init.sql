CREATE TYPE "public"."college_type" AS ENUM('college', 'graduate_school', 'university');--> statement-breakpoint
CREATE TYPE "public"."friend_status" AS ENUM('unfriend', 'pending', 'friend');--> statement-breakpoint
CREATE TYPE "public"."like_type" AS ENUM('like', 'love', 'happy');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('friendRequest', 'like', 'comment', 'post');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "college" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"start_year" integer,
	"end_year" integer,
	"description" text,
	"major_1" text,
	"major_2" text,
	"major_3" text,
	"degree" text,
	"type" "college_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"content" text NOT NULL,
	"comment_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_level_check" CHECK ("comment"."comment_level" >= 0 AND "comment"."comment_level" <= 2)
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"status" "friend_status" DEFAULT 'unfriend',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "highschool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"start_year" integer,
	"end_year" integer,
	"graduated" boolean DEFAULT false,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "like" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"type" "like_type" DEFAULT 'like',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "like_at_least_one_entity" CHECK ("like"."post_id" IS NOT NULL OR "like"."comment_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiver_id" uuid,
	"sender_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"type" "notification_type",
	"is_broadcast" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notify_at_least_one_entity" CHECK ("notification"."receiver_id" IS NOT NULL OR "notification"."post_id" IS NOT NULL OR "notification"."comment_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification_receiver" (
	"user_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_receiver_user_id_notification_id_pk" PRIMARY KEY("user_id","notification_id")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"assets" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"full_name" text GENERATED ALWAYS AS ("user_"."first_name" || ' ' || "user_"."last_name") STORED,
	"phone" text,
	"gender" "gender",
	"birthday" date,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"profile_pic" text,
	"cover_pic" text,
	"bio" text,
	"current_city" text,
	"hometown" text,
	"confirmed_email" boolean DEFAULT false NOT NULL,
	"refresh_token" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user__email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text,
	"position" text,
	"city" text,
	"description" text,
	"start_year" integer,
	"end_year" integer,
	"working_now" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "college" ADD CONSTRAINT "college_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_comment_id_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_friend_id_user__id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highschool" ADD CONSTRAINT "highschool_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like" ADD CONSTRAINT "like_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like" ADD CONSTRAINT "like_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like" ADD CONSTRAINT "like_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_receiver_id_user__id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_sender_id_post_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receiver" ADD CONSTRAINT "notification_receiver_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receiver" ADD CONSTRAINT "notification_receiver_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_user_id_user__id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "full_name_index" ON "user_" USING btree ("full_name");