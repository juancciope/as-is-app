import subprocess
import sys
import os
import pandas as pd
import re
from datetime import datetime
import logging
import requests
import time
from math import radians, cos, sin, asin, sqrt

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

print("🏠 UNIFIED FORECLOSURE DATA PIPELINE - PRODUCTION VERSION")
print("=" * 60)

# Step 1: Run all scraper scripts
def run_scrapers():
    """Run all your existing scraper scripts"""
    scripts = [
        'clearrecon.py',
        'phillipjoneslaw.py', 
        'tnledger.py',
        'wabipowerbi.py',
        'wilson.py'
    ]
    
    print("🤖 Running all scraper scripts...")
    
    for script in scripts:
        if os.path.exists(script):
            try:
                print(f"   Running {script}...")
                result = subprocess.run([sys.executable, script], 
                                      capture_output=True, text=True, timeout=300)
                if result.returncode == 0:
                    print(f"   ✅ {script} completed successfully")
                else:
                    print(f"   ⚠️ {script} completed with warnings")
            except subprocess.TimeoutExpired:
                print(f"   ⏰ {script} timed out after 5 minutes")
            except Exception as e:
                print(f"   ❌ Error running {script}: {e}")
        else:
            print(f"   📁 {script} not found, skipping...")

# Step 2: Distance calculation utilities
class LocationProcessor:
    # Reference locations (Nashville and Mt. Juliet coordinates)
    REFERENCE_LOCATIONS = {
        'Nashville': (36.1627, -86.7816),
        'Mt_Juliet': (36.2009, -86.5186)
    }
    
    # Tennessee cities and their approximate coordinates for fallback
    TN_CITY_COORDINATES = {
        'nashville': (36.1627, -86.7816),
        'mt juliet': (36.2009, -86.5186),
        'mount juliet': (36.2009, -86.5186),
        'antioch': (36.0632, -86.6652),
        'hermitage': (36.1534, -86.5986),
        'murfreesboro': (35.8456, -86.3903),
        'franklin': (35.9251, -86.8689),
        'brentwood': (36.0331, -86.7828),
        'gallatin': (36.3889, -86.4467),
        'hendersonville': (36.3048, -86.6200),
        'smyrna': (35.9828, -86.5186),
        'lebanon': (36.2081, -86.2911),
        'la vergne': (36.0156, -86.5819),
        'goodlettsville': (36.3231, -86.7133),
        'madison': (36.2587, -86.7483),
        'old hickory': (36.2267, -86.6289),
        'bellevue': (36.0706, -87.0069),
        'donelson': (36.1700, -86.6900),
        'joelton': (36.3217, -86.8947),
        'whites creek': (36.2945, -86.7878),
        'forest hills': (36.0689, -86.8244),
        'berry hill': (36.1292, -86.7644),
        'oak hill': (36.1023, -86.8425),
        'spring hill': (35.7512, -86.9300),
        'nolensville': (35.9523, -86.8694),
        'thompson station': (35.8245, -86.9080),
        'columbia': (35.6151, -87.0353),
        'dickson': (36.0770, -87.3878),
        'clarksville': (36.5298, -87.3595),
        'cookeville': (36.1628, -85.5016),
        'crossville': (35.9487, -85.0269),
        'sparta': (36.0742, -85.4669),
        'shelbyville': (35.4834, -86.4603),
        'manchester': (35.4817, -86.0886),
        'tullahoma': (35.3620, -86.2094),
        'mcminnville': (35.6834, -85.7697),
        'livingston': (36.3831, -85.3230),
        'carthage': (36.2509, -85.9519),
        'lafayette': (36.5209, -86.0264),
        'woodbury': (35.8270, -86.0711)
    }
    
    # Nashville area ZIP codes with coordinates
    ZIP_COORDINATES = {
        '37013': (36.0632, -86.6652),  # Antioch
        '37027': (36.2009, -86.5186),  # Mt. Juliet
        '37115': (36.1534, -86.5986),  # Hermitage
        '37129': (35.9828, -86.5186),  # Smyrna
        '37130': (35.8456, -86.3903),  # Murfreesboro
        '37201': (36.1627, -86.7816),  # Nashville Downtown
        '37203': (36.1627, -86.7816),  # Nashville
        '37204': (36.1300, -86.7900),  # Nashville
        '37205': (36.0900, -86.8200),  # Nashville/Belle Meade
        '37206': (36.1800, -86.7200),  # Nashville East
        '37207': (36.1900, -86.7600),  # Nashville North
        '37208': (36.1700, -86.8000),  # Nashville West
        '37209': (36.1500, -86.8100),  # Nashville/Sylvan Park
        '37210': (36.1200, -86.7700),  # Nashville South
        '37211': (36.1000, -86.7400),  # Nashville/Oak Hill
        '37212': (36.1400, -86.8000),  # Nashville/West End
        '37213': (36.1100, -86.6800),  # Nashville/Antioch
        '37214': (36.2000, -86.6900),  # Nashville/Donelson
        '37215': (36.1200, -86.8000),  # Nashville/Green Hills
        '37216': (36.2200, -86.6700),  # Nashville/Hermitage
        '37217': (36.0900, -86.7000),  # Nashville/Una
        '37218': (36.2000, -86.7500),  # Nashville/Madison
        '37219': (36.1600, -86.7800),  # Nashville/West End
        '37220': (36.1100, -86.6500),  # Nashville/Percy Priest
        '37221': (36.0700, -87.0100),  # Nashville/Bellevue
        '37228': (36.1800, -86.7400),  # Nashville/Bordeaux
        '37076': (36.3048, -86.6200),  # Hendersonville
        '37122': (35.9251, -86.8689),  # Franklin
        '37135': (36.2081, -86.2911),  # Lebanon
    }
    
    @staticmethod
    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in miles"""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 3956  # Radius of earth in miles
        return c * r
    
    @staticmethod
    def clean_address_for_geocoding(address):
        """Clean and standardize address format"""
        if not address:
            return ""
        
        address = str(address)
        address = re.sub(r'\s+', ' ', address).strip()
        
        # Fix common abbreviations
        replacements = {
            ' Aly': ' Alley', ' Ave': ' Avenue', ' Blvd': ' Boulevard',
            ' Cir': ' Circle', ' Ct': ' Court', ' Dr': ' Drive',
            ' Ln': ' Lane', ' Pkwy': ' Parkway', ' Pl': ' Place',
            ' Rd': ' Road', ' St': ' Street', ' Trl': ' Trail'
        }
        
        for abbrev, full in replacements.items():
            address = re.sub(f'{abbrev}\\b', full, address, flags=re.IGNORECASE)
        
        return address
    
    @staticmethod
    def geocode_with_nominatim(address, city="", state="TN"):
        """Primary geocoding with Nominatim"""
        try:
            cleaned_address = LocationProcessor.clean_address_for_geocoding(address)
            full_address = f"{cleaned_address}, {city}, {state}, USA".replace(", ,", ",")
            
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': full_address,
                'format': 'json',
                'addressdetails': 1,
                'limit': 3,
                'countrycodes': 'us'
            }
            headers = {'User-Agent': 'RealEstateForeclosurePipeline/1.0'}
            
            response = requests.get(url, params=params, headers=headers, timeout=15)
            data = response.json()
            
            if data and len(data) > 0:
                # Filter for Tennessee results
                for result in data:
                    address_parts = result.get('address', {})
                    display_name = result.get('display_name', '').lower()
                    
                    if (address_parts.get('state', '').lower() in ['tennessee', 'tn'] or 
                        'tennessee' in display_name or ', tn,' in display_name):
                        lat = float(result['lat'])
                        lon = float(result['lon'])
                        return lat, lon
                
                # Use first result if in Tennessee area
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                if 35.0 <= lat <= 36.7 and -90.0 <= lon <= -81.0:
                    return lat, lon
            
        except Exception as e:
            logger.debug(f"Nominatim geocoding failed for {address}: {e}")
        
        return None, None
    
    @staticmethod
    def geocode_city_fallback(city, state="TN"):
        """Fallback: Use predefined city coordinates"""
        if not city:
            return None, None
        
        city_clean = city.lower().strip()
        
        if city_clean in LocationProcessor.TN_CITY_COORDINATES:
            return LocationProcessor.TN_CITY_COORDINATES[city_clean]
        
        # Try geocoding just the city
        try:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'city': city,
                'state': state,
                'country': 'USA',
                'format': 'json',
                'limit': 1
            }
            headers = {'User-Agent': 'RealEstateForeclosurePipeline/1.0'}
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            data = response.json()
            
            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                return lat, lon
                
        except Exception as e:
            logger.debug(f"City fallback geocoding failed for {city}: {e}")
        
        return None, None
    
    @staticmethod
    def estimate_by_zip_code(address):
        """Extract ZIP code and return coordinates"""
        zip_match = re.search(r'\b(\d{5})\b', str(address))
        if not zip_match:
            return None, None
        
        zip_code = zip_match.group(1)
        return LocationProcessor.ZIP_COORDINATES.get(zip_code, (None, None))
    
    @staticmethod
    def estimate_drive_time_minutes(distance_miles):
        """Estimate drive time based on distance"""
        if distance_miles is None:
            return None
        
        if distance_miles <= 5:
            avg_speed = 25  # City driving
        elif distance_miles <= 15:
            avg_speed = 35  # Suburban
        elif distance_miles <= 30:
            avg_speed = 45  # Mixed
        else:
            avg_speed = 55  # Highway
        
        return (distance_miles / avg_speed) * 60
    
    @staticmethod
    def check_proximity_to_targets(lat, lon, max_drive_time_minutes=30):
        """Check if coordinates are within drive time"""
        if lat is None or lon is None:
            return {
                'WITHIN_30MIN': 'Unknown',
                'CLOSEST_CITY': 'Unknown',
                'DISTANCE_MILES': None,
                'EST_DRIVE_TIME': None
            }
        
        min_distance = float('inf')
        closest_city = None
        closest_drive_time = None
        
        for city_name, (ref_lat, ref_lon) in LocationProcessor.REFERENCE_LOCATIONS.items():
            distance = LocationProcessor.haversine_distance(lat, lon, ref_lat, ref_lon)
            est_drive_time = LocationProcessor.estimate_drive_time_minutes(distance)
            
            if distance < min_distance:
                min_distance = distance
                closest_city = city_name.replace('_', ' ')
                closest_drive_time = est_drive_time
        
        within_threshold = 'Yes' if closest_drive_time <= max_drive_time_minutes else 'No'
        
        return {
            'WITHIN_30MIN': within_threshold,
            'CLOSEST_CITY': closest_city,
            'DISTANCE_MILES': round(min_distance, 1) if min_distance != float('inf') else None,
            'EST_DRIVE_TIME': round(closest_drive_time, 0) if closest_drive_time else None
        }

# Step 3: Address and data parsing utilities
class AddressParser:
    @staticmethod
    def extract_city_from_address(address):
        if not address or pd.isna(address):
            return ""
        
        address = str(address)
        patterns = [
            r',\s*([A-Za-z\s]+)\s+TN\s*,?\s*\d{5}',
            r',\s*([A-Za-z\s]+)\s*,\s*TN',
            r',\s*([A-Za-z\s]+)\s+Tennessee',
            r'\b([A-Za-z\s]+),\s*Tennessee\s*\d{5}',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, address, re.IGNORECASE)
            if match:
                city = match.group(1).strip()
                city = re.sub(r'\s+(TN|Tennessee)$', '', city, flags=re.IGNORECASE)
                return city.title()
        return ""
    
    @staticmethod
    def get_county_first_letter(county):
        if not county or pd.isna(county):
            return ""
        county = str(county).strip()
        return county[0].upper() if county else ""
    
    @staticmethod
    def standardize_date(date_str):
        if not date_str or pd.isna(date_str):
            return ""
        
        try:
            dt = pd.to_datetime(date_str, errors='coerce')
            if pd.notna(dt):
                return dt.strftime('%m/%d/%Y')
        except:
            pass
        return str(date_str)
    
    @staticmethod
    def standardize_time(time_str):
        if not time_str or pd.isna(time_str):
            return ""
        
        time_str = str(time_str).strip()
        time_formats = ['%I:%M %p', '%H:%M', '%I:%M:%S %p', '%H:%M:%S']
        
        for fmt in time_formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                return dt.strftime('%I:%M %p')
            except ValueError:
                continue
        return time_str

# Step 4: Data standardization functions
def standardize_clearrecon(df):
    if df.empty:
        return pd.DataFrame(columns=['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'])
    
    result = pd.DataFrame()
    result['SOURCE'] = df['SourceWebsite']
    result['DATE'] = df['SaleDate'].apply(AddressParser.standardize_date)
    result['TIME'] = ""
    result['ADDRESS'] = df['PropertyAddress']
    result['CTY'] = df['PropertyAddress'].apply(AddressParser.extract_city_from_address)
    result['FIRM'] = "ClearRecon"
    
    # Extract county from address for PL
    county_from_address = df['PropertyAddress'].apply(lambda x: re.search(r'(\w+)\s+County', str(x), re.IGNORECASE))
    result['PL'] = county_from_address.apply(lambda x: x.group(1)[0].upper() if x else "")
    
    return result

def standardize_phillipjones(df):
    if df.empty:
        return pd.DataFrame(columns=['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'])
    
    result = pd.DataFrame()
    result['SOURCE'] = df['SourceWebsite']
    result['DATE'] = df['SaleDate'].apply(AddressParser.standardize_date)
    result['TIME'] = df['SaleTime'].apply(AddressParser.standardize_time)
    result['ADDRESS'] = df['PropertyAddress']
    result['CTY'] = df['PropertyAddress'].apply(AddressParser.extract_city_from_address)
    result['FIRM'] = "Phillip Jones Law"
    result['PL'] = df['County'].apply(AddressParser.get_county_first_letter)
    
    return result

def standardize_tnledger(df):
    if df.empty:
        return pd.DataFrame(columns=['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'])
    
    result = pd.DataFrame()
    result['SOURCE'] = df.get('details_url', 'tnledger.com')
    
    # Use detailed date if available, otherwise list date
    date_field = df['advertised_auction_date_detail'].fillna(df['advertised_auction_date_list'])
    result['DATE'] = date_field.apply(AddressParser.standardize_date)
    
    # Extract time from sale details text
    def extract_time(row):
        sale_text = row.get('sale_details_text', '')
        if not sale_text or pd.isna(sale_text):
            return ""
        
        time_match = re.search(r'(\d{1,2}:\d{2}\s*[AP]M)', str(sale_text), re.IGNORECASE)
        return AddressParser.standardize_time(time_match.group(1)) if time_match else ""
    
    result['TIME'] = df.apply(extract_time, axis=1)
    
    # Use detailed address if available
    address_field = df['address_detail'].fillna(df['property_address_list'])
    result['ADDRESS'] = address_field
    result['CTY'] = address_field.apply(AddressParser.extract_city_from_address)
    
    # Extract firm from attorney or substitute_trustee
    def extract_firm(row):
        attorney = row.get('attorney', '')
        substitute_trustee = row.get('substitute_trustee', '')
        
        if substitute_trustee and substitute_trustee not in ["Not found", "", None]:
            return str(substitute_trustee)
        elif attorney and attorney not in ["Not found", "", None]:
            return str(attorney)
        else:
            return "TN Ledger"
    
    result['FIRM'] = df.apply(extract_firm, axis=1)
    
    # Extract county from address or sale details
    def extract_county_pl(row):
        address = row.get('address_detail', row.get('property_address_list', ''))
        sale_text = row.get('sale_details_text', '')
        
        # Try address first
        county_match = re.search(r'(\w+)\s+County', str(address), re.IGNORECASE)
        if county_match:
            return county_match.group(1)[0].upper()
        
        # Try sale details
        county_match = re.search(r'(\w+)\s+County,?\s+Tennessee', str(sale_text), re.IGNORECASE)
        if county_match:
            return county_match.group(1)[0].upper()
        
        return ""
    
    result['PL'] = df.apply(extract_county_pl, axis=1)
    
    return result

def standardize_powerbi(df):
    if df.empty:
        return pd.DataFrame(columns=['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'])
    
    result = pd.DataFrame()
    result['SOURCE'] = df['SourceWebsite']
    result['DATE'] = df['SALE_DATE'].apply(AddressParser.standardize_date)
    result['TIME'] = df['SALE_TIME'].apply(AddressParser.standardize_time)
    result['ADDRESS'] = df['FULL_ADDRESS']
    result['CTY'] = df['FULL_ADDRESS'].apply(AddressParser.extract_city_from_address)
    result['FIRM'] = "Logs.com"
    result['PL'] = df['COUNTY_NAME'].apply(AddressParser.get_county_first_letter)
    
    return result

def standardize_wilson(df):
    if df.empty:
        return pd.DataFrame(columns=['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'])
    
    result = pd.DataFrame()
    result['SOURCE'] = df['SourceWebsite']
    result['DATE'] = df['SaleDate'].apply(AddressParser.standardize_date)
    result['TIME'] = df['SaleTime'].apply(AddressParser.standardize_time)
    result['ADDRESS'] = df['PropertyAddress']
    result['CTY'] = df.get('City', '')
    result['FIRM'] = df.get('Auctioneer', 'Wilson Associates')
    result['PL'] = df['County'].apply(AddressParser.get_county_first_letter)
    
    return result

# Step 5: Location processing function
def add_location_flags(df, max_drive_time=30):
    """Add location-based flags with robust geocoding"""
    print(f"\n📍 Adding location flags (within {max_drive_time} min of Nashville/Mt. Juliet)...")
    print("   Using 5 geocoding strategies for maximum accuracy...")
    
    # Initialize new columns
    df['WITHIN_30MIN'] = 'Unknown'
    df['CLOSEST_CITY'] = 'Unknown'
    df['DISTANCE_MILES'] = None
    df['EST_DRIVE_TIME'] = None
    df['GEOCODE_METHOD'] = 'Failed'
    
    total_records = len(df)
    processed = 0
    successful_geocodes = 0
    geocode_methods = {
        'full_address': 0, 'street_only': 0, 'zip_code': 0,
        'city_fallback': 0, 'extracted_city': 0, 'failed': 0
    }
    
    for idx, row in df.iterrows():
        try:
            address = row['ADDRESS']
            city = row['CTY']
            
            if pd.isna(address) or address == "":
                processed += 1
                geocode_methods['failed'] += 1
                continue
            
            original_address = str(address)
            method_used = 'failed'
            lat = None
            lon = None
            
            # Strategy 1: Full address geocoding
            lat, lon = LocationProcessor.geocode_with_nominatim(address, city, "TN")
            if lat is not None and lon is not None:
                method_used = 'full_address'
            else:
                # Strategy 2: Street only (remove TN/Tennessee)
                street_only = re.sub(r',\s*.*?(TN|Tennessee).*$', '', original_address, flags=re.IGNORECASE)
                if street_only != original_address:
                    lat, lon = LocationProcessor.geocode_with_nominatim(street_only, city, "TN")
                    if lat is not None and lon is not None:
                        method_used = 'street_only'
                
                if lat is None or lon is None:
                    # Strategy 3: ZIP code lookup
                    lat, lon = LocationProcessor.estimate_by_zip_code(address)
                    if lat is not None and lon is not None:
                        method_used = 'zip_code'
                
                if lat is None or lon is None:
                    # Strategy 4: City fallback
                    lat, lon = LocationProcessor.geocode_city_fallback(city, "TN")
                    if lat is not None and lon is not None:
                        method_used = 'city_fallback'
                
                if lat is None or lon is None:
                    # Strategy 5: Extract city from address
                    extracted_city = AddressParser.extract_city_from_address(address)
                    if extracted_city and extracted_city != city:
                        lat, lon = LocationProcessor.geocode_city_fallback(extracted_city, "TN")
                        if lat is not None and lon is not None:
                            method_used = 'extracted_city'
            
            geocode_methods[method_used] += 1
            
            if lat is not None and lon is not None:
                proximity_data = LocationProcessor.check_proximity_to_targets(lat, lon, max_drive_time)
                
                df.loc[idx, 'WITHIN_30MIN'] = proximity_data['WITHIN_30MIN']
                df.loc[idx, 'CLOSEST_CITY'] = proximity_data['CLOSEST_CITY']
                df.loc[idx, 'DISTANCE_MILES'] = proximity_data['DISTANCE_MILES']
                df.loc[idx, 'EST_DRIVE_TIME'] = proximity_data['EST_DRIVE_TIME']
                df.loc[idx, 'GEOCODE_METHOD'] = method_used
                
                successful_geocodes += 1
            
            processed += 1
            
            if processed % 5 == 0:
                success_rate = (successful_geocodes / processed) * 100
                print(f"   Processed {processed}/{total_records} addresses... Success rate: {success_rate:.1f}%")
            
            time.sleep(0.3)  # Rate limiting
            
        except Exception as e:
            logger.debug(f"Error processing location for {address}: {e}")
            processed += 1
            geocode_methods['failed'] += 1
    
    print(f"   ✅ Location processing complete!")
    print(f"   📊 Successfully geocoded: {successful_geocodes}/{total_records} addresses ({(successful_geocodes/total_records)*100:.1f}%)")
    
    # Show method breakdown
    print(f"   🔍 Geocoding methods used:")
    for method, count in geocode_methods.items():
        if count > 0:
            percentage = (count / total_records) * 100
            print(f"      {method.replace('_', ' ').title()}: {count} ({percentage:.1f}%)")
    
    # Summary of flagged properties
    within_30min_count = (df['WITHIN_30MIN'] == 'Yes').sum()
    print(f"   🎯 Properties within {max_drive_time} minutes: {within_30min_count}")
    
    if within_30min_count > 0:
        print(f"   📋 Breakdown by closest city:")
        closest_city_counts = df[df['WITHIN_30MIN'] == 'Yes']['CLOSEST_CITY'].value_counts()
        for city, count in closest_city_counts.items():
            avg_distance = df[(df['WITHIN_30MIN'] == 'Yes') & (df['CLOSEST_CITY'] == city)]['DISTANCE_MILES'].mean()
            avg_time = df[(df['WITHIN_30MIN'] == 'Yes') & (df['CLOSEST_CITY'] == city)]['EST_DRIVE_TIME'].mean()
            print(f"      {city}: {count} properties (avg: {avg_distance:.1f} mi, {avg_time:.0f} min)")
    
    # Show successful geocoding examples
    successful_samples = df[df['GEOCODE_METHOD'] != 'failed'].head(3)
    if not successful_samples.empty:
        print(f"\n   📋 Sample successful geocodes:")
        for _, row in successful_samples.iterrows():
            print(f"      {row['ADDRESS'][:50]}... -> {row['CLOSEST_CITY']} ({row['DISTANCE_MILES']} mi, {row['GEOCODE_METHOD']})")
    
    return df

# Step 6: Main pipeline execution
def run_unified_pipeline():
    """Run the complete unified pipeline"""
    
    # Run all scrapers first
    run_scrapers()
    
    print("\n📊 Loading and processing data...")
    
    # File mapping
    source_files = {
        'clearrecon': 'clearrecon_tn_foreclosures.csv',
        'phillipjones': 'phillipjoneslaw_foreclosures.csv',
        'tnledger': 'foreclosure_notices_tnledger_detailed.csv',
        'powerbi': 'logs_com_powerbi_data.csv',
        'wilson': 'wilson_assoc_foreclosures.csv'
    }
    
    # Load and standardize each source
    all_standardized = []
    
    for source_name, filename in source_files.items():
        if os.path.exists(filename):
            try:
                df = pd.read_csv(filename)
                print(f"   📁 Loaded {filename}: {len(df)} records")
                
                # Standardize based on source
                if source_name == 'clearrecon':
                    std_df = standardize_clearrecon(df)
                elif source_name == 'phillipjones':
                    std_df = standardize_phillipjones(df)
                elif source_name == 'tnledger':
                    std_df = standardize_tnledger(df)
                elif source_name == 'powerbi':
                    std_df = standardize_powerbi(df)
                elif source_name == 'wilson':
                    std_df = standardize_wilson(df)
                
                if not std_df.empty:
                    all_standardized.append(std_df)
                    print(f"   ✅ Standardized {source_name}: {len(std_df)} records")
                
            except Exception as e:
                print(f"   ❌ Error processing {filename}: {e}")
        else:
            print(f"   📁 {filename} not found, skipping...")
    
    # Combine all data
    if all_standardized:
        print(f"\n🔄 Combining data from {len(all_standardized)} sources...")
        combined_df = pd.concat(all_standardized, ignore_index=True, sort=False)
        
        # Clean and deduplicate
        print("🧹 Cleaning and deduplicating...")
        combined_df = combined_df.dropna(how='all')
        
        # Remove duplicates based on address and date
        initial_count = len(combined_df)
        combined_df = combined_df.drop_duplicates(subset=['ADDRESS', 'DATE'], keep='first')
        final_count = len(combined_df)
        
        if initial_count != final_count:
            print(f"   Removed {initial_count - final_count} duplicates")
        
        # Add location flags with robust geocoding
        combined_df = add_location_flags(combined_df, max_drive_time=30)
        
        # Ensure correct column order
        column_order = ['SOURCE', 'DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY', 
                       'WITHIN_30MIN', 'CLOSEST_CITY', 'DISTANCE_MILES', 'EST_DRIVE_TIME', 'GEOCODE_METHOD']
        
        final_df = combined_df[column_order].copy()
        
        # Save results
        import os
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'processed')
        os.makedirs(output_dir, exist_ok=True)
        output_filename = os.path.join(output_dir, "unified_data.csv")
        final_df.to_csv(output_filename, index=False)
        
        print(f"\n🎉 SUCCESS!")
        print(f"📊 Total unified records: {len(final_df)}")
        print(f"📁 Saved to: {output_filename}")
        
        # Show comprehensive summary
        print(f"\n📋 COMPREHENSIVE SUMMARY:")
        print(f"   Counties (PL): {final_df['PL'].value_counts().to_dict()}")
        print(f"   Sources: {final_df['SOURCE'].value_counts().to_dict()}")
        print(f"   Records with TIME: {(final_df['TIME'] != '').sum()}")
        print(f"   Properties within 30 min: {(final_df['WITHIN_30MIN'] == 'Yes').sum()}")
        print(f"   Average distance to Nashville/Mt. Juliet: {final_df['DISTANCE_MILES'].mean():.1f} miles")
        
        # Show high-priority properties (within 30 minutes)
        priority_properties = final_df[final_df['WITHIN_30MIN'] == 'Yes']
        if not priority_properties.empty:
            print(f"\n🎯 HIGH-PRIORITY PROPERTIES (Within 30 minutes):")
            print(f"   Total: {len(priority_properties)} properties")
            for _, prop in priority_properties.head(5).iterrows():
                print(f"   • {prop['ADDRESS'][:40]}... - {prop['DISTANCE_MILES']} mi, {prop['EST_DRIVE_TIME']} min ({prop['DATE']})")
        
        # Show sample data
        print(f"\n📋 SAMPLE DATA (first 3 records):")
        sample_cols = ['SOURCE', 'DATE', 'TIME', 'PL', 'ADDRESS', 'CTY', 'WITHIN_30MIN']
        print(final_df[sample_cols].head(3).to_string(index=False))
        
        print(f"\n📄 Output file '{output_filename}' contains these columns:")
        print(f"   {', '.join(column_order)}")
        
        return final_df
    
    else:
        print("❌ No data was processed successfully")
        return None

# Execute the pipeline
if __name__ == "__main__":
    print("Starting the Unified Foreclosure Data Pipeline...")
    print("This will:")
    print("1. Run all your scraper scripts")
    print("2. Standardize data into unified format")
    print("3. Add Nashville/Mt. Juliet proximity flags")
    print("4. Save to 'Auction_Info_Unified.csv'")
    print("\nPress Ctrl+C to cancel, or wait 3 seconds to continue...")
    
    try:
        time.sleep(3)
        result = run_unified_pipeline()
        
        if result is not None:
            print(f"\n✅ PIPELINE COMPLETED SUCCESSFULLY!")
            print(f"🎯 Found {(result['WITHIN_30MIN'] == 'Yes').sum()} properties within 30 minutes of Nashville/Mt. Juliet")
            print(f"📁 Check 'Auction_Info_Unified.csv' for your unified foreclosure data")
        else:
            print(f"\n⚠️ Pipeline completed but no data was unified")
            
    except KeyboardInterrupt:
        print(f"\n🛑 Pipeline cancelled by user")
    except Exception as e:
        print(f"\n❌ Pipeline failed with error: {e}")
        import traceback
        traceback.print_exc()