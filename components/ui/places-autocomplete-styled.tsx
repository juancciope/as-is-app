'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    google: any;
  }
}

interface PlacesAutocompleteStyledProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PlacesAutocompleteStyled({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false
}: PlacesAutocompleteStyledProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) return;

    const initAutocomplete = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
          throw new Error('Google Maps API key not found');
        }

        // Load Google Maps API with Places library
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();

        // Import Places library and create PlaceAutocompleteElement
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");

        if (!containerRef.current || autocompleteElementRef.current) {
          return;
        }

        // Create the autocomplete element with US region restriction
        const autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ['us']
        });

        // Listen for place selection
        autocomplete.addEventListener('gmp-select', async (event: any) => {
          try {
            const { placePrediction } = event;
            
            if (!placePrediction) {
              console.warn('No place prediction in selection event');
              return;
            }

            // Convert to Place object and fetch required fields
            const place = placePrediction.toPlace();
            await place.fetchFields({ 
              fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
            });

            const fullAddress = place.formattedAddress;
            console.log('Selected address:', fullAddress);

            if (fullAddress) {
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
            setError('Error selecting place');
          }
        });

        // Append to container
        containerRef.current.appendChild(autocomplete);
        autocompleteElementRef.current = autocomplete;
        setIsLoaded(true);
        setIsLoading(false);
        setError(null);

      } catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
        setError('Failed to load autocomplete');
        setIsLoading(false);
        setIsLoaded(false);
      }
    };

    initAutocomplete();

    // Cleanup
    return () => {
      if (autocompleteElementRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(autocompleteElementRef.current);
          autocompleteElementRef.current = null;
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      }
    };
  }, [onChange, onPlaceSelected, disabled]);

  // Fallback input for when Google Maps fails to load or while loading
  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  if (error || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleFallbackChange}
          placeholder={error ? "Address autocomplete unavailable" : placeholder}
          disabled={disabled}
          className={`${className} ${error ? 'border-red-300' : ''}`}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          <MapPin className="h-4 w-4" />
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Global styles for Google Places Autocomplete Element */}
      <style jsx global>{`
        gmp-place-autocomplete {
          width: 100% !important;
          display: block !important;
          font-family: inherit !important;
          position: relative !important;
        }
        
        /* Main input field styling */
        gmp-place-autocomplete input {
          width: 100% !important;
          padding: 0.5rem 0.75rem !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          background-color: white !important;
          color: #374151 !important;
          font-family: inherit !important;
          outline: none !important;
          box-shadow: none !important;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out !important;
        }
        
        gmp-place-autocomplete input:focus {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
          outline: none !important;
          background-color: white !important;
          color: #374151 !important;
        }
        
        gmp-place-autocomplete input::placeholder {
          color: #9ca3af !important;
        }
        
        gmp-place-autocomplete input:disabled {
          background-color: #f9fafb !important;
          color: #6b7280 !important;
          cursor: not-allowed !important;
        }
        
        /* Style the dropdown suggestions */
        gmp-place-autocomplete [role="listbox"] {
          background: white !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          z-index: 50 !important;
          margin-top: 0.25rem !important;
          max-height: 300px !important;
          overflow-y: auto !important;
        }
        
        /* Individual suggestion items */
        gmp-place-autocomplete [role="option"] {
          color: #374151 !important;
          background: white !important;
          padding: 0.75rem !important;
          border-bottom: 1px solid #f3f4f6 !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          cursor: pointer !important;
        }
        
        gmp-place-autocomplete [role="option"]:hover,
        gmp-place-autocomplete [role="option"][aria-selected="true"] {
          background: #f9fafb !important;
          color: #374151 !important;
        }
        
        gmp-place-autocomplete [role="option"]:last-child {
          border-bottom: none !important;
          border-bottom-left-radius: 0.5rem !important;
          border-bottom-right-radius: 0.5rem !important;
        }
        
        gmp-place-autocomplete [role="option"]:first-child {
          border-top-left-radius: 0.5rem !important;
          border-top-right-radius: 0.5rem !important;
        }
        
        /* Aggressively hide ALL buttons and unwanted UI elements */
        gmp-place-autocomplete button,
        gmp-place-autocomplete [role="button"],
        gmp-place-autocomplete .gm-ui-hover-effect,
        gmp-place-autocomplete [data-value="powered_by_google"],
        gmp-place-autocomplete [aria-label*="Google"],
        gmp-place-autocomplete [title*="Google"],
        gmp-place-autocomplete [class*="button"],
        gmp-place-autocomplete [class*="icon"],
        gmp-place-autocomplete svg,
        gmp-place-autocomplete img[src*="google"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          pointer-events: none !important;
        }
        
        /* Ensure all text elements are visible with dark color */
        gmp-place-autocomplete,
        gmp-place-autocomplete *,
        gmp-place-autocomplete input,
        gmp-place-autocomplete [role="option"],
        gmp-place-autocomplete span,
        gmp-place-autocomplete div {
          color: #374151 !important;
          background-color: transparent !important;
        }
        
        /* Specifically target input states */
        gmp-place-autocomplete input:focus,
        gmp-place-autocomplete input:active,
        gmp-place-autocomplete input[aria-expanded="true"] {
          background-color: white !important;
          color: #374151 !important;
        }
        
        /* Loading state */
        gmp-place-autocomplete:not([loaded]) {
          opacity: 0.7;
        }
        
        /* Remove any Google branding or logos */
        gmp-place-autocomplete [class*="powered"],
        gmp-place-autocomplete [class*="logo"],
        gmp-place-autocomplete [class*="brand"] {
          display: none !important;
        }
      `}</style>
      
      <div className="relative">
        {/* Container for Google Places Autocomplete Element */}
        <div 
          ref={containerRef}
          className={`${isLoaded ? 'block' : 'hidden'} w-full`}
        />
        
        {/* Loading fallback */}
        {isLoading && (
          <input
            type="text"
            value={value}
            onChange={handleFallbackChange}
            placeholder="Loading address autocomplete..."
            disabled={true}
            className={`${className} animate-pulse`}
            autoComplete="off"
          />
        )}
        
        {/* Icon overlay */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : isLoading ? 'text-gray-400' : 'text-red-400'}`} />
        </div>
      </div>
    </>
  );
}