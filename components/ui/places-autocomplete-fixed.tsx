'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google: any;
    initGooglePlacesFixed?: () => void;
  }
}

interface PlacesAutocompleteFixedProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PlacesAutocompleteFixed({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false
}: PlacesAutocompleteFixedProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Initialize Google Places Autocomplete with simplified approach
  useEffect(() => {
    const initAutocomplete = () => {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.log('Google Maps not loaded yet');
        return;
      }

      if (!inputRef.current || autocompleteRef.current) {
        return;
      }

      try {
        // Create autocomplete with minimal configuration to avoid API issues
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' }
        });

        // Simplified place_changed handler
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          console.log('🔍 Place object received:', place);
          
          if (place) {
            // Try multiple ways to get the address
            let address = '';
            
            if (place.formatted_address) {
              address = place.formatted_address;
              console.log('✅ Using formatted_address:', address);
            } else if (place.name) {
              address = place.name;
              console.log('✅ Using place.name:', address);
            } else if (inputRef.current) {
              address = inputRef.current.value;
              console.log('✅ Using input value:', address);
            }
            
            if (address && address !== localValue) {
              console.log('🎯 Setting address:', address);
              setLocalValue(address);
              onChange(address);
              
              // Force update input
              if (inputRef.current) {
                inputRef.current.value = address;
              }
              
              if (onPlaceSelected) {
                onPlaceSelected(place);
              }
            }
          } else {
            console.log('⚠️ No place object received');
          }
        });

        autocompleteRef.current = autocomplete;
        setIsLoaded(true);
        console.log('✅ Google Places Autocomplete Fixed initialized');
      } catch (error) {
        console.error('Error initializing autocomplete:', error);
      }
    };

    // Load Google Maps script with basic configuration
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGooglePlacesFixed`;
      script.async = true;
      script.defer = true;
      
      window.initGooglePlacesFixed = () => {
        console.log('Google Maps loaded for fixed autocomplete');
        initAutocomplete();
      };
      
      document.head.appendChild(script);
    } else {
      initAutocomplete();
    }

    return () => {
      if (autocompleteRef.current && window.google) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          console.log('Error clearing listeners:', error);
        }
        autocompleteRef.current = null;
      }
    };
  }, [onChange, onPlaceSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('📝 Input changed to:', newValue);
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  // Check if API key exists
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={handleInputChange}
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
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} pr-8`}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : ''}`} />
      </div>
    </div>
  );
}