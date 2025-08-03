'use client';

import { useState, useCallback } from 'react';
import { MapPin, Check, AlertCircle } from 'lucide-react';

interface AddressInputFinalProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressInputFinal({
  value,
  onChange,
  placeholder = "Enter complete property address...",
  className = "",
  disabled = false
}: AddressInputFinalProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  // Simple validation for complete addresses
  const isValidAddress = localValue.length > 15 && 
                        localValue.includes(' ') && 
                        (localValue.includes(',') || localValue.toLowerCase().includes('tn') || localValue.toLowerCase().includes('tennessee'));

  const isIncomplete = localValue.length > 0 && localValue.length <= 10;

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
          ) : isIncomplete ? (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>
      </div>
      
      <div className="text-xs">
        <div className="text-gray-600 mb-1">
          <span className="font-medium">Enter complete address including:</span>
        </div>
        <div className="text-gray-500 space-y-0.5">
          <div>• Street number and name</div>
          <div>• City, State, ZIP code</div>
          <div className="text-gray-400">Example: "123 Main St, Nashville, TN 37203"</div>
        </div>
        
        {isIncomplete && (
          <div className="text-orange-600 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Address seems too short - please include city and state
          </div>
        )}
        
        {isValidAddress && (
          <div className="text-green-600 mt-2 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Address looks complete!
          </div>
        )}
      </div>
    </div>
  );
}