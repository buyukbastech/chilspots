import { createServerFn } from '@tanstack/react-start';

export const getPhotoUrlFromServer = createServerFn({ method: 'GET' })
  .validator((data: { photoName: string; maxHeight?: number; maxWidth?: number }) => data)
  .handler(async ({ data }) => {
    const { photoName, maxHeight = 800, maxWidth = 1280 } = data;
    const apiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'];
    if (!apiKey) return { url: null };

    try {
      let url = "";
      if (photoName.includes('/')) {
        url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}&key=${apiKey}`;
      } else {
        url = `https://maps.googleapis.com/maps/api/place/photo?maxheight=${maxHeight}&maxwidth=${maxWidth}&photoreference=${photoName}&key=${apiKey}`;
      }
      const res = await fetch(url, { redirect: 'manual' });
      
      if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
        return { url: res.headers.get('location') };
      }
      
      // If no redirect, return null since we shouldn't expose the url with the API key directly
      return { url: null };
    } catch (e) {
      return { url: null };
    }
  });

export const fetchPlaceDetailsFromServer = createServerFn({ method: 'GET' })
  .validator((data: { placeId: string; language: string }) => data)
  .handler(async ({ data }) => {
    const { placeId, language } = data;
    const apiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'];

    if (!apiKey) {
      return { error: "API Key bulunamadı" };
    }

    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${language}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location,priceLevel,rating,userRatingCount,photos,currentOpeningHours,internationalPhoneNumber,websiteUri,reviews,editorialSummary,googleMapsUri"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch place details");
      return await res.json();
    } catch (e: any) {
      console.error(e);
      return { error: e.message };
    }
  });

export const fetchVenuesFromServer = createServerFn({ method: 'GET' })
  .validator((data: {
    locationStr: string;
    vibeStr: string;
    language: string;
    activeRegionBbox: string[] | null;
    intentQuery: string;
    lat?: number;
    lng?: number;
  }) => data)
  .handler(async ({ data }) => {
    const { locationStr, intentQuery, activeRegionBbox } = data;
    const providedLat = data.lat;
    const providedLng = data.lng;
    const googleApiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'];

    if (!googleApiKey) {
      return { error: { message: "API Key bulunamadı (.env dosyanızı kontrol edin)" } };
    }

    let lat = providedLat || 0;
    let lng = providedLng || 0;
    let currentBbox = activeRegionBbox;

    // Strict Geocoding using Google Geocoding API if coordinates are not provided
    if (!providedLat || !providedLng) {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationStr)}&key=${googleApiKey}`);
        const geocodeData = await res.json();
        
        if (geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
          const location = geocodeData.results[0].geometry.location;
          const viewport = geocodeData.results[0].geometry.viewport;
          
          lat = location.lat;
          lng = location.lng;
          
          if (!currentBbox && viewport) {
            currentBbox = [
              viewport.southwest.lat.toString(),
              viewport.northeast.lat.toString(),
              viewport.southwest.lng.toString(),
              viewport.northeast.lng.toString()
            ];
          }
        } else {
          console.warn("[GEOCODING] Could not resolve coordinates for:", locationStr, geocodeData.status);
          return { error: { message: "Lokasyon bulunamadı. Lütfen haritadan geçerli bir konum seçin." }, status: 400 };
        }
      } catch (e) {
        console.warn("[GEOCODING] Network error during geocoding:", e);
        return { error: { message: "Lokasyon servisi geçici olarak kullanılamıyor." }, status: 500 };
      }
    }

    // Classic Google Places API (Nearby Search)
    const fetchFromGoogleClassic = async (query: string, latitude: number, longitude: number) => {
      const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: "5000",
        keyword: query,
        key: googleApiKey
      });

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw { response: { data: errorData }, status: res.status };
      }
      
      const json = await res.json();
      
      // Handle Google API's internal error statuses (e.g., REQUEST_DENIED)
      if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
         throw { response: { data: json } };
      }
      
      // Map Classic API "results" array to Frontend's expected V1 format
      const normalizedPlaces = (json.results || []).map((place: any) => {
        
        let mappedPrice = "";
        if (place.price_level === 4 || place.price_level === 3) mappedPrice = "PRICE_LEVEL_EXPENSIVE";
        else if (place.price_level === 2) mappedPrice = "PRICE_LEVEL_MODERATE";
        else if (place.price_level === 1) mappedPrice = "PRICE_LEVEL_INEXPENSIVE";

        return {
          id: place.place_id,
          displayName: { text: place.name },
          formattedAddress: place.vicinity || place.formatted_address || "",
          location: {
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng
          },
          rating: place.rating || 0,
          userRatingCount: place.user_ratings_total || 0,
          priceLevel: mappedPrice,
          types: place.types || [],
          photos: place.photos ? place.photos.map((p: any) => ({
             photo_reference: p.photo_reference
          })) : []
        };
      });

      return { places: normalizedPlaces };
    };

    try {
      let result = await fetchFromGoogleClassic(intentQuery, lat, lng);
      
      if (!result.places || result.places.length === 0) {
        // Fallback broad search
        result = await fetchFromGoogleClassic(`best places`, lat, lng);
      }

      return { data: result, newBbox: currentBbox };
      
    } catch (e: any) {
      console.error("Google Classic API Hatası:", e.response?.data || e);
      return { error: { message: "Mekan verilerine ulaşılamadı. Lütfen API yetkilerinizi kontrol edin." }, status: 500 };
    }
  });
