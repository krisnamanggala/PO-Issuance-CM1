ALTER TABLE `po_revisions` RENAME COLUMN "delivery_lead_time_days" TO "delivery_lead_time_weeks";--> statement-breakpoint
UPDATE `po_revisions`
SET `delivery_lead_time_weeks` = CAST((`delivery_lead_time_weeks` + 6) / 7 AS INTEGER),
    `purchasing_group` = UPPER(`purchasing_group`);--> statement-breakpoint
ALTER TABLE `po_revisions` ADD `pb_validity` text DEFAULT 'N/A' NOT NULL;--> statement-breakpoint
ALTER TABLE `po_revisions` ADD `wb_validity` text DEFAULT 'N/A' NOT NULL;
