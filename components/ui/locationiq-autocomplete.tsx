'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface LocationIQResult {
  place_id: string;
  osm_id: string;
  osm_type: string;
  lat: string;
  lon: string;
  display_name: string;
  display_place: string;
  display_address: string;
  address: {
    name?: string;
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  class: string;
  type: string;
}

interface LocationIQAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: LocationIQResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  limit?: number;
  countrycodes?: string; // e.g., "us" or "us,ca"
}

/**
 * LocationIQ Autocomplete Component
 * 
 * Features:
 * - Debounced API calls for performance
 * - Keyboard navigation (up/down arrows, enter, escape)
 * - Click outside to close
 * - Loading states and error handling
 * - Customizable styling with Tailwind
 * - Country filtering support
 */
export function LocationIQAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter address...",
  className = "",
  disabled = false,
  style,
  limit = 10,
  countrycodes = "us"
}: LocationIQAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationIQResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search function
  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN;
      
      if (!accessToken) {
        throw new Error('LocationIQ access token not configured');
      }

      const params = new URLSearchParams({
        key: accessToken,
        q: query,
        limit: limit.toString(),
        format: 'json',
        normalizecity: '1',
        'accept-language': 'en'
      });

      if (countrycodes) {
        params.append('countrycodes', countrycodes);
      }

      const response = await fetch(`https://api.locationiq.com/v1/autocomplete?${params}`);
      
      if (!response.ok) {
        throw new Error(`LocationIQ API error: ${response.status}`);
      }

      const results: LocationIQResult[] = await response.json();
      setSuggestions(results);
      setShowSuggestions(true);
      setSelectedIndex(-1);
      
    } catch (err) {
      console.error('LocationIQ search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search addresses');
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, [limit, countrycodes]);

  // Debounce search calls
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, searchPlaces]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(null);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationIQResult) => {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setSuggestions([]);
    
    if (onPlaceSelected) {
      onPlaceSelected(suggestion);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prevIndex => 
          prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prevIndex => 
          prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" style={style}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`${className} pr-16`}
          autoComplete="off"
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        
        {/* Clear button */}
        {value && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {/* Map pin icon */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <MapPin className="h-4 w-4" />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.place_id}-${index}`}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => handleSuggestionSelect(suggestion)}
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.display_place || suggestion.address.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {suggestion.display_address}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !isLoading && suggestions.length === 0 && value.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
          <div className="flex items-center text-gray-500">
            <MapPin className="h-4 w-4 mr-2" />
            <span className="text-sm">No addresses found</span>
          </div>
        </div>
      )}
    </div>
  );
}