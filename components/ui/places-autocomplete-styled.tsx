'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    google: any;
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        // 2025 Google Places API properties
        includedRegionCodes?: string[];
        locationBias?: any;
        locationRestriction?: any;
        includedPrimaryTypes?: string[];
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
 * Google Places Autocomplete component implementing 2025 API best practices
 * - Uses new PlaceAutocompleteElement web component (not deprecated Autocomplete class)
 * - Direct JSX rendering instead of appendChild for better React/modal integration
 * - Handles gmp-select events with proper Place object fetching
 * - Optimized for modal/portal contexts with proper z-index handling
 * - Follows Google's 2025 migration guide recommendations
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Stable callback to prevent useEffect re-runs
  const handlePlaceSelect = useCallback((placeData: any) => {
    if (onPlaceSelected) {
      onPlaceSelected(placeData);
    }
  }, [onPlaceSelected]);

  const handleAddressChange = useCallback((address: string) => {
    onChange(address);
  }, [onChange]);

  // Load Google Maps API once
  useEffect(() => {
    if (disabled) return;
    
    const loadGoogleMaps = async () => {
      try {
        // More robust API key check with better error messaging
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          console.warn('🔑 Google Maps API key not found in local environment. Component will work in production with Vercel environment variable.');
          setError('Google Maps API key not configured for local development');
          setIsLoading(false);
          return;
        }

        console.log('🗺️ Loading Google Places API 2025...');

        // Load Google Maps API with Places library
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();
        await window.google.maps.importLibrary("places");
        
        setGoogleLoaded(true);
        setIsLoading(false);
        setError(null);
        
      } catch (error) {
        console.error('💥 Error loading Google Maps API:', error);
        setError(error instanceof Error ? error.message : 'Failed to load Google Maps API');
        setIsLoading(false);
      }
    };
    
    loadGoogleMaps();
  }, [disabled]);
  
  // Set up the autocomplete element when Google is loaded
  useEffect(() => {
    if (!googleLoaded || !autocompleteRef.current) return;
    
    const setupAutocomplete = () => {
      try {
        const autocomplete = autocompleteRef.current;
        
        // FORCE LIGHT THEME - 2025 Google Places API Configuration
        // Setting colorScheme to 'none' disables dark-mode adaptation, ensuring light theme always
        autocomplete.style.colorScheme = 'none';
        
        // Override CSS variables for explicit white background and black text (2025 API)
        autocomplete.style.setProperty('--gmp-mat-color-surface', '#FFFFFF');
        autocomplete.style.setProperty('--gmp-mat-color-on-surface', '#000000');
        
        // Set region restriction - 2025 API format
        autocomplete.includedRegionCodes = ['us'];
        
        // Listen for place selection
        const handleGmpSelect = async (event: any) => {
          try {
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

            if (fullAddress) {
              handleAddressChange(fullAddress);

              // Call onPlaceSelected with comprehensive place data for property reports
              const placeData = {
                formatted_address: fullAddress,
                display_name: place.displayName,
                location: place.location,
                address_components: place.addressComponents,
                place: place
              };
              handlePlaceSelect(placeData);
            } else {
              console.warn('❌ No formatted address found');
            }
          } catch (error) {
            console.error('💥 Error handling place selection:', error);
            setError('Error selecting place');
          }
        };
        
        autocomplete.addEventListener('gmp-select', handleGmpSelect);
        setIsLoaded(true);
        
        // Cleanup function
        return () => {
          autocomplete.removeEventListener('gmp-select', handleGmpSelect);
        };
        
      } catch (error) {
        console.error('💥 Error setting up autocomplete:', error);
        setError('Failed to setup autocomplete');
      }
    };
    
    const cleanup = setupAutocomplete();
    return cleanup;
  }, [googleLoaded, handleAddressChange, handlePlaceSelect]);

  // Fallback input for when Google Maps fails to load or while loading
  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // For local development, show a working input when API key is missing
  if (error && error.includes('local development')) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleFallbackChange}
          placeholder="Development mode - Google Places API key needed for autocomplete"
          disabled={disabled}
          className={`${className} border-yellow-300 bg-yellow-50`}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-600">
          <MapPin className="h-4 w-4" />
        </div>
        <p className="text-xs text-yellow-600 mt-1">Local development mode - full functionality available in production</p>
      </div>
    );
  }

  // Show fallback only if there's an actual API error
  if (error && !error.includes('local development')) {
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
      {/* 2025 Google Places API Styling - Optimized for Modals/Portals */}
      <style jsx global>{`
        /* Force light theme and prevent dark mode adaptation (2025 API) */
        gmp-place-autocomplete {
          /* Setting to 'none' disables dark-mode adaptation, ensuring light theme always */
          color-scheme: none !important;
          
          /* CSS Variables provided by Google for 2025 Places API customization */
          --gmp-mat-color-surface: #FFFFFF !important;
          --gmp-mat-color-on-surface: #000000 !important;
          
          /* Ensure full width and proper display */
          width: 100% !important;
          display: block !important;
          
          /* CRITICAL: Ensure proper z-index for modals/portals */
          position: relative !important;
          z-index: 1 !important;
        }
        
        /* MODAL/PORTAL FIX: Ensure dropdown appears above modal overlays */
        gmp-place-autocomplete [role=\"listbox\"] {
          z-index: 9999923 !important;
          position: fixed !important;
        }
        
        /* MOBILE OPTIMIZATION: 2025 API automatically handles mobile-friendly display */
        @media (max-width: 640px) {
          gmp-place-autocomplete [role=\"listbox\"] {
            /* Let Google's component handle mobile full-screen display */
            max-width: 100vw !important;
          }
        }
        
        /* NUCLEAR OPTION: Force input text to be visible in ALL possible states */
        gmp-place-autocomplete input,
        gmp-place-autocomplete input:focus,
        gmp-place-autocomplete input:active,
        gmp-place-autocomplete input:hover,
        gmp-place-autocomplete input[value]:not([value=""]),
        gmp-place-autocomplete input:not(:placeholder-shown),
        gmp-place-autocomplete input[aria-expanded="false"]:not(:placeholder-shown),
        gmp-place-autocomplete input.has-value {
          color: #000000 !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
          visibility: visible !important;
          font-family: inherit !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          text-shadow: none !important;
          text-indent: 0 !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-transform: none !important;
          font-weight: normal !important;
          font-style: normal !important;
        }
        
        /* Target any possible pseudo-elements that might be hiding text */
        gmp-place-autocomplete input::before,
        gmp-place-autocomplete input::after,
        gmp-place-autocomplete input::placeholder {
          display: none !important;
        }
        
        /* Force any overlays or masks to be transparent */
        gmp-place-autocomplete::before,
        gmp-place-autocomplete::after,
        gmp-place-autocomplete *::before,
        gmp-place-autocomplete *::after {
          background: transparent !important;
          color: transparent !important;
        }
        
        /* Ensure no elements are covering the input */
        gmp-place-autocomplete > * {
          position: relative !important;
          z-index: 1 !important;
        }
        
        /* Force text selection to be visible */
        gmp-place-autocomplete input::selection {
          background: #3b82f6 !important;
          color: #ffffff !important;
        }
        
        /* Override any webkit-specific hiding */
        gmp-place-autocomplete input:-webkit-autofill,
        gmp-place-autocomplete input:-webkit-autofill:hover,
        gmp-place-autocomplete input:-webkit-autofill:focus {
          -webkit-text-fill-color: #000000 !important;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          background-color: #ffffff !important;
          color: #000000 !important;
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
      
      <div className="relative" style={style}>
        {/* Direct JSX rendering of Google Places Autocomplete - better for modals/portals */}
        {googleLoaded && (
          <gmp-place-autocomplete
            ref={autocompleteRef}
            className={`${isLoaded ? 'block' : 'hidden'} w-full`}
            includedRegionCodes={['us']}
            style={{
              display: isLoaded ? 'block' : 'none',
              width: '100%'
            }}
          />
        )}
        
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