import os
import sys
import json
import subprocess
from http.server import BaseHTTPRequestHandler

# Add the scrapers directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scrapers'))

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Run the aggregator script directly using subprocess to avoid import issues
            script_path = os.path.join(os.path.dirname(__file__), '..', 'scrapers', 'aggregator.py')
            
            # Execute the Python script
            result = subprocess.run(
                ['python3', script_path],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"Scraper failed with return code {result.returncode}: {result.stderr}")
            
            # Return success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': True,
                'message': 'Scraping completed successfully',
                'output': result.stdout,
                'timestamp': None
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