import { createServerFn } from '@tanstack/react-start';

export const getPhotoUrlFromServer = createServerFn({ method: 'GET' })
  .validator((data: { photoName: string; maxHeight?: number; maxWidth?: number }) => data)
  .handler(async ({ data }) => {
    const { photoName, maxHeight = 800, maxWidth = 1280 } = data;
    const apiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'] || "AIzaSyAu9A-k9X4aKM3prE6HdVOX7PKor8nqn_o";
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
    const apiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'] || "AIzaSyAu9A-k9X4aKM3prE6HdVOX7PKor8nqn_o";

    if (!apiKey) {
      return { error: "Servis geçici olarak kullanılamıyor." };
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
    lat?: number | undefined;
    lng?: number | undefined;
  }) => data)
  .handler(async ({ data }) => {
    const { locationStr, intentQuery, activeRegionBbox } = data;
    const providedLat = data.lat;
    const providedLng = data.lng;
    const googleApiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'] || "AIzaSyAu9A-k9X4aKM3prE6HdVOX7PKor8nqn_o";

    if (!googleApiKey) {
      return { error: { message: "Servis geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin." } };
    }

    let lat = providedLat || 0;
    let lng = providedLng || 0;
    let currentBbox = activeRegionBbox;

    let geoCountry = "";
    let geoState = "";
    let geoCity = "";

    // ═══════════════════════════════════════════════════════════════
    // ZERO-TOLERANCE GEO-FILTERING: Always extract official boundaries
    // ═══════════════════════════════════════════════════════════════
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationStr)}&key=${googleApiKey}`);
      const geocodeData = await res.json();
      
      if (geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
        const result = geocodeData.results[0];
        
        // Use geocoded coordinates ONLY if frontend didn't provide specific map-click coordinates
        if (!providedLat || !providedLng) {
          lat = result.geometry.location.lat;
          lng = result.geometry.location.lng;
          if (!currentBbox && result.geometry.viewport) {
            currentBbox = [
              result.geometry.viewport.southwest.lat.toString(),
              result.geometry.viewport.northeast.lat.toString(),
              result.geometry.viewport.southwest.lng.toString(),
              result.geometry.viewport.northeast.lng.toString()
            ];
          }
        }

        // Extract strict geo-hierarchy for zero-tolerance filtering
        if (result.address_components) {
          result.address_components.forEach((comp: any) => {
            if (comp.types.includes("country")) geoCountry = comp.long_name;
            if (comp.types.includes("administrative_area_level_1")) geoState = comp.long_name;
            if (comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")) {
              if (!geoCity) geoCity = comp.long_name;
            }
          });
        }
      } else {
        console.warn("[GEOCODING] Could not resolve coordinates for:", locationStr, geocodeData.status);
        if (!providedLat || !providedLng) {
          return { error: { message: "Seçilen konum bulunamadı. Lütfen farklı bir konum deneyin." }, status: 400 };
        }
      }
    } catch (e) {
      console.warn("[GEOCODING] Network error during geocoding:", e);
      if (!providedLat || !providedLng) {
        return { error: { message: "Konum servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin." }, status: 500 };
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CACHE LAYER: Check Supabase first before hitting Google API
    // ═══════════════════════════════════════════════════════════════
    const { supabaseServer } = await import('../lib/supabaseServer');
    
    const CACHE_TTL_HOURS = 24;
    const CACHE_RADIUS = 0.045; // ~5km bounding box
    const MIN_CACHED_RESULTS = 5;

    if (supabaseServer) {
      try {
        const cutoffTime = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
        
        let cacheQuery = supabaseServer
          .from('venues')
          .select('*')
          .gte('lat', lat - CACHE_RADIUS)
          .lte('lat', lat + CACHE_RADIUS)
          .gte('lng', lng - CACHE_RADIUS)
          .lte('lng', lng + CACHE_RADIUS)
          .gte('updated_at', cutoffTime)
          .limit(20);

        // Enforce strict geo-filtering in Cache
        if (geoCountry) cacheQuery = cacheQuery.ilike('country', `%${geoCountry}%`);
        if (geoCity) cacheQuery = cacheQuery.ilike('city', `%${geoCity}%`);
        
        const { data: cachedVenues, error: cacheError } = await cacheQuery;

        if (!cacheError && cachedVenues && cachedVenues.length >= MIN_CACHED_RESULTS) {
          console.log(`[CACHE HIT] ${cachedVenues.length} mekan Supabase cache'den getirildi (Google'a istek atılmadı)`);
          
          const cachedPlaces = cachedVenues.map((v: any) => ({
            id: v.google_place_id,
            displayName: { text: v.name },
            formattedAddress: v.address || "",
            location: { latitude: v.lat, longitude: v.lng },
            rating: v.rating || 0,
            userRatingCount: v.user_rating_count || 0,
            priceLevel: v.price_level === "₺₺₺" ? "PRICE_LEVEL_EXPENSIVE" 
                      : v.price_level === "₺₺" ? "PRICE_LEVEL_MODERATE"
                      : v.price_level === "₺" ? "PRICE_LEVEL_INEXPENSIVE" 
                      : "",
            types: [],
            photos: v.image_url && v.image_url.startsWith('photo:') 
              ? [{ photo_reference: v.image_url.replace('photo:', '') }] 
              : []
          }));

          return { data: { places: cachedPlaces }, newBbox: currentBbox, fromCache: true };
        } else {
          console.log(`[CACHE MISS] Cache'de yeterli sonuç yok (${cachedVenues?.length || 0} bulundu, ${MIN_CACHED_RESULTS} gerekli). Google'a soruluyor...`);
        }
      } catch (cacheErr) {
        console.warn("[CACHE] Supabase cache sorgusu başarısız, Google'a devam ediliyor:", cacheErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE API: Strict Text Search Enforcement
    // ═══════════════════════════════════════════════════════════════
    const fetchFromGoogleTextSearch = async (query: string, searchLocationStr: string) => {
      // Force Google to respect political boundaries by appending the explicit location
      const strictQuery = `${query} in ${searchLocationStr}`;
      
      const params = new URLSearchParams({
        query: strictQuery,
        key: googleApiKey
      });

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw { response: { data: errorData }, status: res.status };
      }
      
      const json = await res.json();
      
      if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
         throw { response: { data: json } };
      }
      
      let normalizedPlaces = (json.results || []).map((place: any) => {
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

      // ═══════════════════════════════════════════════════════════════
      // ZERO-TOLERANCE POST-FETCH FILTERING
      // ═══════════════════════════════════════════════════════════════
      if (geoCountry) {
        normalizedPlaces = normalizedPlaces.filter((place: any) => {
          const addr = place.formattedAddress.toLowerCase();
          
          // Basic string matching. Some addresses don't have country if local, but we check if we have city/state.
          // To prevent dropping all venues if Google omits the country name, we check if AT LEAST ONE
          // of the extracted geo regions (City, State, or Country) appears in the address.
          const countryMatch = geoCountry ? addr.includes(geoCountry.toLowerCase()) : false;
          const cityMatch = geoCity ? addr.includes(geoCity.toLowerCase()) : false;
          const stateMatch = geoState ? addr.includes(geoState.toLowerCase()) : false;
          
          // Zero tolerance: It MUST match the extracted location somewhere in the formatted address.
          return countryMatch || cityMatch || stateMatch;
        });
      }

      return { places: normalizedPlaces };
    };

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result = await fetchFromGoogleTextSearch(intentQuery, locationStr);
        
        if (!result.places || result.places.length === 0) {
          result = await fetchFromGoogleTextSearch(`best places`, locationStr);
        }

        return { data: result, newBbox: currentBbox };
        
      } catch (e: any) {
        console.error(`[Attempt ${attempt}/${maxRetries}] Google Classic API Hatası:`, e.response?.data || e);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        // ═══════════════════════════════════════════════════════════
        // STALE CACHE FALLBACK: If Google completely fails, show old data
        // ═══════════════════════════════════════════════════════════
        if (supabaseServer) {
          try {
            let staleQuery = supabaseServer
              .from('venues')
              .select('*')
              .gte('lat', lat - CACHE_RADIUS)
              .lte('lat', lat + CACHE_RADIUS)
              .gte('lng', lng - CACHE_RADIUS)
              .lte('lng', lng + CACHE_RADIUS)
              .limit(20);

            // Enforce strict geo-filtering in Stale Cache
            if (geoCountry) staleQuery = staleQuery.ilike('country', `%${geoCountry}%`);
            if (geoCity) staleQuery = staleQuery.ilike('city', `%${geoCity}%`);
            
            const { data: staleVenues } = await staleQuery;

            if (staleVenues && staleVenues.length > 0) {
              console.log(`[STALE CACHE] Google çöktü ama ${staleVenues.length} mekan eski cache'den getirildi`);
              
              const stalePlaces = staleVenues.map((v: any) => ({
                id: v.google_place_id,
                displayName: { text: v.name },
                formattedAddress: v.address || "",
                location: { latitude: v.lat, longitude: v.lng },
                rating: v.rating || 0,
                userRatingCount: v.user_rating_count || 0,
                priceLevel: v.price_level === "₺₺₺" ? "PRICE_LEVEL_EXPENSIVE" 
                          : v.price_level === "₺₺" ? "PRICE_LEVEL_MODERATE"
                          : v.price_level === "₺" ? "PRICE_LEVEL_INEXPENSIVE" 
                          : "",
                types: [],
                photos: v.image_url && v.image_url.startsWith('photo:') 
                  ? [{ photo_reference: v.image_url.replace('photo:', '') }] 
                  : []
              }));

              return { data: { places: stalePlaces }, newBbox: currentBbox, fromCache: true };
            }
          } catch (staleCacheErr) {
            console.warn("[STALE CACHE] Eski cache sorgusu da başarısız:", staleCacheErr);
          }
        }
        
        return { error: { message: "Şu anda mekan bilgilerine ulaşılamıyor. Lütfen birkaç saniye bekleyip tekrar deneyin." }, status: 500 };
      }
    }
    return { error: { message: "Şu anda mekan bilgilerine ulaşılamıyor. Lütfen birkaç saniye bekleyip tekrar deneyin." }, status: 500 };
  });
