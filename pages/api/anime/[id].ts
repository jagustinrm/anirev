import type { NextApiRequest, NextApiResponse } from 'next'
import axios from '../../../lib/axiosClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id)
  const query = `query ($id: Int) {
    Media(id: $id) {
      id
      type
      title { romaji english native }
      description
      episodes
      seasonYear
      coverImage { large medium }
      averageScore
      characters(perPage: 10) { edges { node { id name { full } } } }
    }
  }`
  try {
    const resp = await axios.post('https://graphql.anilist.co', { query, variables: { id } })
    const json = resp.data
    res.status(200).json({ data: json.data?.Media })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
