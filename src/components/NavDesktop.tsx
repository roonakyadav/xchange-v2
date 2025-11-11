'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getChatPreviews } from '@/lib/db'
import { subscribeToChatUpdates } from '@/lib/realtime'
import { useUser } from '@/hooks/useUser'
import { useScrollHide } from '@/hooks/useScrollHide'

import SellingToggle from './SellingToggle'

export default function NavDesktop() {
    const pathname = usePathname()
    const { user } = useUser()
    const hidden = useScrollHide(50) // Hide after 50px scroll
    const [sellingMode, setSellingMode] = useState<'Selling' | 'Requesting'>('Selling')
    const [activeCategory, setActiveCategory] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')
    const [hasUnread, setHasUnread] = useState(false)
    const [isSearchActive, setIsSearchActive] = useState(false)
    const [isDesktop, setIsDesktop] = useState(false)
    const [recentSearches, setRecentSearches] = useState<string[]>([])

    // Check if desktop
    useEffect(() => {
        const checkDesktop = () => {
            setIsDesktop(window.innerWidth >= 768)
        }

        checkDesktop()
        window.addEventListener('resize', checkDesktop)
        return () => window.removeEventListener('resize', checkDesktop)
    }, [])

    const navItems = [
        { href: '/feed', label: 'Feed' },
        { href: '/post/new', label: 'New Post' },
        { href: '/chats', label: 'Chats', hasUnread },
        { href: '/profile', label: 'Profile' },
    ]

    const categories = ['All', 'Subscription', 'Templates', 'Coupon Code', 'Art', 'Others']

    const isActive = (href: string) => {
        if (href === '/feed') {
            return pathname === '/feed'
        }
        return pathname.startsWith(href)
    }

    // Load selected mode from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('feed-mode')
        if (saved === 'selling' || saved === 'requesting') {
            setSellingMode(saved === 'selling' ? 'Selling' : 'Requesting')
        }
    }, [])

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('recent-searches')
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved))
            } catch (error) {
                console.error('Failed to parse recent searches:', error)
            }
        }
    }, [])

    const handleModeChange = (mode: 'Selling' | 'Requesting') => {
        setSellingMode(mode)
        const modeValue = mode.toLowerCase() as 'selling' | 'requesting'
        localStorage.setItem('feed-mode', modeValue)
        // Dispatch custom event to notify feed page
        window.dispatchEvent(new CustomEvent('feed-mode-change', { detail: modeValue }))
    }

    const handleSearchChange = (value: string) => {
        setSearchTerm(value)
        // Dispatch search event
        window.dispatchEvent(new CustomEvent('feed-search-change', { detail: value }))
    }

    const handleCategoryChange = (category: string) => {
        setActiveCategory(category)
        // Dispatch category event
        window.dispatchEvent(new CustomEvent('feed-category-change', { detail: category }))
    }

    const handleSearchSubmit = (searchValue: string) => {
        if (searchValue.trim()) {
            // Add to recent searches
            const updated = [searchValue.trim(), ...recentSearches.filter(s => s !== searchValue.trim())].slice(0, 5)
            setRecentSearches(updated)
            localStorage.setItem('recent-searches', JSON.stringify(updated))
        }
        handleSearchChange(searchValue)
        setIsSearchActive(false)
    }

    const clearSearch = () => {
        setSearchTerm('')
        handleSearchChange('')
        setRecentSearches([])
        localStorage.removeItem('recent-searches')
    }

    // Check for unread messages
    useEffect(() => {
        if (!user) return

        const checkUnread = async () => {
            try {
                const chats = await getChatPreviews(user.username)
                const totalUnread = chats.reduce((total, chat) => total + chat.unreadCount, 0)
                setHasUnread(totalUnread > 0)
            } catch (error) {
                console.error('Failed to check unread:', error)
            }
        }

        checkUnread()

        // Subscribe to realtime updates
        const chatChannel = subscribeToChatUpdates(user.username, checkUnread)

        return () => {
            chatChannel.unsubscribe()
        }
    }, [user])

    // Hide all navbars on landing page
    if (pathname === '/') {
        return null
    }

    return (
        <>
            {/* Mobile Navbar - Two-level layout */}
            {pathname !== '/' && (
                <motion.header
                    initial={{ y: 0 }}
                    animate={{
                        y: hidden ? -100 : 0,
                        transition: { duration: 0.3, ease: 'easeOut' },
                    }}
                    className="block md:hidden fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/20 text-white"
                >
                    {/* First level: xChange (left) + Toggle (right) */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <Link
                            href="/feed"
                            className="text-xl font-bold cursor-pointer hover:text-red-500 transition-colors"
                        >
                            xChange
                        </Link>
                        {pathname === '/feed' && (
                            <SellingToggle
                                sellingMode={sellingMode}
                                setSellingMode={handleModeChange}
                            />
                        )}
                    </div>

                    {/* Second level: Search bar - Only on /feed */}
                    {pathname === '/feed' && (
                        <div className="px-4 pb-3 relative">
                            {/* Search input */}
                            <motion.div
                                animate={{ scaleX: isSearchActive ? 1.02 : 1 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search posts..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onFocus={() => setIsSearchActive(true)}
                                        onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearchSubmit(searchTerm)
                                            }
                                        }}
                                        className="w-full bg-white/10 text-gray-200 px-4 py-2 pr-10 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-300"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>

                            {/* Animated category bar on search focus */}
                            <AnimatePresence>
                                {isSearchActive && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex overflow-x-auto no-scrollbar gap-2 mt-2 px-1 pb-1 bg-black/20 backdrop-blur-md rounded-lg border border-white/20"
                                    >
                                        {categories.map((cat) => (
                                            <motion.button
                                                key={cat}
                                                onClick={() => {
                                                    handleCategoryChange(cat)
                                                    setIsSearchActive(false)
                                                }}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                className={`flex-shrink-0 px-4 py-1 rounded-full text-sm border transition-all duration-200 ${activeCategory === cat
                                                    ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                                                    : 'border-white/20 text-gray-300 hover:bg-white/10 hover:border-red-500/30'
                                                    }`}
                                            >
                                                {cat}
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.header>
            )}

            {/* Desktop Navbar - Only visible on desktop */}
            <motion.header
                initial={{ y: 0 }}
                animate={{
                    y: hidden && isDesktop ? -100 : 0,
                    transition: { duration: 0.3, ease: 'easeInOut' },
                }}
                className={`hidden md:flex sticky top-0 z-40 flex-col border-b border-white/20 bg-black/20 backdrop-blur-md text-white transition-all duration-300 ${!hidden ? 'shadow-lg shadow-black/30' : 'shadow-none'
                    }`}
            >
                {/* Level 1: Top Navbar */}
                <div className="flex justify-between items-center px-6 py-4">
                    <Link
                        href="/feed"
                        className="text-2xl font-bold cursor-pointer hover:text-red-500 transition-colors"
                    >
                        Xchange
                    </Link>
                    <nav className="flex gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-4 py-2 rounded-full transition-all duration-300 relative ${isActive(item.href)
                                    ? 'bg-red-600 text-white'
                                    : 'hover:bg-white/10'
                                    }`}
                            >
                                {item.label}
                                {item.hasUnread && (
                                    <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Level 2: Bottom Navbar - Only on /feed */}
                {pathname === '/feed' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-4 px-6 py-3 border-t border-white/20"
                    >
                        {/* Selling Toggle */}
                        <SellingToggle
                            sellingMode={sellingMode}
                            setSellingMode={handleModeChange}
                        />

                        {/* Search Bar with Focus Categories */}
                        <div className="flex-1 ml-4">
                            <motion.div
                                className="relative w-full"
                                animate={{ scaleX: isSearchActive ? 1.05 : 1 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                {/* Search input */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search posts..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onFocus={() => setIsSearchActive(true)}
                                        onBlur={() => setTimeout(() => setIsSearchActive(false), 150)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearchSubmit(searchTerm)
                                            }
                                        }}
                                        className="w-full bg-white/10 text-gray-200 px-4 py-2 pr-10 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-300"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Search dropdown with recent searches and categories */}
                                <AnimatePresence>
                                    {isSearchActive && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute left-0 right-0 mt-2 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 z-20 shadow-xl"
                                        >
                                            {/* Recent searches */}
                                            {recentSearches.length > 0 && (
                                                <div className="p-3 border-b border-white/10">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs text-gray-400 font-medium">Recent searches</span>
                                                        <button
                                                            onClick={clearSearch}
                                                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                                        >
                                                            Clear all
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {recentSearches.map((search, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => handleSearchSubmit(search)}
                                                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                                                            >
                                                                {search}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Category buttons */}
                                            <div className="p-3">
                                                <span className="text-xs text-gray-400 font-medium mb-2 block">Filter by category</span>
                                                <div className="flex overflow-x-auto no-scrollbar gap-2">
                                                    {categories.map((cat) => (
                                                        <motion.button
                                                            key={cat}
                                                            onClick={() => {
                                                                handleCategoryChange(cat)
                                                                setIsSearchActive(false)
                                                            }}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            className={`flex-shrink-0 px-4 py-1 rounded-full text-sm border transition-all duration-200 ${activeCategory === cat
                                                                ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                                                                : 'border-white/20 text-gray-300 hover:bg-white/10 hover:border-red-500/30'
                                                                }`}
                                                        >
                                                            {cat}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </motion.div>
                )}


            </motion.header>
        </>
    )
}
