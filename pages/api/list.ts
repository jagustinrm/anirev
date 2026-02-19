import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Add to personal list
    const { user_id, anime_id, anime_title, metadata } = req.body
    if (!user_id || !anime_id) return res.status(400).json({ error: 'user_id and anime_id required' })
    try {
      const { data, error } = await supabaseAdmin.from('personal_lists').insert([{ user_id, anime_id, anime_title, metadata }])
      if (error) {
        console.error('Supabase insert error:', error)
        return res.status(500).json({ error: error.message ?? error })
      }
      res.status(200).json({ data })
    } catch (err) {
      console.error('Unexpected error in /api/list POST:', err)
      res.status(500).json({ error: String(err) })
    }
    return
  }

  if (req.method === 'DELETE') {
    // Expect body with id or user_id+anime_id
    const { id, user_id, anime_id } = req.body
    try {
      if (id) {
        const { data, error } = await supabaseAdmin.from('personal_lists').delete().eq('id', id)
        if (error) {
          console.error('Supabase delete error:', error)
          return res.status(500).json({ error: error.message ?? error })
        }
        return res.status(200).json({ data })
      }
      if (user_id && anime_id) {
        const { data, error } = await supabaseAdmin.from('personal_lists').delete().match({ user_id, anime_id })
        if (error) {
          console.error('Supabase delete error:', error)
          return res.status(500).json({ error: error.message ?? error })
        }
        return res.status(200).json({ data })
      }
      return res.status(400).json({ error: 'provide id or user_id+anime_id' })
    } catch (err) {
      console.error('Unexpected error in /api/list DELETE:', err)
      return res.status(500).json({ error: String(err) })
    }
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
