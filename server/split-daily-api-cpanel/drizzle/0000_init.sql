CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."group_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'paid', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."split_method" AS ENUM('equal', 'exact', 'percentage', 'shares');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"providerAccountId" varchar(191) NOT NULL,
	"email" varchar(320),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"actorId" integer NOT NULL,
	"groupId" integer,
	"kind" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"relatedEntityType" varchar(64),
	"relatedEntityId" varchar(36),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_logs_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"symbol" varchar(8) NOT NULL,
	"minorUnit" integer DEFAULT 2 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"platform" varchar(32) NOT NULL,
	"deviceName" varchar(160),
	"lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exchange_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"baseCurrency" varchar(3) NOT NULL,
	"quoteCurrency" varchar(3) NOT NULL,
	"rate" varchar(32) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_participants" (
	"expenseId" integer NOT NULL,
	"userId" integer NOT NULL,
	"value" varchar(32) NOT NULL,
	"amountMinor" integer NOT NULL,
	CONSTRAINT "expense_participants_expenseId_userId_pk" PRIMARY KEY("expenseId","userId")
);
--> statement-breakpoint
CREATE TABLE "expense_payers" (
	"expenseId" integer NOT NULL,
	"userId" integer NOT NULL,
	"amountMinor" integer NOT NULL,
	CONSTRAINT "expense_payers_expenseId_userId_pk" PRIMARY KEY("expenseId","userId")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"groupId" integer,
	"createdBy" integer NOT NULL,
	"description" varchar(160) NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"originalAmountMinor" integer NOT NULL,
	"originalCurrency" varchar(3) NOT NULL,
	"exchangeRate" varchar(32),
	"category" varchar(64) DEFAULT 'Other' NOT NULL,
	"splitMethod" "split_method" NOT NULL,
	"note" text,
	"receiptCount" integer DEFAULT 0 NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "expenses_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "friend_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"senderId" integer NOT NULL,
	"receiverId" integer NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"respondedAt" timestamp with time zone,
	CONSTRAINT "friend_requests_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "friendships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"userAId" integer NOT NULL,
	"userBId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"removedAt" timestamp with time zone,
	CONSTRAINT "friendships_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "group_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"groupId" integer NOT NULL,
	"inviterId" integer NOT NULL,
	"inviteeEmail" varchar(320),
	"code" varchar(32) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"acceptedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invitations_publicId_unique" UNIQUE("publicId"),
	CONSTRAINT "group_invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"groupId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "group_member_role" DEFAULT 'member' NOT NULL,
	"joinedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"leftAt" timestamp with time zone,
	CONSTRAINT "group_members_groupId_userId_pk" PRIMARY KEY("groupId","userId")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"imageUrl" text,
	"category" varchar(64) DEFAULT 'Other' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"archivedAt" timestamp with time zone,
	CONSTRAINT "groups_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"pushEnabled" boolean DEFAULT true NOT NULL,
	"emailEnabled" boolean DEFAULT true NOT NULL,
	"inAppEnabled" boolean DEFAULT true NOT NULL,
	"expenseAlerts" boolean DEFAULT true NOT NULL,
	"groupAlerts" boolean DEFAULT true NOT NULL,
	"friendAlerts" boolean DEFAULT true NOT NULL,
	"settlementAlerts" boolean DEFAULT true NOT NULL,
	"reminderAlerts" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"relatedEntityType" varchar(64),
	"relatedEntityId" varchar(36),
	"readAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "notifications_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "push_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deviceId" integer NOT NULL,
	"token" varchar(512) NOT NULL,
	"provider" varchar(32) DEFAULT 'expo' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedAt" timestamp with time zone,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"expenseId" integer NOT NULL,
	"uploadedBy" integer NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"stableUrl" varchar(1024) NOT NULL,
	"contentType" varchar(128) NOT NULL,
	"sizeBytes" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "receipts_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recurring_expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"createdBy" integer NOT NULL,
	"groupId" integer,
	"description" varchar(160) NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"recurrence" varchar(32) NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone,
	"nextRunAt" timestamp with time zone NOT NULL,
	"pausedAt" timestamp with time zone,
	"cancelledAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_expenses_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"createdBy" integer NOT NULL,
	"targetUserId" integer,
	"amountMinor" integer,
	"currency" varchar(3),
	"message" text NOT NULL,
	"remindAt" timestamp with time zone NOT NULL,
	"recurrence" varchar(32),
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"userAgent" varchar(512),
	"ipAddress" varchar(64),
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedAt" timestamp with time zone,
	CONSTRAINT "sessions_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "settlements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"groupId" integer,
	"payerId" integer NOT NULL,
	"receiverId" integer NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"paymentMethod" varchar(64) DEFAULT 'Other' NOT NULL,
	"note" text,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"settledAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicId" varchar(36) NOT NULL,
	"name" varchar(160),
	"email" varchar(320),
	"emailVerified" boolean DEFAULT false NOT NULL,
	"loginMethod" varchar(64),
	"profileImageUrl" text,
	"phone" varchar(32),
	"defaultCurrency" varchar(3) DEFAULT 'USD' NOT NULL,
	"displayCurrency" varchar(3) DEFAULT 'USD' NOT NULL,
	"country" varchar(2),
	"timezone" varchar(64),
	"language" varchar(16) DEFAULT 'en' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"notificationPreferences" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "users_publicId_unique" UNIQUE("publicId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_idx" ON "accounts" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "activity_group_feed_idx" ON "activity_logs" USING btree ("groupId","createdAt");--> statement-breakpoint
CREATE INDEX "activity_actor_idx" ON "activity_logs" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE INDEX "exchange_rates_lookup_idx" ON "exchange_rates" USING btree ("baseCurrency","quoteCurrency","capturedAt");--> statement-breakpoint
CREATE INDEX "expense_participants_user_idx" ON "expense_participants" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "expense_payers_user_idx" ON "expense_payers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "expenses_group_idx" ON "expenses" USING btree ("groupId","occurredAt");--> statement-breakpoint
CREATE INDEX "expenses_creator_idx" ON "expenses" USING btree ("createdBy","occurredAt");--> statement-breakpoint
CREATE INDEX "friend_requests_receiver_idx" ON "friend_requests" USING btree ("receiverId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_idx" ON "friendships" USING btree ("userAId","userBId");--> statement-breakpoint
CREATE INDEX "group_invitations_group_idx" ON "group_invitations" USING btree ("groupId");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "groups_owner_idx" ON "groups" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "groups_archived_idx" ON "groups" USING btree ("archivedAt");--> statement-breakpoint
CREATE INDEX "notifications_user_feed_idx" ON "notifications" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "settlements_payer_idx" ON "settlements" USING btree ("payerId","status");--> statement-breakpoint
CREATE INDEX "settlements_receiver_idx" ON "settlements" USING btree ("receiverId","status");