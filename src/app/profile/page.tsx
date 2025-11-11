'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MoreVertical, Heart, Grid3X3, Settings, MessageSquare, Star } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import PostMenu from '@/components/PostMenu'
import EditPostModal from '@/components/EditPostModal'
import { getUser, updateUsernameEverywhere, getUserPosts, deletePostAndImage, deleteAccount, authenticateUser, getSavedPosts, getUserStats, updateUserProfile, submitFeedback } from '@/lib/db'
import { profileSchema, feedbackSchema, type ProfileInput } from '@/lib/validators'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { formatTimeAgo } from '@/lib/time'
import { useUser } from '@/hooks/useUser'
import type { User, PostWithUser, SavedPost, UserStats, Feedback } from '@/types'

export default function Profile() {
    const router = useRouter()
    const { user: currentUser, logout, loading: userLoading } = useUser()
    const [posts, setPosts] = useState<PostWithUser[]>([])
    const [savedPosts, setSavedPosts] = useState<SavedPost[]>([])
    const [userStats, setUserStats] = useState<UserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts')
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deletingAccount, setDeletingAccount] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [selectedPost, setSelectedPost] = useState<any>(null)
    const [showEditModal, setShowEditModal] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset
    } = useForm<ProfileInput>({
        resolver: zodResolver(profileSchema)
    })

    const feedbackForm = useForm({
        resolver: zodResolver(feedbackSchema)
    })

    useEffect(() => {
        if (userLoading) return
        if (!currentUser) {
            router.push('/auth')
            return
        }

        fetchUserPosts(currentUser.username)
        fetchSavedPosts()
    }, [router, currentUser, userLoading])

    // Handle click outside menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Early returns for loading/auth states
    if (userLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        )
    }

    if (!currentUser) {
        return null
    }

    const fetchUserPosts = async (username: string) => {
        try {
            // Fetch user's posts
            const userPosts = await getUserPosts(username)
            setPosts(userPosts)

            reset({
                name: currentUser!.name,
                username: currentUser!.username
            })
        } catch (error) {
            console.error('Error fetching user posts:', error)
            toast.error('Failed to load profile')
        } finally {
            setLoading(false)
        }
    }

    const fetchSavedPosts = async () => {
        if (!currentUser?.id) return

        try {
            const saved = await getSavedPosts(currentUser.id)
            setSavedPosts(saved || [])
        } catch (error) {
            console.error('Error fetching saved posts:', error)
            // Table might not exist yet, set empty array
            setSavedPosts([])
        }
    }

    const onSubmit = async (data: ProfileInput) => {
        if (!currentUser) return

        setSaving(true)

        try {
            // If username changed, update everywhere
            if (data.username !== currentUser.username) {
                await updateUsernameEverywhere(currentUser.username, data.username)
            }

            // Update user info
            const { supabase } = await import('@/lib/supabase')
            const { error } = await supabase
                .from('users')
                .update({
                    name: data.name,
                    username: data.username
                })
                .eq('id', currentUser.id)

            if (error) throw error

            // The useUser hook will handle the localStorage update
            setEditing(false)
            toast.success('Profile updated successfully!')

            // Refresh the page to get updated user data
            window.location.reload()
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error('Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = () => {
        logout()
    }

    const handleDeleteAccount = async () => {
        if (!currentUser) return

        setDeletingAccount(true)

        try {
            // Verify password
            const { user, error } = await authenticateUser(currentUser.username, deletePassword)

            if (error === 'wrong_password') {
                toast.error('Wrong password')
                setDeletingAccount(false)
                return
            }

            if (!user) {
                toast.error('Authentication failed')
                setDeletingAccount(false)
                return
            }

            // Delete account using user ID
            await deleteAccount(currentUser.id)

            // Clear localStorage
            localStorage.removeItem('x_user')
            localStorage.removeItem('x_seen_welcome')

            // Show success toast and redirect
            toast.success('Account deleted')
            router.replace('/')

        } catch (error) {
            console.error('Error deleting account:', error)
            toast.error('Failed to delete account')
        } finally {
            setDeletingAccount(false)
        }
    }

    const handleSendFeedback = () => {
        const mailtoLink = `mailto:ronakyadav1609@gmail.com?subject=Xchange Feedback&body=`
        window.location.href = mailtoLink
    }

    const onEditPost = (post: any) => {
        console.log('📝 [PROFILE] onEditPost called with post:', post)
        setSelectedPost(post)
        setShowEditModal(true)
    }



    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse space-y-6">
                        <div className="h-32 bg-black/20 backdrop-blur-md border border-white/20 rounded-lg"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-black/20 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden">
                                    <div className="aspect-square bg-black/20 backdrop-blur-md border border-white/20"></div>
                                    <div className="p-4 space-y-2">
                                        <div className="h-4 bg-black/20 backdrop-blur-md border border-white/20 rounded"></div>
                                        <div className="h-3 bg-black/20 backdrop-blur-md border border-white/20 rounded w-3/4"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!currentUser) return null

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
            {/* Profile Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden pt-0 md:pt-4"
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-purple-500/20 to-blue-500/20"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
                </div>

                <div className="relative max-w-6xl mx-auto p-4 md:p-6 pt-6 md:pt-8">
                    {/* Instagram-style Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="w-full max-w-md mx-auto bg-gradient-to-b from-gray-900 to-black rounded-xl p-4 md:p-6 shadow-md"
                    >
                        {/* Avatar and User Info Row */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-4"
                        >
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-red-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/30 border-2 border-white/20">
                                    {currentUser.avatar_url ? (
                                        <img
                                            src={currentUser.avatar_url}
                                            alt={currentUser.name}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-white text-2xl md:text-3xl font-bold">
                                            {currentUser.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {/* Online indicator */}
                                <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border border-black rounded-full flex items-center justify-center">
                                    <div className="w-1 h-1 bg-white rounded-full"></div>
                                </div>
                            </div>

                            {/* User Info */}
                            <div className="flex flex-col">
                                <h1 className="text-lg md:text-xl font-semibold text-white">
                                    {currentUser.name}
                                </h1>
                                <p className="text-sm text-gray-400">
                                    @{currentUser.username}
                                </p>
                                {/* Stats Row */}
                                <div className="flex gap-4 mt-2 text-xs md:text-sm text-gray-300">
                                    <div><span className="font-semibold">{posts.length}</span> Posts</div>
                                    <div><span className="font-semibold">{savedPosts.length}</span> Saved</div>
                                    <div><span className="font-semibold">0</span> Following</div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Action Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex justify-between gap-2 mt-4 flex-wrap"
                        >
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSignOut}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Sign Out
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setEditing(true)}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Edit Profile
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowFeedbackModal(true)}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Feedback
                            </motion.button>
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>

            {/* Content Area */}
            <div className="max-w-6xl mx-auto p-6">
                {/* Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="flex justify-center mb-8"
                >
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-xl">
                        <div className="flex gap-2">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('posts')}
                                className={`px-6 md:px-8 py-2 md:py-3 text-sm md:text-base rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === 'posts'
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Grid3X3 className="w-4 h-4 md:w-5 md:h-5" />
                                My Posts
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('saved')}
                                className={`px-6 md:px-8 py-2 md:py-3 text-sm md:text-base rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === 'saved'
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Heart className="w-4 h-4 md:w-5 md:h-5" />
                                Saved Posts
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'posts' ? (
                        <motion.div
                            key="posts"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {posts.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Grid3X3 className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4">No posts yet</h3>
                                    <p className="text-gray-400 mb-8 max-w-md mx-auto">
                                        Start creating amazing content and share it with the community!
                                    </p>
                                    <Link
                                        href="/post/new"
                                        className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-8 py-4 rounded-2xl font-medium text-white transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30"
                                    >
                                        <Star className="w-5 h-5" />
                                        Create Your First Post
                                    </Link>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {posts.map((post, index) => (
                                        <motion.div
                                            key={post.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(255,0,80,0.08)] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,0,80,0.15)] transition-all duration-300 cursor-pointer relative group"
                                            onClick={() => router.push(`/post/${post.id}`)}
                                        >
                                            <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                                                <Image
                                                    src={post.image_url}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover absolute inset-0"
                                                />
                                                <PostMenu
                                                    postId={post.id}
                                                    imageUrl={post.image_url}
                                                    username={post.username}
                                                    currentUser={currentUser?.username}
                                                    onPostDeleted={() => fetchUserPosts(currentUser!.username)}
                                                    onPostEdit={onEditPost}
                                                    onPostSaved={() => fetchSavedPosts()}
                                                    onPostUnsaved={() => fetchSavedPosts()}
                                                    post={post}
                                                />
                                            </div>
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <motion.span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${post.mode === 'selling'
                                                            ? 'bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                                                            : 'bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                                            }`}
                                                        whileHover={{ scale: 1.05 }}
                                                        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                    >
                                                        {post.mode === 'selling' ? 'Selling' : 'Requesting'}
                                                    </motion.span>
                                                    <span className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</span>
                                                </div>
                                                <h3 className="font-semibold text-lg mb-1 line-clamp-1 text-white">{post.title}</h3>
                                                <p className="text-gray-400 text-sm mb-2 line-clamp-2">{post.description}</p>
                                                {post.tags && post.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {post.tags.slice(0, 3).map((tag, tagIndex) => (
                                                            <span
                                                                key={tagIndex}
                                                                className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {post.tags.length > 3 && (
                                                            <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full">
                                                                +{post.tags.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>@{post.users?.username || 'unknown'}</span>
                                                    {post.price && (
                                                        <motion.span
                                                            className="text-sm font-bold bg-emerald-600 text-white px-2 py-1 rounded-full"
                                                            whileHover={{
                                                                scale: 1.05,
                                                                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
                                                            }}
                                                            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                        >
                                                            {post.price}
                                                        </motion.span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="saved"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {savedPosts.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Heart className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4">No saved posts yet</h3>
                                    <p className="text-gray-400 mb-8 max-w-md mx-auto">
                                        Save posts you like to view them here later!
                                    </p>
                                    <Link
                                        href="/feed"
                                        className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-8 py-4 rounded-2xl font-medium text-white transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30"
                                    >
                                        <Grid3X3 className="w-5 h-5" />
                                        Explore Posts
                                    </Link>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {savedPosts.map((savedPost, index) => {
                                        // Parse tags if they're stored as JSON string
                                        const tags = Array.isArray(savedPost.posts?.tags)
                                            ? savedPost.posts.tags
                                            : savedPost.posts?.tags
                                                ? JSON.parse(savedPost.posts.tags)
                                                : []

                                        return (
                                            <motion.div
                                                key={savedPost.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(255,0,80,0.08)] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,0,80,0.15)] transition-all duration-300 cursor-pointer relative group"
                                                onClick={() => router.push(`/post/${savedPost.post_id}`)}
                                            >
                                                <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                                                    {savedPost.posts?.image_url ? (
                                                        <Image
                                                            src={savedPost.posts.image_url}
                                                            alt={savedPost.posts.title || ''}
                                                            fill
                                                            className="object-cover absolute inset-0"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center absolute inset-0">
                                                            <span className="text-gray-400 text-sm">No image</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2">
                                                        <Heart className="w-6 h-6 text-red-500 fill-current drop-shadow-lg" />
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <motion.span
                                                            className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${savedPost.posts?.mode === 'selling'
                                                                ? 'bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                                                                : 'bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                                                }`}
                                                            whileHover={{ scale: 1.05 }}
                                                            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                        >
                                                            {savedPost.posts?.mode === 'selling' ? 'Selling' : 'Requesting'}
                                                        </motion.span>
                                                        <span className="text-xs text-gray-500">{formatTimeAgo(savedPost.created_at)}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-lg mb-1 line-clamp-1 text-white">{savedPost.posts?.title}</h3>
                                                    <p className="text-gray-400 text-sm mb-2 line-clamp-2">{savedPost.posts?.description}</p>
                                                    {tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {tags.slice(0, 3).map((tag: string, tagIndex: number) => (
                                                                <span
                                                                    key={tagIndex}
                                                                    className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {tags.length > 3 && (
                                                                <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full">
                                                                    +{tags.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                                        <span>@{savedPost.posts?.users?.username || 'unknown'}</span>
                                                        {savedPost.posts?.price && (
                                                            <motion.span
                                                                className="text-sm font-bold bg-emerald-600 text-white px-2 py-1 rounded-full"
                                                                whileHover={{
                                                                    scale: 1.05,
                                                                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
                                                                }}
                                                                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                            >
                                                                {savedPost.posts?.price}
                                                            </motion.span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {/* Edit Profile Modal */}
                {editing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setEditing(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-white">Edit Profile</h2>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-white">Name</label>
                                    <input
                                        {...register('name')}
                                        type="text"
                                        className="w-full px-4 py-3 bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-300 text-white placeholder-gray-400"
                                        placeholder="Your full name"
                                    />
                                    {errors.name && (
                                        <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-white">Username</label>
                                    <input
                                        {...register('username')}
                                        type="text"
                                        className="w-full px-4 py-3 bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-300 text-white placeholder-gray-400"
                                        placeholder="Choose a username"
                                    />
                                    {errors.username && (
                                        <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        3–20 characters, letters, numbers, and underscores only
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-red-300 disabled:to-red-400 text-white py-3 rounded-2xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={() => setEditing(false)}
                                        className="px-6 py-3 border border-gray-600 rounded-2xl hover:bg-white/10 transition-colors text-white"
                                    >
                                        Cancel
                                    </motion.button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {/* Feedback Modal */}
                {showFeedbackModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowFeedbackModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-white text-center">Send Feedback</h2>
                            <form onSubmit={feedbackForm.handleSubmit(async (data) => {
                                try {
                                    await submitFeedback(currentUser.id, data.rating, data.message)
                                    toast.success('Thank you for your feedback!')
                                    setShowFeedbackModal(false)
                                } catch (error) {
                                    toast.error('Failed to send feedback')
                                }
                            })} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-3 text-white">How would you rate your experience?</label>
                                    <div className="flex gap-2 justify-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <motion.button
                                                key={star}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                type="button"
                                                onClick={() => feedbackForm.setValue('rating', star)}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${feedbackForm.watch('rating') >= star
                                                    ? 'bg-yellow-500 text-white'
                                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                    }`}
                                            >
                                                <Star className="w-6 h-6" fill="currentColor" />
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-white">Additional Comments (Optional)</label>
                                    <textarea
                                        {...feedbackForm.register('message')}
                                        className="w-full px-4 py-3 bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-300 text-white placeholder-gray-400 resize-none"
                                        placeholder="Tell us what you think..."
                                        rows={4}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 rounded-2xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25"
                                    >
                                        Send Feedback
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={() => setShowFeedbackModal(false)}
                                        className="px-6 py-3 border border-gray-600 rounded-2xl hover:bg-white/10 transition-colors text-white"
                                    >
                                        Cancel
                                    </motion.button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {/* Delete Account Modal */}
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 w-full max-w-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Delete Account</h3>
                                <p className="text-gray-400">
                                    This action cannot be undone. All your data will be permanently deleted.
                                </p>
                            </div>

                            <div className="mb-6">
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="Enter your password to confirm"
                                    className="w-full px-4 py-3 bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-300 text-white placeholder-gray-400"
                                />
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-600 rounded-2xl hover:bg-white/10 transition-colors text-white"
                                    disabled={deletingAccount}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleDeleteAccount}
                                    disabled={deletingAccount || !deletePassword.trim()}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-3 rounded-2xl font-medium transition-colors"
                                >
                                    {deletingAccount ? 'Deleting...' : 'Delete Account'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Post Modal */}
            {showEditModal && selectedPost && (
                <EditPostModal
                    post={selectedPost}
                    onClose={() => {
                        setShowEditModal(false)
                        setSelectedPost(null)
                    }}
                    onUpdate={() => fetchUserPosts(currentUser!.username)}
                />
            )}
        </div>
    )
}
