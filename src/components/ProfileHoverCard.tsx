'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface ProfileHoverCardProps {
    username: string
    isVisible: boolean
    onClose: () => void
    position?: { top: number; left: number }
}

interface UserProfile {
    username: string
    avatar_url?: string
    bio?: string
    created_at: string
}

export default function ProfileHoverCard({ username, isVisible, onClose, position = { top: 100, left: 100 } }: ProfileHoverCardProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isVisible) {
            fetchProfile()
        }
    }, [isVisible, username])

    const fetchProfile = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual API call to get user profile
            // For now, simulate with mock data
            const mockProfile: UserProfile = {
                username,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                bio: `Creative designer and digital artist. Passionate about creating beautiful user experiences.`,
                created_at: '2024-01-15T00:00:00Z'
            }
            setProfile(mockProfile)
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatJoinDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />

                    {/* Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="fixed z-50 w-80 bg-black/90 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl overflow-hidden"
                        style={{ top: position.top, left: position.left }}
                    >
                        {loading ? (
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse"></div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-white/10 rounded w-24 animate-pulse"></div>
                                        <div className="h-3 bg-white/10 rounded w-16 animate-pulse"></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-white/10 rounded animate-pulse"></div>
                                    <div className="h-3 bg-white/10 rounded w-3/4 animate-pulse"></div>
                                </div>
                            </div>
                        ) : profile ? (
                            <div className="p-4">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/10">
                                        <Image
                                            src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                                            alt={username}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white text-lg truncate">@{profile.username}</h3>
                                        <p className="text-gray-400 text-sm">Joined {formatJoinDate(profile.created_at)}</p>
                                    </div>
                                </div>

                                {profile.bio && (
                                    <p className="text-gray-300 text-sm mb-4 line-clamp-3">{profile.bio}</p>
                                )}

                                <Link
                                    href={`/profile/${profile.username}`}
                                    className="block w-full bg-red-500 hover:bg-red-600 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors"
                                    onClick={onClose}
                                >
                                    View Profile
                                </Link>
                            </div>
                        ) : (
                            <div className="p-4 text-center">
                                <p className="text-gray-400">Failed to load profile</p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
