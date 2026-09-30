CREATE TABLE `exam_marks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`marks` integer NOT NULL,
	`max_marks` integer DEFAULT 50 NOT NULL,
	`remarks` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_student_subject_unique` ON `exam_marks` (`exam_id`,`student_id`,`subject_id`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`exam_date` text NOT NULL,
	`academic_year_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grade_boundaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grade` text NOT NULL,
	`min_percentage` integer NOT NULL,
	`max_percentage` integer NOT NULL,
	`classification` text,
	`is_pass` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
