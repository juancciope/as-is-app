// React component for TN Ledger scraper dashboard
// Place this in your Vercel app components

import React, { useState } from 'react';

export default function TNLedgerScraperDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noticesDate, setNoticesDate] = useState('');

  const triggerScraper = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const response = await fetch('/api/scrapers/tnledger/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          noticesDate: noticesDate || undefined // Let actor determine date if empty
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger scraper');
      }

      setRunId(data.runId);
      setStatus('RUNNING');
      
      // Start polling for status
      pollStatus(data.runId);
      
    } catch (err) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  const pollStatus = async (runId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scrapers/tnledger/status?runId=${runId}`);
        const data = await response.json();
        
        setStatus(data.status);
        
        if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
          clearInterval(interval);
          setIsRunning(false);
          
          if (data.status === 'SUCCEEDED') {
            alert(`Scraping completed! Found ${data.resultCount} notices.`);
          } else {
            setError('Scraping failed. Check Apify console for details.');
          }
        }
      } catch (err) {
        clearInterval(interval);
        setError('Failed to check status');
        setIsRunning(false);
      }
    }, 5000); // Poll every 5 seconds
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">TN Ledger Foreclosure Scraper</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notice Date (Optional)
        </label>
        <input
          type="text"
          value={noticesDate}
          onChange={(e) => setNoticesDate(e.target.value)}
          placeholder="M/D/YYYY (e.g., 7/4/2025)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={isRunning}
        />
        <p className="mt-1 text-sm text-gray-500">
          Leave empty to automatically use the most recent Friday
        </p>
      </div>

      <button
        onClick={triggerScraper}
        disabled={isRunning}
        className={`w-full py-2 px-4 rounded-md font-medium ${
          isRunning 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? 'Running...' : 'Run Scraper'}
      </button>

      {status && (
        <div className="mt-4 p-3 bg-gray-100 rounded-md">
          <p className="text-sm">
            <span className="font-medium">Status:</span> {status}
          </p>
          {runId && (
            <p className="text-sm mt-1">
              <span className="font-medium">Run ID:</span> {runId}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-medium mb-2">Features:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Automatically determines the correct Friday date</li>
          <li>Extracts auction time and location from notices</li>
          <li>Geocodes property addresses</li>
          <li>Syncs data to Supabase database</li>
        </ul>
      </div>
    </div>
  );
}