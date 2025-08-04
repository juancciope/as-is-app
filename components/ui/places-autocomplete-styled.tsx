'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

// TypeScript declarations for the new Google Places web component
declare global {
  interface Window {
    google: any;
    _googleMapsLoaded?: boolean;
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id?: string;
        className?: string;
        style?: React.CSSProperties;
        ref?: React.Ref<any>;
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
 * - Renders <gmp-place-autocomplete> directly in JSX
 * - Handles gmp-select events for place selection
 * - Styled with Tailwind-compatible CSS
 * - Optimized for modal usage and mobile devices
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
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load Google Maps API once globally
  useEffect(() => {
    if (!isClient || disabled || window._googleMapsLoaded) {
      if (window._googleMapsLoaded) {
        setIsLoaded(true);
      }
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          setError('Google Maps API key not configured');
          return;
        }

        // Check if already loading/loaded
        if (window.google && window.google.maps && window.google.maps.places) {
          window._googleMapsLoaded = true;
          setIsLoaded(true);
          return;
        }

        // Load Google Maps JavaScript API with Places library
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();
        await window.google.maps.importLibrary("places");
        
        // Mark as loaded globally
        window._googleMapsLoaded = true;
        setIsLoaded(true);
        
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
        setError('Failed to load Google Maps API');
      }
    };

    loadGoogleMaps();
  }, [isClient, disabled]);

  // Configure autocomplete options
  useEffect(() => {
    if (!isLoaded || !autocompleteRef.current || disabled) {
      return;
    }

    // Set region restriction to US
    try {
      // @ts-ignore - Google's types might not be fully updated
      if (autocompleteRef.current.includedRegionCodes !== undefined) {
        autocompleteRef.current.includedRegionCodes = ['us'];
      }
    } catch (e) {
      // Property might not be available in older versions
    }
  }, [isLoaded, disabled]);

  // Set up event listener for place selection
  useEffect(() => {
    if (!isLoaded || !autocompleteRef.current || disabled) {
      return;
    }

    const handleSelect = async (event: any) => {
      const { placePrediction } = event;
      
      if (!placePrediction) {
        return;
      }

      try {
        // Convert to Place object and fetch fields
        const place = placePrediction.toPlace();
        await place.fetchFields({ 
          fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
        });

        const fullAddress = place.formattedAddress || place.displayName;
        
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
        }
      } catch (error) {
        console.error('Error processing place selection:', error);
      }
    };

    // Add event listener
    autocompleteRef.current.addEventListener('gmp-select', handleSelect);

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.removeEventListener('gmp-select', handleSelect);
      }
    };
  }, [isLoaded, onChange, onPlaceSelected, disabled]);

  // Handle modal focus issues
  useEffect(() => {
    if (!isLoaded || !autocompleteRef.current) {
      return;
    }

    // Workaround for modal pointer-down issues
    const handlePointerDown = (e: PointerEvent) => {
      // Prevent modal from stealing focus when clicking autocomplete suggestions
      e.stopPropagation();
    };

    // Try to access the shadow root for modal fixes (if needed)
    try {
      const shadowRoot = autocompleteRef.current.shadowRoot;
      if (shadowRoot) {
        shadowRoot.addEventListener('pointerdown', handlePointerDown, true);
        return () => {
          shadowRoot.removeEventListener('pointerdown', handlePointerDown, true);
        };
      }
    } catch (e) {
      // Shadow DOM might be closed, that's okay
    }
  }, [isLoaded]);

  // Don't render on server side
  if (!isClient) {
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={error.includes('API key') ? "Development mode - Google Places API key needed" : placeholder}
          disabled={disabled}
          className={`${className} ${error.includes('API key') ? 'border-yellow-300 bg-yellow-50' : 'border-red-300'}`}
          style={style}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <MapPin className={`h-4 w-4 ${error.includes('API key') ? 'text-yellow-600' : 'text-red-600'}`} />
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        /* Base styles for the autocomplete element */
        gmp-place-autocomplete {
          width: 100% !important;
          display: block !important;
          position: relative !important;
          
          /* Tailwind-compatible styling */
          background-color: rgb(255 255 255); /* white */
          color-scheme: light;
          border: 1px solid rgb(209 213 219); /* gray-300 */
          border-radius: 0.375rem; /* rounded-md */
          transition: all 0.2s;
        }
        
        /* Focus state */
        gmp-place-autocomplete:focus-within {
          border-color: rgb(59 130 246); /* blue-500 */
          box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1); /* ring-blue-500/10 */
        }
        
        /* Disabled state */
        gmp-place-autocomplete[disabled] {
          background-color: rgb(243 244 246); /* gray-100 */
          cursor: not-allowed;
          opacity: 0.5;
        }
        
        /* Style the internal input */
        gmp-place-autocomplete input {
          padding: 0.5rem 2.5rem 0.5rem 0.75rem !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          color: rgb(17 24 39) !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          width: 100% !important;
        }
        
        /* Dropdown positioning for modals */
        gmp-place-autocomplete [role="listbox"] {
          z-index: 999999 !important;
          position: fixed !important;
          margin-top: 0.25rem !important;
          background-color: white !important;
          border: 1px solid rgb(229 231 235) !important; /* gray-200 */
          border-radius: 0.375rem !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          max-height: 300px !important;
          overflow-y: auto !important;
        }
        
        /* Style dropdown items using CSS parts */
        gmp-place-autocomplete::part(prediction-item) {
          padding: 0.5rem 0.75rem !important;
          cursor: pointer !important;
          transition: background-color 0.15s !important;
          font-size: 0.875rem !important;
        }
        
        gmp-place-autocomplete::part(prediction-item):hover {
          background-color: rgb(243 244 246) !important; /* gray-100 */
        }
        
        gmp-place-autocomplete::part(prediction-item-main-text) {
          color: rgb(17 24 39) !important; /* gray-900 */
          font-weight: 500 !important;
        }
        
        gmp-place-autocomplete::part(prediction-item-secondary-text) {
          color: rgb(107 114 128) !important; /* gray-500 */
          font-size: 0.75rem !important;
        }
        
        /* Mobile optimizations */
        @media (max-width: 640px) {
          gmp-place-autocomplete [role="listbox"] {
            max-width: calc(100vw - 2rem) !important;
            left: 1rem !important;
            right: 1rem !important;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          gmp-place-autocomplete {
            background-color: rgb(31 41 55); /* gray-800 */
            border-color: rgb(55 65 81); /* gray-700 */
            color-scheme: dark;
          }
          
          gmp-place-autocomplete input {
            color: rgb(243 244 246) !important; /* gray-100 */
          }
          
          gmp-place-autocomplete [role="listbox"] {
            background-color: rgb(31 41 55) !important; /* gray-800 */
            border-color: rgb(55 65 81) !important; /* gray-700 */
          }
          
          gmp-place-autocomplete::part(prediction-item):hover {
            background-color: rgb(55 65 81) !important; /* gray-700 */
          }
          
          gmp-place-autocomplete::part(prediction-item-main-text) {
            color: rgb(243 244 246) !important; /* gray-100 */
          }
          
          gmp-place-autocomplete::part(prediction-item-secondary-text) {
            color: rgb(156 163 175) !important; /* gray-400 */
          }
        }
      `}</style>
      
      <div className="relative" style={style}>
        {isLoaded ? (
          <gmp-place-autocomplete 
            ref={autocompleteRef}
            id="place-autocomplete"
            className={className}
            {...(disabled ? { disabled: true } : {})}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Loading address autocomplete..."
            disabled={true}
            className={`${className} animate-pulse`}
          />
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
      </div>
    </>
  );
}