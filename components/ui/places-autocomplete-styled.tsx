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
            console.log('🔥 PLACE SELECTION EVENT:', event);
            const { placePrediction } = event;
            
            if (!placePrediction) {
              console.warn('❌ No place prediction in selection event');
              return;
            }

            // Convert to Place object and fetch required fields
            const place = placePrediction.toPlace();
            await place.fetchFields({ 
              fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
            });

            const fullAddress = place.formattedAddress;
            console.log('✅ Selected address:', fullAddress);
            console.log('📍 Place object:', place);

            if (fullAddress) {
              console.log('🎯 Calling onChange with:', fullAddress);
              onChange(fullAddress);

              if (onPlaceSelected) {
                const placeData = {
                  formatted_address: fullAddress,
                  display_name: place.displayName,
                  location: place.location,
                  address_components: place.addressComponents,
                  place: place
                };
                console.log('📦 Calling onPlaceSelected with:', placeData);
                onPlaceSelected(placeData);
              }
            } else {
              console.warn('❌ No formatted address found');
            }
          } catch (error) {
            console.error('💥 Error handling place selection:', error);
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
      {/* Aggressive CSS to force black text visibility in all states */}
      <style jsx global>{`
        /* AGGRESSIVELY force all text to be black in ALL states */
        gmp-place-autocomplete,
        gmp-place-autocomplete *,
        gmp-place-autocomplete input,
        gmp-place-autocomplete input:focus,
        gmp-place-autocomplete input:active,
        gmp-place-autocomplete input:hover,
        gmp-place-autocomplete input[value],
        gmp-place-autocomplete [role="option"],
        gmp-place-autocomplete span,
        gmp-place-autocomplete div,
        gmp-place-autocomplete p,
        gmp-place-autocomplete text {
          color: #000000 !important;
          text-shadow: none !important;
        }
        
        /* Force input to ALWAYS have black text on white background in ALL states */
        gmp-place-autocomplete input,
        gmp-place-autocomplete input:focus,
        gmp-place-autocomplete input:active,
        gmp-place-autocomplete input:hover,
        gmp-place-autocomplete input[aria-expanded="true"],
        gmp-place-autocomplete input[aria-expanded="false"] {
          color: #000000 !important;
          background-color: white !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
        }
        
        /* Force dropdown items to have black text in ALL states */
        gmp-place-autocomplete [role="option"],
        gmp-place-autocomplete [role="option"]:hover,
        gmp-place-autocomplete [role="option"]:focus,
        gmp-place-autocomplete [role="option"]:active,
        gmp-place-autocomplete [role="option"][aria-selected="true"] {
          color: #000000 !important;
          background-color: white !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
        }
        
        gmp-place-autocomplete [role="option"]:hover {
          background-color: #f0f0f0 !important;
        }
        
        /* Override any webkit autofill styles */
        gmp-place-autocomplete input:-webkit-autofill,
        gmp-place-autocomplete input:-webkit-autofill:hover,
        gmp-place-autocomplete input:-webkit-autofill:focus,
        gmp-place-autocomplete input:-webkit-autofill:active {
          -webkit-text-fill-color: #000000 !important;
          color: #000000 !important;
          background-color: white !important;
          box-shadow: 0 0 0px 1000px white inset !important;
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