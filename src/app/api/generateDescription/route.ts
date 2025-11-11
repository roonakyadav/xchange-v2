import { NextResponse } from 'next/server'

// Simple keyword-based description generation as fallback
function generateDescriptionFromKeywords(title: string): string {
    const titleLower = title.toLowerCase()

    // Common patterns for different product types
    if (titleLower.includes('netflix') || titleLower.includes('subscription')) {
        return 'Premium streaming account with unlimited access to movies, TV shows, and exclusive content. Perfect for entertainment lovers!'
    }

    if (titleLower.includes('spotify') || titleLower.includes('music')) {
        return 'Ad-free music streaming with millions of songs, playlists, and podcasts. Elevate your listening experience!'
    }

    if (titleLower.includes('canva') || titleLower.includes('design')) {
        return 'Professional design tool with templates, graphics, and creative assets. Create stunning visuals effortlessly!'
    }

    if (titleLower.includes('chatgpt') || titleLower.includes('ai') || titleLower.includes('gpt')) {
        return 'Advanced AI assistant for writing, coding, and creative tasks. Boost your productivity with intelligent conversations!'
    }

    if (titleLower.includes('gaming') || titleLower.includes('game')) {
        return 'Premium gaming account with exclusive content, skins, and early access. Level up your gaming experience!'
    }

    if (titleLower.includes('software') || titleLower.includes('tool')) {
        return 'Professional software license with full features and updates. Essential tool for productivity and creativity!'
    }

    // Generic fallback
    return `High-quality ${title.toLowerCase()} with premium features and excellent performance. Perfect for your needs!`
}

export async function POST(req: Request) {
    try {
        const { title, imageUrl } = await req.json()

        if (!title || !imageUrl) {
            return NextResponse.json(
                { error: 'Title and imageUrl are required' },
                { status: 400 }
            )
        }

        // Use keyword-based generation for now
        const aiDescription = generateDescriptionFromKeywords(title)

        return NextResponse.json({ aiDescription })
    } catch (error) {
        console.error('Error generating description:', error)
        return NextResponse.json(
            { error: 'Failed to generate description' },
            { status: 500 }
        )
    }
}
