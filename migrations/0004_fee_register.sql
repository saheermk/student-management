CREATE TABLE `fee_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	`academic_year_id` integer NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`remarks` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fee_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fee_item_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`amount_paid` integer NOT NULL,
	`payment_date` text NOT NULL,
	`receipt_no` text NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`remarks` text,
	`recorded_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`fee_item_id`) REFERENCES `fee_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
