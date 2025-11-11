import React from 'react'
import { motion } from 'framer-motion'

type Props = {
    sellingMode: 'Selling' | 'Requesting'
    setSellingMode: (mode: 'Selling' | 'Requesting') => void
}

export default function SellingToggle({ sellingMode, setSellingMode }: Props) {
    const isSelling = sellingMode === 'Selling'

    return (
        <div className="relative flex items-center justify-between bg-black/20 backdrop-blur-md rounded-full w-[240px] h-[44px] px-1 shadow-inner border border-white/20">
            {/* Animated background */}
            <motion.div
                layout
                animate={{
                    x: isSelling ? 0 : '100%',
                }}
                transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 30,
                }}
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-red-500 to-pink-500 shadow-md pointer-events-none"
            />

            {/* Selling Button */}
            <button
                type="button"
                onClick={() => setSellingMode('Selling')}
                className={`relative flex-1 z-10 text-sm font-medium transition-colors duration-200 ${isSelling ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
            >
                Selling
            </button>

            {/* Requesting Button */}
            <button
                type="button"
                onClick={() => setSellingMode('Requesting')}
                className={`relative flex-1 z-10 text-sm font-medium transition-colors duration-200 ${!isSelling ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
            >
                Requesting
            </button>
        </div>
    )
}
