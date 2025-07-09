// API Integration for Connected Investors Enricher
// Add this to your existing /api/scrape-apify/route.ts file

import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

// Add this function to your existing route.ts
export async function runEnrichment(source = 'all') {
    try {
        console.log(`Starting enrichment process for source: ${source}`);
        
        const enricherActorId = process.env.APIFY_ACTOR_ID_ENRICHER; // Add this to your .env
        
        if (!enricherActorId) {
            throw new Error('APIFY_ACTOR_ID_ENRICHER not configured');
        }
        
        const input = {
            username: process.env.CONNECTED_INVESTORS_USERNAME,
            password: process.env.CONNECTED_INVESTORS_PASSWORD,
            batchSize: 15,
            maxRetries: 3,
            skipAlreadyEnriched: true
        };
        
        const run = await apifyClient.actor(enricherActorId).call(input);
        
        console.log(`Enrichment started. Run ID: ${run.id}`);
        
        // Wait for completion (optional)
        const finishedRun = await apifyClient.run(run.id).waitForFinish();
        
        console.log(`Enrichment completed. Status: ${finishedRun.status}`);
        
        if (finishedRun.status === 'SUCCEEDED') {
            return {
                success: true,
                runId: run.id,
                status: finishedRun.status,
                message: 'Enrichment completed successfully'
            };
        } else {
            return {
                success: false,
                runId: run.id,
                status: finishedRun.status,
                message: 'Enrichment failed or was aborted'
            };
        }
        
    } catch (error) {
        console.error('Error running enrichment:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Add this to your existing route handler
export async function POST(request: Request) {
    try {
        const { source } = await request.json();
        
        // Your existing scraping logic here...
        
        // After all scrapers complete, run enrichment
        if (source === 'all' || source === 'enrich') {
            console.log('Running enrichment after scrapers...');
            
            // Small delay to ensure all data is saved
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const enrichmentResult = await runEnrichment(source);
            
            return NextResponse.json({
                success: true,
                message: 'Scraping and enrichment completed',
                enrichment: enrichmentResult
            });
        }
        
        return NextResponse.json({
            success: true,
            message: 'Scraping completed'
        });
        
    } catch (error) {
        console.error('Error in scrape-apify route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Environment variables to add to your .env.local:
/*
APIFY_ACTOR_ID_ENRICHER=your_enricher_actor_id
CONNECTED_INVESTORS_USERNAME=your_username
CONNECTED_INVESTORS_PASSWORD=your_password
*/