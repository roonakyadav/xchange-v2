'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { getChatById, sendMessage, markThreadRead } from '@/lib/db'
import { subscribeToTyping, updateTypingStatus } from '@/lib/realtime'
import { formatTimeAgo } from '@/lib/time'
import { useUser } from '@/hooks/useUser'
import { useChatMessages } from '@/hooks/useChatMessages'
import { uploadChatMedia } from '@/lib/chatUtils'
import { supabase } from '@/lib/supabase'
import TypingDots from './TypingDots'
import MediaViewer from './MediaViewer'

import type { ChatWithPost, Message } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChatThreadProps {
    chatId: string
}



export default function ChatThread({ chatId }: ChatThreadProps) {
    const router = useRouter()
    const { user } = useUser()
    const { messages, upsertMessages } = useChatMessages(chatId, user?.username)
    const [chat, setChat] = useState<ChatWithPost | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [otherUserTyping, setOtherUserTyping] = useState(false)

    const [isMobile, setIsMobile] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [mediaViewer, setMediaViewer] = useState<{
        isOpen: boolean
        mediaUrl: string
        isVideo: boolean
    }>({
        isOpen: false,
        mediaUrl: '',
        isVideo: false
    })
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const messageChannelsRef = useRef<RealtimeChannel[]>([])

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        const container = document.getElementById('chat-scroll-area')
        if (container) {
            container.scrollTop = container.scrollHeight
        }
    }, [messages])



    // Load chat
    useEffect(() => {
        if (!user) return

        const loadChat = async () => {
            try {
                const chatData = await getChatById(chatId)
                if (!chatData) {
                    router.push('/chats')
                    return
                }
                setChat(chatData)
                setLoading(false)
            } catch (error) {
                console.error('Failed to load chat:', error)
                router.push('/chats')
            }
        }

        loadChat()

        // Mark thread as read on open
        markThreadRead(chatId, user.username).catch(console.error)
    }, [chatId, user, router])

    // Mark unread messages as read when window becomes visible (debounced)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        const handleVisibilityChange = () => {
            if (!document.hidden && user) {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    markThreadRead(chatId, user.username).catch(console.error)
                }, 300)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            clearTimeout(timeoutId)
        }
    }, [chatId, user])

    // Set up typing and read status subscriptions
    useEffect(() => {
        if (!user || !chat) return

        console.log('Setting up typing subscriptions for chat:', chatId)
        const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1

        // Subscribe to typing indicators
        const typingChannel = subscribeToTyping(chatId, user.username, (state) => {
            const otherUserTyping = Object.values(state).some(users =>
                users.some(u => u.user === otherUser && u.typing)
            )
            setOtherUserTyping(otherUserTyping)
        })

        messageChannelsRef.current = [typingChannel]

        return () => {
            console.log('Cleaning up typing subscriptions for chat:', chatId)
            messageChannelsRef.current.forEach(channel => channel.unsubscribe())
            messageChannelsRef.current = []
        }
    }, [chatId, user, chat, upsertMessages])

    // Listen for chat deletion events to clean up subscriptions
    useEffect(() => {
        const handleChatDeleted = (event: CustomEvent<{ chatId: string }>) => {
            if (event.detail.chatId === chatId) {
                console.log('Chat deleted, cleaning up subscriptions for chat:', chatId)
                messageChannelsRef.current.forEach(channel => {
                    channel.unsubscribe()
                })
                messageChannelsRef.current = []
            }
        }

        window.addEventListener('chat-deleted', handleChatDeleted as EventListener)
        return () => window.removeEventListener('chat-deleted', handleChatDeleted as EventListener)
    }, [chatId])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleTyping = useCallback(() => {
        if (!isTyping) {
            setIsTyping(true)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, true, user!.username)
                }
            })
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, false, user!.username)
                }
            })
        }, 1500)
    }, [isTyping, user])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending || !user) return

        const messageText = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            await sendMessage({
                chatId,
                sender: user.username,
                body: messageText,
            })

            // Scroll to bottom after sending
            setTimeout(scrollToBottom, 100)

            // Stop typing indicator
            setIsTyping(false)
            messageChannelsRef.current.forEach(channel => {
                if (channel.topic?.includes('presence-typing')) {
                    updateTypingStatus(channel, false, user.username)
                }
            })

            // Clear typing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

        } catch (error) {
            console.error('Failed to send message:', error)
            // Re-add message to input if failed
            setNewMessage(messageText)
        } finally {
            setSending(false)
            // Keep focus on desktop after sending
            if (!isMobile) {
                requestAnimationFrame(() => inputRef.current?.focus())
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(e)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user || !chat) return

        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Please select an image or video file')
            return
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB')
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1
            const mediaUrl = await uploadChatMedia(file, user.username, otherUser, setUploadProgress)

            // Send media message
            await supabase.from('messages').insert([{
                chat_id: chatId,
                sender: user.username,
                body: `[MEDIA]${mediaUrl}`,
            }])

            // Scroll to bottom after sending
            setTimeout(scrollToBottom, 100)

        } catch (error) {
            console.error('Media upload failed:', error)
            alert('Failed to upload media. Please try again.')
        } finally {
            setUploading(false)
            setUploadProgress(0)
            // Reset file input
            e.target.value = ''
        }
    }



    if (loading) {
        return (
            <div className="flex flex-col h-full bg-[#0b0b0b]">
                {/* Header Skeleton */}
                <div className="p-6 border-b border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                    <div className="animate-pulse flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                        <div className="flex-1">
                            <div className="h-5 bg-gray-700 rounded w-24 mb-1"></div>
                            <div className="h-3 bg-gray-700 rounded w-16"></div>
                        </div>
                    </div>
                </div>

                {/* Messages Skeleton */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`animate-pulse ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'}`}
                        >
                            <div className={`h-12 bg-gray-700 rounded-2xl ${i % 2 === 0 ? 'w-32' : 'w-24'}`}></div>
                        </motion.div>
                    ))}
                </div>

                {/* Input Skeleton */}
                <div className="p-6 border-t border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                    <div className="animate-pulse flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                        <div className="flex-1 h-12 bg-gray-700 rounded-2xl"></div>
                        <div className="w-20 h-12 bg-gray-700 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!chat || !user) return null

    const otherUser = chat.user1 === user.username ? chat.user2 : chat.user1

    return (
        <div className="flex flex-col h-full bg-[#0b0b0b]">
            {/* Header */}
            <div className="p-6 border-b border-gray-800/50 bg-[#0b0b0b]/80 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">
                                    {otherUser.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            {/* Online indicator */}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0b0b0b]"></div>
                        </div>

                        {/* User Info */}
                        <div>
                            <h2 className="font-semibold text-white text-lg">@{otherUser}</h2>
                            {otherUserTyping ? (
                                <div className="flex items-center space-x-1">
                                    <TypingDots />
                                    <span className="text-xs text-gray-400">typing...</span>
                                </div>
                            ) : messages.length > 0 ? (
                                <span className="text-xs text-gray-500">
                                    Active {formatTimeAgo(messages[messages.length - 1].created_at)}
                                </span>
                            ) : (
                                <span className="text-xs text-gray-500">Say hi 👋</span>
                            )}
                        </div>
                    </div>

                    {/* Menu Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </motion.button>
                </div>
            </div>

            {/* Messages Area */}
            <div
                id="chat-scroll-area"
                className="flex-1 overflow-y-auto px-3 py-2 space-y-3 md:px-6 md:py-4 scroll-smooth"
            >
                {/* Messages */}
                <AnimatePresence>
                    {messages.map((message) => {
                        const isMine = message.sender === user.username

                        return (
                            <motion.div
                                key={message.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                            >
                                <div
                                    className={`max-w-[70%] break-words px-4 py-2 text-sm rounded-2xl shadow-md ${isMine
                                        ? 'bg-red-600 text-white rounded-br-sm shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                        : 'bg-[#141414] text-gray-200 rounded-bl-sm'
                                        }`}
                                >
                                    {message.body.startsWith('[MEDIA]') ? (
                                        (() => {
                                            const mediaUrl = message.body.replace('[MEDIA]', '')
                                            const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov') || mediaUrl.includes('.avi')

                                            return isVideo ? (
                                                <video
                                                    src={mediaUrl}
                                                    controls
                                                    className="max-w-full rounded-2xl border border-gray-700/50 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ maxHeight: '300px' }}
                                                    onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: true })}
                                                />
                                            ) : (
                                                <img
                                                    src={mediaUrl}
                                                    alt="shared media"
                                                    className="max-w-full rounded-2xl border border-gray-700/50 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ maxHeight: '300px' }}
                                                    onClick={() => setMediaViewer({ isOpen: true, mediaUrl, isVideo: false })}
                                                />
                                            )
                                        })()
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words">
                                            {message.body}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {/* Typing Indicator */}
                {otherUserTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        <div className="bg-[#141414] text-gray-200 rounded-2xl rounded-bl-sm px-4 py-2">
                            <TypingDots />
                        </div>
                    </motion.div>
                )}

                {/* Empty State */}
                {messages.length === 0 && !otherUserTyping && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex items-center justify-center"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Start a conversation</h3>
                            <p className="text-gray-400">Send a message to @{otherUser}</p>
                        </div>
                    </motion.div>
                )}


            </div>

            {/* Message Composer */}
            <div className={`fixed bottom-0 ${isMobile ? 'left-0' : 'left-[340px]'} right-0 bg-[#0b0b0b] border-t border-gray-800 px-6 py-4 z-10`}>
                {/* Upload Progress */}
                {uploading && (
                    <div className="mb-4 flex items-center space-x-3 text-gray-400">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-2 bg-red-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <span className="text-sm">{uploadProgress}%</span>
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                    {/* Attachment Button */}
                    <label className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[#141414] hover:bg-[#1a1a1a] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        ) : (
                            <Plus className="w-5 h-5 text-gray-400 hover:text-white" />
                        )}
                        <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={uploading}
                        />
                    </label>

                    {/* Message Input */}
                    <textarea
                        ref={inputRef}
                        value={newMessage}
                        onChange={(e) => {
                            setNewMessage(e.target.value)
                            handleTyping()

                            // Auto-resize textarea
                            const target = e.target as HTMLTextAreaElement
                            target.style.height = 'auto'
                            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message @${otherUser}...`}
                        className="flex-1 resize-none bg-[#141414] text-gray-200 placeholder-gray-500 rounded-2xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-red-500 min-h-[44px] max-h-[120px] overflow-hidden shadow-inner"
                        rows={1}
                        disabled={sending || uploading}
                        style={{ height: '44px' }}
                    />

                    {/* Send Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={!newMessage.trim() || sending || uploading}
                        className={`h-10 px-6 rounded-2xl font-medium transition-all ${newMessage.trim() && !sending && !uploading
                            ? 'bg-gradient-to-r from-red-600 to-pink-500 text-white shadow-lg hover:shadow-xl hover:opacity-90'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <span className="hidden sm:inline">Send</span>
                        )}
                        {!sending && (
                            <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </motion.button>
                </form>
            </div>

            {/* Media Viewer Modal */}
            <MediaViewer
                isOpen={mediaViewer.isOpen}
                onClose={() => setMediaViewer({ isOpen: false, mediaUrl: '', isVideo: false })}
                mediaUrl={mediaViewer.mediaUrl}
                isVideo={mediaViewer.isVideo}
            />
        </div>
    )
}
