'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin, ArrowLeft } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

// TypeScript declarations for Google Places web component
declare global {
  interface Window {
    google: any;
  }
}

interface AddressAutocompleteModalProps {
  show: boolean;
  onClose: () => void;
  onAddressSelected: (address: string, placeData?: any) => void;
  title?: string;
  placeholder?: string;
  isMobile?: boolean;
}

/**
 * Google Places Autocomplete Modal - Complete 2025 Implementation
 * 
 * Based on Google's official 2025 modal integration guide:
 * 
 * ✅ VERIFIED IMPLEMENTATIONS:
 * 
 * 1. JSX MOUNTING: Uses <gmp-place-autocomplete> directly in JSX (not appendChild)
 * 2. API VERSION: Latest v3.65+ with mobile tap/focus bug fixes
 * 3. MODAL STYLING: Ultra-high z-index (999999) for dropdown above modal backdrops
 * 4. MOBILE FIXES: 16px font size prevents iOS zoom, auto-focus on open
 * 5. FLICKER PREVENTION: Component manages own state, no React re-render interference
 * 6. EVENT HANDLING: Uses gmp-select event with proper place field fetching
 * 7. ESCAPE HANDLING: Keyboard shortcuts and body scroll prevention
 * 
 * 🎯 MODAL-SPECIFIC FEATURES:
 * - Force light theme (color-scheme: light) prevents white-on-white text
 * - Solid white backgrounds prevent transparency issues
 * - Custom CSS for both mobile fullscreen and desktop dialog modes
 * - Auto-focus management for mobile accessibility
 * 
 * 📱 MOBILE OPTIMIZATIONS:
 * - Fullscreen modal on mobile for better UX
 * - 16px font prevents iOS auto-zoom
 * - Large touch targets (0.75rem padding)
 * - Proper viewport handling
 * 
 * 🖥 DESKTOP FEATURES:
 * - Traditional modal dialog with backdrop
 * - Escape key support
 * - Click outside to close
 * - Compact sizing for desktop screens
 * 
 * 💾 USAGE EXAMPLE:
 * ```tsx
 * <AddressAutocompleteModal
 *   show={showModal}
 *   onClose={() => setShowModal(false)}
 *   onAddressSelected={(address, placeData) => {
 *     // Save to state or database
 *     console.log('Selected:', address);
 *   }}
 *   isMobile={window.innerWidth < 768}
 * />
 * ```
 */
