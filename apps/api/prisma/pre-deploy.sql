-- One-time cleanup for the Issue -> Task rename: existing Comment rows
-- reference the old Issue table being renamed/recreated as Task, so they
-- would be orphaned regardless. Remove them so `prisma db push` can add
-- the new required Comment.taskId column without --force-reset (which
-- would wipe the entire database).
DELETE FROM "Comment";

-- The NotificationType enum dropped ISSUE_ASSIGNED in favor of
-- TASK_ASSIGNED. Existing rows with the old value can't be cast to the
-- new enum during AlterEnum, so remove them before push.
DELETE FROM "Notification" WHERE type = 'ISSUE_ASSIGNED';
