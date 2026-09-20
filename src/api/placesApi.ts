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
          return { error: { message: "Seçilen konum bulunamadı. Lütfen farklı bir konum deneyin." }, status: 400 };
        }
      } catch (e) {
        console.warn("[GEOCODING] Network error during geocoding:", e);
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
        
        const { data: cachedVenues, error: cacheError } = await supabaseServer
          .from('venues')
          .select('*')
          .gte('lat', lat - CACHE_RADIUS)
          .lte('lat', lat + CACHE_RADIUS)
          .gte('lng', lng - CACHE_RADIUS)
          .lte('lng', lng + CACHE_RADIUS)
          .gte('updated_at', cutoffTime)
          .limit(20);

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
    // GOOGLE API: Only called if cache miss
    // ═══════════════════════════════════════════════════════════════
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
      
      if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
         throw { response: { data: json } };
      }
      
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

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result = await fetchFromGoogleClassic(intentQuery, lat, lng);
        
        if (!result.places || result.places.length === 0) {
          result = await fetchFromGoogleClassic(`best places`, lat, lng);
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
            const { data: staleVenues } = await supabaseServer
              .from('venues')
              .select('*')
              .gte('lat', lat - CACHE_RADIUS)
              .lte('lat', lat + CACHE_RADIUS)
              .gte('lng', lng - CACHE_RADIUS)
              .lte('lng', lng + CACHE_RADIUS)
              .limit(20);

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
