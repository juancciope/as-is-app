'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

interface PlacesAutocompleteNewProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PlacesAutocompleteNew({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false
}: PlacesAutocompleteNewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Initialize the new Google Places Autocomplete Element
  useEffect(() => {
    const initNewAutocomplete = async () => {
      try {        
        // Check if Google Maps is available
        if (!window.google?.maps) {
          throw new Error('Google Maps not loaded');
        }

        // Import the Places library with the new API
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");

        if (!containerRef.current || autocompleteElementRef.current) {
          return;
        }

        // Create the new PlaceAutocompleteElement
        const autocompleteElement = new PlaceAutocompleteElement({
          includedRegionCodes: ['us'], // Restrict to US addresses
          requestedLanguage: 'en',
          // You can add other options like locationBias if needed
        });


        // Style the element to match our design
        autocompleteElement.style.width = '100%';
        autocompleteElement.style.border = 'none';
        autocompleteElement.style.outline = 'none';
        autocompleteElement.style.backgroundColor = 'white';
        autocompleteElement.style.color = '#374151'; // text-gray-700
        autocompleteElement.style.fontSize = '14px';
        autocompleteElement.style.fontFamily = 'inherit';
        
        // Override internal styling
        const style = document.createElement('style');
        style.textContent = `
          gmp-place-autocomplete {
            --gmp-color-surface: white !important;
            --gmp-color-on-surface: #374151 !important;
            --gmp-color-on-surface-variant: #6b7280 !important;
            --gmp-color-outline: #d1d5db !important;
            --gmp-font-family: inherit !important;
            --gmp-font-size: 14px !important;
          }
          
          gmp-place-autocomplete input {
            background-color: white !important;
            color: #374151 !important;
            border: 1px solid #d1d5db !important;
            border-radius: 0.5rem !important;
            padding: 0.5rem 0.75rem !important;
            font-size: 14px !important;
            font-family: inherit !important;
            outline: none !important;
          }
          
          gmp-place-autocomplete input:focus {
            border-color: #10b981 !important;
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
          }
          
          gmp-place-autocomplete .suggestion-list {
            background-color: white !important;
            border: 1px solid #d1d5db !important;
            border-radius: 0.5rem !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          }
          
          gmp-place-autocomplete .suggestion-item {
            color: #374151 !important;
            background-color: white !important;
            padding: 0.75rem !important;
            border-bottom: 1px solid #f3f4f6 !important;
          }
          
          gmp-place-autocomplete .suggestion-item:hover {
            background-color: #f9fafb !important;
          }
          
          gmp-place-autocomplete .suggestion-item:last-child {
            border-bottom: none !important;
          }
        `;
        document.head.appendChild(style);

        // Listen for the gmp-select event (new API event)
        autocompleteElement.addEventListener('gmp-select', async (event: any) => {
          try {
            const { placePrediction } = event;
            if (!placePrediction) {
              return;
            }

            // Convert prediction to Place object
            const place = placePrediction.toPlace();

            // Fetch the fields we need
            await place.fetchFields({ 
              fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
            });

            // Get the formatted address (complete address string)
            const fullAddress = place.formattedAddress;

            if (fullAddress) {
              setLocalValue(fullAddress);
              onChange(fullAddress);

              if (onPlaceSelected) {
                onPlaceSelected({
                  formatted_address: fullAddress,
                  display_name: place.displayName,
                  location: place.location,
                  address_components: place.addressComponents,
                  place: place
                });
              }
            }
          } catch (error) {
            console.error('Error handling place selection:', error);
            setApiError('Error processing selected place');
          }
        });

        // Append to container
        containerRef.current.appendChild(autocompleteElement);
        autocompleteElementRef.current = autocompleteElement;
        setIsLoaded(true);
        setApiError(null);

      } catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
        setApiError(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoaded(false);
      }
    };

    // Load Google Maps with the new API
    const loadGoogleMaps = () => {
      if (window.google?.maps) {
        initNewAutocomplete();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        initNewAutocomplete();
      };
      
      script.onerror = () => {
        setApiError('Failed to load Google Maps API');
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();

    return () => {
      if (autocompleteElementRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(autocompleteElementRef.current);
        } catch (error) {
          console.log('Cleanup error (non-critical):', error);
        }
        autocompleteElementRef.current = null;
      }
    };
  }, [onChange, onPlaceSelected]);

  // Fallback input change handler
  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  // Check if API key exists
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={localValue}
            onChange={handleFallbackInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className={className}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="text-xs text-red-500">
          Google Maps API key not configured
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* Container for the new PlaceAutocompleteElement */}
        <div 
          ref={containerRef}
          className={`${isLoaded ? '' : 'hidden'} ${className}`}
          style={{ minHeight: '40px' }}
        />
        
        {/* Fallback input shown while loading or if API fails */}
        {(!isLoaded || apiError) && (
          <input
            ref={fallbackInputRef}
            type="text"
            value={localValue}
            onChange={handleFallbackInputChange}
            placeholder={apiError ? "Enter address manually..." : "Loading autocomplete..."}
            disabled={disabled}
            className={className}
            autoComplete="off"
          />
        )}
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <MapPin className={`h-4 w-4 ${isLoaded && !apiError ? 'text-green-600' : ''}`} />
        </div>
      </div>
      
      {/* Status messages */}
      {apiError && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {apiError} - Using manual input instead
        </div>
      )}
      
      {!isLoaded && !apiError && (
        <div className="text-xs text-gray-500">
          Loading address autocomplete...
        </div>
      )}
      
      {isLoaded && !apiError && (
        <div className="text-xs text-green-600">
          ✅ Google Places autocomplete ready
        </div>
      )}
    </div>
  );
}