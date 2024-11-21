import axios from 'axios'

const BASE_URL = 'https://api.linkedin.com/v2'

interface LinkedInClient {
  accessToken: string
}

let client: LinkedInClient | null = null

export const getClient = () => {
  if (!client) {
    client = {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN!
    }
  }
  return client
}

interface LinkedInPost {
  id: string
  author: {
    id: string
    firstName: string
    lastName: string
  }
  content: {
    contentEntities: Array<{
      entityLocation: string
      thumbnails?: Array<{ resolvedUrl: string }>
    }>
    title: string
    description: string
  }
  socialDetail: {
    totalSocialActivityCounts: {
      numLikes: number
      numComments: number
    }
  }
}

interface InteractionResults {
  searched: number
  liked: number
  commented: number
  connected: number
  errors: number
  terms: Record<string, {
    posts: number
    interactions: number
    authors: Array<{
      name: string
      id: string
      actions: Array<'liked' | 'commented' | 'connected'>
    }>
  }>
}

const makeRequest = async (endpoint: string, options: any = {}) => {
  const client = getClient()
  const url = `${BASE_URL}${endpoint}`
  
  try {
    const response = await axios({
      ...options,
      url,
      headers: {
        'Authorization': `Bearer ${client.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    
    return response.data
  } catch (error: any) {
    console.error(`LinkedIn API Error (${endpoint}):`, error.response?.data || error.message)
    throw error
  }
}

export const searchAndInteract = async (searchTerms: string[]) => {
  const results: InteractionResults = {
    searched: 0,
    liked: 0,
    commented: 0,
    connected: 0,
    errors: 0,
    terms: {}
  }

  try {
    console.log('🔑 Using LinkedIn credentials...')
    
    // Get our profile info using the correct endpoint
    const meResponse = await makeRequest('/me?projection=(id,localizedFirstName,localizedLastName)')
    const myId = `urn:li:person:${meResponse.id}`
    
    // Track unique profiles we've interacted with
    const interactedProfiles = new Set<string>()
    
    for (const term of searchTerms) {
      console.log(`\n🔎 Searching for term: "${term}"`)
      results.terms[term] = {
        posts: 0,
        interactions: 0,
        authors: []
      }
      
      try {
        // Search for posts using the correct feed endpoint
        const searchResults = await makeRequest('/search/posts', {
          params: {
            keywords: term,
            count: 10,
            start: 0
          }
        })
        
        results.terms[term].posts = searchResults.elements?.length || 0
        
        for (const post of (searchResults.elements || [])) {
          try {
            const authorId = post.author
            
            // Get author details
            const authorResponse = await makeRequest(`/people/${authorId}?projection=(localizedFirstName,localizedLastName)`)
            const authorName = `${authorResponse.localizedFirstName} ${authorResponse.localizedLastName}`
            
            // React to the post
            try {
              await makeRequest(`/reactions`, {
                method: 'POST',
                data: {
                  actor: myId,
                  object: post.id,
                  type: 'LIKE'
                }
              })
              console.log(`❤️ Liked post from ${authorName}`)
              results.liked++
              
              results.terms[term].authors.push({
                name: authorName,
                id: authorId,
                actions: ['liked']
              })
            } catch (error) {
              console.error(`⚠️ Error liking post from ${authorName}:`, error)
            }
            
            // Add delay between interactions
            await new Promise(resolve => setTimeout(resolve, 2000))
            
          } catch (error) {
            console.error('⚠️ Error processing post:', error)
            results.errors++
          }
        }
        
      } catch (error) {
        console.error(`❌ Error searching for term "${term}":`, error)
        results.errors++
        continue
      }
      
      results.searched++
      
      // Add delay between search terms
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
    
    return results
    
  } catch (error) {
    console.error('❌ Error in searchAndInteract:', error)
    results.errors++
    throw error
  }
} 