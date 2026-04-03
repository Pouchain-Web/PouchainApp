-- Create table for automated push notification schedules
CREATE TABLE IF NOT EXISTS notification_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id), -- Null means 'all' or specific logic, but here we can allow null for 'all'
    target_type TEXT NOT NULL DEFAULT 'all', -- 'all' or 'specific'
    message TEXT NOT NULL,
    frequency TEXT NOT NULL, -- 'weekly', 'monthly', 'yearly', 'daily'
    day_of_week INTEGER, -- 0-6 (0=Sunday)
    day_of_month INTEGER, -- 1-31
    month INTEGER, -- 1-12
    last_sent_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

-- Allow only admins to manage schedules
CREATE POLICY "Admins can do anything on notification_schedules"
ON notification_schedules
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Add a comment
COMMENT ON TABLE notification_schedules IS 'Stores schedules for automated push notifications.';
