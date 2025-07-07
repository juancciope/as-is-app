import requests
import json
import pandas as pd
from datetime import datetime, timedelta
import uuid # For generating unique IDs

# --- Configuration ---
API_URL = "https://wabi-us-north-central-h-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true"
CSV_OUTPUT_FILENAME = "logs_com_powerbi_data.csv"
SOURCE_WEBSITE_NAME = "logs.com (Power BI)"

# --- Request Headers (dynamic IDs will be added) ---
BASE_REQUEST_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "connection": "keep-alive",
    "content-type": "application/json;charset=UTF-8",
    "host": "wabi-us-north-central-h-primary-api.analysis.windows.net",
    "origin": "https://app.powerbi.com",
    "referer": "https://app.powerbi.com/",
    "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "x-powerbi-resourcekey": "ce677020-d221-48ab-9ca2-be2af745da7d" # Provided by user
}

# --- Request Payload (Date filter for "Next 15 days" starting tomorrow) ---
# LowerBound: Today + 1 Day
# UpperBound: Today + 15 Days
REQUEST_PAYLOAD = {
    "version": "1.0.0",
    "queries": [
        {
            "Query": {
                "Commands": [
                    {
                        "SemanticQueryDataShapeCommand": {
                            "Query": {
                                "Version": 2,
                                "From": [
                                    {
                                        "Name": "u",
                                        "Entity": "web Upcoming Sales Report TN",
                                        "Type": 0
                                    }
                                ],
                                "Select": [
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "COUNTY_NAME"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.COUNTY_NAME"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "SALE_DATE"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.SALE_DATE"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "SALE_TIME"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.SALE_TIME"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "FULL_ADDRESS"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.FULL_ADDRESS"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "BID_AMNT"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.BID_AMNT"
                                    }
                                ],
                                "Where": [
                                    {
                                        "Condition": {
                                            "Between": {
                                                "Expression": {
                                                    "Column": {
                                                        "Expression": {
                                                            "SourceRef": {
                                                                "Source": "u"
                                                            }
                                                        },
                                                        "Property": "SALES_DATE" 
                                                    }
                                                },
                                                "LowerBound": { 
                                                    "DateSpan": {
                                                        "Expression": {
                                                            "DateAdd": {
                                                                "Expression": {"Now": {}},
                                                                "Amount": 1, # Start from tomorrow
                                                                "TimeUnit": 0 # Day
                                                            }
                                                        },
                                                        "TimeUnit": 0 
                                                    }
                                                },
                                                "UpperBound": { 
                                                    "DateSpan": {
                                                        "Expression": {
                                                            "DateAdd": {
                                                                "Expression": {"Now": {}},
                                                                "Amount": 15, # Include up to 15 days from today
                                                                "TimeUnit": 0 # Day
                                                            }
                                                        },
                                                        "TimeUnit": 0 
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ],
                                "OrderBy": [
                                    {
                                        "Direction": 1, 
                                        "Expression": {
                                            "Column": {
                                                "Expression": {
                                                    "SourceRef": {
                                                        "Source": "u"
                                                    }
                                                },
                                                "Property": "COUNTY_NAME"
                                            }
                                        }
                                    }
                                ]
                            },
                            "Binding": {
                                "Primary": {
                                    "Groupings": [
                                        {
                                            "Projections": [0, 1, 2, 3, 4], 
                                            "Subtotal": 1 
                                        }
                                    ]
                                },
                                "DataReduction": {
                                    "DataVolume": 3, 
                                    "Primary": {
                                        "Window": {
                                            "Count": 500 
                                        }
                                    }
                                },
                                "Version": 1
                            },
                            "ExecutionMetricsKind": 1
                        }
                    }
                ]
            },
            "QueryId": "", 
            "ApplicationContext": {
                "DatasetId": "d5653a6a-9977-452b-a5b5-222f385753a6",
                "Sources": [
                    {
                        "ReportId": "1f44cd24-bd40-48c2-815e-a952bfa6014c",
                    }
                ]
            }
        }
    ],
    "cancelQueries": [],
    "modelId": 453000 
}

# --- Helper function to convert milliseconds (from midnight) to HH:MM AM/PM ---
def convert_ms_to_time(ms_value):
    if ms_value is None:
        return None
    try:
        if isinstance(ms_value, (int, float)) and 0 <= ms_value < 86400000: 
             seconds_in_day = ms_value // 1000
             h = int(seconds_in_day // 3600)
             m = int((seconds_in_day % 3600) // 60)
             dt_time_obj = datetime(1900, 1, 1, hour=h, minute=m)
             return dt_time_obj.strftime("%I:%M %p")
        return str(ms_value) 
    except Exception as e:
        return str(ms_value)

# --- Function to Parse Power BI DSR (Data Shape Result) ---
def parse_powerbi_dsr(dsr_data):
    """
    Parses the DSR data from Power BI response.
    """
    all_rows_data = []
    if not dsr_data or 'DS' not in dsr_data or not dsr_data['DS']:
        print("DSR data is empty or not in expected format.")
        return all_rows_data

    data_source = dsr_data['DS'][0]
    value_dicts = data_source.get('ValueDicts', {})
    
    descriptor = dsr_data.get('descriptor', {}).get('Select', [])
    column_names = [col.get('Name', f"Column_{i}") for i, col in enumerate(descriptor)]
    if not column_names or len(column_names) != 5: 
        column_names = ['Upcoming_Sales_Report_TN.COUNTY_NAME', 
                        'Upcoming_Sales_Report_TN.SALE_DATE', 
                        'Upcoming_Sales_Report_TN.SALE_TIME', 
                        'Upcoming_Sales_Report_TN.FULL_ADDRESS', 
                        'Upcoming_Sales_Report_TN.BID_AMNT']

    dict_map_by_name = {
        'Upcoming_Sales_Report_TN.COUNTY_NAME': 'D0',
        'Upcoming_Sales_Report_TN.SALE_DATE': 'D1',
        'Upcoming_Sales_Report_TN.SALE_TIME': None, 
        'Upcoming_Sales_Report_TN.FULL_ADDRESS': 'D2',
        'Upcoming_Sales_Report_TN.BID_AMNT': 'D3'
    }

    num_cols = len(column_names)
    prev_raw_values_from_dsr_entry = [None] * num_cols 

    if 'PH' in data_source and data_source['PH'] and 'DM0' in data_source['PH'][0]:
        for dsr_idx, dsr_cell_entry in enumerate(data_source['PH'][0]['DM0']):
            current_row_raw_values = [None] * num_cols 
            
            c_values_iter = iter(dsr_cell_entry.get("C", []))
            # R is UseValuesFromPreviousInstanceMask - a bitmask
            r_mask = dsr_cell_entry.get("R", 0) 
            null_mask = dsr_cell_entry.get("Ø", 0)   

            for col_idx in range(num_cols):
                is_nulled_by_mask = (null_mask >> col_idx) & 1
                is_repeated_from_previous = (r_mask >> col_idx) & 1

                if is_nulled_by_mask:
                    current_row_raw_values[col_idx] = None
                elif is_repeated_from_previous:
                    current_row_raw_values[col_idx] = prev_raw_values_from_dsr_entry[col_idx]
                else: # Not nulled, not repeated -> must be from C array
                    try:
                        current_row_raw_values[col_idx] = next(c_values_iter)
                    except StopIteration:
                        print(f"Warning: DSR Entry {dsr_idx}, Col {col_idx}: C array exhausted for non-null, non-repeated column. DSR cell: {dsr_cell_entry}")
                        current_row_raw_values[col_idx] = None # Or some other error indicator
            
            translated_row_for_df = {}
            for i, raw_val in enumerate(current_row_raw_values):
                col_name = column_names[i]
                if raw_val is None:
                    translated_row_for_df[col_name] = None
                    continue

                dict_key_for_col = dict_map_by_name.get(col_name)
                if dict_key_for_col and dict_key_for_col in value_dicts:
                    try:
                        translated_row_for_df[col_name] = value_dicts[dict_key_for_col][raw_val]
                    except IndexError:
                        print(f"Warning: DSR Entry {dsr_idx}, Col {i} ('{col_name}'): Index {raw_val} out of bounds for dict {dict_key_for_col}. Using raw value.")
                        translated_row_for_df[col_name] = raw_val
                    except TypeError: # If raw_val is not an int (e.g. already a string if dict lookup failed before)
                        print(f"Warning: DSR Entry {dsr_idx}, Col {i} ('{col_name}'): TypeError looking up {raw_val} in dict {dict_key_for_col}. Using raw value.")
                        translated_row_for_df[col_name] = raw_val

                elif col_name == "Upcoming_Sales_Report_TN.SALE_TIME":
                    translated_row_for_df[col_name] = convert_ms_to_time(raw_val)
                else: 
                    translated_row_for_df[col_name] = raw_val
            
            all_rows_data.append(translated_row_for_df)
            prev_raw_values_from_dsr_entry = current_row_raw_values 
            
    return all_rows_data

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Power BI Scraper for {SOURCE_WEBSITE_NAME} ---")
    
    current_headers = BASE_REQUEST_HEADERS.copy()
    current_headers['activityid'] = str(uuid.uuid4())
    current_headers['requestid'] = str(uuid.uuid4())

    try:
        print(f"Sending POST request to: {API_URL}")
        # print(f"Payload: {json.dumps(REQUEST_PAYLOAD, indent=2)}") # For debugging payload
        response = requests.post(API_URL, headers=current_headers, json=REQUEST_PAYLOAD, timeout=30)
        response.raise_for_status() 
        print(f"Successfully received response (Status: {response.status_code})")
        
        response_data = response.json()
        # print(f"Raw Response JSON: {json.dumps(response_data, indent=2)}") # For debugging response
        
        if (response_data and "results" in response_data and 
            response_data["results"] and "result" in response_data["results"][0] and 
            "data" in response_data["results"][0]["result"] and 
            "dsr" in response_data["results"][0]["result"]["data"]):
            
            dsr_data = response_data["results"][0]["result"]["data"]["dsr"]
            
            print("\n--- Parsing Power BI DSR Data ---")
            extracted_rows = parse_powerbi_dsr(dsr_data)
            print(f"Extracted {len(extracted_rows)} rows of data.")
            
            if extracted_rows:
                df = pd.DataFrame(extracted_rows)
                df['SourceWebsite'] = SOURCE_WEBSITE_NAME
                df.columns = [col.replace('Upcoming_Sales_Report_TN.', '') for col in df.columns]

                print(f"\n--- First 5 Rows of Extracted Data ---")
                print(df.head().to_string())
                
                try:
                    df.to_csv(CSV_OUTPUT_FILENAME, index=False, encoding='utf-8')
                    print(f"\nData successfully saved to {CSV_OUTPUT_FILENAME}")
                except Exception as e:
                    print(f"Error saving data to CSV: {e}")
            else:
                print("No data rows were parsed from the DSR.")
        else:
            print("Response JSON does not contain the expected DSR data structure.")
            # print("Response sample:", json.dumps(response_data, indent=4)[:2000]) # Print more for debugging

    except requests.exceptions.HTTPError as e:
        print(f"HTTP error occurred: {e.response.status_code} {e.response.reason}")
        if e.response and e.response.content:
            try:
                print("Error content:", e.response.json())
            except json.JSONDecodeError:
                print("Error content (not JSON):", e.response.text)
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        if 'response' in locals() and response: 
             print("Response text:", response.text[:1000])
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        
    print(f"\n--- End of Power BI Scraper for {SOURCE_WEBSITE_NAME} ---")

import requests
import json
import pandas as pd
from datetime import datetime, timedelta
import uuid # For generating unique IDs

# --- Configuration ---
API_URL = "https://wabi-us-north-central-h-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true"
CSV_OUTPUT_FILENAME = "logs_com_powerbi_data.csv"
SOURCE_WEBSITE_NAME = "logs.com (Power BI)"

# --- Request Headers (dynamic IDs will be added) ---
BASE_REQUEST_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "connection": "keep-alive",
    "content-type": "application/json;charset=UTF-8",
    "host": "wabi-us-north-central-h-primary-api.analysis.windows.net",
    "origin": "https://app.powerbi.com",
    "referer": "https://app.powerbi.com/",
    "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "x-powerbi-resourcekey": "ce677020-d221-48ab-9ca2-be2af745da7d" # Provided by user
}

# --- Request Payload (Date filter for "Next 15 days" starting tomorrow) ---
# LowerBound: Today + 1 Day
# UpperBound: Today + 15 Days
REQUEST_PAYLOAD = {
    "version": "1.0.0",
    "queries": [
        {
            "Query": {
                "Commands": [
                    {
                        "SemanticQueryDataShapeCommand": {
                            "Query": {
                                "Version": 2,
                                "From": [
                                    {
                                        "Name": "u",
                                        "Entity": "web Upcoming Sales Report TN",
                                        "Type": 0
                                    }
                                ],
                                "Select": [
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "COUNTY_NAME"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.COUNTY_NAME"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "SALE_DATE"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.SALE_DATE"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "SALE_TIME"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.SALE_TIME"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "FULL_ADDRESS"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.FULL_ADDRESS"
                                    },
                                    {
                                        "Column": {
                                            "Expression": {
                                                "SourceRef": {
                                                    "Source": "u"
                                                }
                                            },
                                            "Property": "BID_AMNT"
                                        },
                                        "Name": "Upcoming_Sales_Report_TN.BID_AMNT"
                                    }
                                ],
                                "Where": [
                                    {
                                        "Condition": {
                                            "Between": {
                                                "Expression": {
                                                    "Column": {
                                                        "Expression": {
                                                            "SourceRef": {
                                                                "Source": "u"
                                                            }
                                                        },
                                                        "Property": "SALES_DATE" 
                                                    }
                                                },
                                                "LowerBound": { 
                                                    "DateSpan": {
                                                        "Expression": {
                                                            "DateAdd": {
                                                                "Expression": {"Now": {}},
                                                                "Amount": 1, # Start from tomorrow
                                                                "TimeUnit": 0 # Day
                                                            }
                                                        },
                                                        "TimeUnit": 0 
                                                    }
                                                },
                                                "UpperBound": { 
                                                    "DateSpan": {
                                                        "Expression": {
                                                            "DateAdd": {
                                                                "Expression": {"Now": {}},
                                                                "Amount": 15, # Include up to 15 days from today
                                                                "TimeUnit": 0 # Day
                                                            }
                                                        },
                                                        "TimeUnit": 0 
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ],
                                "OrderBy": [
                                    {
                                        "Direction": 1, 
                                        "Expression": {
                                            "Column": {
                                                "Expression": {
                                                    "SourceRef": {
                                                        "Source": "u"
                                                    }
                                                },
                                                "Property": "COUNTY_NAME"
                                            }
                                        }
                                    }
                                ]
                            },
                            "Binding": {
                                "Primary": {
                                    "Groupings": [
                                        {
                                            "Projections": [0, 1, 2, 3, 4], 
                                            "Subtotal": 1 
                                        }
                                    ]
                                },
                                "DataReduction": {
                                    "DataVolume": 3, 
                                    "Primary": {
                                        "Window": {
                                            "Count": 500 
                                        }
                                    }
                                },
                                "Version": 1
                            },
                            "ExecutionMetricsKind": 1
                        }
                    }
                ]
            },
            "QueryId": "", 
            "ApplicationContext": {
                "DatasetId": "d5653a6a-9977-452b-a5b5-222f385753a6",
                "Sources": [
                    {
                        "ReportId": "1f44cd24-bd40-48c2-815e-a952bfa6014c",
                    }
                ]
            }
        }
    ],
    "cancelQueries": [],
    "modelId": 453000 
}

# --- Helper function to convert milliseconds (from midnight) to HH:MM AM/PM ---
def convert_ms_to_time(ms_value):
    if ms_value is None:
        return None
    try:
        if isinstance(ms_value, (int, float)) and 0 <= ms_value < 86400000: 
             seconds_in_day = ms_value // 1000
             h = int(seconds_in_day // 3600)
             m = int((seconds_in_day % 3600) // 60)
             dt_time_obj = datetime(1900, 1, 1, hour=h, minute=m)
             return dt_time_obj.strftime("%I:%M %p")
        return str(ms_value) 
    except Exception as e:
        return str(ms_value)

# --- Function to Parse Power BI DSR (Data Shape Result) ---
def parse_powerbi_dsr(dsr_data):
    """
    Parses the DSR data from Power BI response.
    """
    all_rows_data = []
    if not dsr_data or 'DS' not in dsr_data or not dsr_data['DS']:
        print("DSR data is empty or not in expected format.")
        return all_rows_data

    data_source = dsr_data['DS'][0]
    value_dicts = data_source.get('ValueDicts', {})
    
    descriptor = dsr_data.get('descriptor', {}).get('Select', [])
    column_names = [col.get('Name', f"Column_{i}") for i, col in enumerate(descriptor)]
    if not column_names or len(column_names) != 5: 
        column_names = ['Upcoming_Sales_Report_TN.COUNTY_NAME', 
                        'Upcoming_Sales_Report_TN.SALE_DATE', 
                        'Upcoming_Sales_Report_TN.SALE_TIME', 
                        'Upcoming_Sales_Report_TN.FULL_ADDRESS', 
                        'Upcoming_Sales_Report_TN.BID_AMNT']

    dict_map_by_name = {
        'Upcoming_Sales_Report_TN.COUNTY_NAME': 'D0',
        'Upcoming_Sales_Report_TN.SALE_DATE': 'D1',
        'Upcoming_Sales_Report_TN.SALE_TIME': None, 
        'Upcoming_Sales_Report_TN.FULL_ADDRESS': 'D2',
        'Upcoming_Sales_Report_TN.BID_AMNT': 'D3'
    }

    num_cols = len(column_names)
    prev_raw_values_from_dsr_entry = [None] * num_cols 

    if 'PH' in data_source and data_source['PH'] and 'DM0' in data_source['PH'][0]:
        for dsr_idx, dsr_cell_entry in enumerate(data_source['PH'][0]['DM0']):
            current_row_raw_values = [None] * num_cols 
            
            c_values_iter = iter(dsr_cell_entry.get("C", []))
            # R is UseValuesFromPreviousInstanceMask - a bitmask
            r_mask = dsr_cell_entry.get("R", 0) 
            null_mask = dsr_cell_entry.get("Ø", 0)   

            for col_idx in range(num_cols):
                is_nulled_by_mask = (null_mask >> col_idx) & 1
                is_repeated_from_previous = (r_mask >> col_idx) & 1

                if is_nulled_by_mask:
                    current_row_raw_values[col_idx] = None
                elif is_repeated_from_previous:
                    current_row_raw_values[col_idx] = prev_raw_values_from_dsr_entry[col_idx]
                else: # Not nulled, not repeated -> must be from C array
                    try:
                        current_row_raw_values[col_idx] = next(c_values_iter)
                    except StopIteration:
                        print(f"Warning: DSR Entry {dsr_idx}, Col {col_idx}: C array exhausted for non-null, non-repeated column. DSR cell: {dsr_cell_entry}")
                        current_row_raw_values[col_idx] = None # Or some other error indicator
            
            translated_row_for_df = {}
            for i, raw_val in enumerate(current_row_raw_values):
                col_name = column_names[i]
                if raw_val is None:
                    translated_row_for_df[col_name] = None
                    continue

                dict_key_for_col = dict_map_by_name.get(col_name)
                if dict_key_for_col and dict_key_for_col in value_dicts:
                    try:
                        translated_row_for_df[col_name] = value_dicts[dict_key_for_col][raw_val]
                    except IndexError:
                        print(f"Warning: DSR Entry {dsr_idx}, Col {i} ('{col_name}'): Index {raw_val} out of bounds for dict {dict_key_for_col}. Using raw value.")
                        translated_row_for_df[col_name] = raw_val
                    except TypeError: # If raw_val is not an int (e.g. already a string if dict lookup failed before)
                        print(f"Warning: DSR Entry {dsr_idx}, Col {i} ('{col_name}'): TypeError looking up {raw_val} in dict {dict_key_for_col}. Using raw value.")
                        translated_row_for_df[col_name] = raw_val

                elif col_name == "Upcoming_Sales_Report_TN.SALE_TIME":
                    translated_row_for_df[col_name] = convert_ms_to_time(raw_val)
                else: 
                    translated_row_for_df[col_name] = raw_val
            
            all_rows_data.append(translated_row_for_df)
            prev_raw_values_from_dsr_entry = current_row_raw_values 
            
    return all_rows_data

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Power BI Scraper for {SOURCE_WEBSITE_NAME} ---")
    
    current_headers = BASE_REQUEST_HEADERS.copy()
    current_headers['activityid'] = str(uuid.uuid4())
    current_headers['requestid'] = str(uuid.uuid4())

    try:
        print(f"Sending POST request to: {API_URL}")
        # print(f"Payload: {json.dumps(REQUEST_PAYLOAD, indent=2)}") # For debugging payload
        response = requests.post(API_URL, headers=current_headers, json=REQUEST_PAYLOAD, timeout=30)
        response.raise_for_status() 
        print(f"Successfully received response (Status: {response.status_code})")
        
        response_data = response.json()
        # print(f"Raw Response JSON: {json.dumps(response_data, indent=2)}") # For debugging response
        
        if (response_data and "results" in response_data and 
            response_data["results"] and "result" in response_data["results"][0] and 
            "data" in response_data["results"][0]["result"] and 
            "dsr" in response_data["results"][0]["result"]["data"]):
            
            dsr_data = response_data["results"][0]["result"]["data"]["dsr"]
            
            print("\n--- Parsing Power BI DSR Data ---")
            extracted_rows = parse_powerbi_dsr(dsr_data)
            print(f"Extracted {len(extracted_rows)} rows of data.")
            
            if extracted_rows:
                df = pd.DataFrame(extracted_rows)
                df['SourceWebsite'] = SOURCE_WEBSITE_NAME
                df.columns = [col.replace('Upcoming_Sales_Report_TN.', '') for col in df.columns]

                print(f"\n--- First 5 Rows of Extracted Data ---")
                print(df.head().to_string())
                
                try:
                    df.to_csv(CSV_OUTPUT_FILENAME, index=False, encoding='utf-8')
                    print(f"\nData successfully saved to {CSV_OUTPUT_FILENAME}")
                except Exception as e:
                    print(f"Error saving data to CSV: {e}")
            else:
                print("No data rows were parsed from the DSR.")
        else:
            print("Response JSON does not contain the expected DSR data structure.")
            # print("Response sample:", json.dumps(response_data, indent=4)[:2000]) # Print more for debugging

    except requests.exceptions.HTTPError as e:
        print(f"HTTP error occurred: {e.response.status_code} {e.response.reason}")
        if e.response and e.response.content:
            try:
                print("Error content:", e.response.json())
            except json.JSONDecodeError:
                print("Error content (not JSON):", e.response.text)
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        if 'response' in locals() and response: 
             print("Response text:", response.text[:1000])
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        
    print(f"\n--- End of Power BI Scraper for {SOURCE_WEBSITE_NAME} ---")

