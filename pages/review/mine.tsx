import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getCurrentUser } from '../../lib/supabaseClient'
import axios from '../../lib/axiosClient'

type View = 'list' | 'details'

export default function MyReviews() {
  const [user, setUser] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [animeReviews, setAnimeReviews] = useState<any[]>([])
  const [mangaReviews, setMangaReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<any | null>(null)
  const [listType, setListType] = useState<'ANIME'|'MANGA'>('ANIME')

  useEffect(() => {
    let mounted = true
    getCurrentUser().then(u => { if (!mounted) return; setUser(u); if (u) fetchReviews(u.id) })
    return () => { mounted = false }
  }, [])

  async function fetchReviews(userId: string) {
    setLoading(true)
    try {
  const res = await axios.get(`/api/reviews?user_id=${userId}`)
  const json = res.data
  const data = json.data ?? []
      setReviews(data)

      // get unique anime ids and fetch media details to determine type
      const ids = Array.from(new Set(data.map((r: any) => r.anime_id))).filter(Boolean)
      const detailsMap: Record<string, any> = {}
      await Promise.all(ids.map(async (id) => {
        try {
          const rr = await axios.get(`/api/anime/${id}`)
          const jj = rr.data
          detailsMap[String(id)] = jj.data || null
        } catch (e) {
          // ignore
        }
      }))

      const animeList = data.filter((r: any) => (detailsMap[String(r.anime_id)]?.type || 'ANIME') === 'ANIME')
      const mangaList = data.filter((r: any) => (detailsMap[String(r.anime_id)]?.type || 'ANIME') === 'MANGA')
      setAnimeReviews(animeList)
      setMangaReviews(mangaList)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this review?')) return
    try {
      await axios.request({ method: 'DELETE', url: '/api/reviews', data: { id } })
      setReviews(r => r.filter(x => x.id !== id))
      // if the removed review was selected, go back to list
      if (selected?.id === id) { setSelected(null); setView('list') }
    } catch (err) { alert(String(err)) }
  }

  async function openDetails(r: any) {
    setSelected(null)
    setView('details')
    // fetch media details to show cover and type
    try {
      const rr = await axios.get(`/api/anime/${r.anime_id}`)
      const jj = rr.data
      setSelected({ ...r, media: jj.data || null })
    } catch (e) {
      setSelected(r)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    // optional: redirect to home
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-700">anirev</Link>
            <nav className="hidden md:flex gap-3 text-sm text-gray-600">
              <Link href="/" className="px-3 py-1 rounded hover:bg-gray-100">Anime</Link>
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
                <button onClick={signOut} className="bg-gray-200 px-3 py-1 rounded">Logout</button>
              </div>
            ) : (
              <Link href="/login"><button className="bg-blue-600 text-white px-3 py-1 rounded">Login</button></Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">My Reviews</h2>
            <div className="flex items-center gap-2">
              <button onClick={()=>{ setView('list'); setSelected(null) }} className={`px-3 py-1 rounded ${view==='list' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>List</button>
              <button onClick={()=>{ if (selected) setView('details') }} disabled={!selected} className={`px-3 py-1 rounded ${view==='details' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Details</button>
            </div>
          </div>

          { !user && <div className="p-6">You must be logged in to see your reviews. <Link href="/login" className="text-blue-600">Login</Link></div> }

          {user && (
            <div className="mt-4">
              {loading && <div>Loading...</div>}

              {view === 'list' && (
                <div>
                  <div className="mb-3 flex gap-2">
                    <button onClick={()=>setListType('ANIME')} className={`px-3 py-1 rounded ${listType==='ANIME' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Anime</button>
                    <button onClick={()=>setListType('MANGA')} className={`px-3 py-1 rounded ${listType==='MANGA' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Manga</button>
                  </div>
                  <div className="space-y-4">
                    {((listType==='ANIME') ? animeReviews : mangaReviews).length === 0 && <div className="text-sm text-gray-600">No reviews in this section.</div>}
                    {((listType==='ANIME') ? animeReviews : mangaReviews).map(r => (
                      <div key={r.id} className="p-4 bg-gray-50 rounded border cursor-pointer" onClick={()=>openDetails(r)}>
                        <div className="flex justify-between">
                          <div>
                            <div className="font-semibold">{r.anime_title}</div>
                            <div className="text-sm text-gray-600">Overall: {r.overall_score}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={(e)=>{ e.stopPropagation(); window.location.href = `/review/new?animeId=${r.anime_id}&animeTitle=${encodeURIComponent(r.anime_title)}` }} className="px-3 py-1 border rounded">Edit</button>
                            <button onClick={(e)=>{ e.stopPropagation(); remove(r.id) }} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-700">{r.review_text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === 'details' && selected && (
                <div className="p-4 bg-white rounded shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{selected.anime_title}</h3>
                      <div className="text-sm text-gray-600">Overall: {selected.overall_score}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>window.location.href = `/review/new?animeId=${selected.anime_id}&animeTitle=${encodeURIComponent(selected.anime_title)}`} className="px-3 py-1 border rounded">Edit</button>
                      <button onClick={()=>remove(selected.id)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                      <button onClick={()=>{ setView('list'); setSelected(null) }} className="px-3 py-1 border rounded">Back</button>
                    </div>
                  </div>
                  <div className="mt-4 text-gray-700">
                    <div className="mb-3"><strong>Review text</strong></div>
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selected.review_text || '<em>No text</em>' }} />

                    <div className="mt-4">
                      <h4 className="font-semibold">Sections</h4>
                      <div className="mt-2 space-y-2">
                        {selected.categories && (
                          Array.isArray(selected.categories) ? (
                            selected.categories.map((c: any) => (
                              <div key={c.id || c.title} className="p-2 bg-gray-50 rounded">
                                <div className="flex justify-between">
                                  <div className="text-sm font-medium">{c.title}</div>
                                  <div className="text-sm text-gray-600">{c.score}</div>
                                </div>
                                {c.text && <div className="mt-1 text-sm text-gray-700">{c.text}</div>}
                              </div>
                            ))
                          ) : (
                            // legacy object shape: render key/value pairs
                            Object.entries(selected.categories).map(([k,v]: any) => (
                              <div key={k} className="p-2 bg-gray-50 rounded">
                                <div className="flex justify-between">
                                  <div className="text-sm font-medium">{k}</div>
                                  <div className="text-sm text-gray-600">{v}</div>
                                </div>
                              </div>
                            ))
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
