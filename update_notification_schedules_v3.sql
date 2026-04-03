-- Add minute support for exact scheduling
ALTER TABLE notification_schedules ADD COLUMN IF NOT EXISTS minute INTEGER DEFAULT 0; -- 0-59
COMMENT ON COLUMN notification_schedules.minute IS 'Minute of the hour to send (0-59)';

-- Ensure existing schedules default to 0
UPDATE notification_schedules SET minute = 0 WHERE minute IS NULL;
