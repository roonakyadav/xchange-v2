'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@/hooks/useUser'
import { Search, MessageSquare, ArrowLeft } from 'lucide-react'
import ChatList from '@/components/ChatList'
import ChatThread from '@/components/ChatThread'
import BottomNav from '@/components/BottomNav'

export default function Chats() {
    const router = useRouter()
    const { user, loading } = useUser()
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth')
        }
    }, [loading, user, router])

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024) // lg breakpoint
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Handle mobile back navigation
    useEffect(() => {
        const handleBackNavigation = () => {
            if (isMobile && selectedChatId) {
                setSelectedChatId(null)
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMobile && selectedChatId) {
                setSelectedChatId(null)
            }
        }

        window.addEventListener('popstate', handleBackNavigation)
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('popstate', handleBackNavigation)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isMobile, selectedChatId])

    // Handle URL-based chat selection
    useEffect(() => {
        const pathSegments = window.location.pathname.split('/')
        const chatIdFromUrl = pathSegments[pathSegments.length - 1]

        if (chatIdFromUrl && chatIdFromUrl !== 'chats' && chatIdFromUrl !== selectedChatId) {
            setSelectedChatId(chatIdFromUrl)
        }
    }, [])

    const handleChatSelect = (chatId: string) => {
        setSelectedChatId(chatId)
        if (!isMobile) {
            // Update URL without navigation on desktop
            window.history.replaceState(null, '', `/chats/${chatId}`)
        }
    }

    const handleBackToList = () => {
        setSelectedChatId(null)
        window.history.replaceState(null, '', '/chats')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="h-screen bg-[#0b0b0b] flex flex-col overflow-hidden" style={{ overflow: 'hidden' }}>
            {/* Desktop Layout */}
            {!isMobile && (
                <div className="flex h-screen overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-[300px] border-r border-gray-800 overflow-y-auto hidden md:flex flex-col bg-[#0b0b0b]">
                        {/* Header */}
                        <div className="sticky top-0 z-10 bg-[#0b0b0b] border-b border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h1 className="text-2xl font-bold text-white">Chats</h1>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                </motion.button>
                            </div>

                            {/* Search Bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Chat List */}
                        <div className="flex-1">
                            <ChatList
                                onChatSelect={handleChatSelect}
                                selectedChatId={selectedChatId}
                                searchQuery={searchQuery}
                            />
                        </div>
                    </aside>

                    {/* Chat Section */}
                    <main className="flex-1 flex flex-col bg-black">
                        {selectedChatId ? (
                            <ChatThread chatId={selectedChatId} />
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-[#0b0b0b]">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center"
                                >
                                    <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <MessageSquare className="w-12 h-12 text-red-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Select a conversation</h2>
                                    <p className="text-gray-400">Choose a chat from the sidebar to start messaging</p>
                                </motion.div>
                            </div>
                        )}
                    </main>
                </div>
            )}

            {/* Mobile Layout */}
            {isMobile && (
                <div className="flex flex-col h-screen pt-0 md:pt-0">
                    <AnimatePresence mode="wait">
                        {!selectedChatId ? (
                            <motion.div
                                key="chat-list"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                {/* Header */}
                                <div className="p-4 border-b border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <h1 className="text-xl font-bold text-white">Chats</h1>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </motion.button>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search conversations..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Chat List */}
                                <div className="flex-1 overflow-hidden">
                                    <ChatList
                                        onChatSelect={handleChatSelect}
                                        selectedChatId={selectedChatId}
                                        searchQuery={searchQuery}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="chat-thread"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full"
                            >
                                {/* Back Button Header */}
                                <div className="p-4 border-b border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                                    <motion.button
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        onClick={handleBackToList}
                                        className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                        <span>Back to chats</span>
                                    </motion.button>
                                </div>

                                {/* Chat Thread */}
                                <div className="flex-1">
                                    <div className="flex flex-col h-[calc(100vh-64px)] overflow-y-auto pt-0 mt-0 safe-area-inset-0">
                                        <ChatThread chatId={selectedChatId} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Bottom Navigation (only on mobile when not in chat) */}
            {isMobile && !selectedChatId && <BottomNav />}
        </div>
    )
}
