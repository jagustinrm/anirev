import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import axios from '../lib/axiosClient'
import { supabase, getCurrentUser } from '../lib/supabaseClient'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageInfo, setPageInfo] = useState<any>(null)
  const [mediaType, setMediaType] = useState<'ANIME'|'MANGA'>('ANIME')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalUserReview, setModalUserReview] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    getCurrentUser().then(u => { if (mounted) setUser(u) })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        getCurrentUser().then(u => setUser(u))
      } else {
        setUser(null)
      }
    })

    return () => { mounted = false; sub?.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    // initial: load trending anime so the homepage isn't empty
    fetchTrending()
  }, [])

  async function fetchTrending(page = 1) {
    try {
      setLoading(true)
      setError(null)
      const resp = await axios.get(`/api/anime/trending?page=${page}&type=${mediaType}`)
      const json = resp.data
      setResults(json.data ?? [])
      setPageInfo(json.pageInfo ?? null)
    } catch (err: any) {
      setError(String(err))
    } finally { setLoading(false) }
  }

  // Request throttling: ensure at most 1 request per second
  const lastRequestAt = useRef<number>(0)
  async function rateLimitWait() {
    const now = Date.now()
    const diff = now - (lastRequestAt.current || 0)
    if (diff < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - diff))
    }
    lastRequestAt.current = Date.now()
  }

  // Fetch with backoff when receiving 429
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
        // normalize to fetch-like interface
        return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) }
      } catch (err: any) {
        const status = err?.response?.status
        if (status && status !== 429) {
          return { ok: false, status, json: async () => err.response.data, text: async () => JSON.stringify(err.response.data) }
        }
        // 429 or network error -> retry
        const wait = Math.min(16000, 1000 * Math.pow(2, attempt))
        await new Promise(r => setTimeout(r, wait))
        attempt++
      }
    }
    // final attempt (will throw if fails)
    const res = await axios.get(url)
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) }
  }

  // Debounce incremental search: use autocomplete endpoint while typing
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setPageInfo(null)
      setError(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        const url = `/api/anime/autocomplete?q=${encodeURIComponent(q)}&page=1&type=${mediaType}`
        const res = await fetchWithBackoff(url)
        if (!res.ok) {
          if (res.status === 429) { setError('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'); return }
          const txt = await res.text().catch(()=>null)
          throw new Error(txt || String(res.status))
        }
        const json = await res.json()
        setResults(json.data ?? [])
        setPageInfo(json.pageInfo ?? null)
      } catch (err: any) {
        setError(String(err))
      } finally { setLoading(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, mediaType])

  async function fetchList(q: string, page: number = 1, type: string = 'ANIME') {
    try {
      setLoading(true)
      setError(null)
      // ensure page is at least 1
      page = Math.max(1, page)
  const url = '/api/anime/search' + (q ? `?q=${encodeURIComponent(q)}&page=${page}&type=${type}` : `?page=${page}&type=${type}`)
  const res = await fetchWithBackoff(url)
      // handle rate-limit specifically
      if (!res.ok) {
        const body = await res.text().catch(()=>null)
        try {
          const parsed = body ? JSON.parse(body) : null
          if (res.status === 429 || (parsed && parsed.error && JSON.stringify(parsed.error).includes('Too Many Requests'))) {
            setError('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.')
            return
          }
        } catch (_) {}
  throw new Error(body || String(res.status))
      }
      const json = await res.json()
      if (json.error) {
        const errStr = JSON.stringify(json.error)
        if (errStr.includes('Too Many Requests') || (json.error[0] && json.error[0].status === 429)) {
          setError('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.')
          return
        }
        throw new Error(errStr)
      }
      setResults(json.data ?? [])
      setPageInfo(json.pageInfo ?? null)
    } catch (err: any) {
      // friendly fallback
      if (!String(err).includes('Demasiadas solicitudes')) setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function openModal(id: number) {
    setModalOpen(true)
    setModalLoading(true)
    // prevent background scroll/select
    document.body.style.overflow = 'hidden'
    document.body.style.userSelect = 'none'
    try {
      const resp = await axios.get(`/api/anime/${id}`)
      const json = resp.data
      setModalData(json.data)
      // check if current user has a review
      const u = await getCurrentUser()
      if (u?.id) {
        const r = await axios.get(`/api/reviews?anime_id=${id}&user_id=${u.id}`)
        const jr = r.data
        setModalUserReview((jr.data && jr.data.length) ? jr.data[0] : null)
      } else setModalUserReview(null)
    } catch (err) {
      console.error('Error loading modal data', err)
      setModalData(null)
      setModalUserReview(null)
    } finally {
      setModalLoading(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setModalData(null)
    setModalUserReview(null)
    document.body.style.overflow = ''
    document.body.style.userSelect = ''
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-700">anirev</Link>
            <nav className="hidden md:flex gap-3 text-sm text-gray-600">
              <button onClick={()=>{ setQuery(''); setMediaType('ANIME'); fetchTrending(1) }} className="px-3 py-1 rounded hover:bg-gray-100">Anime</button>
              <button onClick={()=>{ setQuery(''); setMediaType('MANGA'); fetchTrending(1) }} className="px-3 py-1 rounded hover:bg-gray-100">Manga</button>
              <a className="px-3 py-1 rounded hover:bg-gray-100">Community</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter') fetchList(query) }} className="border rounded px-3 py-1" placeholder="Search anime, manga, and more..." />
            <button onClick={()=>fetchList(query)} className="bg-blue-600 text-white px-3 py-1 rounded">Search</button>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-700">{user.email}</div>
                <Link href="/review/new"><button className="bg-green-600 text-white px-3 py-1 rounded">New Review</button></Link>
                <Link href="/review/mine"><button className="bg-gray-100 px-3 py-1 rounded">My Reviews</button></Link>
                <button onClick={signOut} className="bg-gray-200 px-3 py-1 rounded">Logout</button>
              </div>
            ) : (
              <Link href="/login"><button className="bg-blue-600 text-white px-3 py-1 rounded">Login</button></Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Real results from AniList */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Search {mediaType === 'ANIME' ? 'Anime' : 'Manga'}</h3>
            <div className="flex items-center gap-2">
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search..." className="border px-2 py-1 rounded" />
              <button onClick={()=>fetchList(query)} className="bg-blue-600 text-white px-3 py-1 rounded">Search</button>
            </div>
          </div>

          {loading && <div className="text-sm text-gray-600">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map(item => (
              <div key={item.id} className="flex gap-4 p-3 bg-white rounded shadow">
                <img src={item.coverImage?.medium || item.coverImage?.large} alt={item.title?.romaji || item.title?.english} className="w-20 h-28 object-cover rounded" />
                <div className="flex-1">
                  <div className="font-semibold">{item.title?.romaji || item.title?.english || item.title?.native}</div>
                  <div className="text-sm text-gray-500">{item.episodes ? `${item.episodes} eps` : '—'} • {item.seasonYear || '—'}</div>
                  <div className="mt-2 text-yellow-500 font-bold">★ {item.averageScore ?? 'N/A'}</div>
                </div>
                <div className="flex flex-col justify-between">
                    <button onClick={async ()=>{
                    // use client-side supabase to get current user id
                    const u = await getCurrentUser()
                    const user_id = u?.id
                    if (!user_id) { alert('You must log in to add to your list'); return }
                    const payload = { user_id, anime_id: item.id, anime_title: item.title?.romaji || item.title?.english }
                    try {
                      const rr = await axios.post('/api/list', payload)
                      if (rr.status >= 200 && rr.status < 300) alert('Added to your list')
                      else alert('Error adding to list')
                    } catch (e: any) {
                      const msg = e?.response?.data?.error || e?.message || 'Unknown error'
                      alert('Error adding to list: ' + msg)
                    }
                  }} className="bg-blue-600 text-white px-3 py-1 rounded">Add to My List</button>
                  <button className="text-sm text-blue-600 mt-2 text-left" onClick={()=>openModal(item.id)}>Details</button>
                  <button className="text-sm text-green-600 mt-2" onClick={()=>{
                    // navigate to review/new with query params
                    const params = new URLSearchParams({ animeId: String(item.id), animeTitle: item.title?.romaji || item.title?.english || '' })
                    window.location.href = `/review/new?${params.toString()}`
                  }}>Create review</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={()=>{
            const prev = (pageInfo?.currentPage || 1) - 1
            if ((query || '').trim()) fetchList(query, prev)
            else fetchTrending(prev)
          }} disabled={(pageInfo?.currentPage || 1) <= 1 || loading} className="px-3 py-1 border rounded">Previous</button>
          <div className="px-3 py-1">Page {pageInfo?.currentPage ?? 1} / {pageInfo?.lastPage ?? 1}</div>
          <button onClick={()=>{
            const next = (pageInfo?.currentPage || 1) + 1
            if ((query || '').trim()) fetchList(query, next)
            else fetchTrending(next)
          }} disabled={!pageInfo?.hasNextPage || loading} className="px-3 py-1 border rounded">Next</button>
        </div>
        {/* Modal overlay for details */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-50" onClick={()=>closeModal()} />
            <div className="relative bg-white rounded shadow max-w-3xl w-full mx-4 p-6 z-10">
              {modalLoading ? <div>Loading...</div> : (
                modalData ? (
                  <div>
                    <div className="flex gap-4">
                      <img src={modalData.coverImage?.large || modalData.coverImage?.medium} className="w-40 h-56 object-cover rounded" />
                      <div>
                        <h2 className="text-xl font-bold">{modalData.title?.romaji || modalData.title?.english}</h2>
                        <div className="text-sm text-gray-600">{modalData.episodes ? `${modalData.episodes} eps` : '—'} • {modalData.seasonYear}</div>
                        <div className="mt-3 text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: modalData.description || '' }} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-semibold">Characters</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        {modalData.characters?.edges?.map((e: any) => (
                          <div key={e.node.id} className="p-2 bg-gray-50 rounded text-sm">{e.node.name.full}</div>
                        ))}
                      </div>
                    </div>
                    {modalUserReview && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded">
                        <h4 className="font-semibold">Your review</h4>
                        <div className="text-sm">Overall: {modalUserReview.overall_score}</div>
                        <div className="mt-2 text-sm">{modalUserReview.review_text}</div>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button onClick={()=>closeModal()} className="px-3 py-1 border rounded">Close</button>
                    </div>
                  </div>
                ) : <div>No data</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
