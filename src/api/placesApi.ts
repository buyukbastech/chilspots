import { createServerFn } from '@tanstack/react-start';

export const fetchVenuesFromServer = createServerFn({ method: 'GET' })
  .validator((data: {
    locationStr: string;
    vibeStr: string;
    language: string;
    activeRegionBbox: string[] | null;
    intentQuery: string;
  }) => data)
  .handler(async ({ data }) => {
    const { locationStr, intentQuery, activeRegionBbox } = data;
    const googleApiKey = process.env['GOOGLE_PLACES_SECRET_KEY'];

    if (!googleApiKey) {
      return { error: { message: "API Key bulunamadı (.env dosyanızı kontrol edin)" } };
    }

    let lat = 0;
    let lng = 0;
    let currentBbox = activeRegionBbox;

    // Strict Geocoding
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`, {
        headers: { "User-Agent": "ChillSpot AI Server" }
      });
      const osmMata = await res.json();
      
      if (osmMata && osmMata[0]) {
        if (!currentBbox) currentBbox = osmMata[0].boundingbox;
        lat = parseFloat(osmMata[0].lat);
        lng = parseFloat(osmMata[0].lon);
      } else {
        console.warn("[GEOCODING] Could not resolve coordinates for:", locationStr);
        return { error: { message: "Lokasyon bulunamadı. Lütfen geçerli bir şehir girin." }, status: 400 };
      }
    } catch (e) {
      console.warn("[GEOCODING] Network error during geocoding:", e);
      return { error: { message: "Lokasyon servisi geçici olarak kullanılamıyor." }, status: 500 };
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
          // To avoid breaking the frontend v1 media URLs, we leave photos empty to trigger the safe Unsplash fallback for now.
          photos: [] 
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
