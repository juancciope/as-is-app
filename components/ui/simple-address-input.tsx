'use client';

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

interface SimpleAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected?: (address: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SimpleAddressInput({
  value,
  onChange,
  onAddressSelected,
  placeholder = "Enter address...",
  className = "",
  disabled = false
}: SimpleAddressInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Simple debounced search
  useEffect(() => {
    if (!value || value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN;
        if (!token) return;

        const response = await fetch(
          `https://api.locationiq.com/v1/autocomplete?key=${token}&q=${encodeURIComponent(value)}&limit=5&countrycodes=us`
        );
        
        if (response.ok) {
          const results = await response.json();
          setSuggestions(results);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  const handleSelect = (suggestion: any) => {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    if (onAddressSelected) {
      onAddressSelected(suggestion.display_name);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="off"
        />
        <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              onClick={() => handleSelect(suggestion)}
            >
              <div className="font-medium text-sm">{suggestion.display_place}</div>
              <div className="text-xs text-gray-500">{suggestion.display_address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}