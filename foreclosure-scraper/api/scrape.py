import os
import sys
import json
from http.server import BaseHTTPRequestHandler

# Add the scrapers directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scrapers'))

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Import and run the aggregator
            from aggregator import run_unified_pipeline
            
            # Run the scraping pipeline
            result = run_unified_pipeline()
            
            # Return success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': True,
                'message': 'Scraping completed successfully',
                'timestamp': str(result) if result else None
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            # Return error response
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': False,
                'error': 'Failed to run scrapers',
                'details': str(e)
            }
            
            self.wfile.write(json.dumps(response).encode())
    
    def do_GET(self):
        # Return status for GET requests
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            'status': 'ready',
            'availableScrapers': ['clearrecon', 'phillipjoneslaw', 'tnledger', 'wabipowerbi', 'wilson']
        }
        
        self.wfile.write(json.dumps(response).encode())