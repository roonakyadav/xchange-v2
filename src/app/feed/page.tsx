'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Flag, Heart, Share2, MoreVertical, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import BottomNav from '@/components/BottomNav'
import PostMenu from '@/components/PostMenu'
import EditPostModal from '@/components/EditPostModal'
import ClientOnly from '@/components/ClientOnly'
import { useUser } from '@/hooks/useUser'
import { getPostsByMode, savePost, unsavePost, isPostSaved, getSavedPosts } from '@/lib/db'
import type { PostWithUser } from '@/types'

interface Post extends PostWithUser {
    category?: string
}

// Mobile Post Card Menu Component
function PostCardMenu({
    postId,
    onPreview,
    onFavorite,
    onShare,
    isFavorited
}: {
    postId: string
    onPreview: () => void
    onFavorite: (e: React.MouseEvent) => void
    onShare: (e: React.MouseEvent) => Promise<void>
    isFavorited: boolean
}) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={menuRef}>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
                className="p-2 bg-black/50 hover:bg-red-600/50 rounded-full text-white transition-colors"
                aria-label="Post actions"
            >
                <MoreVertical size={16} />
            </motion.button>

            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-12 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-20 min-w-[140px]"
                >
                    <div className="py-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onPreview()
                                setIsOpen(false)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                            <Eye size={16} />
                            Preview
                        </button>
                        <button
                            onClick={(e) => {
                                onFavorite(e)
                                setIsOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors flex items-center gap-2 ${isFavorited ? 'text-red-500' : 'text-white'}`}
                        >
                            <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} />
                            {isFavorited ? 'Unfavorite' : 'Add to Favorites'}
                        </button>
                        <button
                            onClick={(e) => {
                                onShare(e)
                                setIsOpen(false)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                            <Share2 size={16} />
                            Share
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default function Feed() {
    const router = useRouter()
    const { user, loading: userLoading } = useUser()
    const [posts, setPosts] = useState<Post[]>([])
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [selectedMode, setSelectedMode] = useState<'selling' | 'requesting'>('selling')
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [selectedPost, setSelectedPost] = useState<any>(null)
    const [showEditModal, setShowEditModal] = useState(false)
    const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
    const [page, setPage] = useState(1)
    const POSTS_PER_PAGE = 12


    useEffect(() => {
        if (userLoading) return

        fetchPosts()
    }, [router, selectedMode, user, userLoading])

    // Listen for mode changes from NavDesktop
    useEffect(() => {
        const handleModeChange = (event: CustomEvent<'selling' | 'requesting'>) => {
            setSelectedMode(event.detail)
        }

        window.addEventListener('feed-mode-change', handleModeChange as EventListener)
        return () => window.removeEventListener('feed-mode-change', handleModeChange as EventListener)
    }, [])

    // Listen for search changes from NavDesktop
    useEffect(() => {
        const handleSearchChange = (event: CustomEvent<string>) => {
            setSearchTerm(event.detail)
        }

        window.addEventListener('feed-search-change', handleSearchChange as EventListener)
        return () => window.removeEventListener('feed-search-change', handleSearchChange as EventListener)
    }, [])

    // Listen for category changes from NavDesktop
    useEffect(() => {
        const handleCategoryChange = (event: CustomEvent<string>) => {
            setActiveCategory(event.detail)
        }

        window.addEventListener('feed-category-change', handleCategoryChange as EventListener)
        return () => window.removeEventListener('feed-category-change', handleCategoryChange as EventListener)
    }, [])

    // Filter and paginate posts based on search term and category
    useEffect(() => {
        let filtered = posts

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim()
            filtered = filtered.filter(post => {
                const titleMatch = post.title.toLowerCase().includes(term)
                const descriptionMatch = post.description.toLowerCase().includes(term)
                const tagsMatch = post.tags?.some(tag => tag.toLowerCase().includes(term)) || false

                return titleMatch || descriptionMatch || tagsMatch
            })
        }

        // Apply category filter
        if (activeCategory !== 'All') {
            filtered = filtered.filter(post => post.category === activeCategory)
        }

        // Apply pagination
        const paginated = filtered.slice(0, page * POSTS_PER_PAGE)
        setFilteredPosts(paginated)
        setHasMore(paginated.length < filtered.length)
    }, [posts, searchTerm, activeCategory, page])

    const fetchPosts = async () => {
        try {
            const data = await getPostsByMode(selectedMode)
            setPosts(data)
        } catch (error) {
            console.error('Error fetching posts:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const now = new Date()
        const postDate = new Date(dateString)
        const diffInHours = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60))

        if (diffInHours < 1) return 'Just now'
        if (diffInHours < 24) return `${diffInHours}h ago`
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) return `${diffInDays}d ago`
        return postDate.toLocaleDateString()
    }

    const onEditPost = (post: any) => {
        console.log('📝 [FEED] onEditPost called with post:', post)
        setSelectedPost(post)
        setShowEditModal(true)
    }

    const loadMorePosts = async () => {
        setLoadingMore(true)
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        setPage(prev => prev + 1)
        setLoadingMore(false)
    }

    const handleSaveToggle = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!user) return

        try {
            const isCurrentlySaved = savedPosts.has(postId)
            if (isCurrentlySaved) {
                await unsavePost(user.id, postId)
                setSavedPosts(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(postId)
                    return newSet
                })
                toast.success('post unsaved')
            } else {
                await savePost(user.id, postId)
                setSavedPosts(prev => new Set(prev).add(postId))
                toast.success('post saved')
            }
        } catch (error) {
            console.error('Error toggling save:', error)
            toast.error('Failed to save/unsave post')
        }
    }

    // Initialize saved posts state
    useEffect(() => {
        const initializeSavedPosts = async () => {
            if (!user) return

            try {
                const saved = await getSavedPosts(user.id)
                const savedIds = new Set(saved.map(s => s.post_id))
                setSavedPosts(savedIds)
            } catch (error) {
                console.error('Error initializing saved posts:', error)
            }
        }

        initializeSavedPosts()
    }, [user])

    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-black/20 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden animate-pulse">
                                <div className="relative w-full bg-white/10" style={{ paddingBottom: '100%' }}></div>
                                <div className="p-4 space-y-2">
                                    <div className="h-4 bg-white/10 rounded"></div>
                                    <div className="h-3 bg-white/10 rounded w-3/4"></div>
                                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }



    return (
        <div className="min-h-screen bg-black flex flex-col pb-16 md:pb-0">
            {/* Feed */}
            <div className="flex-1 pt-0 md:pt-0">



                <div className="max-w-6xl mx-auto px-4 py-6">
                    {posts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <p className="text-gray-400 text-lg mb-4">No posts yet</p>
                            <Link
                                href="/post/new"
                                className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg font-medium transition-colors inline-block"
                            >
                                Create the first post
                            </Link>
                        </motion.div>
                    ) : filteredPosts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <p className="text-gray-400 text-lg">No posts found</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPosts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(255,0,80,0.08)] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,0,80,0.15)] transition-all duration-300 cursor-pointer relative group"
                                    onClick={() => router.push(`/post/${post.id}`)}
                                >
                                    {/* AI Category Label */}
                                    {(() => {
                                        const categoryToDisplay = post.category || "Others";
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.1 + 0.2 }}
                                                className={`absolute top-3 right-3 z-10 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-md border ${categoryToDisplay === 'Art' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' :
                                                    categoryToDisplay === 'Subscription' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                                        categoryToDisplay === 'Coupon Code' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                                            categoryToDisplay === 'Templates' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                                'bg-gray-500/20 text-gray-300 border-gray-500/30'
                                                    }`}
                                            >
                                                AI: {categoryToDisplay}
                                            </motion.div>
                                        );
                                    })()}

                                    <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                                        <Image
                                            src={post.image_url}
                                            alt={post.title}
                                            fill
                                            className="object-cover absolute inset-0"
                                        />

                                        {/* Mobile Menu Button */}
                                        <div className="absolute top-2 left-2 z-10 flex md:hidden">
                                            <PostCardMenu
                                                postId={post.id}
                                                onPreview={() => router.push(`/post/${post.id}`)}
                                                onFavorite={(e) => handleSaveToggle(post.id, e)}
                                                onShare={async (e) => {
                                                    e.stopPropagation()
                                                    const link = window.location.origin + `/post/${post.id}`

                                                    try {
                                                        // Check if clipboard API is available
                                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                                            await navigator.clipboard.writeText(link)
                                                            toast.success('Link copied!')
                                                        } else {
                                                            // Fallback for older browsers
                                                            const textArea = document.createElement('textarea')
                                                            textArea.value = link
                                                            textArea.style.position = 'fixed'
                                                            textArea.style.left = '-999999px'
                                                            textArea.style.top = '-999999px'
                                                            document.body.appendChild(textArea)
                                                            textArea.focus()
                                                            textArea.select()

                                                            try {
                                                                document.execCommand('copy')
                                                                toast.success('Link copied!')
                                                            } catch (fallbackError) {
                                                                console.error('Fallback copy failed:', fallbackError)
                                                                toast.error('Please copy this link manually: ' + link)
                                                            } finally {
                                                                document.body.removeChild(textArea)
                                                            }
                                                        }
                                                    } catch (error) {
                                                        console.error('Failed to copy link:', error)
                                                        toast.error('Failed to copy link')
                                                    }
                                                }}
                                                isFavorited={savedPosts.has(post.id)}
                                            />
                                        </div>

                                        {/* Hover Overlay - Desktop Only */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            whileHover={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            className="hidden md:flex absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent items-end justify-center pb-4"
                                        >
                                            <div className="flex gap-4">
                                                <motion.button
                                                    whileHover={{ scale: 1.1, y: -2 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                    className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toast.success('Post reported!')
                                                    }}
                                                >
                                                    <Flag size={18} />
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.1, y: -2 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                    className={`p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors ${savedPosts.has(post.id) ? 'text-red-500' : ''}`}
                                                    onClick={(e) => handleSaveToggle(post.id, e)}
                                                >
                                                    <Heart size={18} fill={savedPosts.has(post.id) ? 'currentColor' : 'none'} />
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.1, y: -2 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                    className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        const link = window.location.origin + `/post/${post.id}`

                                                        try {
                                                            // Check if clipboard API is available
                                                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                                                await navigator.clipboard.writeText(link)
                                                                toast.success('Link copied!')
                                                            } else {
                                                                // Fallback for older browsers
                                                                const textArea = document.createElement('textarea')
                                                                textArea.value = link
                                                                textArea.style.position = 'fixed'
                                                                textArea.style.left = '-999999px'
                                                                textArea.style.top = '-999999px'
                                                                document.body.appendChild(textArea)
                                                                textArea.focus()
                                                                textArea.select()

                                                                try {
                                                                    document.execCommand('copy')
                                                                    toast.success('Link copied!')
                                                                } catch (fallbackError) {
                                                                    console.error('Fallback copy failed:', fallbackError)
                                                                    toast.error('Please copy this link manually: ' + link)
                                                                } finally {
                                                                    document.body.removeChild(textArea)
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.error('Failed to copy link:', error)
                                                            toast.error('Failed to copy link')
                                                        }
                                                    }}
                                                >
                                                    <Share2 size={18} />
                                                </motion.button>
                                            </div>
                                        </motion.div>
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
                                        <h3 className="font-semibold text-lg mb-1 line-clamp-1">{post.title}</h3>
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
                                            <Link
                                                href={`/profile/${post.users?.username || 'unknown'}`}
                                                className="hover:text-red-400 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                @{post.users?.username || 'unknown'}
                                            </Link>
                                            {post.price && (
                                                <motion.span
                                                    className="text-sm font-bold bg-emerald-600 text-white px-2 py-1 rounded-full"
                                                    whileHover={{
                                                        scale: 1.05,
                                                        boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
                                                    }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                                >
                                                    {post.price?.toLowerCase() === "free"
                                                        ? "Free"
                                                        : `₹${Number(post.price).toLocaleString("en-IN")}`}
                                                </motion.span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Load More Button */}
                    {hasMore && filteredPosts.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center mt-8 mb-8"
                        >
                            <motion.button
                                onClick={loadMorePosts}
                                disabled={loadingMore}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white px-8 py-3 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                            >
                                {loadingMore ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Loading...
                                    </div>
                                ) : (
                                    'Load More Posts'
                                )}
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Shimmer Loading for Load More */}
                    {loadingMore && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                            {[...Array(6)].map((_, i) => (
                                <motion.div
                                    key={`shimmer-${i}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden animate-pulse"
                                >
                                    <div className="relative w-full bg-white/10" style={{ paddingBottom: '100%' }}></div>
                                    <div className="p-4 space-y-2">
                                        <div className="h-4 bg-white/10 rounded"></div>
                                        <div className="h-3 bg-white/10 rounded w-3/4"></div>
                                        <div className="h-3 bg-white/10 rounded w-1/2"></div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <BottomNav />

                {/* Edit Post Modal */}
                {showEditModal && selectedPost && (
                    <EditPostModal
                        post={selectedPost}
                        onClose={() => {
                            setShowEditModal(false)
                            setSelectedPost(null)
                        }}
                        onUpdate={() => fetchPosts()}
                    />
                )}
            </div>
        </div>
    )
}
