import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from '../../lib/axiosClient'

export default function AnimeDetail() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    axios.get(`/api/anime/${id}`)
      .then(r => setData(r.data?.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">No data</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex gap-6">
        <img src={data.coverImage?.large || data.coverImage?.medium} className="w-48 h-64 object-cover rounded" />
        <div>
          <h1 className="text-2xl font-bold">{data.title?.romaji || data.title?.english}</h1>
          <div className="text-sm text-gray-600">{data.episodes ? `${data.episodes} eps` : '—'} • {data.seasonYear}</div>
          <div className="mt-4 text-gray-800" dangerouslySetInnerHTML={{ __html: data.description || '' }} />
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Characters</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          {data.characters?.edges?.map((e: any) => (
            <div key={e.node.id} className="p-2 bg-white rounded shadow text-sm">{e.node.name.full}</div>
          ))}
        </div>
      </section>
    </div>
  )
}
