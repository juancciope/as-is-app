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

/**
 * Google Places Autocomplete component using traditional implementation
 * - Uses stable Autocomplete class for reliability
 * - Manages controlled input properly to prevent typing issues
 * - Simple, clean implementation without debug modes
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ignoreValueChange = useRef(false);

  // Load Google Maps API once
  useEffect(() => {
    if (disabled) {
      return;
    }
    
    const loadGoogleMaps = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          setError('Google Maps API key not configured for local development');
          setIsLoading(false);
          return;
        }

        // Check if already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsLoading(false);
          setIsLoaded(true);
          return;
        }

        // Load Google Maps API with Places library
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();
        await window.google.maps.importLibrary("places");
        
        setIsLoading(false);
        setIsLoaded(true);
        setError(null);
        
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
        setError(error instanceof Error ? error.message : 'Failed to load Google Maps API');
        setIsLoading(false);
      }
    };
    
    loadGoogleMaps();
  }, [disabled]);
  
  // Set up autocomplete when Google Maps is loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }
    
    try {
      // Create autocomplete instance
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'name', 'geometry', 'address_components']
      });
      
      autocompleteRef.current = autocomplete;
      
      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address) {
          // Set flag to ignore the next value change to prevent loops
          ignoreValueChange.current = true;
          onChange(place.formatted_address);
          
          if (onPlaceSelected) {
            const placeData = {
              formatted_address: place.formatted_address,
              display_name: place.name,
              location: place.geometry?.location,
              address_components: place.address_components,
              place: place
            };
            onPlaceSelected(placeData);
          }
        }
      });
      
    } catch (error) {
      console.error('Error setting up autocomplete:', error);
      setError('Failed to setup autocomplete');
    }
  }, [isLoaded, onChange, onPlaceSelected]);
  
  // Clean up autocomplete on unmount
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If this change is from autocomplete selection, ignore it
    if (ignoreValueChange.current) {
      ignoreValueChange.current = false;
      return;
    }
    onChange(e.target.value);
  };

  // For local development, show a working input when API key is missing
  if (error && error.includes('local development')) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
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

  // Show error state
  if (error && !error.includes('local development')) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
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
    <div className="relative" style={style}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className={`${className} ${isLoading ? 'animate-pulse' : ''}`}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : isLoading ? 'text-gray-400' : ''}`} />
      </div>
    </div>
  );
}