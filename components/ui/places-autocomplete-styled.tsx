'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

// TypeScript declarations for the new Google Places web component
declare global {
  interface Window {
    google: any;
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id?: string;
        className?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

interface PlacesAutocompleteStyledProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Google Places Autocomplete component using the new 2025 PlaceAutocompleteElement
 * - Uses the new web component <gmp-place-autocomplete>
 * - Mounts only once to prevent flickering
 * - Handles gmp-select events for place selection
 * - Properly configured for modal/portal contexts
 */
export function PlacesAutocompleteStyled({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false,
  style
}: PlacesAutocompleteStyledProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  
  // Note: The gmp-place-autocomplete web component manages its own internal state
  // The value prop is used for the parent component but doesn't directly control the input

  // Load Google Maps and set up autocomplete - only once
  useEffect(() => {
    if (disabled || isInitializedRef.current) {
      return;
    }

    const initializeAutocomplete = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          console.warn('Google Maps API key not configured');
          return;
        }

        // Check if Google Maps is already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('Google Maps already loaded, importing places library');
        } else {
          console.log('Loading Google Maps JavaScript API');
          // Load Google Maps JavaScript API with Places library
          const loader = new Loader({
            apiKey: apiKey,
            version: "weekly",
            libraries: ["places"]
          });

          await loader.load();
        }
        
        // Import the places library
        await window.google.maps.importLibrary("places");
        console.log('Places library imported successfully');
        
        // Check if PlaceAutocompleteElement is available
        if (!window.google.maps.places.PlaceAutocompleteElement) {
          console.error('PlaceAutocompleteElement not available - API might not be enabled');
          return;
        }
        
        // Create the PlaceAutocompleteElement only once
        if (!containerRef.current || autocompleteElementRef.current) {
          return;
        }

        console.log('Creating PlaceAutocompleteElement');
        // Create the autocomplete element
        const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
          // Restrict to US addresses
          includedRegionCodes: ['us']
        });
        
        // Store reference
        autocompleteElementRef.current = placeAutocomplete;
        
        // Add event listener for place selection
        placeAutocomplete.addEventListener('gmp-select', async (event: any) => {
          console.log('Place selected event triggered');
          const { placePrediction } = event;
          
          if (!placePrediction) {
            console.warn('No place prediction in event');
            return;
          }

          try {
            // Convert to Place object and fetch fields
            const place = placePrediction.toPlace();
            await place.fetchFields({ 
              fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
            });

            const fullAddress = place.formattedAddress || place.displayName;
            console.log('Selected address:', fullAddress);
            
            if (fullAddress) {
              onChange(fullAddress);

              if (onPlaceSelected) {
                const placeData = {
                  formatted_address: fullAddress,
                  display_name: place.displayName,
                  location: place.location,
                  address_components: place.addressComponents,
                  place: place.toJSON()
                };
                onPlaceSelected(placeData);
              }
            } else {
              console.warn('No address found in place data');
            }
          } catch (error) {
            console.error('Error processing place selection:', error);
          }
        });
        
        // Append to container
        containerRef.current.appendChild(placeAutocomplete);
        console.log('PlaceAutocompleteElement appended to DOM');
        
        // Mark as initialized
        isInitializedRef.current = true;
        console.log('Google Places Autocomplete initialized successfully');
        
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    };

    initializeAutocomplete();
  }, [disabled, onChange, onPlaceSelected]);

  // For development without API key
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Development mode - Google Places API key needed"
          disabled={disabled}
          className={`${className} border-yellow-300 bg-yellow-50`}
          style={style}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-600">
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        /* Ensure the autocomplete component takes full width */
        gmp-place-autocomplete {
          width: 100% !important;
          display: block !important;
          position: relative !important;
        }
        
        /* Ensure dropdown appears above modals */
        gmp-place-autocomplete [role="listbox"] {
          z-index: 9999999 !important;
          position: fixed !important;
        }
        
        /* Style the input inside the web component */
        gmp-place-autocomplete input {
          width: 100% !important;
          padding: 0.5rem 2.5rem 0.5rem 0.75rem !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          color: rgb(17 24 39) !important;
          background-color: white !important;
          border: 1px solid rgb(209 213 219) !important;
          border-radius: 0.375rem !important;
          transition: all 0.2s !important;
        }
        
        gmp-place-autocomplete input:focus {
          outline: none !important;
          border-color: rgb(59 130 246) !important;
          box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1) !important;
        }
        
        gmp-place-autocomplete input:disabled {
          background-color: rgb(243 244 246) !important;
          cursor: not-allowed !important;
        }
        
        /* Style the dropdown */
        gmp-place-autocomplete [role="listbox"] {
          margin-top: 0.25rem !important;
          background-color: white !important;
          border: 1px solid rgb(229 231 235) !important;
          border-radius: 0.375rem !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          max-height: 300px !important;
          overflow-y: auto !important;
        }
        
        /* Style dropdown items */
        gmp-place-autocomplete [role="option"] {
          padding: 0.5rem 0.75rem !important;
          cursor: pointer !important;
          transition: background-color 0.15s !important;
        }
        
        gmp-place-autocomplete [role="option"]:hover {
          background-color: rgb(243 244 246) !important;
        }
        
        /* Hide any Google branding if needed */
        gmp-place-autocomplete .google-logo {
          display: none !important;
        }
      `}</style>
      
      <div className="relative" style={style}>
        <div ref={containerRef} className={className}>
          {/* The gmp-place-autocomplete element will be appended here */}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    </>
  );
}