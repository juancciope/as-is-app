const { Actor } = require('apify');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = "https://wabi-us-north-central-h-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true";
const SOURCE_WEBSITE_NAME = "logs.com (Power BI)";

// Base request headers
const BASE_REQUEST_HEADERS = {
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
    "x-powerbi-resourcekey": "ce677020-d221-48ab-9ca2-be2af745da7d"
};

// Request payload for PowerBI API
const REQUEST_PAYLOAD = {
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
                                                                "Amount": 1, // Start from tomorrow
                                                                "TimeUnit": 0 // Day
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
                                                                "Amount": 15, // Include up to 15 days from today
                                                                "TimeUnit": 0 // Day
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
};

// Helper function to convert milliseconds (from midnight) to HH:MM AM/PM
function convertMsToTime(msValue) {
    if (msValue === null || msValue === undefined) {
        return null;
    }
    
    try {
        if (typeof msValue === 'number' && msValue >= 0 && msValue < 86400000) {
            const secondsInDay = Math.floor(msValue / 1000);
            const hours = Math.floor(secondsInDay / 3600);
            const minutes = Math.floor((secondsInDay % 3600) / 60);
            
            const date = new Date(1900, 0, 1, hours, minutes);
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        return String(msValue);
    } catch (error) {
        console.error('Error converting time:', error);
        return String(msValue);
    }
}

// Function to parse PowerBI DSR (Data Shape Result)
function parsePowerBiDsr(dsrData) {
    console.log('Parsing PowerBI DSR data...');
    
    const allRowsData = [];
    
    if (!dsrData || !dsrData.DS || !dsrData.DS.length) {
        console.log('DSR data is empty or not in expected format.');
        return allRowsData;
    }

    const dataSource = dsrData.DS[0];
    const valueDicts = dataSource.ValueDicts || {};
    
    const descriptor = dsrData.descriptor?.Select || [];
    let columnNames = descriptor.map((col, i) => col.Name || `Column_${i}`);
    
    if (!columnNames.length || columnNames.length !== 5) {
        columnNames = [
            'Upcoming_Sales_Report_TN.COUNTY_NAME',
            'Upcoming_Sales_Report_TN.SALE_DATE',
            'Upcoming_Sales_Report_TN.SALE_TIME',
            'Upcoming_Sales_Report_TN.FULL_ADDRESS',
            'Upcoming_Sales_Report_TN.BID_AMNT'
        ];
    }

    const dictMapByName = {
        'Upcoming_Sales_Report_TN.COUNTY_NAME': 'D0',
        'Upcoming_Sales_Report_TN.SALE_DATE': 'D1',
        'Upcoming_Sales_Report_TN.SALE_TIME': null,
        'Upcoming_Sales_Report_TN.FULL_ADDRESS': 'D2',
        'Upcoming_Sales_Report_TN.BID_AMNT': 'D3'
    };

    const numCols = columnNames.length;
    let prevRawValues = new Array(numCols).fill(null);

    if (dataSource.PH && dataSource.PH.length && dataSource.PH[0].DM0) {
        for (let dsrIdx = 0; dsrIdx < dataSource.PH[0].DM0.length; dsrIdx++) {
            const dsrCellEntry = dataSource.PH[0].DM0[dsrIdx];
            const currentRowRawValues = new Array(numCols).fill(null);
            
            const cValues = dsrCellEntry.C || [];
            const rMask = dsrCellEntry.R || 0;
            const nullMask = dsrCellEntry.Ø || 0;

            let cIndex = 0;
            for (let colIdx = 0; colIdx < numCols; colIdx++) {
                const isNulledByMask = (nullMask >> colIdx) & 1;
                const isRepeatedFromPrevious = (rMask >> colIdx) & 1;

                if (isNulledByMask) {
                    currentRowRawValues[colIdx] = null;
                } else if (isRepeatedFromPrevious) {
                    currentRowRawValues[colIdx] = prevRawValues[colIdx];
                } else {
                    // Not nulled, not repeated -> must be from C array
                    if (cIndex < cValues.length) {
                        currentRowRawValues[colIdx] = cValues[cIndex];
                        cIndex++;
                    } else {
                        console.warn(`DSR Entry ${dsrIdx}, Col ${colIdx}: C array exhausted`);
                        currentRowRawValues[colIdx] = null;
                    }
                }
            }

            const translatedRow = {};
            for (let i = 0; i < currentRowRawValues.length; i++) {
                const rawVal = currentRowRawValues[i];
                const colName = columnNames[i];
                
                if (rawVal === null) {
                    translatedRow[colName] = null;
                    continue;
                }

                const dictKeyForCol = dictMapByName[colName];
                if (dictKeyForCol && valueDicts[dictKeyForCol]) {
                    try {
                        translatedRow[colName] = valueDicts[dictKeyForCol][rawVal];
                    } catch (error) {
                        console.warn(`Warning: Index ${rawVal} out of bounds for dict ${dictKeyForCol}`);
                        translatedRow[colName] = rawVal;
                    }
                } else if (colName === "Upcoming_Sales_Report_TN.SALE_TIME") {
                    translatedRow[colName] = convertMsToTime(rawVal);
                } else {
                    translatedRow[colName] = rawVal;
                }
            }

            allRowsData.push(translatedRow);
            prevRawValues = currentRowRawValues;
        }
    }

    return allRowsData;
}

Actor.main(async () => {
    console.log('Starting WABI PowerBI scraper...');
    
    const input = await Actor.getInput();
    const { customHeaders, customPayload } = input || {};
    
    // Prepare headers with dynamic IDs
    const headers = {
        ...BASE_REQUEST_HEADERS,
        ...customHeaders,
        'activityid': uuidv4(),
        'requestid': uuidv4()
    };
    
    const payload = customPayload || REQUEST_PAYLOAD;
    
    try {
        console.log('Sending POST request to PowerBI API...');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        
        console.log(`Successfully received response (Status: ${response.status})`);
        
        const responseData = await response.json();
        
        // Check if response contains expected DSR data structure
        if (responseData &&
            responseData.results &&
            responseData.results[0] &&
            responseData.results[0].result &&
            responseData.results[0].result.data &&
            responseData.results[0].result.data.dsr) {
            
            const dsrData = responseData.results[0].result.data.dsr;
            
            console.log('Parsing PowerBI DSR data...');
            const extractedRows = parsePowerBiDsr(dsrData);
            
            console.log(`Extracted ${extractedRows.length} rows of data`);
            
            if (extractedRows.length > 0) {
                // Transform data to match expected format
                const transformedData = extractedRows.map(row => {
                    // Clean column names by removing prefix
                    const cleanRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.replace('Upcoming_Sales_Report_TN.', '');
                        cleanRow[cleanKey] = row[key];
                    });
                    
                    // Add source website
                    cleanRow.SourceWebsite = SOURCE_WEBSITE_NAME;
                    
                    // Add scraped timestamp
                    cleanRow.scraped_at = new Date().toISOString();
                    
                    return cleanRow;
                });
                
                console.log('Sample transformed data:', JSON.stringify(transformedData[0], null, 2));
                
                // Save to dataset
                await Actor.pushData(transformedData);
                
                console.log(`WABI PowerBI scraper completed successfully. Processed ${transformedData.length} records`);
            } else {
                console.log('No data rows were parsed from the DSR.');
                await Actor.pushData([]);
            }
        } else {
            console.log('Response JSON does not contain the expected DSR data structure.');
            console.log('Response sample:', JSON.stringify(responseData, null, 2).substring(0, 2000));
            await Actor.pushData([]);
        }
        
    } catch (error) {
        console.error('Error in WABI PowerBI scraper:', error);
        
        if (error.message.includes('timeout')) {
            console.log('This might be due to network connectivity issues or API timeout');
        } else if (error.message.includes('HTTP error')) {
            console.log('This might be due to API authentication issues or resource key problems');
        }
        
        throw error;
    }
});