'use client';

import { useState, useCallback } from 'react';
import { MapPin, Check } from 'lucide-react';

interface AddressInputSimpleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressInputSimple({
  value,
  onChange,
  placeholder = "Enter complete property address...",
  className = "",
  disabled = false
}: AddressInputSimpleProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('📝 Simple address input changed:', newValue);
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const isValidAddress = localValue.length > 10 && localValue.includes(' ');

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${className} pr-8`}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {isValidAddress ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>
      </div>
      
      <div className="text-xs text-gray-600">
        <div className="font-medium mb-1">Enter the complete address including:</div>
        <ul className="list-disc list-inside space-y-0.5 text-gray-500">
          <li>Street number and name</li>
          <li>City, State, ZIP code</li>
          <li>Example: "123 Main St, Nashville, TN 37207"</li>
        </ul>
        {localValue.length > 0 && localValue.length <= 10 && (
          <div className="text-orange-600 mt-2">
            ⚠️ Address seems too short. Please enter the complete address.
          </div>
        )}
        {localValue.length > 10 && !localValue.includes(' ') && (
          <div className="text-orange-600 mt-2">
            ⚠️ Please include street name, city, and state.
          </div>
        )}
        {isValidAddress && (
          <div className="text-green-600 mt-2">
            ✅ Address looks complete!
          </div>
        )}
      </div>
    </div>
  );
}