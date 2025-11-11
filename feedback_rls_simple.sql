-- Enable RLS on feedback table
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- TEMPORARY: Allow all operations (for testing)
-- Remove these and use proper policies after confirming auth works
CREATE POLICY "allow_all_feedback" ON "public"."feedback"
FOR ALL USING (true) WITH CHECK (true);
