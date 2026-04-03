-- Update notification_schedules table to support multiple users and specific hour
ALTER TABLE notification_schedules ADD COLUMN IF NOT EXISTS hour INTEGER DEFAULT 8; -- 0-23
ALTER TABLE notification_schedules ADD COLUMN IF NOT EXISTS target_user_ids UUID[]; -- Array of user IDs

-- Keep user_id (singular) for backward compatibility or just migrate to target_user_ids
-- If target_type is 'specific', we'll use target_user_ids. If 'all', it remains 'all'.

COMMENT ON COLUMN notification_schedules.hour IS 'Hour of the day to send (0-23)';
COMMENT ON COLUMN notification_schedules.target_user_ids IS 'List of specific user IDs if target_type is specific';
