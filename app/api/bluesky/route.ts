import { searchAndInteract } from '../../../lib/bluesky'
import { interactWithFollowersPosts } from '../../../lib/bluesky'
import { NextResponse } from 'next/server'

// The search terms we want to monitor
const SEARCH_TERMS = [
  '100DaysOfCode',
  'CodeNewbie',
  'WebsiteDevelopment',
  'nextjs',
  'typescript',
  'tailwindcss',
  'trpc',
  'react-query',
  'shadcn',
  'supabase',
  'vercel',
  'biome',
  'pnpm',
  'magicui',
  'lucide',
  'zod',
]

export async function GET(request: Request) {
  try {
    console.log('🤖 Cron job started:', new Date().toISOString())
    console.log('🔍 Searching for terms:', SEARCH_TERMS)
    
    const authHeader = request.headers.get('authorization')
    
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET is not defined in environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Authorization failed. Received:', authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchResults = await searchAndInteract(SEARCH_TERMS)
    const followerResults = await interactWithFollowersPosts()
    
    console.log('✅ Cron job completed successfully')
    console.log('📊 Summary:', searchResults)
    console.log('📊 Follower Summary:', followerResults)
    
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      searchResults,
      followerResults
    })
  } catch (error) {
    console.error('❌ Cron job failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Configure the route to run every 4 hours
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minute timeout 