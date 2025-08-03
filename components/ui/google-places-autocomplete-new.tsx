'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    // Check if Google Maps API is loaded
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.log('Waiting for Google Maps API to load...');
      return;
    }

    const initAutocomplete = async () => {
      try {
        // Create a new PlaceAutocompleteElement
        const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'address_components', 'location']
        });

        // Clear container and append the element
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(placeAutocomplete);
        }

        // Handle place selection
        placeAutocomplete.addEventListener('gmp-select', async (event: any) => {
          const place = event.placePrediction;
          if (place) {
            try {
              // Fetch full place details
              const placeDetails = await place.toPlace();
              await placeDetails.fetchFields({
                fields: ['displayName', 'formattedAddress', 'addressComponents', 'location']
              });
              
              const formattedAddress = placeDetails.formattedAddress || placeDetails.displayName;
              onChange(formattedAddress);
              setLocalValue(formattedAddress);
              
              if (onPlaceSelected) {
                onPlaceSelected({
                  formatted_address: formattedAddress,
                  address_components: placeDetails.addressComponents,
                  geometry: {
                    location: placeDetails.location
                  }
                });
              }
            } catch (error) {
              console.error('Error fetching place details:', error);
            }
          }
        });

        setIsLoaded(true);
      } catch (error) {
        console.error('Error creating PlaceAutocompleteElement:', error);
        // Fallback to simple input
      }
    };

    // Initialize when API is ready
    if (window.google && window.google.maps && window.google.maps.places) {
      initAutocomplete();
    } else {
      // Wait for API to load
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(checkInterval);
          initAutocomplete();
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }
  }, [onChange, onPlaceSelected]);

  // Fallback to regular input if Google Maps isn't available
  if (!isLoaded) {
    return (
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setLocalValue(newValue);
            onChange(newValue);
          }}
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
    <div className="relative">
      <div ref={containerRef} className={className} />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MapPin className="h-4 w-4 text-green-600" />
      </div>
    </div>
  );
}