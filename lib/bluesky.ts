import { AtpAgent, BskyAgent, AppBskyFeedDefs } from '@atproto/api'

// Define types for Bluesky post record
interface PostRecord {
  $type?: string
  text: string
  [key: string]: unknown
}

type FeedViewPost = AppBskyFeedDefs.FeedViewPost

// Create a singleton agent
let agent: AtpAgent | null = null

interface Post {
  text: string
}

export const getAgent = async () => {
  if (!agent) {
    agent = new AtpAgent({
      service: 'https://bsky.social'
    })
    
    // Login using environment variables
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME!,
      password: process.env.BLUESKY_PASSWORD!
    })
  }
  
  return agent
}

export const searchAndInteract = async (searchTerms: string[]) => {
  const results = {
    searched: 0,
    liked: 0,
    followed: 0,
    errors: 0,
    terms: {} as Record<string, { 
      posts: number, 
      interactions: number,
      authors: Array<{ 
        handle: string, 
        did: string,
        actions: Array<'liked' | 'followed'> 
      }>
    }>
  }

  try {
    console.log('🔑 Authenticating with Bluesky...')
    const agent = await getAgent()
    
    // Track unique authors we've interacted with to avoid duplicate follows
    const interactedAuthors = new Set<string>()
    
    for (const term of searchTerms) {
      console.log(`\n🔎 Searching for term: "${term}"`)
      results.terms[term] = { 
        posts: 0, 
        interactions: 0,
        authors: []
      }
      
      try {
        // Search for posts with the term
        const { data } = await agent.app.bsky.feed.searchPosts({ 
          q: term, 
          limit: 10 
        })
        
        results.terms[term].posts = data.posts.length
        
        for (const post of data.posts) {
          try {
            // Skip if we've already liked this post
            if (post.viewer?.like) {
              console.log(`⏭️ Already liked post from @${post.author.handle}`)
              continue
            }

            // Try to like the post
            try {
              await agent.like(post.uri, post.cid)
              console.log(`❤️ Liked post from @${post.author.handle}`)
              results.liked++
              
              // Fix: Properly type the actions array
              const authorActions: Array<'liked' | 'followed'> = ['liked']
              
              // Only follow if we haven't interacted with this author before
              if (!interactedAuthors.has(post.author.did)) {
                try {
                  const { data: relationship } = await agent.getProfile({
                    actor: post.author.did
                  })
                  
                  if (!relationship.viewer?.following) {
                    await agent.follow(post.author.did)
                    console.log(`👥 Followed @${post.author.handle} after liking their post`)
                    results.followed++
                    authorActions.push('followed')
                  }
                  
                  // Mark this author as interacted with
                  interactedAuthors.add(post.author.did)
                } catch (error) {
                  console.error(`⚠️ Error following @${post.author.handle}:`, error)
                }
              }
              
              results.terms[term].authors.push({
                handle: post.author.handle,
                did: post.author.did,
                actions: authorActions
              })
              
              results.terms[term].interactions++
              
              // Add delay to respect rate limits (5,000 points per hour)
              await new Promise(resolve => setTimeout(resolve, 500))
              
            } catch (error) {
              console.error(`⚠️ Error liking post from @${post.author.handle}:`, error)
              results.errors++
            }
            
          } catch (error) {
            console.error(`⚠️ Error processing post from @${post.author.handle}:`, error)
            results.errors++
            continue
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for term "${term}":`, error)
        results.errors++
        continue
      }
      
      results.searched++
      
      // Log summary for this term
      console.log(`\n📊 Summary for "${term}":`)
      console.log(`- Posts found: ${results.terms[term].posts}`)
      console.log(`- Interactions: ${results.terms[term].interactions}`)
      console.log(`- Authors interacted with:`)
      results.terms[term].authors.forEach(author => {
        console.log(`  @${author.handle} (${author.actions.join(', ')})`)
      })
      
      // Add delay between search terms to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('\n🎯 Final Summary:')
    console.log(`- Terms searched: ${results.searched}`)
    console.log(`- Total likes: ${results.liked}`)
    console.log(`- Total follows: ${results.followed}`)
    console.log(`- Errors encountered: ${results.errors}`)
    console.log(`- Unique authors interacted with: ${interactedAuthors.size}`)
    
    return results

  } catch (error) {
    console.error('❌ Error in searchAndInteract:', error)
    results.errors++
    throw error
  }
}

export const interactWithFollowersPosts = async () => {
  const results = {
    followersChecked: 0,
    postsFound: 0,
    postsLiked: 0,
    errors: 0,
    interactions: [] as Array<{
      author: string,
      postText: string,
      action: 'liked'
    }>
  }

  try {
    console.log('🔑 Authenticating with Bluesky...')
    const agent = await getAgent()

    // Get our own profile to get our DID
    const profile = await agent.getProfile({
      actor: process.env.BLUESKY_USERNAME!
    })

    // Get list of followers
    const followers = await agent.getFollowers({
      actor: profile.data.did
    })

    console.log(`📋 Found ${followers.data.followers.length} followers`)

    for (const follower of followers.data.followers) {
      try {
        results.followersChecked++
        
        const { data } = await agent.app.bsky.feed.getAuthorFeed({
          actor: follower.did,
          limit: 20
        })

        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)

        for (const feedView of data.feed) {
          const post = feedView as FeedViewPost
          const postDate = new Date(post.post.indexedAt)
          
          if (postDate < fourHoursAgo) continue

          results.postsFound++

          if (post.post.viewer?.like) continue

          try {
            await agent.like(post.post.uri, post.post.cid)
            results.postsLiked++
            
            const postRecord = post.post.record as PostRecord
            const postText = postRecord.text
            
            results.interactions.push({
              author: follower.handle,
              postText: postText.slice(0, 50) + '...',
              action: 'liked'
            })

            console.log(`❤️ Liked post from @${follower.handle}: "${postText.slice(0, 50)}..."`)
            
            await new Promise(resolve => setTimeout(resolve, 500))

          } catch (error) {
            console.error(`⚠️ Error liking post from @${follower.handle}:`, error)
            results.errors++
          }
        }

      } catch (error) {
        console.error(`❌ Error processing follower @${follower.handle}:`, error)
        results.errors++
        continue
      }
    }

    console.log('\n📊 Final Summary:')
    console.log(`- Followers checked: ${results.followersChecked}`)
    console.log(`- Recent posts found: ${results.postsFound}`)
    console.log(`- Posts liked: ${results.postsLiked}`)
    console.log(`- Errors encountered: ${results.errors}`)
    
    if (results.interactions.length > 0) {
      console.log('\n🤝 Recent Interactions:')
      results.interactions.forEach(interaction => {
        console.log(`- @${interaction.author} (${interaction.action}): "${interaction.postText}"`)
      })
    }

    return results

  } catch (error) {
    console.error('❌ Error in interactWithFollowersPosts:', error)
    results.errors++
    throw error
  }
} 