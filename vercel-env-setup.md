# Vercel Environment Variables Setup

To fix the white page issue, you need to add these NEXT_PUBLIC_ environment variables to Vercel:

## Required Variables (add these to your Vercel project)

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Value: `https://shyqqjsksxoiawikirju.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoeXFxanNrc3hvaWF3aWtpcmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjE1OTMsImV4cCI6MjA2NzQ5NzU5M30.kDumFJ-NFpy-lY0EMbVFwEDwM6Rg1I1Ti5axi9vK0Ao`

3. **NEXT_PUBLIC_USE_VNEXT_FILTERS**
   - Value: `1`

4. **NEXT_PUBLIC_VNEXT_SCORING_ENABLED**
   - Value: `1`

5. **NEXT_PUBLIC_VNEXT_DEBUG**
   - Value: `0`

## How to Add in Vercel

1. Go to your Vercel project dashboard
2. Click on "Settings"
3. Click on "Environment Variables"
4. Add each variable above with the specified values
5. Set them for all environments (Production, Preview, Development)
6. Redeploy your project

## Why This Fixes the Issue

The error was happening because:
- Client-side components were trying to access server-only environment variables
- Next.js only makes `NEXT_PUBLIC_` prefixed variables available to the browser
- The config was throwing an error when these variables weren't found on the client side

This fix separates client-safe config from server-only config.