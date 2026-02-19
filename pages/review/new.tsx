import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase, getCurrentUser } from '../../lib/supabaseClient'
import axios from '../../lib/axiosClient'
import { useRouter } from 'next/router'

type Mini = { id: string, title: string, score: number, text?: string }

export default function NewReview() {
  const [user, setUser] = useState<any>(null)
  const [animeId, setAnimeId] = useState('')
  const [animeTitle, setAnimeTitle] = useState('')
  const [titleQuery, setTitleQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCover, setSelectedCover] = useState<string | null>(null)
  const [minis, setMinis] = useState<Mini[]>([
    { id: String(Date.now()) + '-characters', title: 'Characters', score: 5, text: '' },
    { id: String(Date.now()+1) + '-lore', title: 'Lore', score: 5, text: '' },
    { id: String(Date.now()+2) + '-scenes', title: 'Scenes', score: 5, text: '' }
  ])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  // throttling/backoff helpers similar to index.tsx
  const lastRequestAt = useRef<number>(0)
  async function rateLimitWait() {
    const now = Date.now()
    const diff = now - (lastRequestAt.current || 0)
    if (diff < 1000) await new Promise(r => setTimeout(r, 1000 - diff))
    lastRequestAt.current = Date.now()
  }

  async function fetchWithBackoff(url: string, opts?: any, retries = 3) {
    let attempt = 0
    while (attempt <= retries) {
      await rateLimitWait()
      try {
        const method = (opts && opts.method) || 'get'
        const config: any = { method, url }
        if (opts && opts.headers) config.headers = opts.headers
        if (opts && (opts.body || opts.data)) {
          try { config.data = opts.body ? JSON.parse(opts.body as string) : opts.data } catch { config.data = opts.data }
        }
        const res = await axios.request(config)
        return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data }
      } catch (err: any) {
        const status = err?.response?.status
        if (status && status !== 429) {
          return { ok: false, status, json: async () => err.response.data }
        }
        const wait = Math.min(16000, 1000 * Math.pow(2, attempt))
        await new Promise(r => setTimeout(r, wait))
        attempt++
      }
    }
    const res = await axios.get(url)
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data }
  }

  // debounce for title suggestions
  useEffect(() => {
    const q = titleQuery.trim()
    if (!q) { setSuggestions([]); setShowSuggestions(false); return }
    const t = setTimeout(async () => {
      try {
        const url = `/api/anime/autocomplete?q=${encodeURIComponent(q)}&page=1&type=ANIME`
        const res = await fetchWithBackoff(url)
        if (!res.ok) return
        const json = await res.json()
        setSuggestions(json.data ?? [])
        setShowSuggestions(true)
      } catch (err) {
        // ignore suggestion errors
      }
    }, 300)
    return () => clearTimeout(t)
  }, [titleQuery])

  useEffect(() => {
    getCurrentUser().then(u => setUser(u))
  }, [])

  useEffect(() => {
    // Prefill from query params if present
    const { animeId: qId, animeTitle: qTitle } = router.query
    if (qId && !animeId) setAnimeId(String(qId))
    if (qTitle && !animeTitle) { setAnimeTitle(String(qTitle)); setTitleQuery(String(qTitle)) }
  }, [router.query])

  function updateMini(id: string, patch: Partial<Mini>) {
    setMinis(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function addMini() {
    setMinis(prev => [...prev, { id: String(Date.now()), title: 'New section', score: 5, text: '' }])
  }

  function removeMini(id: string) {
    setMinis(prev => prev.filter(m => m.id !== id))
  }

  function computeOverall() {
    if (minis.length === 0) return 0
    const sum = minis.reduce((a,b) => a + Number(b.score), 0)
    return +(sum / minis.length).toFixed(2)
  }

  async function submit() {
    if (!user) { setMessage('Debes iniciar sesión para enviar una review'); return }
    setLoading(true)
    // ensure anime exists: if no animeId, try to resolve by title
    let resolvedId = animeId
    if (!resolvedId) {
      try {
        const res = await fetchWithBackoff(`/api/anime/autocomplete?q=${encodeURIComponent((animeTitle || titleQuery).trim())}&page=1&type=ANIME`)
        if (res.ok) {
          const j = await res.json()
          const found = (j.data || []).find((m: any) => {
            const t = (animeTitle || titleQuery).toLowerCase()
            return (m.title?.romaji || '').toLowerCase() === t || (m.title?.english || '').toLowerCase() === t
          })
          if (found) resolvedId = String(found.id)
        }
      } catch (_) {}
    }

    if (!resolvedId) {
      setMessage('Advertencia: ese animé no está en el listado. Comprueba el título o créalo en AniList antes.')
      setLoading(false)
      return
    }

    const payload = {
      anime_id: resolvedId,
      anime_title: animeTitle || titleQuery || 'Unknown Title',
      user_id: user.id,
      categories: minis,
      overall_score: computeOverall(),
      review_text: text
    }

    try {
      const res = await axios.post('/api/reviews', payload)
      const json = res.data
      if (res.status < 200 || res.status >= 300) throw new Error(JSON.stringify(json))
        setMessage('Review guardada')
      router.push('/review/mine')
    } catch (err: any) {
      setMessage('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-700">anirev</Link>
            <nav className="hidden md:flex gap-3 text-sm text-gray-600">
              <button onClick={()=>{ window.location.href='/?q=&page=1&type=ANIME' }} className="px-3 py-1 rounded hover:bg-gray-100">Anime</button>
              <button onClick={()=>{ window.location.href='/?q=&page=1&type=MANGA' }} className="px-3 py-1 rounded hover:bg-gray-100">Manga</button>
              <a className="px-3 py-1 rounded hover:bg-gray-100">Community</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <input className="border rounded px-3 py-1" placeholder="Search anime, manga, and more..." />
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-700">{user.email}</div>
                <Link href="/review/new"><button className="bg-green-600 text-white px-3 py-1 rounded">New Review</button></Link>
                <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href='/' }} className="bg-gray-200 px-3 py-1 rounded">Logout</button>
              </div>
            ) : (
              <Link href="/login"><button className="bg-blue-600 text-white px-3 py-1 rounded">Login</button></Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="w-full bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">New Review</h2>

          <label className="block text-sm font-medium text-gray-700">Title</label>
            <div className="relative flex items-start">
            <input className="mt-1 mb-2 w-full border px-3 py-2 rounded" value={animeTitle || titleQuery} onChange={e=>{ setAnimeId(''); setSelectedCover(null); setAnimeTitle(''); setTitleQuery(e.target.value); }} onFocus={()=>{ if (suggestions.length) setShowSuggestions(true) }} />
            {selectedCover && (
              <img src={selectedCover} alt="cover" className="w-16 h-20 object-cover rounded ml-3 mt-1" />
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-40 left-0 right-0 bg-white border rounded mt-1 shadow max-h-60 overflow-auto">
                {suggestions.map(s => (
                  <div key={s.id} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-3" onMouseDown={(e)=>{ e.preventDefault(); setAnimeId(String(s.id)); setAnimeTitle(s.title?.romaji || s.title?.english || ''); setTitleQuery(s.title?.romaji || s.title?.english || ''); setSelectedCover(s.coverImage?.medium || s.coverImage?.large || null); setShowSuggestions(false) }}>
                    {s.coverImage?.medium ? (
                      <img src={s.coverImage.medium} alt="cover" className="w-10 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-14 bg-gray-100 rounded" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{s.title?.romaji || s.title?.english}</div>
                      <div className="text-xs text-gray-500">ID: {s.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Sections (mini-reviews)</h3>
            <button onClick={addMini} className="px-3 py-1 bg-gray-100 rounded">+ Add section</button>
          </div>
          {minis.map(m => (
            <div key={m.id} className="p-3 border rounded bg-gray-50">
              <div className="flex items-center gap-2">
                <input value={m.title} onChange={e=>updateMini(m.id, { title: e.target.value })} className="flex-1 border px-2 py-1 rounded" />
                <button onClick={()=>removeMini(m.id)} className="px-2 py-1 bg-red-600 text-white rounded">Remove</button>
              </div>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <button key={i} onClick={() => updateMini(m.id, { score: i })} className={`w-6 h-3 rounded-sm ${i <= m.score ? 'bg-blue-600' : 'bg-gray-200'} focus:outline-none`} aria-label={`Set ${m.title} score to ${i}`} />
                  ))}
                </div>
                <div className="text-sm">Score: <strong>{m.score}</strong></div>
              </div>
              <div className="mt-2">
                <textarea value={m.text} onChange={e=>updateMini(m.id, { text: e.target.value })} className="w-full border p-2 rounded" rows={3} placeholder="Optional notes for this section" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">General review text</label>
          <textarea className="mt-1 w-full border p-3 rounded" rows={6} value={text} onChange={e=>setText(e.target.value)} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>Overall: <strong>{computeOverall()}</strong></div>
          <div className="flex gap-2">
            <button onClick={()=>router.push('/review/mine')} className="px-3 py-2 border rounded">Cancel</button>
            <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>{loading ? 'Saving...' : 'Save Review'}</button>
          </div>
        </div>

        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
      </main>
    </div>
  )
}
