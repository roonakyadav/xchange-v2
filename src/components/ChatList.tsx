'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getVisibleChats, computePreview, isUserBlocked } from '@/lib/db'
import { subscribeToChatUpdates } from '@/lib/realtime'
import { formatTimeAgo } from '@/lib/time'
import { useUser } from '@/hooks/useUser'
import type { ChatPreview } from '@/lib/db'

interface ChatListProps {
    onChatSelect?: (chatId: string) => void
    selectedChatId?: string | null
    searchQuery?: string
}

export default function ChatList({ onChatSelect, selectedChatId, searchQuery }: ChatListProps) {
    const router = useRouter()
    const { user } = useUser()
    const [chats, setChats] = useState<ChatPreview[]>([])
    const [loading, setLoading] = useState(true)
    const [filteredChats, setFilteredChats] = useState<ChatPreview[]>([])

    useEffect(() => {
        if (!user) return

        loadChats()

        // Subscribe to chat updates (for deletions, new chats, etc.)
        const chatChannel = subscribeToChatUpdates(user.username, () => {
            console.log('Chat list update detected, reloading chats')
            loadChats()
        })

        // Listen for chat deletion events
        const handleChatDeleted = (event: CustomEvent<{ chatId: string }>) => {
            console.log('Chat deleted event received:', event.detail.chatId)
            setChats(prev => prev.filter(chat => chat.id !== event.detail.chatId))
        }

        window.addEventListener('chat-deleted', handleChatDeleted as EventListener)

        return () => {
            chatChannel.unsubscribe()
            window.removeEventListener('chat-deleted', handleChatDeleted as EventListener)
        }
    }, [user])

    // Filter chats based on search query
    useEffect(() => {
        if (!searchQuery?.trim()) {
            setFilteredChats(chats)
        } else {
            const filtered = chats.filter(chat =>
                chat.otherUser.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (chat.lastMessage?.body && chat.lastMessage.body.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (chat.posts?.title && chat.posts.title.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            setFilteredChats(filtered)
        }
    }, [chats, searchQuery])

    const loadChats = async () => {
        if (!user) return

        try {
            const chatData = await getVisibleChats(user.username)
            setChats(chatData)
        } catch (error) {
            console.error('Failed to load chats:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleChatClick = async (chat: ChatPreview) => {
        // Optimistically clear unread in UI
        setChats(prev => prev.map(c =>
            c.id === chat.id ? { ...c, unreadCount: 0 } : c
        ))

        onChatSelect?.(chat.id)
    }

    const getPreviewText = (chat: ChatPreview) => {
        const { unreadCount, outgoingPendingCount, lastMessage } = chat

        // Priority 1: if unreadIncoming > 0 → bold "{unreadIncoming} unread messages"
        if (unreadCount > 0) {
            return `**${unreadCount} unread message${unreadCount > 1 ? 's' : ''}**`
        }

        // Priority 2: else if last.sender != me → last.body (1-line truncate)
        if (lastMessage && lastMessage.sender !== user?.username) {
            return lastMessage.body.length > 50
                ? lastMessage.body.substring(0, 50) + '...'
                : lastMessage.body
        }

        // Priority 3: else if unreadOutgoing > 0 → "{unreadOutgoing} messages sent"
        if (outgoingPendingCount > 0) {
            return `${outgoingPendingCount} message${outgoingPendingCount > 1 ? 's' : ''} sent`
        }

        // Priority 4: else → "Seen {timeAgo(last.read_at)}"
        if (lastMessage && lastMessage.is_read && lastMessage.read_at) {
            return `Seen ${formatTimeAgo(lastMessage.read_at)}`
        }

        // Fallback
        return lastMessage?.body || 'Say hi 👋'
    }

    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="animate-pulse flex items-center space-x-3 p-4 rounded-xl bg-gray-800/30"
                        >
                            <div className="w-14 h-14 bg-gray-700 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <AnimatePresence>
                {filteredChats.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-8 text-center"
                    >
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-gray-400 text-lg mb-2">
                            {searchQuery ? 'No conversations found' : 'No conversations yet'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {searchQuery ? 'Try a different search term' : 'Start chatting by messaging sellers on posts'}
                        </p>
                    </motion.div>
                ) : (
                    <div className="p-2">
                        {filteredChats.map((chat, index) => {
                            const previewText = getPreviewText(chat)
                            const timeAgo = chat.updated_at ? formatTimeAgo(chat.updated_at) : ''
                            const hasUnread = chat.unreadCount > 0
                            const isSelected = selectedChatId === chat.id

                            return (
                                <motion.div
                                    key={chat.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => handleChatClick(chat)}
                                    className={`flex items-center space-x-4 p-4 mx-2 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-gray-800/50 ${isSelected
                                            ? 'bg-red-500/10 border border-red-500/30 shadow-lg shadow-red-500/10'
                                            : hasUnread
                                                ? 'bg-red-500/5 border border-red-500/20'
                                                : 'hover:bg-gray-800/30'
                                        }`}
                                >
                                    {/* Avatar with Online Status */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                            <span className="text-white font-bold text-lg">
                                                {chat.otherUser.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        {/* Online indicator */}
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0b0b0b]"></div>
                                        {/* Unread indicator */}
                                        {hasUnread && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 border-2 border-[#0b0b0b] flex items-center justify-center"
                                            >
                                                <span className="text-white text-xs font-bold">
                                                    {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                                                </span>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Chat Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className={`font-semibold text-base truncate ${hasUnread ? 'text-white' : 'text-gray-200'
                                                }`}>
                                                @{chat.otherUser}
                                            </h3>
                                            {timeAgo && (
                                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                    {timeAgo}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm truncate max-w-[200px] ${hasUnread ? 'text-gray-200 font-medium' : 'text-gray-400'
                                                } ${previewText.startsWith('**') ? 'font-bold text-red-400' : ''}`}>
                                                {previewText.replace(/\*\*/g, '')}
                                            </p>
                                        </div>

                                        {/* Post reference if exists */}
                                        {chat.posts && (
                                            <div className="flex items-center space-x-2 mt-2">
                                                <div className="w-3 h-3 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                                                </div>
                                                <span className="text-xs text-gray-500 truncate">
                                                    {chat.posts.title}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
