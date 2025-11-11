-- Enable RLS on saved_posts table
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- TEMPORARY: Allow all operations (for testing)
-- Remove these and use proper policies after confirming auth works
CREATE POLICY "allow_all_saved_posts" ON "public"."saved_posts"
FOR ALL USING (true) WITH CHECK (true);
