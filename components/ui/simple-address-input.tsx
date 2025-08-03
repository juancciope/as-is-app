'use client';

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

interface SimpleAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Common US addresses for autocomplete suggestions
const commonAddressParts = {
  streets: ['Main St', 'First St', 'Second St', 'Third St', 'Park Ave', 'Oak St', 'Elm St', 'Maple Ave', 'Washington St', 'Broadway'],
  cities: ['Nashville', 'Franklin', 'Brentwood', 'Murfreesboro', 'Clarksville', 'Spring Hill', 'Smyrna', 'Gallatin', 'Hendersonville', 'Lebanon'],
  states: ['TN', 'Tennessee'],
  zipCodes: ['37201', '37203', '37205', '37206', '37207', '37208', '37209', '37210', '37211', '37212']
};

export function SimpleAddressInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter address (e.g., 123 Main St, Nashville, TN 37201)",
  className = "",
  disabled = false
}: SimpleAddressInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const generateSuggestions = (input: string) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    const inputLower = input.toLowerCase();
    const suggestionsSet = new Set<string>();

    // If input looks like a street number, suggest common streets
    if (/^\d+\s*/.test(input)) {
      const number = input.match(/^\d+/)?.[0] || '';
      commonAddressParts.streets.forEach(street => {
        suggestionsSet.add(`${number} ${street}, Nashville, TN`);
      });
    }

    // If input contains a city name, suggest full addresses
    commonAddressParts.cities.forEach(city => {
      if (city.toLowerCase().includes(inputLower) || inputLower.includes(city.toLowerCase())) {
        suggestionsSet.add(`123 Main St, ${city}, TN 37201`);
      }
    });

    setSuggestions(Array.from(suggestionsSet).slice(0, 5));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
    generateSuggestions(newValue);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocalValue(suggestion);
    onChange(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    
    if (onPlaceSelected) {
      onPlaceSelected({
        formatted_address: suggestion,
        address_components: []
      });
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} pr-8`}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
        <MapPin className="h-4 w-4" />
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}