'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin, ArrowLeft } from 'lucide-react';
import { LocationIQAutocomplete } from './locationiq-autocomplete';

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

interface LocationIQAddressModalProps {
  show: boolean;
  onClose: () => void;
  onAddressSelected: (address: string, placeData?: LocationIQResult) => void;
  title?: string;
  placeholder?: string;
  isMobile?: boolean;
  countrycodes?: string;
}

/**
 * LocationIQ Address Modal Component
 * 
 * Features:
 * - LocationIQ Autocomplete API integration
 * - Mobile-first responsive design
 * - Keyboard shortcuts and accessibility
 * - Clean, modern UI with Tailwind CSS
 * - No external dependencies or complex setup
 */
export function LocationIQAddressModal({
  show,
  onClose,
  onAddressSelected,
  title = "Enter Address",
  placeholder = "Search for property address...",
  isMobile = false,
  countrycodes = "us"
}: LocationIQAddressModalProps) {
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [selectedPlaceData, setSelectedPlaceData] = useState<LocationIQResult | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle address selection
  const handleAddressChange = (address: string) => {
    setSelectedAddress(address);
  };

  const handlePlaceSelected = (place: LocationIQResult) => {
    setSelectedAddress(place.display_name);
    setSelectedPlaceData(place);
  };

  // Handle save/confirm
  const handleSave = () => {
    if (selectedAddress) {
      onAddressSelected(selectedAddress, selectedPlaceData || undefined);
      handleClose();
    }
  };

  // Handle close with cleanup
  const handleClose = () => {
    setSelectedAddress("");
    setSelectedPlaceData(null);
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        handleClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (show && inputRef.current) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show) return null;

  if (!process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-red-600">Configuration Error</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            LocationIQ access token is not configured. Please add NEXT_PUBLIC_LOCATIONIQ_TOKEN to your environment variables.
          </p>
          <button
            onClick={handleClose}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Mobile fullscreen modal
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
            <button
              onClick={handleClose}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <h1 className="text-lg font-medium text-gray-900">{title}</h1>
            <div className="w-16"></div>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-4 bg-gray-50">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <LocationIQAutocomplete
                value={selectedAddress}
                onChange={handleAddressChange}
                onPlaceSelected={handlePlaceSelected}
                placeholder={placeholder}
                className="p-4 border border-gray-300 rounded-lg w-full text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ fontSize: '16px' }} // Prevents iOS zoom
                countrycodes={countrycodes}
              />
              
              {/* Instructions */}
              <p className="text-sm text-gray-500 mt-3">
                Type at least 3 characters to search for addresses
              </p>
              
              {/* Selected address display */}
              {selectedAddress && selectedPlaceData && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Selected Address:</p>
                      <p className="text-sm text-green-700">{selectedPlaceData.display_place}</p>
                      <p className="text-xs text-green-600 mt-1">{selectedPlaceData.display_address}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Action button */}
            <div className="mt-4">
              <button
                onClick={handleSave}
                disabled={!selectedAddress}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                {selectedAddress ? 'Confirm Address' : 'Search for an address'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop modal
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      {/* Modal */}
      <div 
        ref={modalRef}
        className="bg-white rounded-lg w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          <LocationIQAutocomplete
            value={selectedAddress}
            onChange={handleAddressChange}
            onPlaceSelected={handlePlaceSelected}
            placeholder={placeholder}
            className="px-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            countrycodes={countrycodes}
          />
          
          {/* Selected address display */}
          {selectedAddress && selectedPlaceData && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-800">Selected:</p>
                  <p className="text-sm text-green-700">{selectedPlaceData.display_place}</p>
                  <p className="text-xs text-green-600 mt-1">{selectedPlaceData.display_address}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedAddress}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Save Address
          </button>
        </div>
      </div>
    </div>
  );
}