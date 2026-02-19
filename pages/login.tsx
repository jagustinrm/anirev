import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function signUp() {
    setMessage('Creating account...')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(String(error))
    else setMessage('Check your email for confirmation (or you are signed up).')
  }

  async function signIn() {
    setMessage('Signing in...')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(String(error))
    else {
      setMessage('Signed in')
      router.push('/')
    }
  }

  async function signInWithGoogle() {
    setMessage('Redirecting to Google...')
    // This uses Supabase OAuth flow. Configure Google provider in your Supabase project settings first.
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setMessage(String(error))
    // Supabase handles the redirect to Google; user will return via callback
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold mb-4">anirev — Login / Sign up</h2>

        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input className="mt-1 mb-3 w-full border px-3 py-2 rounded" value={email} onChange={e=>setEmail(e.target.value)} />

        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input type="password" className="mt-1 mb-3 w-full border px-3 py-2 rounded" value={password} onChange={e=>setPassword(e.target.value)} />

        <div className="flex gap-2">
          <button onClick={signIn} className="bg-blue-600 text-white px-4 py-2 rounded">Sign in</button>
          <button onClick={signUp} className="bg-green-600 text-white px-4 py-2 rounded">Sign up</button>
        </div>

        <div className="mt-4">
          <button onClick={signInWithGoogle} className="w-full bg-white border px-4 py-2 rounded flex items-center justify-center gap-2">
            <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
            <span>Sign in with Google</span>
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  )
}
