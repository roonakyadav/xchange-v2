-- Enable RLS on feedback table
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own feedback
CREATE POLICY "users_insert_own_feedback" ON "public"."feedback"
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to select their own feedback
CREATE POLICY "users_select_own_feedback" ON "public"."feedback"
FOR SELECT USING (auth.uid() = user_id);

-- Allow users to update their own feedback (if needed)
CREATE POLICY "users_update_own_feedback" ON "public"."feedback"
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own feedback (if needed)
CREATE POLICY "users_delete_own_feedback" ON "public"."feedback"
FOR DELETE USING (auth.uid() = user_id);
