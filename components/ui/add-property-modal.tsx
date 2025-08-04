'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Plus, Loader2 } from 'lucide-react';

// Declare Google Places types
declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProperty: (address: string) => Promise<void>;
  isLoading?: boolean;
}

export function AddPropertyModal({ isOpen, onClose, onAddProperty, isLoading = false }: AddPropertyModalProps) {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

  // Load Google Places API
  useEffect(() => {
    const loadGooglePlaces = () => {
      if (window.google?.maps?.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'));
        setIsGoogleLoaded(true);
        return;
      }

      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=3.61`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
          placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'));
          setIsGoogleLoaded(true);
        };
        document.head.appendChild(script);
      }
    };

    loadGooglePlaces();
  }, []);

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen]);

  // Search Google Places
  useEffect(() => {
    if (!address || address.length < 3 || !isGoogleLoaded || !autocompleteService.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchTimer = setTimeout(() => {
      setIsSearching(true);
      
      autocompleteService.current.getPlacePredictions(
        {
          input: address,
          componentRestrictions: { country: 'us' },
          types: ['address']
        },
        (predictions: any[], status: any) => {
          setIsSearching(false);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions.slice(0, 5));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }
      );
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [address, isGoogleLoaded]);

  const handleSelectAddress = (suggestion: any) => {
    // Get full address from Google Places details
    if (placesService.current && suggestion.place_id) {
      placesService.current.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['formatted_address', 'address_components', 'geometry']
        },
        (place: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            setAddress(place.formatted_address);
          } else {
            setAddress(suggestion.description);
          }
        }
      );
    } else {
      setAddress(suggestion.description);
    }
    
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    try {
      await onAddProperty(address.trim());
      setAddress('');
      setSuggestions([]);
      setShowSuggestions(false);
      onClose();
    } catch (error) {
      console.error('Failed to add property:', error);
    }
  };

  const handleClose = () => {
    setAddress('');
    setSuggestions([]);
    setShowSuggestions(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Property</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Start typing an address..."
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  autoComplete="off"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4 text-gray-400" />
                  )}
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectAddress(suggestion)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-sm text-gray-900">
                          {suggestion.structured_formatting?.main_text || 'Address'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {suggestion.structured_formatting?.secondary_text || suggestion.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* No token warning */}
              {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                <p className="text-xs text-red-600 mt-1">
                  Google Maps API key not configured. Address suggestions unavailable.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!address.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}