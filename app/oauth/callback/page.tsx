'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function OAuthCallbackContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [tokens, setTokens] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setError(`OAuth error: ${errorParam}`)
      return
    }

    if (!code) {
      setStatus('error')
      setError('No authorization code received')
      return
    }

    // Exchange code for tokens
    exchangeCodeForTokens(code)
  }, [searchParams])

  const exchangeCodeForTokens = async (code: string) => {
    try {
      const response = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange code for tokens')
      }

      setTokens(data)
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Completing authorization...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-4">Authorization Failed</h1>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-2xl mx-auto bg-green-50 border border-green-200 rounded-lg p-6">
        <h1 className="text-xl font-bold text-green-800 mb-4">✅ Authorization Successful!</h1>
        
        <div className="bg-white border rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">Add these to your Vercel Environment Variables:</h2>
          <div className="space-y-2 font-mono text-sm">
            <div><strong>GHL_API_KEY:</strong> {tokens.access_token}</div>
            <div><strong>GHL_REFRESH_TOKEN:</strong> {tokens.refresh_token}</div>
            <div><strong>GHL_LOCATION_ID:</strong> {tokens.locationId}</div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Copy these tokens to your Vercel environment variables, 
            then redeploy your app. The access token expires in 24 hours, but the refresh 
            token will automatically get you a new one.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => navigator.clipboard.writeText(tokens.access_token)}
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Copy Access Token
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(tokens.refresh_token)}
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Copy Refresh Token
          </button>
          <button
            onClick={() => window.close()}
            className="block w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GHLOAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  )
}