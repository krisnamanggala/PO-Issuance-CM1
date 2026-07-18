CREATE TABLE `po_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_number` text NOT NULL,
	`revision_number` integer NOT NULL,
	`released_date` text NOT NULL,
	`purchasing_group` text NOT NULL,
	`equipment_name` text NOT NULL,
	`vendor_name` text NOT NULL,
	`budget` text NOT NULL,
	`contract_value` text NOT NULL,
	`delivery_lead_time_days` integer NOT NULL,
	`incoterm` text NOT NULL,
	`eta_ros_at_site` text NOT NULL,
	`term_of_payment` text NOT NULL,
	`milestone_details` text DEFAULT '' NOT NULL,
	`pb` integer NOT NULL,
	`wb` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `po_revisions_po_revision_unique` ON `po_revisions` (`po_number`,`revision_number`);--> statement-breakpoint
CREATE INDEX `po_revisions_po_number_idx` ON `po_revisions` (`po_number`);--> statement-breakpoint
CREATE INDEX `po_revisions_eta_idx` ON `po_revisions` (`eta_ros_at_site`);--> statement-breakpoint
CREATE INDEX `po_revisions_group_idx` ON `po_revisions` (`purchasing_group`);