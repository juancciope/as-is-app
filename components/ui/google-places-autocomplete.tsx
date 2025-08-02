'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';

const libraries: ("places")[] = ["places"];

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter address...",
  className = "",
  disabled = false
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { isLoaded: scriptLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  useEffect(() => {
    if (!scriptLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      // Create autocomplete instance
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' }, // Restrict to US addresses
        fields: ['formatted_address', 'address_components', 'geometry']
      });

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address) {
          onChange(place.formatted_address);
          if (onPlaceSelected) {
            onPlaceSelected(place);
          }
        }
      });

      autocompleteRef.current = autocomplete;
      setIsLoaded(true);
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [scriptLoaded, onChange, onPlaceSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Show loading state if API key is missing
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`relative ${className}`}>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pr-8 ${className}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled || !scriptLoaded}
        className={`w-full pr-8 ${className}`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
        <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : ''}`} />
      </div>
    </div>
  );
}