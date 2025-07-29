'use client'

import { useState } from 'react'

export default function GHLSetupPage() {
  const [clientId, setClientId] = useState('')

  const initiateOAuth = () => {
    if (!clientId) {
      alert('Please enter your GHL Client ID first')
      return
    }

    const redirectUri = `${window.location.origin}/oauth/callback`
    const scope = 'conversations/message.readonly conversations/message.write conversations.readonly conversations.write'
    
    const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?` + 
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `scope=${encodeURIComponent(scope)}`

    // Open in popup window
    const popup = window.open(
      authUrl,
      'ghl-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    )

    // Check if popup was closed
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed)
        // Refresh the page to see if tokens were set
        window.location.reload()
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Go High Level OAuth Setup</h1>
          
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h2 className="font-semibold text-blue-800 mb-2">Step 1: Create OAuth App</h2>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Go to <a href="https://marketplace.gohighlevel.com/" target="_blank" rel="noopener" className="underline">GHL Marketplace</a></li>
                <li>2. Sign up for developer account if needed</li>
                <li>3. Create new app with these scopes: <code className="bg-blue-100 px-1 rounded">conversations/message.readonly conversations/message.write conversations.readonly conversations.write</code></li>
                <li>4. Copy your Client ID and Client Secret</li>
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <h2 className="font-semibold text-yellow-800 mb-2">Step 2: Set Redirect URL</h2>
              <p className="text-sm text-yellow-700 mb-2">In your GHL app settings, add this redirect URL:</p>
              <code className="block bg-yellow-100 p-2 rounded text-sm">
                {typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : 'https://your-domain.com/oauth/callback'}
              </code>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h2 className="font-semibold text-green-800 mb-2">Step 3: Add Client Credentials to Vercel</h2>
              <p className="text-sm text-green-700 mb-2">Add these to your Vercel environment variables:</p>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• <code>GHL_CLIENT_ID</code> - Your OAuth app client ID</li>
                <li>• <code>GHL_CLIENT_SECRET</code> - Your OAuth app client secret</li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded p-4">
              <h2 className="font-semibold text-purple-800 mb-4">Step 4: Get Access Tokens</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GHL Client ID:
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter your GHL OAuth app client ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={initiateOAuth}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Start OAuth Authorization
              </button>
              
              <p className="text-xs text-purple-600 mt-2">
                This will open a popup where you can authorize the app and get your access tokens.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded p-4">
              <h2 className="font-semibold text-gray-800 mb-2">Step 5: Test Integration</h2>
              <p className="text-sm text-gray-700 mb-2">After setting up tokens:</p>
              <div className="space-y-2">
                <a
                  href="/api/ghl/oauth-test"
                  target="_blank"
                  className="block w-full text-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Test OAuth Setup
                </a>
                <a
                  href="/leads"
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View Leads Page
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}