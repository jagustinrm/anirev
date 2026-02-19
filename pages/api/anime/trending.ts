import type { NextApiRequest, NextApiResponse } from 'next'
import axios from '../../../lib/axiosClient'

const CACHE_TTL = 60 * 1000
const cache = new Map<string, { ts: number, value: any }>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const page = Math.max(1, Number(req.query.page || 1))
  const type = String(req.query.type || 'ANIME')

  const key = `trending:${page}:${type}`
  const c = cache.get(key)
  if (c && (Date.now() - c.ts) < CACHE_TTL) return res.status(200).json(c.value)

  const query = `query ($page: Int, $type: MediaType) {
    Page(page: $page, perPage: 10) {
      pageInfo { total, currentPage, lastPage, hasNextPage }
      media(type: $type, sort: [POPULARITY_DESC]) {
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
    const resp = await axios.post('https://graphql.anilist.co', { query, variables: { page, type } })
    const json = resp.data
    if (json.errors) {
      const first = json.errors[0]
      if (first && first.status === 429) return res.status(429).json({ error: json.errors })
      return res.status(502).json({ error: json.errors })
    }
    const pageData = json.data?.Page
    const payload = { data: (pageData?.media) || [], pageInfo: pageData?.pageInfo || null }
    cache.set(key, { ts: Date.now(), value: payload })
    res.status(200).json(payload)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
