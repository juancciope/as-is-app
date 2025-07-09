#!/bin/bash

# Deploy script for TN Ledger Actor
echo "Deploying TN Ledger Foreclosure Scraper to Apify..."

# Check if logged in
if ! apify auth --check; then
    echo "Please login to Apify first: apify login"
    exit 1
fi

# Push the actor
echo "Pushing actor to Apify..."
apify push

# Check if push was successful
if [ $? -eq 0 ]; then
    echo "✅ Actor deployed successfully!"
    echo "You can now run the actor from the Apify Console or via API"
else
    echo "❌ Deployment failed"
    exit 1
fi