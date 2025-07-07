import os
from supabase import create_client, Client
from typing import List, Dict, Any
import logging

class SupabaseClient:
    def __init__(self):
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and Service Role Key must be provided in environment variables")
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        self.table_name = 'foreclosure_data'
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def clear_existing_data(self) -> bool:
        """Clear all existing data from the foreclosure_data table"""
        try:
            result = self.client.table(self.table_name).delete().neq('id', 0).execute()
            self.logger.info(f"Cleared existing data from {self.table_name}")
            return True
        except Exception as e:
            self.logger.error(f"Error clearing existing data: {str(e)}")
            return False
    
    def insert_foreclosure_data(self, df: pd.DataFrame) -> bool:
        """Insert foreclosure data from DataFrame into Supabase"""
        try:
            # Convert DataFrame to list of dictionaries
            records = []
            for _, row in df.iterrows():
                record = {
                    'source': str(row['SOURCE']),
                    'date': str(row['DATE']),
                    'time': str(row['TIME']) if pd.notna(row['TIME']) else None,
                    'pl': str(row['PL']),
                    'firm': str(row['FIRM']),
                    'address': str(row['ADDRESS']),
                    'city': str(row['CTY']),
                    'within_30min': str(row['WITHIN_30MIN']),
                    'closest_city': str(row['CLOSEST_CITY']) if pd.notna(row['CLOSEST_CITY']) else None,
                    'distance_miles': float(row['DISTANCE_MILES']) if pd.notna(row['DISTANCE_MILES']) else None,
                    'est_drive_time': str(row['EST_DRIVE_TIME']) if pd.notna(row['EST_DRIVE_TIME']) else None,
                    'geocode_method': str(row['GEOCODE_METHOD']) if pd.notna(row['GEOCODE_METHOD']) else None
                }
                records.append(record)
            
            # Insert in batches to avoid payload size limits
            batch_size = 100
            total_records = len(records)
            
            for i in range(0, total_records, batch_size):
                batch = records[i:i + batch_size]
                result = self.client.table(self.table_name).insert(batch).execute()
                
                if hasattr(result, 'data') and result.data:
                    self.logger.info(f"Inserted batch {i//batch_size + 1}: {len(batch)} records")
                else:
                    self.logger.warning(f"Batch {i//batch_size + 1} may have failed")
            
            self.logger.info(f"Successfully inserted {total_records} records into {self.table_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error inserting data: {str(e)}")
            return False
    
    def get_data_count(self) -> int:
        """Get the total count of records in the foreclosure_data table"""
        try:
            result = self.client.table(self.table_name).select('id', count='exact').execute()
            return result.count if hasattr(result, 'count') else 0
        except Exception as e:
            self.logger.error(f"Error getting data count: {str(e)}")
            return 0
    
    def test_connection(self) -> bool:
        """Test the connection to Supabase"""
        try:
            # Try to select from the table
            result = self.client.table(self.table_name).select('id').limit(1).execute()
            self.logger.info("Successfully connected to Supabase")
            return True
        except Exception as e:
            self.logger.error(f"Error connecting to Supabase: {str(e)}")
            return False