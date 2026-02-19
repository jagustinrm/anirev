import type { NextApiRequest, NextApiResponse } from 'next'
import axios from '../../../lib/axiosClient'

// Simple in-memory cache to reduce duplicate AniList calls while the server process runs
const CACHE_TTL = 60 * 1000 // 60s
const cache = new Map<string, { ts: number, value: any }>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
  const page = Math.max(1, Number(req.query.page || 1))
  const type = String(req.query.type || 'ANIME') // ANIME or MANGA

  const query = `query ($search: String, $page: Int, $type: MediaType) {
    Page(page: $page, perPage: 10) {
      pageInfo { total, currentPage, lastPage, hasNextPage }
      media(search: $search, type: $type) {
        id
        title { romaji english native }
        episodes
        seasonYear
        coverImage { large medium }
        averageScore
      }
    }
  }`

  try {
    // If no search query provided, don't return the full catalog
    if (!q) {
      return res.status(200).json({ data: [], pageInfo: null })
    }

    const key = `search:${q}:${page}:${type}`
    const cached = cache.get(key)
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return res.status(200).json(cached.value)
    }

    const variables: any = { page, type, search: q }

    const resp = await axios.post('https://graphql.anilist.co', { query, variables })
    const json = resp.data
    if (json.errors) {
      const first = json.errors[0]
      if (first && first.status === 429) return res.status(429).json({ error: json.errors })
      return res.status(502).json({ error: json.errors })
    }
    const pageData = json.data?.Page
    const results = (pageData?.media) || []
    const pageInfo = pageData?.pageInfo || null
    const payload = { data: results, pageInfo }
    cache.set(key, { ts: Date.now(), value: payload })
    res.status(200).json(payload)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
