'use client'

// React Hooks must always be called in same order


import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type PostInputRaw } from '@/lib/validators'
import { useUser } from '@/hooks/useUser'
import { classifyCategory } from '../../../../@Integrations/geminiClient'

export default function NewPost() {
    // All hooks must be called at the top level, in the same order every time
    const router = useRouter()
    const { user, loading: userLoading } = useUser()

    // State hooks - all called unconditionally
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [toggleMode, setToggleMode] = useState<'Selling' | 'Requesting'>('Selling')
    const [formattedPrice, setFormattedPrice] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [tagInput, setTagInput] = useState('')
    const [showTagSuggestions, setShowTagSuggestions] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form hook - called unconditionally
    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        setError,
        resetField
    } = useForm<PostInputRaw>({
        defaultValues: {
            mode: 'selling'
        }
    })

    // Watch values - called unconditionally
    const image = watch('image')
    const mode = watch('mode')

    // Callback hooks - all called unconditionally
    const formatPrice = useCallback((value: string) => {
        // Remove all non-numeric characters except decimal point
        const numericValue = value.replace(/[^\d.]/g, '')

        if (!numericValue) return ''

        // Parse as number
        const numValue = parseFloat(numericValue)

        if (isNaN(numValue)) return ''

        // Format with commas for thousands
        const formatted = numValue.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        })

        // Auto-detect currency symbol from input
        const currencyMatch = value.match(/[₹$€£¥]/)
        const currencySymbol = currencyMatch ? currencyMatch[0] : '$'

        // Determine if symbol should be prefix or suffix
        const hasSymbolAtStart = /^[₹$€£¥]/.test(value.trim())
        const hasSymbolAtEnd = /[₹$€£¥]$/.test(value.trim())

        if (hasSymbolAtStart) {
            return `${currencySymbol}${formatted}`
        } else if (hasSymbolAtEnd) {
            return `${formatted}${currencySymbol}`
        } else {
            // Default to prefix
            return `${currencySymbol}${formatted}`
        }
    }, [])

    // Effect hooks - all called unconditionally
    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/auth')
        }
    }, [userLoading, user, router])

    useEffect(() => {
        setValue('mode', toggleMode.toLowerCase() as 'selling' | 'requesting')
    }, [toggleMode, setValue])

    useEffect(() => {
        setToggleMode(mode === 'selling' ? 'Selling' : 'Requesting')
    }, [mode])

    // Early returns come AFTER all hooks are called
    if (userLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    // Event handlers and other logic - no hooks here
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image must be less than 5MB')
                return
            }

            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file')
                return
            }

            setValue('image', file)
            const reader = new FileReader()
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    // Handle price input change
    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value
        const formatted = formatPrice(rawValue)
        setFormattedPrice(formatted)
        setValue('price', formatted)
    }

    // Popular tags suggestions
    const popularTags = [
        'tech', 'subscription', 'netflix', 'spotify', 'gaming', 'electronics',
        'books', 'clothing', 'furniture', 'sports', 'music', 'art',
        'software', 'tools', 'services', 'education', 'health', 'fitness'
    ]

    // Filter tag suggestions based on input
    const filteredSuggestions = popularTags.filter(tag =>
        tag.toLowerCase().includes(tagInput.toLowerCase()) &&
        !selectedTags.includes(tag)
    ).slice(0, 5)

    // Handle tag input
    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInput(e.target.value)
        setShowTagSuggestions(e.target.value.length > 0)
    }

    // Add tag
    const addTag = (tag: string) => {
        const cleanTag = tag.toLowerCase().trim()
        if (cleanTag && !selectedTags.includes(cleanTag)) {
            setSelectedTags([...selectedTags, cleanTag])
            setTagInput('')
            setShowTagSuggestions(false)
            // Update form value
            setValue('tags', [...selectedTags, cleanTag].join(', '))
        }
    }

    // Remove tag
    const removeTag = (tagToRemove: string) => {
        const newTags = selectedTags.filter(tag => tag !== tagToRemove)
        setSelectedTags(newTags)
        setValue('tags', newTags.join(', '))
    }

    // Handle tag input key press
    const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (tagInput.trim()) {
                addTag(tagInput.trim())
            }
        } else if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1])
        }
    }

    const onSubmit = async (rawData: PostInputRaw) => {
        if (!user) {
            router.push('/auth')
            return
        }

        // Custom validation: check price format with currency symbol
        const priceValue = rawData.price.trim()
        const PRICE_RE = /^\s*(?:[₹$€£¥]\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*[₹$€£¥])\s*$/

        if (!PRICE_RE.test(priceValue)) {
            toast.error('Enter a valid price with currency, e.g. $200 or 200$')
            setError('price', { message: 'Enter a valid price with currency, e.g. $200 or 200$' })
            return
        }

        // Normalize price format while preserving user's symbol choice
        const normalizedPrice = priceValue.trim()

        // If it's prefix format (symbol first), keep as is
        // If it's suffix format (symbol last), keep as is
        // The regex ensures it's one or the other

        setLoading(true)
        setIsUploading(true)
        setUploadProgress(0)

        try {
            // Upload image to Supabase storage
            const fileExt = rawData.image.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90))
            }, 200)

            const { error: uploadError } = await supabase.storage
                .from('post-images')
                .upload(filePath, rawData.image)

            clearInterval(progressInterval)
            setUploadProgress(100)

            if (uploadError) {
                console.error('Upload error:', uploadError)
                toast.error(`Failed to upload image: ${uploadError.message}`)
                return
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('post-images')
                .getPublicUrl(filePath)

            // Parse tags
            const tags = rawData.tags
                ? rawData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                : []

            // Classify category using Gemini AI
            console.log("🏷️ [POST_CREATION] Starting category classification for:", rawData.title);
            console.log("🔧 [POST_CREATION] Environment check - GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
            const category = await classifyCategory(rawData.title, rawData.description);
            console.log("🏷️ [POST_CREATION] Category classified as:", category);

            // Create post
            const { error: insertError } = await supabase.from("posts").insert({
                title: rawData.title,
                description: rawData.description,
                image_url: publicUrl,
                username: user.username,
                mode: rawData.mode,
                price: normalizedPrice,
                tags: tags,
                category: category,
            });

            if (insertError) {
                console.error('Insert error:', insertError)
                toast.error(`Failed to create post: ${insertError.message}`)
                return
            }

            toast.success('Post created successfully!')
            router.push('/feed')
        } catch (error) {
            console.error('Error creating post:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Failed to create post: ${errorMessage}`)
        } finally {
            setLoading(false)
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 bg-black/20 backdrop-blur-md border-b border-white/20 p-4 z-10 md:px-12">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <h1 className="text-xl font-bold">New Post</h1>
                    <div></div>
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="flex flex-col w-full h-full overflow-y-auto px-4 py-4 space-y-4 md:space-y-6 md:px-12 md:py-6 md:hidden">
                {/* Photo Upload */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Photo *</label>
                    <motion.div
                        className="w-full h-48 sm:h-56 md:h-64 bg-[#141414] rounded-xl border border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-400 text-sm cursor-pointer hover:border-red-600 transition-all"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => document.getElementById('fileUpload')?.click()}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            <>
                                <Camera className="w-6 h-6 mb-2 text-gray-500" />
                                Tap to upload (max 5MB)
                            </>
                        )}
                        <input type="file" id="fileUpload" hidden onChange={handleImageSelect} />
                    </motion.div>
                    {errors.image && (
                        <p className="text-red-500 text-sm mt-1">{errors.image.message}</p>
                    )}
                </motion.div>

                {/* Selling / Requesting Toggle */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Type *</label>
                    <div className="flex w-full bg-[#1a1a1a] rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => setToggleMode('Selling')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${toggleMode === 'Selling'
                                ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                : 'text-gray-400'
                                }`}
                        >
                            Selling
                        </button>
                        <button
                            type="button"
                            onClick={() => setToggleMode('Requesting')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${toggleMode === 'Requesting'
                                ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                : 'text-gray-400'
                                }`}
                        >
                            Requesting
                        </button>
                    </div>
                    {errors.mode && (
                        <p className="text-red-500 text-sm mt-1">{errors.mode.message}</p>
                    )}
                </motion.div>

                {/* Title Input */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.2 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Title *</label>
                    <input
                        {...register('title')}
                        type="text"
                        className="w-full bg-[#141414] text-gray-100 placeholder-gray-500 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="What are you selling?"
                    />
                    {errors.title && (
                        <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
                    )}
                </motion.div>

                {/* Description Textarea */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.3 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Description *</label>
                    <textarea
                        {...register('description')}
                        rows={4}
                        className="w-full bg-[#141414] text-gray-100 placeholder-gray-500 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="Describe your item..."
                    />
                    {errors.description && (
                        <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                    )}
                </motion.div>

                {/* Price Input */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.4 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Price *</label>
                    <input
                        {...register('price')}
                        type="text"
                        value={formattedPrice}
                        onChange={handlePriceChange}
                        className="w-full bg-[#141414] text-gray-100 placeholder-gray-500 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="Price (e.g. $200 or 200$)"
                    />
                    {errors.price && (
                        <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
                    )}
                </motion.div>

                {/* Tags Input with Pills */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.5 }}
                >
                    <label className="block text-gray-400 text-sm font-medium mb-2">Tags</label>

                    {/* Selected Tags Pills */}
                    {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedTags.map((tag, i) => (
                                <span
                                    key={i}
                                    className="bg-[#1a1a1a] text-gray-300 text-xs px-3 py-1 rounded-full border border-gray-700"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder="Add tags..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyPress}
                        className="w-full bg-[#141414] text-gray-100 placeholder-gray-500 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                </motion.div>

                {/* Spacer for fixed button */}
                <div className="h-20" />
            </div>

            {/* Desktop Layout - Hidden on Mobile */}
            <div className="hidden md:block">
                <div className="max-w-3xl mx-auto p-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0b0b0b] backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 p-8"
                    >
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            onSubmit={handleSubmit(onSubmit)}
                            className="space-y-6"
                        >
                            {/* Top Section: Image Upload */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <label className="block text-gray-400 text-sm font-medium mb-2">Photo *</label>
                                <motion.div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative w-full h-56 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-all duration-300 group overflow-hidden"
                                    whileHover={{
                                        scale: [1, 1.02, 1],
                                        boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)",
                                        transition: { duration: 0.6, repeat: Infinity, repeatType: "reverse" }
                                    }}
                                >
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <motion.img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover rounded-lg"
                                                whileHover={{ scale: 1.1 }}
                                                transition={{ duration: 0.3 }}
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setImagePreview(null)
                                                        resetField('image')
                                                        if (fileInputRef.current) {
                                                            fileInputRef.current.value = ''
                                                        }
                                                    }}
                                                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <p className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">Click to change image</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 text-center">
                                            <div className="text-4xl text-gray-500">📷</div>
                                            <p className="text-gray-400">Click to upload an image</p>
                                            <p className="text-xs text-gray-500">Max 5MB</p>
                                        </div>
                                    )}

                                    {/* Progress Bar */}
                                    <AnimatePresence>
                                        {isUploading && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute bottom-0 left-0 right-0 bg-black/80 p-2"
                                            >
                                                <div className="w-full bg-gray-700 rounded-full h-2">
                                                    <motion.div
                                                        className="bg-red-500 h-2 rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${uploadProgress}%` }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                </div>
                                                <p className="text-xs text-white/80 mt-1 text-center">Uploading... {uploadProgress}%</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                />
                                {errors.image && (
                                    <p className="text-red-500 text-sm mt-1">{errors.image.message}</p>
                                )}
                            </motion.div>

                            {/* Middle Section: Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6 items-start">
                                {/* Left Column */}
                                <div className="space-y-5">
                                    {/* Title */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Title *</label>
                                        <input
                                            {...register('title')}
                                            type="text"
                                            className="w-full h-12 px-4 py-3 bg-[#111] border border-gray-700 rounded-xl focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all duration-200 text-gray-200 placeholder-gray-500"
                                            placeholder="What are you selling?"
                                        />
                                        {errors.title && (
                                            <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
                                        )}
                                    </motion.div>

                                    {/* Price */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Price *</label>
                                        <input
                                            {...register('price')}
                                            type="text"
                                            value={formattedPrice}
                                            onChange={handlePriceChange}
                                            className="w-full h-12 px-4 py-3 bg-[#111] border border-gray-700 rounded-xl focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all duration-200 text-gray-200 placeholder-gray-500"
                                            placeholder="Price (e.g. $200 or 200$)"
                                        />
                                        {errors.price && (
                                            <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
                                        )}
                                    </motion.div>

                                    {/* Tags */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="relative"
                                    >
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Tags</label>

                                        {/* Selected Tags */}
                                        {selectedTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <AnimatePresence>
                                                    {selectedTags.map((tag) => (
                                                        <motion.span
                                                            key={tag}
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.8 }}
                                                            className="inline-flex items-center px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm border border-red-500/30"
                                                        >
                                                            {tag}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTag(tag)}
                                                                className="ml-2 hover:text-red-200 transition-colors"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </motion.span>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Tag Input */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={tagInput}
                                                onChange={handleTagInputChange}
                                                onKeyDown={handleTagKeyPress}
                                                className="w-full h-12 px-4 py-3 bg-[#111] border border-gray-700 rounded-xl focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all duration-200 text-gray-200 placeholder-gray-500"
                                                placeholder={selectedTags.length === 0 ? "e.g. tech, subscription, netflix" : "Add more tags..."}
                                            />

                                            {/* Tag Suggestions Dropdown */}
                                            <AnimatePresence>
                                                {showTagSuggestions && filteredSuggestions.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-gray-700 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto"
                                                    >
                                                        {filteredSuggestions.map((suggestion) => (
                                                            <button
                                                                key={suggestion}
                                                                type="button"
                                                                onClick={() => addTag(suggestion)}
                                                                className="w-full px-4 py-2 text-left text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors first:rounded-t-xl last:rounded-b-xl"
                                                            >
                                                                {suggestion}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <p className="text-xs text-gray-500 mt-1">
                                            Press Enter or comma to add tags. Click suggestions or type to search.
                                        </p>
                                    </motion.div>
                                </div>

                                {/* Right Column */}
                                <div className="flex flex-col h-full">
                                    {/* Toggle */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 }}
                                        className="mb-4"
                                    >
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Type *</label>
                                        <div className="flex w-full bg-[#1a1a1a] rounded-xl p-1">
                                            <button
                                                type="button"
                                                onClick={() => setToggleMode('Selling')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${toggleMode === 'Selling'
                                                    ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                                    : 'text-gray-400'
                                                    }`}
                                            >
                                                Selling
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setToggleMode('Requesting')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${toggleMode === 'Requesting'
                                                    ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,60,0.3)]'
                                                    : 'text-gray-400'
                                                    }`}
                                            >
                                                Requesting
                                            </button>
                                        </div>
                                        {errors.mode && (
                                            <p className="text-red-500 text-sm mt-1">{errors.mode.message}</p>
                                        )}
                                    </motion.div>

                                    {/* Description */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.7 }}
                                    >
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Description *</label>
                                        <motion.textarea
                                            {...register('description')}
                                            className="w-full h-[124px] px-4 py-3 bg-[#111] border border-gray-700 rounded-xl focus:outline-none focus:border-red-400 focus:shadow-[0_0_6px_rgba(255,0,80,0.2)] transition-all duration-200 resize-none text-gray-200 placeholder-gray-500"
                                            placeholder="Describe your item..."
                                            whileFocus={{ scale: 1.01 }}
                                            transition={{ duration: 0.2 }}
                                        />
                                        {errors.description && (
                                            <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                                        )}
                                    </motion.div>
                                </div>
                            </div>

                            {/* Bottom: Submit Button */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                className="text-center"
                            >
                                <button
                                    type="submit"
                                    disabled={loading || !image}
                                    className="w-full sm:w-1/2 mx-auto bg-gradient-to-r from-red-600 via-pink-500 to-red-400 hover:scale-105 disabled:opacity-50 text-white py-4 px-8 rounded-full font-medium transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 relative overflow-hidden"
                                >
                                    <span className="relative z-10">
                                        {loading ? 'Creating Post...' : 'Create Post'}
                                    </span>
                                    {!loading && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-400 opacity-0 hover:opacity-20 transition-opacity duration-300 rounded-full"></div>
                                    )}
                                </button>
                            </motion.div>
                        </motion.form>
                    </motion.div>
                </div>
            </div>

            {/* Sticky Create Button - Mobile Only */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0b0b0b]/80 backdrop-blur-md border-t border-gray-800 p-3 md:hidden">
                <button
                    type="submit"
                    disabled={loading || !image}
                    onClick={handleSubmit(onSubmit)}
                    className={`w-full py-3 rounded-2xl font-semibold transition-all ${loading || !image
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-pink-500 text-white hover:opacity-90 shadow-lg'
                        }`}
                >
                    {loading ? 'Creating Post...' : 'Create Post'}
                </button>
            </div>
        </div>
    )
}
