'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
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
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export function PlacesAutocompleteStyled({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter property address...",
  className = "",
  disabled = false
}: PlacesAutocompleteStyledProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (disabled) return;

    const initPlacesAPI = async () => {
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

        // Initialize Autocomplete Service for getting predictions
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        
        // Initialize Places Service for getting place details (requires a map)
        const mapDiv = document.createElement('div');
        const map = new window.google.maps.Map(mapDiv);
        placesServiceRef.current = new window.google.maps.places.PlacesService(map);

        setIsLoaded(true);
        setIsLoading(false);
        setError(null);
        console.log('✅ Places API initialized successfully');

      } catch (error) {
        console.error('Error initializing Places API:', error);
        setError('Failed to load Places API');
        setIsLoading(false);
        setIsLoaded(false);
      }
    };

    initPlacesAPI();
  }, [disabled]);

  // Handle input changes and fetch predictions
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);

    if (!inputValue.trim() || !autocompleteServiceRef.current) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    try {
      // Get place predictions for US addresses
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: inputValue,
          componentRestrictions: { country: 'us' },
          types: ['address']
        },
        (predictions: any[], status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            console.log('🔍 Got predictions:', predictions.length);
            setPredictions(predictions);
            setShowDropdown(true);
            setSelectedIndex(-1);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
      setShowDropdown(false);
    }
  };

  // Handle prediction selection
  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    try {
      console.log('🎯 Selected prediction:', prediction.description);
      
      // Set the input value immediately - this ensures visible text!
      onChange(prediction.description);
      setShowDropdown(false);
      setPredictions([]);

      // Get detailed place information
      if (placesServiceRef.current && onPlaceSelected) {
        placesServiceRef.current.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['formatted_address', 'name', 'geometry', 'address_components']
          },
          (place: any, status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
              console.log('✅ Got place details:', place);
              
              const placeData = {
                formatted_address: place.formatted_address,
                display_name: place.name,
                location: place.geometry?.location,
                address_components: place.address_components,
                place: place
              };
              
              onPlaceSelected(placeData);
            } else {
              console.warn('❌ Failed to get place details:', status);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error selecting prediction:', error);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handlePredictionSelect(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setPredictions([]);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fallback input for when Google Maps fails to load or while loading
  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  if (error || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
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
    <div className="relative">
      {/* Custom Places Autocomplete Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={isLoading ? "Loading address autocomplete..." : placeholder}
        disabled={disabled || isLoading}
        className={`${className} w-full pr-10`}
        autoComplete="off"
      />
      
      {/* Clear button */}
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setPredictions([]);
            setShowDropdown(false);
            inputRef.current?.focus();
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      
      {/* Icon */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <MapPin className={`h-4 w-4 ${isLoaded ? 'text-green-600' : isLoading ? 'text-gray-400' : 'text-red-400'}`} />
      </div>
      
      {/* Predictions Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              onClick={() => handlePredictionSelect(prediction)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {prediction.structured_formatting ? (
                    <>
                      <div className="font-medium text-gray-900 truncate">
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </>
                  ) : (
                    <div className="font-medium text-gray-900">
                      {prediction.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}