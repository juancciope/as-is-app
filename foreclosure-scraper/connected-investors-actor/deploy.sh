#!/bin/bash

# Deploy Connected Investors Actor to Apify
# Make sure you have APIFY_TOKEN environment variable set

echo "Deploying Connected Investors Actor to Apify..."

# Check if APIFY_TOKEN is set
if [ -z "$APIFY_TOKEN" ]; then
    echo "Error: APIFY_TOKEN environment variable is not set"
    echo "Please set it with: export APIFY_TOKEN=your_token_here"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Deploy to Apify
echo "Deploying to Apify..."
npx apify push

echo "Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Go to https://console.apify.com/actors"
echo "2. Find your 'connected-investors-scraper' actor"
echo "3. Test it with sample input"
echo "4. Copy the actor ID and add it to your .env.local file as APIFY_ACTOR_ID_CONNECTEDINVESTORS"