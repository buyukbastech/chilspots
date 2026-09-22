import { createServerFn } from '@tanstack/react-start';

export const getPhotoUrlFromServer = createServerFn({ method: 'GET' })
  .validator((data: { photoName: string; maxHeight?: number; maxWidth?: number }) => data)
  .handler(async ({ data }) => {
    const { photoName, maxHeight = 800, maxWidth = 1280 } = data;
    
    // Check if it's a Foursquare photo reference (fsq|PREFIX|SUFFIX)
    if (photoName.startsWith('fsq|')) {
      const parts = photoName.split('|');
      if (parts.length === 3) {
        const prefix = parts[1];
        const suffix = parts[2];
        return { url: `${prefix}${maxWidth}x${maxHeight}${suffix}` };
      }
    }

    // Fallback for old Google photos or Supabase photos
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
      
      return { url: null };
    } catch (e) {
      return { url: null };
    }
  });

export const fetchPlaceDetailsFromServer = createServerFn({ method: 'GET' })
  .validator((data: { placeId: string; language: string }) => data)
  .handler(async ({ data }) => {
    const { placeId, language } = data;
    const apiKey = process.env['FOURSQUARE_API_KEY'];

    if (!apiKey) {
      return { error: "Servis geçici olarak kullanılamıyor." };
    }

    try {
      // Foursquare Place Details
      const res = await fetch(`https://api.foursquare.com/v3/places/${placeId}?language=${language}&fields=fsq_id,name,location,rating,stats,price,photos,tel,website,description`, {
        method: "GET",
        headers: {
          "Authorization": apiKey,
          "Accept": "application/json"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch place details from Foursquare");
      const json = await res.json();
      
      // Map Foursquare to the format frontend expects
      return {
        id: json.fsq_id,
        displayName: { text: json.name },
        formattedAddress: json.location?.formatted_address || "",
        location: { latitude: json.location?.geocodes?.main?.latitude, longitude: json.location?.geocodes?.main?.longitude },
        rating: json.rating ? (json.rating / 2) : 0, // Foursquare rating is out of 10
        userRatingCount: json.stats?.total_ratings || 0,
        priceLevel: json.price === 3 || json.price === 4 ? "PRICE_LEVEL_EXPENSIVE" 
                  : json.price === 2 ? "PRICE_LEVEL_MODERATE" 
                  : json.price === 1 ? "PRICE_LEVEL_INEXPENSIVE" : "",
        internationalPhoneNumber: json.tel || "",
        websiteUri: json.website || "",
        editorialSummary: { text: json.description || "" },
        reviews: [], // Foursquare v3 doesn't return reviews directly on this endpoint without a separate call
        photos: json.photos ? json.photos.map((p: any) => ({
           name: `fsq|${p.prefix}|${p.suffix}`,
           photo_reference: `fsq|${p.prefix}|${p.suffix}`
        })) : []
      };
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
    const foursquareApiKey = process.env['FOURSQUARE_API_KEY'];

    if (!foursquareApiKey) {
      return { error: { message: "Servis geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin." } };
    }

    let lat = providedLat || 0;
    let lng = providedLng || 0;
    let currentBbox = activeRegionBbox;

    // Foursquare API can search by 'near' string directly, so we don't strict geocode first if we don't have lat/lng
    
    // ═══════════════════════════════════════════════════════════════
    // CACHE LAYER: Check Supabase first before hitting Foursquare
    // ═══════════════════════════════════════════════════════════════
    const { supabaseServer } = await import('../lib/supabaseServer');
    
    const CACHE_TTL_HOURS = 24;
    const CACHE_RADIUS = 0.045; // ~5km bounding box
    const MIN_CACHED_RESULTS = 5;

    // We skip cache if we don't have lat/lng from the frontend map bounds, because searching by string in DB is harder without full text search
    if (supabaseServer && lat !== 0 && lng !== 0) {
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

        const { data: cachedVenues, error: cacheError } = await cacheQuery;

        if (!cacheError && cachedVenues && cachedVenues.length >= MIN_CACHED_RESULTS) {
          console.log(`[CACHE HIT] ${cachedVenues.length} mekan Supabase cache'den getirildi`);
          
          const cachedPlaces = cachedVenues.map((v: any) => ({
            id: v.google_place_id, // We reuse this column for fsq_id
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
            photos: v.image_url && (v.image_url.startsWith('photo:') || v.image_url.startsWith('fsq|'))
              ? [{ photo_reference: v.image_url.replace('photo:', '') }] 
              : []
          }));

          return { data: { places: cachedPlaces }, newBbox: currentBbox, fromCache: true };
        }
      } catch (cacheErr) {
        console.warn("[CACHE] Supabase cache sorgusu başarısız:", cacheErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FOURSQUARE API
    // ═══════════════════════════════════════════════════════════════
    const fetchFromFoursquare = async (query: string, searchLocationStr: string) => {
      const params = new URLSearchParams({
        query: query,
        near: searchLocationStr,
        limit: "20",
        fields: "fsq_id,name,location,rating,stats,price,photos,geocodes"
      });

      const url = `https://api.foursquare.com/v3/places/search?${params.toString()}`;
      const res = await fetch(url, { 
        method: "GET",
        headers: {
          "Authorization": foursquareApiKey,
          "Accept": "application/json"
        }
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw { response: { data: errorData }, status: res.status };
      }
      
      const json = await res.json();
      
      // Determine center/bbox from the first result if we don't have lat/lng
      if ((lat === 0 || lng === 0) && json.results && json.results.length > 0) {
         lat = json.results[0].geocodes?.main?.latitude || lat;
         lng = json.results[0].geocodes?.main?.longitude || lng;
      }

      const normalizedPlaces = (json.results || []).map((place: any) => {
        let mappedPrice = "";
        if (place.price === 4 || place.price === 3) mappedPrice = "PRICE_LEVEL_EXPENSIVE";
        else if (place.price === 2) mappedPrice = "PRICE_LEVEL_MODERATE";
        else if (place.price === 1) mappedPrice = "PRICE_LEVEL_INEXPENSIVE";

        return {
          id: place.fsq_id,
          displayName: { text: place.name },
          formattedAddress: place.location?.formatted_address || "",
          location: {
            latitude: place.geocodes?.main?.latitude,
            longitude: place.geocodes?.main?.longitude
          },
          rating: place.rating ? (place.rating / 2) : 0, // Convert 10-scale to 5-scale
          userRatingCount: place.stats?.total_ratings || 0,
          priceLevel: mappedPrice,
          types: [],
          photos: place.photos ? place.photos.map((p: any) => ({
             photo_reference: `fsq|${p.prefix}|${p.suffix}`
          })) : []
        };
      });

      return { places: normalizedPlaces };
    };

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result = await fetchFromFoursquare(intentQuery, locationStr);
        
        if (!result.places || result.places.length === 0) {
           result = await fetchFromFoursquare("best places", locationStr);
        }

        return { data: result, newBbox: currentBbox };
        
      } catch (e: any) {
        console.error(`[Attempt ${attempt}/${maxRetries}] Foursquare API Hatası:`, e.response?.data || e);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        // ═══════════════════════════════════════════════════════════
        // STALE CACHE FALLBACK
        // ═══════════════════════════════════════════════════════════
        if (supabaseServer && lat !== 0 && lng !== 0) {
          try {
            let staleQuery = supabaseServer
              .from('venues')
              .select('*')
              .gte('lat', lat - CACHE_RADIUS)
              .lte('lat', lat + CACHE_RADIUS)
              .gte('lng', lng - CACHE_RADIUS)
              .lte('lng', lng + CACHE_RADIUS)
              .limit(20);
            
            const { data: staleVenues } = await staleQuery;

            if (staleVenues && staleVenues.length > 0) {
              console.log(`[STALE CACHE] API çöktü ama ${staleVenues.length} mekan eski cache'den getirildi`);
              
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
                photos: v.image_url && (v.image_url.startsWith('photo:') || v.image_url.startsWith('fsq|'))
                  ? [{ photo_reference: v.image_url.replace('photo:', '') }] 
                  : []
              }));

              return { data: { places: stalePlaces }, newBbox: currentBbox, fromCache: true };
            }
          } catch (staleCacheErr) {}
        }
        
        return { error: { message: "Şu anda mekan bilgilerine ulaşılamıyor." }, status: 500 };
      }
    }
    return { error: { message: "Şu anda mekan bilgilerine ulaşılamıyor." }, status: 500 };
  });
