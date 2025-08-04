# LocationIQ Autocomplete Components

This directory contains LocationIQ-based address autocomplete components that replace Google Places API.

## Components

### LocationIQAutocomplete
A standalone autocomplete input component with full keyboard navigation and debounced API calls.

```tsx
import { LocationIQAutocomplete } from '@/components/ui/locationiq-autocomplete';

<LocationIQAutocomplete
  value={address}
  onChange={setAddress}
  onPlaceSelected={(place) => console.log(place)}
  placeholder="Enter address..."
  countrycodes="us"
  limit={10}
/>
```

### LocationIQAddressModal
A complete modal component for address selection with mobile/desktop responsive design.

```tsx
import { LocationIQAddressModal } from '@/components/ui/locationiq-address-modal';

<LocationIQAddressModal
  show={showModal}
  onClose={() => setShowModal(false)}
  onAddressSelected={(address, placeData) => {
    console.log('Selected:', address);
  }}
  title="Enter Address"
  isMobile={window.innerWidth < 768}
  countrycodes="us"
/>
```

## Environment Setup

Add your LocationIQ access token to your environment variables:

```bash
NEXT_PUBLIC_LOCATIONIQ_TOKEN=your_access_token_here
```

## Features

✅ **Performance**
- Debounced API calls (300ms delay)
- Lightweight bundle (no external map libraries)
- Fast response times with LocationIQ's global CDN

✅ **User Experience**
- Keyboard navigation (arrow keys, enter, escape)
- Click outside to close
- Loading states and error handling
- Mobile-optimized with 16px font (prevents iOS zoom)

✅ **Accessibility**
- ARIA-compliant dropdown
- Screen reader friendly
- Focus management
- Semantic HTML structure

✅ **Customization**
- Country filtering support
- Customizable result limits
- Tailwind CSS styling
- Mobile/desktop responsive design

## API Response Format

LocationIQ returns structured data with separate display fields:

```json
{
  "place_id": "12345",
  "lat": "40.7484284",
  "lon": "-73.985654619873",
  "display_name": "Empire State Building, 350, 5th Avenue, New York City, New York, 10018, United States of America",
  "display_place": "Empire State Building",
  "display_address": "350, 5th Avenue, New York City, New York, 10018, United States of America",
  "address": {
    "name": "Empire State Building",
    "house_number": "350",
    "road": "5th Avenue",
    "city": "New York City",
    "state": "New York",
    "postcode": "10018",
    "country": "United States of America"
  }
}
```

## Migration from Google Places

The LocationIQ components are drop-in replacements with similar APIs:

| Google Places | LocationIQ |
|---------------|------------|
| `formatted_address` | `display_name` |
| `name` | `display_place` |
| `geometry.location` | `lat`, `lon` |
| `address_components` | `address` object |

## Benefits over Google Places

1. **Simpler Integration** - No complex web components or shadow DOM
2. **Better Performance** - Lighter bundle, faster API responses  
3. **No Modal Issues** - No z-index or focus trap problems
4. **Cost Effective** - More generous free tier
5. **Global Coverage** - Same worldwide address data
6. **Easier Styling** - Standard HTML/CSS, no shadow DOM restrictions

## Usage in Production

The components handle all edge cases:
- Missing API tokens (shows helpful error)
- Network failures (retry logic)
- Empty results (user-friendly messaging)
- Mobile optimization (prevents zoom, larger touch targets)
- Accessibility (keyboard navigation, ARIA labels)