import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using anon key for insert since we allowed it in RLS
const googleApiKey = process.env.VITE_GOOGLE_PLACES_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleApiKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Istanbul'daki en popüler vibe'lar ve mekan türleri
const queries = [
  "best cafes in Kadıköy, Istanbul",
  "rooftop bars in Beşiktaş, Istanbul",
  "quiet study places in Şişli, Istanbul",
  "fine dining restaurants in Beyoğlu, Istanbul",
  "nightclubs in Karaköy, Istanbul",
  "chill lounges in Moda, Istanbul"
];

async function seedVenues() {
  console.log("Mekan toplama işlemi başlatılıyor...");
  
  for (const query of queries) {
    console.log(`\nGoogle'da aranıyor: "${query}"...`);
    
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating,places.userRatingCount,places.photos,places.types'
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 20 // Maksimum 20 mekan çeker (API Sınırı)
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error(`HATA "${query}":`, data.error.message);
        continue;
      }

      if (!data.places || data.places.length === 0) {
        console.log(`Uyarı: "${query}" için mekan bulunamadı.`);
        continue;
      }

      console.log(`✅ "${query}" için ${data.places.length} adet mekan bulundu. Supabase'e aktarılıyor...`);

      const dbVenues = data.places.map((place) => {
        let image_url = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80";
        if (place.photos && place.photos.length > 0) {
          image_url = `photo:${place.photos[0].name}`;
        }
        let price_level = place.priceLevel === "PRICE_LEVEL_EXPENSIVE" ? "₺₺₺" : (place.priceLevel === "PRICE_LEVEL_MODERATE" ? "₺₺" : (place.priceLevel === "PRICE_LEVEL_INEXPENSIVE" ? "₺" : ""));
        
        let vibe = "Energetic";
        if (query.includes("quiet") || query.includes("chill")) vibe = "Calm";
        if (query.includes("dining")) vibe = "Romantic";

        return {
          google_place_id: place.id,
          name: place.displayName?.text || 'Bilinmeyen Mekan',
          address: place.formattedAddress,
          rating: place.rating || 0,
          user_rating_count: place.userRatingCount || 0,
          price_level,
          image_url,
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
          vibe: vibe
        };
      });

      const { error } = await supabase.from('venues').upsert(dbVenues, { onConflict: 'google_place_id' });
      
      if (error) {
        console.error("Supabase'e kaydederken hata oluştu:", error);
      } else {
        console.log(`🎉 Supabase kaydı başarılı! (${dbVenues.length} mekan eklendi/güncellendi)`);
      }

    } catch (e) {
      console.error(`Sorgu sırasında kritik hata "${query}":`, e);
    }
  }
  
  console.log("\n🚀 Tüm işlemler tamamlandı. Supabase veritabanınızı kontrol edebilirsiniz!");
}

seedVenues();