export function AddressAutocompleteModal({
  show,
  onClose,
  onAddressSelected,
  title = "Enter Address",
  placeholder = "Search for property address...",
  isMobile = false
}: AddressAutocompleteModalProps) {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [selectedPlaceData, setSelectedPlaceData] = useState<any>(null);
  const autocompleteRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load Google Maps Places library when modal opens
  useEffect(() => {
    if (!show) return;

    const loadGoogleMaps = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          console.warn('Google Maps API key not configured');
          return;
        }

        // Check if already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
          setMapsLoaded(true);
          return;
        }

        // Load with latest version for mobile tap fixes
        const loader = new Loader({
          apiKey: apiKey,
          version: "3.65", // Latest version with mobile fixes
          libraries: ["places"]
        });

        await loader.load();
        await window.google.maps.importLibrary("places");
        
        setMapsLoaded(true);
        
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
      }
    };

    loadGoogleMaps();
  }, [show]);

  // Set up autocomplete event listener
  useEffect(() => {
    if (!mapsLoaded || !autocompleteRef.current) return;

    const handleSelect = async (event: any) => {
      const { placePrediction } = event;
      
      if (!placePrediction) return;

      try {
        // Convert to Place object and fetch fields
        const place = placePrediction.toPlace();
        await place.fetchFields({ 
          fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'] 
        });

        const address = place.formattedAddress || place.displayName;
        
        if (address) {
          setSelectedAddress(address);
          setSelectedPlaceData({
            formatted_address: address,
            display_name: place.displayName,
            location: place.location,
            address_components: place.addressComponents,
            place: place.toJSON()
          });
        }
      } catch (error) {
        console.error('Error processing place selection:', error);
      }
    };

    // Use Google's new gmp-select event
    autocompleteRef.current.addEventListener('gmp-select', handleSelect);

    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.removeEventListener('gmp-select', handleSelect);
      }
    };
  }, [mapsLoaded]);

  // Configure autocomplete options
  useEffect(() => {
    if (!mapsLoaded || !autocompleteRef.current) return;

    // Set region restriction to US
    try {
      if ('includedRegionCodes' in autocompleteRef.current) {
        autocompleteRef.current.includedRegionCodes = ['us'];
      }
    } catch (e) {
      // Property might not be available
    }
  }, [mapsLoaded]);

  // Focus management for mobile
  useEffect(() => {
    if (!show || !mapsLoaded || !autocompleteRef.current || !isMobile) return;

    // Auto-focus on mobile after a brief delay to ensure rendering
    const timer = setTimeout(() => {
      try {
        // Try to focus the internal input element
        const input = autocompleteRef.current?.shadowRoot?.querySelector('input') ||
                     autocompleteRef.current?.querySelector('input');
        if (input) {
          input.focus();
        }
      } catch (e) {
        // Fallback - focus the component itself
        autocompleteRef.current?.focus?.();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [show, mapsLoaded, isMobile]);

  // Handle save/confirm
  const handleSave = () => {
    if (selectedAddress) {
      onAddressSelected(selectedAddress, selectedPlaceData);
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

  if (!show) return null;

  // Mobile fullscreen modal
  if (isMobile) {
    return (
      <>
        <style jsx global>{`
          /* Modal-specific autocomplete styling */
          .modal-autocomplete gmp-place-autocomplete {
            background-color: #ffffff !important;
            color-scheme: light !important;
            border: 1px solid rgb(209, 213, 219) !important;
            border-radius: 0.5rem !important;
            z-index: 99999 !important;
            width: 100% !important;
            font-size: 16px !important; /* Prevents iOS zoom */
          }
          
          .modal-autocomplete gmp-place-autocomplete input {
            font-size: 16px !important; /* Prevents iOS zoom */
            padding: 1rem !important;
            color: #111827 !important;
            background: transparent !important;
            border: none !important;
            outline: none !important;
            width: 100% !important;
            -webkit-appearance: none !important;
          }
          
          /* Dropdown with ultra-high z-index for modals */
          .modal-autocomplete gmp-place-autocomplete [role="listbox"] {
            z-index: 999999 !important;
            position: fixed !important;
            background-color: white !important;
            border: 1px solid rgb(229, 231, 235) !important;
            border-radius: 0.5rem !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
            max-height: 300px !important;
            overflow-y: auto !important;
          }
          
          .modal-autocomplete gmp-place-autocomplete [role="option"] {
            padding: 0.75rem 1rem !important;
            cursor: pointer !important;
            font-size: 0.875rem !important;
          }
          
          .modal-autocomplete gmp-place-autocomplete [role="option"]:hover {
            background-color: rgb(243, 244, 246) !important;
          }
        `}</style>
        
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
              <div className="bg-white rounded-lg p-4 border border-gray-200 modal-autocomplete">
                {mapsLoaded ? (
                  <gmp-place-autocomplete
                    ref={autocompleteRef}
                    style={{ 
                      width: '100%',
                      fontSize: '16px' // Prevents iOS zoom
                    }}
                  />
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 animate-pulse">
                    <div className="flex items-center">
                      <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="h-4 bg-gray-300 rounded w-48"></div>
                    </div>
                  </div>
                )}
                
                {/* Instructions */}
                <p className="text-sm text-gray-500 mt-3">
                  Type to search for addresses in the United States
                </p>
                
                {/* Selected address display */}
                {selectedAddress && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Selected Address:</p>
                        <p className="text-sm text-green-700">{selectedAddress}</p>
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
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
                >
                  {selectedAddress ? 'Confirm Address' : 'Search for an address'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop modal
  return (
    <>
      <style jsx global>{`
        /* Desktop modal autocomplete styling */
        .desktop-modal-autocomplete gmp-place-autocomplete {
          background-color: #ffffff !important;
          color-scheme: light !important;
          border: 1px solid rgb(209, 213, 219) !important;
          border-radius: 0.375rem !important;
          z-index: 99999 !important;
          width: 100% !important;
        }
        
        .desktop-modal-autocomplete gmp-place-autocomplete input {
          padding: 0.75rem !important;
          font-size: 0.875rem !important;
          color: #111827 !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          width: 100% !important;
        }
        
        .desktop-modal-autocomplete gmp-place-autocomplete [role="listbox"] {
          z-index: 999999 !important;
          position: fixed !important;
          background-color: white !important;
          border: 1px solid rgb(229, 231, 235) !important;
          border-radius: 0.375rem !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          max-height: 300px !important;
          overflow-y: auto !important;
        }
        
        .desktop-modal-autocomplete gmp-place-autocomplete [role="option"] {
          padding: 0.5rem 0.75rem !important;
          cursor: pointer !important;
          font-size: 0.875rem !important;
        }
        
        .desktop-modal-autocomplete gmp-place-autocomplete [role="option"]:hover {
          background-color: rgb(243, 244, 246) !important;
        }
      `}</style>
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        {/* Modal */}
        <div 
          ref={modalRef}
          className="bg-white rounded-lg w-full max-w-md relative desktop-modal-autocomplete"
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
            {mapsLoaded ? (
              <gmp-place-autocomplete
                ref={autocompleteRef}
                style={{ width: '100%' }}
              />
            ) : (
              <div className="p-3 border border-gray-300 rounded-md bg-gray-50 animate-pulse">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                  <div className="h-4 bg-gray-300 rounded w-40"></div>
                </div>
              </div>
            )}
            
            {/* Selected address display */}
            {selectedAddress && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-800">Selected:</p>
                    <p className="text-sm text-green-700">{selectedAddress}</p>
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
    </>
  );
}