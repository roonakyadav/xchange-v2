-- Enable RLS on saved_posts table
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own saved posts
CREATE POLICY "users_insert_own_saved_posts" ON "public"."saved_posts"
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to select their own saved posts
CREATE POLICY "users_select_own_saved_posts" ON "public"."saved_posts"
FOR SELECT USING (auth.uid() = user_id);

-- Allow users to delete their own saved posts
CREATE POLICY "users_delete_own_saved_posts" ON "public"."saved_posts"
FOR DELETE USING (auth.uid() = user_id);

-- Allow users to update their own saved posts (if needed)
CREATE POLICY "users_update_own_saved_posts" ON "public"."saved_posts"
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
