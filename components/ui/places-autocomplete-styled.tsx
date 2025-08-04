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
  style?: React.CSSProperties;
}

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
              onChange(fullAddress);

              // FORCE CSS UPDATES: Since Shadow DOM is closed, force CSS updates through style injection
              
              // Method 1: Inject styles into document head to override any Google styles
              const injectForceStyles = () => {
                const styleId = 'gmp-force-visible-text';
                let existingStyle = document.getElementById(styleId);
                
                if (existingStyle) {
                  existingStyle.remove();
                }
                
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                  /* CRITICAL: Force text visibility in Google Places Autocomplete after selection */
                  gmp-place-autocomplete {
                    --gmp-mat-color-on-surface: #000000 !important;
                    --gmp-mat-color-surface: #ffffff !important;
                    color-scheme: light !important;
                  }
                  
                  /* Target all possible input states with maximum specificity */
                  gmp-place-autocomplete * {
                    color: #000000 !important;
                    background-color: #ffffff !important;
                    -webkit-text-fill-color: #000000 !important;
                  }
                `;
                
                document.head.appendChild(style);
              };
              
              // Method 2: Force the autocomplete element itself to update
              const forceElementUpdate = () => {
                // Trigger a reflow to force style recalculation
                autocomplete.style.display = 'none';
                autocomplete.offsetHeight; // Force reflow
                autocomplete.style.display = 'block';
                
                // Set CSS custom properties directly on the element
                autocomplete.style.setProperty('--gmp-mat-color-on-surface', '#000000', 'important');
                autocomplete.style.setProperty('--gmp-mat-color-surface', '#ffffff', 'important');
                autocomplete.style.colorScheme = 'light';
                
              };
              
              // Execute immediately and with delays
              [0, 10, 50, 100, 200, 500].forEach(delay => {
                setTimeout(() => {
                  injectForceStyles();
                  forceElementUpdate();
                }, delay);
              });

              if (onPlaceSelected) {
                const placeData = {
                  formatted_address: fullAddress,
                  display_name: place.displayName,
                  location: place.location,
                  address_components: place.addressComponents,
                  place: place
                };
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
    console.log('🔧 Fallback input change:', e.target.value);
    onChange(e.target.value);
  };

  // Force fallback mode for testing
  if (true || error || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleFallbackChange}
          placeholder={error ? "Address autocomplete unavailable" : placeholder + " (FALLBACK MODE)"}
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
      {/* HYPER-FOCUSED: Make input text visible after address selection */}
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