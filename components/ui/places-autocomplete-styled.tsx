'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

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
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const initNewAutocomplete = async () => {
      try {        
        if (!window.google?.maps) {
          throw new Error('Google Maps not loaded');
        }

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");

        if (!containerRef.current || autocompleteElementRef.current) {
          return;
        }

        const autocompleteElement = new PlaceAutocompleteElement({
          includedRegionCodes: ['us'],
          requestedLanguage: 'en',
        });

        // Listen for place selection
        autocompleteElement.addEventListener('gmp-select', async (event: any) => {
          try {
            const { placePrediction } = event;
            if (!placePrediction) return;

            const place = placePrediction.toPlace();
            await place.fetchFields({ 
              fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
            });

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
          }
        });

        // Append to container
        containerRef.current.appendChild(autocompleteElement);
        autocompleteElementRef.current = autocompleteElement;
        setIsLoaded(true);

      } catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
        setIsLoaded(false);
      }
    };

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
        setIsLoaded(false);
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();

    return () => {
      if (autocompleteElementRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(autocompleteElementRef.current);
        } catch (error) {
          // Ignore cleanup errors
        }
        autocompleteElementRef.current = null;
      }
    };
  }, [onChange, onPlaceSelected]);

  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
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
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inject custom CSS to style the Google component */}
      <style jsx global>{`
        gmp-place-autocomplete {
          width: 100% !important;
          display: block !important;
          font-family: inherit !important;
        }
        
        gmp-place-autocomplete input {
          width: 100% !important;
          padding: 0.5rem 2rem 0.5rem 0.75rem !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          background-color: white !important;
          color: #374151 !important;
          font-family: inherit !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        gmp-place-autocomplete input:focus {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
          outline: none !important;
        }
        
        gmp-place-autocomplete input::placeholder {
          color: #9ca3af !important;
        }
        
        /* Style the dropdown */
        gmp-place-autocomplete .suggestions-list,
        gmp-place-autocomplete [role="listbox"] {
          background: white !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          z-index: 50 !important;
          margin-top: 0.25rem !important;
        }
        
        /* Style individual suggestions */
        gmp-place-autocomplete [role="option"],
        gmp-place-autocomplete .suggestion-item {
          color: #374151 !important;
          background: white !important;
          padding: 0.75rem !important;
          border-bottom: 1px solid #f3f4f6 !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
        }
        
        gmp-place-autocomplete [role="option"]:hover,
        gmp-place-autocomplete .suggestion-item:hover {
          background: #f9fafb !important;
        }
        
        gmp-place-autocomplete [role="option"]:last-child,
        gmp-place-autocomplete .suggestion-item:last-child {
          border-bottom: none !important;
          border-bottom-left-radius: 0.5rem !important;
          border-bottom-right-radius: 0.5rem !important;
        }
        
        gmp-place-autocomplete [role="option"]:first-child,
        gmp-place-autocomplete .suggestion-item:first-child {
          border-top-left-radius: 0.5rem !important;
          border-top-right-radius: 0.5rem !important;
        }
        
        /* Hide any unwanted buttons or icons */
        gmp-place-autocomplete button,
        gmp-place-autocomplete [role="button"] {
          display: none !important;
        }
        
        /* Ensure text is always visible */
        gmp-place-autocomplete * {
          color: #374151 !important;
        }
        
        gmp-place-autocomplete input {
          color: #374151 !important;
        }
      `}</style>
      
      <div className="relative">
        {/* Container for the Google autocomplete element */}
        <div 
          ref={containerRef}
          className={isLoaded ? '' : 'hidden'}
          style={{ width: '100%' }}
        />
        
        {/* Fallback input shown while loading */}
        {!isLoaded && (
          <input
            ref={fallbackInputRef}
            type="text"
            value={localValue}
            onChange={handleFallbackInputChange}
            placeholder="Loading autocomplete..."
            disabled={disabled}
            className={className}
            autoComplete="off"
          />
        )}
        
        {/* Icon overlay */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : ''}`} />
        </div>
      </div>
    </>
  );
}