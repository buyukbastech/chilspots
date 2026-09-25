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

    // Initialize supabaseServer
    let supabaseServer: any = null;
    try {
      const sbMod = await import('../lib/supabaseServer');
      supabaseServer = sbMod.supabaseServer;
    } catch (e) {}

    // 1. Check DB Cache
    if (supabaseServer) {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: cachedPhoto } = await supabaseServer
          .from('photo_cache')
          .select('photo_url')
          .eq('photo_name', photoName)
          .gte('fetched_at', thirtyDaysAgo)
          .single();
          
        if (cachedPhoto && cachedPhoto.photo_url) {
          return { url: cachedPhoto.photo_url };
        }
      } catch (err) {
        // Ignore cache lookup errors, just fetch
      }
    }

    try {
      let url = "";
      if (photoName.includes('/')) {
        url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}&key=${apiKey}`;
      } else {
        url = `https://maps.googleapis.com/maps/api/place/photo?maxheight=${maxHeight}&maxwidth=${maxWidth}&photoreference=${photoName}&key=${apiKey}`;
      }
      const res = await fetch(url, { redirect: 'manual' });
      
      if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
        const locationUrl = res.headers.get('location');
        if (locationUrl && supabaseServer) {
          // Save to cache
          try {
            await supabaseServer.from('photo_cache').upsert({
              photo_name: photoName,
              photo_url: locationUrl,
              fetched_at: new Date().toISOString()
            }, { onConflict: 'photo_name' });
          } catch (cacheErr) {
            console.error("Cache save error:", cacheErr);
          }
        }
        return { url: locationUrl };
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
    const apiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'];

    if (!apiKey) {
      return { error: "Servis geçici olarak kullanılamıyor." };
    }

    try {
      const isFsq = placeId.startsWith('fsq|') || placeId.length === 24;
      if (isFsq) {
        const fsqKey = process.env['FOURSQUARE_API_KEY'] || process.env['VITE_FOURSQUARE_API_KEY'] || "304M0FLWEVEDW1BQRYWA4RHW5ACLGMJOVZZ4SP5TZLSGR25M";
        const res = await fetch(`https://api.foursquare.com/v3/places/${placeId}?language=${language}&fields=fsq_id,name,location,rating,stats,price,photos,tel,website,description`, {
          method: "GET",
          headers: { "Authorization": fsqKey, "Accept": "application/json" }
        });
        if (res.ok) {
          const json = await res.json();
          return {
            id: json.fsq_id,
            displayName: { text: json.name },
            formattedAddress: json.location?.formatted_address || "",
            location: { latitude: json.location?.geocodes?.main?.latitude, longitude: json.location?.geocodes?.main?.longitude },
            rating: json.rating ? (json.rating / 2) : 0,
            userRatingCount: json.stats?.total_ratings || 0,
            priceLevel: json.price === 3 || json.price === 4 ? "PRICE_LEVEL_EXPENSIVE" 
                      : json.price === 2 ? "PRICE_LEVEL_MODERATE" 
                      : json.price === 1 ? "PRICE_LEVEL_INEXPENSIVE" : "",
            internationalPhoneNumber: json.tel || "",
            websiteUri: json.website || "",
            editorialSummary: { text: json.description || "" },
            reviews: [],
            photos: json.photos ? json.photos.map((p: any) => ({
               name: `fsq|${p.prefix}|${p.suffix}`,
               photo_reference: `fsq|${p.prefix}|${p.suffix}`
            })) : []
          };
        }
      }

      // Google Places API
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${language}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,internationalPhoneNumber,websiteUri,editorialSummary,reviews,photos"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch place details from Google");
      const json = await res.json();
      return json;
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
    const googleApiKey = process.env['GOOGLE_PLACES_SECRET_KEY'] || process.env['VITE_GOOGLE_PLACES_API_KEY'];

    if (!googleApiKey) {
      return { error: { message: "Servis geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin." } };
    }

    let lat = providedLat || 0;
    let lng = providedLng || 0;
    let currentBbox = activeRegionBbox;

    // ═══════════════════════════════════════════════════════════════
    // CACHE LAYER: Check Supabase first before hitting Google
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
              ? [{ name: v.image_url.replace('photo:', ''), photo_reference: v.image_url.replace('photo:', '') }] 
              : []
          }));

          return { data: { places: cachedPlaces }, newBbox: currentBbox, fromCache: true };
        }
      } catch (cacheErr) {
        console.warn("[CACHE] Supabase cache sorgusu başarısız:", cacheErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE PLACES API (Text Search)
    // ═══════════════════════════════════════════════════════════════
    const fetchFromGoogle = async (query: string, searchLocationStr: string) => {
      const textQuery = `${query} in ${searchLocationStr}`;
      const url = `https://places.googleapis.com/v1/places:searchText`;
      
      const res = await fetch(url, { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          // Removed expensive fields to stay within Basic Data SKU
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types"
        },
        body: JSON.stringify({
          textQuery: textQuery,
          languageCode: data.language || "tr",
          maxResultCount: 20
        })
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw { response: { data: errorData }, status: res.status };
      }
      
      const json = await res.json();
      
      // Determine center/bbox from the first result if we don't have lat/lng
      if ((lat === 0 || lng === 0) && json.places && json.places.length > 0) {
         lat = json.places[0].location?.latitude || lat;
         lng = json.places[0].location?.longitude || lng;
      }

      return { places: json.places || [] };
    };

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let result = await fetchFromGoogle(intentQuery, locationStr);
        
        if (!result.places || result.places.length === 0) {
           result = await fetchFromGoogle("best places", locationStr);
        }

        return { data: result, newBbox: currentBbox };
        
      } catch (e: any) {
        console.error(`[Attempt ${attempt}/${maxRetries}] Google API Hatası:`, e.response?.data || e);
        
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
        
        return { error: { message: `(Canlı Log) Google API isteği başarısız oldu. API Key okundu mu?: ${!!googleApiKey}. Hata Detayı: ${typeof e === 'object' ? JSON.stringify(e.response?.data || e.message || 'Bilinmeyen Hata') : e}` }, status: 500 };
      }
    }
    return { error: { message: "Şu anda mekan bilgilerine ulaşılamıyor (Max Retry aşıldı)." }, status: 500 };
  });
