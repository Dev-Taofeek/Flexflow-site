-- One-time cleanup for the Issue -> Task rename: existing Comment rows
-- reference the old Issue table being renamed/recreated as Task, so they
-- would be orphaned regardless. Remove them so `prisma db push` can add
-- the new required Comment.taskId column without --force-reset (which
-- would wipe the entire database).
DELETE FROM "Comment";
