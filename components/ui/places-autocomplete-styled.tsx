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
        
        // FORCE LIGHT THEME - This fixes the invisible text issue!
        autocomplete.style.colorScheme = 'light';
        
        // Also set CSS variables for explicit white background and black text
        autocomplete.style.setProperty('--gmp-mat-color-surface', '#FFFFFF');
        autocomplete.style.setProperty('--gmp-mat-color-on-surface', '#000000');

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
      {/* Proper Google Places styling using CSS variables and color-scheme */}
      <style jsx global>{`
        /* Force light theme and use CSS variables for consistent styling */
        gmp-place-autocomplete {
          /* Force light theme regardless of system settings */
          color-scheme: light !important;
          
          /* CSS Variables provided by Google for customization */
          --gmp-mat-color-surface: #FFFFFF !important;
          --gmp-mat-color-on-surface: #000000 !important;
          
          /* Ensure full width */
          width: 100% !important;
          display: block !important;
        }
        
        /* Additional styling for better appearance */
        gmp-place-autocomplete input {
          font-family: inherit !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
        }
        
        /* Style the dropdown to match */
        gmp-place-autocomplete [role="listbox"] {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          border-radius: 0.5rem !important;
        }
        
        /* Hover state for dropdown items */
        gmp-place-autocomplete [role="option"]:hover {
          background-color: #f9fafb !important;
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