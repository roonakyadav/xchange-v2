-- =========================================
-- VERIFY SUPABASE SETUP FOR SAVED POSTS & FEEDBACK
-- =========================================

-- 1. Check if tables exist
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('saved_posts', 'feedback')
ORDER BY tablename;

-- 2. Check RLS status on tables
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('saved_posts', 'feedback')
ORDER BY tablename;

-- 3. Check RLS policies for saved_posts
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'saved_posts'
ORDER BY policyname;

-- 4. Check RLS policies for feedback
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'feedback'
ORDER BY policyname;

-- 5. Check table structure for saved_posts
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'saved_posts'
ORDER BY ordinal_position;

-- 6. Check table structure for feedback
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'feedback'
ORDER BY ordinal_position;

-- 7. Test if you can query the tables (should return empty if no data)
SELECT COUNT(*) as saved_posts_count FROM saved_posts;
SELECT COUNT(*) as feedback_count FROM feedback;
