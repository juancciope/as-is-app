#!/bin/bash

# Connected Investors Enricher Deployment Script

echo "🚀 Deploying Connected Investors Enricher to Apify..."

# Check if apify CLI is installed
if ! command -v apify &> /dev/null; then
    echo "❌ Apify CLI not found. Please install it first:"
    echo "npm install -g apify-cli"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "main.js" ]; then
    echo "❌ main.js not found. Please run this script from the enricher directory."
    exit 1
fi

# Check environment variables
if [ -z "$APIFY_TOKEN" ]; then
    echo "❌ APIFY_TOKEN environment variable not set"
    echo "Please set your Apify token:"
    echo "export APIFY_TOKEN=your_apify_token_here"
    exit 1
fi

# Build and deploy
echo "📦 Building actor..."
apify push

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to your Apify Console"
    echo "2. Find the 'Connected Investors Property Enricher' actor"
    echo "3. Set up environment variables:"
    echo "   - SUPABASE_URL=https://your-project.supabase.co"
    echo "   - SUPABASE_SERVICE_KEY=your_service_role_key"
    echo "4. Run the actor with your Connected Investors credentials"
    echo ""
    echo "🔗 Integration options:"
    echo "- Manual: Run from Apify Console"
    echo "- Scheduled: Set up daily runs after scrapers complete"
    echo "- API: Call via Apify API in your pipeline"
else
    echo "❌ Deployment failed!"
    exit 1
fi