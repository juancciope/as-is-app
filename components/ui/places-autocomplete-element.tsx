'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google: any;
    initGooglePlacesElement?: () => void;
  }
}

interface PlacesAutocompleteElementProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PlacesAutocompleteElement({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false
}: PlacesAutocompleteElementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Initialize Google Places Autocomplete Element (new API)
  useEffect(() => {
    const initAutocompleteElement = () => {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.log('Google Maps not loaded yet');
        return;
      }

      if (!containerRef.current || autocompleteElementRef.current) {
        return;
      }

      try {
        // Create the new PlaceAutocompleteElement
        const autocompleteElement = document.createElement('gmp-place-autocomplete');
        autocompleteElement.setAttribute('placeholder', placeholder);
        autocompleteElement.setAttribute('countries', 'us');
        autocompleteElement.setAttribute('types', 'address');
        
        // Style the element
        autocompleteElement.style.width = '100%';
        autocompleteElement.style.height = '100%';

        // Add event listener for place selection
        autocompleteElement.addEventListener('gmp-placeselect', (event: any) => {
          const place = event.place;
          console.log('🎯 Place selected from new element:', place);
          
          if (place && place.formattedAddress) {
            const formattedAddress = place.formattedAddress;
            console.log('✅ Full address captured:', formattedAddress);
            
            setLocalValue(formattedAddress);
            onChange(formattedAddress);
            
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
          }
        });

        containerRef.current.appendChild(autocompleteElement);
        autocompleteElementRef.current = autocompleteElement;
        setIsLoaded(true);
        console.log('✅ Google Places Autocomplete Element initialized');
      } catch (error) {
        console.error('Error initializing autocomplete element:', error);
        // Fallback to basic input
        setIsLoaded(false);
      }
    };

    // Load Google Maps script with the new API
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&loading=async&callback=initGooglePlacesElement`;
      script.async = true;
      script.defer = true;
      
      window.initGooglePlacesElement = () => {
        console.log('Google Maps with new Places API loaded');
        initAutocompleteElement();
      };
      
      document.head.appendChild(script);
    } else {
      initAutocompleteElement();
    }

    return () => {
      if (autocompleteElementRef.current && containerRef.current) {
        containerRef.current.removeChild(autocompleteElementRef.current);
        autocompleteElementRef.current = null;
      }
    };
  }, [onChange, onPlaceSelected, placeholder]);

  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  // Check if API key exists
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
        <div className="text-xs text-red-500 mt-1">
          Google Maps API key not configured
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className={`${className} ${isLoaded ? '' : 'hidden'}`}
        style={{ minHeight: '40px' }}
      />
      {!isLoaded && (
        <input
          type="text"
          value={localValue}
          onChange={handleFallbackInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="off"
        />
      )}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : ''}`} />
      </div>
    </div>
  );
}