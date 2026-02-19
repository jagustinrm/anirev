import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Support optional filtering by query params: anime_id, user_id
      const { anime_id, user_id } = req.query
      let qb = supabaseAdmin.from('reviews').select('*').order('created_at', { ascending: false })
      if (anime_id) qb = qb.eq('anime_id', String(anime_id))
      if (user_id) qb = qb.eq('user_id', String(user_id))
      const { data, error } = await qb
      if (error) {
        console.error('Supabase select reviews error:', error)
        return res.status(500).json({ error: error.message ?? error })
      }
      res.status(200).json({ data })
    } catch (err) {
      console.error('Unexpected error in GET /api/reviews:', err)
      res.status(500).json({ error: String(err) })
    }
    return
  }

  if (req.method === 'POST') {
    const review = req.body
    try {
      const { data, error } = await supabaseAdmin.from('reviews').insert([review])
      if (error) return res.status(500).json({ error })
      res.status(200).json({ data })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
    return
  }

  if (req.method === 'DELETE') {
    // delete by id or by user_id+anime_id
    const { id, user_id, anime_id } = req.body
    try {
      if (id) {
        const { data, error } = await supabaseAdmin.from('reviews').delete().eq('id', id)
        if (error) {
          console.error('Supabase delete review error:', error)
          return res.status(500).json({ error: error.message ?? error })
        }
        return res.status(200).json({ data })
      }
      if (user_id && anime_id) {
        const { data, error } = await supabaseAdmin.from('reviews').delete().match({ user_id, anime_id })
        if (error) {
          console.error('Supabase delete review error:', error)
          return res.status(500).json({ error: error.message ?? error })
        }
        return res.status(200).json({ data })
      }
      return res.status(400).json({ error: 'provide id or user_id+anime_id' })
    } catch (err) {
      console.error('Unexpected error in DELETE /api/reviews:', err)
      return res.status(500).json({ error: String(err) })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
