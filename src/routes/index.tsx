import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BatteryLow,
  Bell,
  ChevronDown,
  CloudRain,
  Coffee,
  Compass,
  Film,
  Globe2,
  Heart,
  ListFilter,
  LocateFixed,
  Map,
  MapPin,
  Minus,
  PartyPopper,
  Plus,
  Search,
  Sofa,
  Sparkles,
  Star,
  Store,
  User,
  Users,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { renderToString } from "react-dom/server";
import type * as LeafletType from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import logoImg from "../assets/logo.png";
import { Country, State, City as CSCCity } from "country-state-city";
import { fetchVenuesFromServer } from "../api/placesApi";
import { useLanguage, type Language } from "../contexts/LanguageContext";
import { LoginModal } from "@/components/LoginModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChillSpot AI | İstanbul Vibe Keşfi" },
      { name: "description", content: "Ruh haline en uygun İstanbul mekanlarını canlı vibe radarıyla keşfet." },
      { property: "og:title", content: "ChillSpot AI | İstanbul Vibe Keşfi" },
      { property: "og:description", content: "Ruh haline en uygun İstanbul mekanlarını canlı vibe radarıyla keşfet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const vibes = [
  { id: "Yorgun", tr: "Yorgun", en: "Tired", searchQuery: "relaxing quiet cafe or lounge", icon: BatteryLow },
  { id: "Keyifli & Enerjik", tr: "Keyifli & Enerjik", en: "Joyful & Energetic", searchQuery: "lively energetic bar or cafe", icon: Zap },
  { id: "Sakin", tr: "Sakin", en: "Calm", searchQuery: "peaceful quiet uncrowded cafe or park", icon: Wind },
  { id: "Melankolik", tr: "Melankolik", en: "Melancholic", searchQuery: "cozy aesthetic cafe dim lighting", icon: CloudRain },
  { id: "Sosyal", tr: "Sosyal", en: "Social", searchQuery: "popular social pub or busy cafe", icon: Users },
  { id: "Meraklı", tr: "Meraklı", en: "Curious", searchQuery: "museum or art gallery or historical site", icon: Compass },
  { id: "Romantik", tr: "Romantik", en: "Romantic", searchQuery: "romantic restaurant or intimate places", icon: Heart },
  { id: "Nostaljik", tr: "Nostaljik", en: "Nostalgic", searchQuery: "historic vintage cafe or retro places", icon: Film },
  { id: "Eğlence", tr: "Eğlence", en: "Party / Fun", searchQuery: "nightclub or dance club or lively party venue", icon: PartyPopper },
  { id: "Rahat", tr: "Rahat", en: "Relaxed", searchQuery: "comfortable chill lounge or casual cafe", icon: Sofa },
];

type Venue = {
  id: number;
  name: string;
  area: string;
  match: number;
  weather: string;
  price: string;
  distance: string;
  image: string;
  icon: any;
  lat: number;
  lng: number;
  vibe: string;
  region: string;
  placeId: string;
  details?: {
    address?: string;
    openNow?: boolean;
    phone?: string;
  };
};

const regions = ["Beşiktaş", "Kadıköy"];

// Custom hook to manage session storage state
function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading sessionStorage", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error("Error setting sessionStorage", error);
    }
  };

  return [storedValue, setValue];
}

function Index() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [activeVibe, setActiveVibe] = useSessionStorage("chillspot_activeVibe", "Sakin");
  const [activeRegion, setActiveRegion] = useSessionStorage("chillspot_activeRegion", "İstanbul");
  const [activeRegionBbox, setActiveRegionBbox] = useState<string[] | null>(null);
  
  // Hierarchical Location State
  const [selectedCountry, setSelectedCountry] = useSessionStorage("chillspot_selectedCountry", "TR");
  const [selectedState, setSelectedState] = useSessionStorage("chillspot_selectedState", "");
  const [selectedCity, setSelectedCity] = useSessionStorage("chillspot_selectedCity", "");
  const [locationOpen, setLocationOpen] = useState(false);
  const [venueType, setVenueType] = useSessionStorage("chillspot_venueType", "Tümü");
  
  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(() => selectedCountry ? State.getStatesOfCountry(selectedCountry) : [], [selectedCountry]);
  const cities = useMemo(() => (selectedCountry && selectedState) ? CSCCity.getCitiesOfState(selectedCountry, selectedState) : [], [selectedCountry, selectedState]);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selected, setSelected] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const [session, setSession] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchFavorites(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchFavorites(session.user.id);
      else setFavorites([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFavorites = async (userId: string) => {
    const { data } = await supabase.from('user_favorites').select('google_place_id').eq('user_id', userId);
    if (data) {
      setFavorites(data.map(d => d.google_place_id));
    }
  };
  const [mobileMap, setMobileMap] = useState(false);
  const [hasInitialSearch, setHasInitialSearch] = useState(false);
  
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeOut(true), 1500);
    const timer2 = setTimeout(() => setShowSplash(false), 2000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const searchVenues = async (locationStr: string, vibeStr: string = activeVibe) => {
    const apiKey = import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] as string;
    if (!apiKey) {
      setApiError("API Key bulunamadı (.env dosyanızı kontrol edin)");
      setHasInitialSearch(true);
      return;
    }
    
    setIsSearching(true);
    setHasInitialSearch(true);
    setShowDropdown(false);
    setApiError(null);
    
    try {
      const vibeObj = vibes.find(v => v.id === vibeStr);
      const intentQuery = vibeObj?.searchQuery || vibeStr;

      const result = await fetchVenuesFromServer({
        data: {
          locationStr,
          vibeStr,
          language,
          activeRegionBbox,
          intentQuery
        }
      });
      
      if (result.error) {
        console.error("ChillSpot API İletişim Hatası:", result.error);
        setApiError("Şu anda mekan verilerine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.");
        setVenues([]);
        setIsSearching(false);
        return;
      }

      if (result.newBbox && result.newBbox !== activeRegionBbox) {
        setActiveRegionBbox(result.newBbox);
      }
      
      const data = result.data;
      
      if (data.places && data.places.length > 0) {
        const newVenues = data.places.map((place: any, index: number) => {
          let image = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"; // fallback
          if (place.photos && place.photos.length > 0) {
            image = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=800&maxWidthPx=1280&key=${apiKey}`;
          }
          
          const icon = vibes.find(v => v.id === vibeStr)?.icon || Coffee;
          let price = place.priceLevel === "PRICE_LEVEL_EXPENSIVE" ? "₺₺₺" : (place.priceLevel === "PRICE_LEVEL_MODERATE" ? "₺₺" : (place.priceLevel === "PRICE_LEVEL_INEXPENSIVE" ? "₺" : ""));
          
          return {
            id: 1000 + index,
            name: place.displayName?.text || t('unknownVenue'),
            area: place.formattedAddress?.split(',')[0] || locationStr,
            match: Math.floor(Math.random() * 20) + 80, // Random 80-99
            weather: `${place.rating || t('newVenue')} ${t('points')} (${place.userRatingCount || 0} ${t('reviews')})`,
            price: price || t('priceNotSet'),
            distance: t('realLocation'),
            image,
            icon,
            lat: place.location?.latitude || 41.0,
            lng: place.location?.longitude || 29.0,
            vibe: vibeStr,
            region: locationStr,
            placeId: place.id,
            rating: place.rating || 0,
            types: place.types || [],
            details: {
               address: place.formattedAddress,
               openNow: place.currentOpeningHours?.openNow,
               phone: place.internationalPhoneNumber
            }
          };
        });
        setVenues(newVenues);

        // Supabase'e Arka Planda Kayıt İşlemi (Upsert - Varsa Günceller, Yoksa Ekler)
        const dbVenues = data.places.map((place: any) => {
          let image_url = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80";
          if (place.photos && place.photos.length > 0) {
            image_url = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=800&maxWidthPx=1280&key=${apiKey}`;
          }
          let price_level = place.priceLevel === "PRICE_LEVEL_EXPENSIVE" ? "₺₺₺" : (place.priceLevel === "PRICE_LEVEL_MODERATE" ? "₺₺" : (place.priceLevel === "PRICE_LEVEL_INEXPENSIVE" ? "₺" : ""));
          
          let country: string | null = null, state: string | null = null, city: string | null = null;
          if (place.addressComponents) {
            place.addressComponents.forEach((comp: any) => {
              if (comp.types?.includes("country")) country = comp.longText;
              if (comp.types?.includes("administrative_area_level_1")) state = comp.longText;
              if (comp.types?.includes("administrative_area_level_2") || comp.types?.includes("locality")) {
                if (!city) city = comp.longText;
              }
            });
          }
          
          return {
            google_place_id: place.id,
            name: place.displayName?.text || t('unknownVenue'),
            address: place.formattedAddress,
            rating: place.rating || 0,
            user_rating_count: place.userRatingCount || 0,
            price_level,
            image_url,
            lat: place.location?.latitude || 0,
            lng: place.location?.longitude || 0,
            vibe: vibeStr,
            country,
            state,
            city
          };
        });

        supabase.from('venues').upsert(dbVenues, { onConflict: 'google_place_id' })
          .then(({ error }) => {
            if (error) console.error("Supabase'e kaydederken hata:", error);
            else console.log(`${dbVenues.length} mekan Supabase veritabanına başarıyla kaydedildi!`);
          });
          
      } else {
        setApiError("Arama sonuçları bulunamadı.");
        setVenues([]);
      }
    } catch (e: any) {
      console.error("ChillSpot API İletişim Hatası:", e);
      setApiError("Şu anda mekan verilerine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.");
      setVenues([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!hasInitialSearch) {
      searchVenues(activeRegion, activeVibe);
    }
  }, [hasInitialSearch]);

  useEffect(() => {
    if (hasInitialSearch) {
      searchVenues(activeRegion, activeVibe);
    }
  }, [language]);
  
  const selectedVenue = venues.find(v => v.id === selected) ?? venues[0];
  const visibleVenues = useMemo(() => {
    if (venueType === "Tümü") return venues;
    
    return venues.filter((v: any) => {
      const t = v.types as string[];
      if (!t || t.length === 0) return false;
      
      switch (venueType) {
        case "Kafe": return t.includes("cafe") || t.includes("coffee_shop");
        case "Restoran": return t.includes("restaurant") || t.includes("steakhouse") || t.includes("seafood_restaurant") || t.includes("pizza_restaurant") || t.includes("fast_food_restaurant");
        case "Bar": return t.includes("bar") || t.includes("pub") || t.includes("wine_bar") || t.includes("cocktail_bar");
        case "Gece Kulübü": return t.includes("night_club");
        default: return true;
      }
    });
  }, [venues, venueType]);

  useEffect(() => {
    if (visibleVenues.length > 0 && !visibleVenues.find(v => v.id === selected)) {
      setSelected(visibleVenues[0]?.id ?? 0);
    }
  }, [visibleVenues, selected]);

  const toggleFavorite = async (venue: Venue) => {
    if (!session) {
      setIsLoginModalOpen(true);
      return;
    }
    
    const isFav = favorites.includes(venue.placeId);
    
    if (isFav) {
      setFavorites((current) => current.filter((id) => id !== venue.placeId));
      try {
        const { error } = await supabase.from('user_favorites').delete().match({
          user_id: session.user.id,
          google_place_id: venue.placeId
        });
        if (error) console.error("Supabase delete error:", error);
      } catch (e) {
        console.error("Error removing favorite:", e);
      }
    } else {
      setFavorites((current) => [...current, venue.placeId]);
      try {
        console.log("Upserting venue:", venue.placeId, venue.name);
        // Ensure venue exists in our DB
        const { error: venueError } = await supabase.from('venues').upsert({
          google_place_id: venue.placeId,
          name: venue.name,
          address: venue.area,
          image_url: venue.image,
          rating: venue.match / 20, // approximate match to 5-star scale
          lat: venue.lat,
          lng: venue.lng
        }, { onConflict: 'google_place_id' });
        
        if (venueError) {
           console.error("Supabase venue upsert error:", venueError);
           alert("Mekan veritabanına eklenirken hata: " + venueError.message);
        }

        console.log("Inserting user_favorite:", session.user.id, venue.placeId);
        const { error: favError } = await supabase.from('user_favorites').insert({
          user_id: session.user.id,
          google_place_id: venue.placeId
        });

        if (favError) {
           console.error("Supabase fav insert error:", favError);
           alert("Favori eklenirken hata: " + favError.message);
        }
      } catch (e) {
        console.error("Error adding favorite:", e);
      }
    }
  };

  return (
    <>
      {showSplash && (
        <div className={cn("fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-700", fadeOut ? "opacity-0" : "opacity-100")}>
          <div className="relative flex flex-col items-center">
            {/* Background glowing rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute h-48 w-48 animate-ping rounded-full bg-primary/20 opacity-0" style={{ animationDuration: '2s' }} />
              <div className="absolute h-64 w-64 animate-ping rounded-full bg-primary/10 opacity-0" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </div>
            
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-[100px] animate-pulse" />
            
            {/* The Logo */}
            <img src={logoImg} alt="ChillSpot AI Loading" className="animate-splash-logo relative z-10 h-36 w-36 object-contain drop-shadow-[0_0_30px_rgba(249,115,22,0.6)]" />
            
            {/* Text Reveal */}
            <div className="animate-text-reveal flex flex-col items-center">
              <h1 className="relative z-10 mt-8 font-display text-4xl font-bold tracking-tight">ChillSpot <span className="text-primary">AI</span></h1>
              <p className="relative z-10 mt-3 text-xs font-bold uppercase tracking-[0.3em] text-primary/80">Vibe Radarı Başlatılıyor...</p>
            </div>
          </div>
        </div>
      )}
      
      <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-2xl">
        <div className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 pt-3 pb-2 lg:py-0 lg:grid-cols-[1fr_auto_1fr] lg:px-7">
          <a href="#top" className="flex min-w-0 items-center gap-3 lg:justify-start" aria-label="ChillSpot AI ana sayfa" onClick={() => { setActiveRegion("İstanbul"); searchVenues("İstanbul"); }}>
            <img src={logoImg} alt="ChillSpot AI Logo" className="h-10 w-10 shrink-0 object-contain drop-shadow-glow" />
            <span className="truncate font-display text-lg font-bold">ChillSpot <span className="text-primary">AI</span></span>
          </a>

          <div className="order-3 col-span-2 mb-4 flex w-full min-w-0 flex-col gap-2 rounded-3xl border border-border bg-surface-glass p-3 shadow-card lg:order-2 lg:col-span-1 lg:mx-auto lg:mb-0 lg:w-[720px] lg:grid lg:grid-cols-[1.2fr_1fr_.85fr_auto] lg:gap-0 lg:rounded-full lg:p-1.5">
            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
              <PopoverTrigger asChild>
                <button className="flex h-12 lg:h-full min-w-0 items-center justify-between rounded-xl lg:rounded-l-full border border-border/50 bg-background/50 lg:border-0 lg:border-r lg:bg-transparent px-5 text-left outline-none hover:bg-white/5 transition-colors">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">{t('where')}</span>
                    <span className="block truncate text-sm font-semibold">{activeRegion || t('selectLocation')}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-4 bg-background/95 backdrop-blur-xl border-border shadow-glow rounded-xl z-[100]" align="start">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t('country')}</label>
                    <select 
                      className="w-full bg-accent/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedCountry}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCountry(val);
                        setSelectedState("");
                        setSelectedCity("");
                        const cName = Country.getCountryByCode(val)?.name || "";
                        setActiveRegion(cName);
                        setActiveRegionBbox(null);
                      }}
                    >
                      <option value="">{t('selectCountry')}</option>
                      {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t('region')}</label>
                    <select 
                      className="w-full bg-accent/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      value={selectedState}
                      disabled={!selectedCountry || states.length === 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedState(val);
                        setSelectedCity("");
                        const cName = Country.getCountryByCode(selectedCountry)?.name || "";
                        const sName = State.getStateByCodeAndCountry(val, selectedCountry)?.name || "";
                        setActiveRegion(`${sName}, ${cName}`);
                        setActiveRegionBbox(null);
                      }}
                    >
                      <option value="">{t('selectRegion')}</option>
                      {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t('city')}</label>
                    {selectedCountry && selectedState && cities.length === 0 ? (
                      <input
                        type="text"
                        className="w-full bg-accent/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={t('typeCityOptional')}
                        value={selectedCity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCity(val);
                          const cName = Country.getCountryByCode(selectedCountry)?.name || "";
                          const sName = State.getStateByCodeAndCountry(selectedState, selectedCountry)?.name || "";
                          setActiveRegion(val ? `${val}, ${sName}, ${cName}` : `${sName}, ${cName}`);
                          setActiveRegionBbox(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setLocationOpen(false);
                          }
                        }}
                      />
                    ) : (
                      <select 
                        className="w-full bg-accent/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        value={selectedCity}
                        disabled={!selectedState}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCity(val);
                          const cName = Country.getCountryByCode(selectedCountry)?.name || "";
                          const sName = State.getStateByCodeAndCountry(selectedState, selectedCountry)?.name || "";
                          setActiveRegion(`${val}, ${sName}, ${cName}`);
                          setActiveRegionBbox(null);
                          setLocationOpen(false); // Close popover when fully selected
                        }}
                      >
                        <option value="">{t('selectCity')}</option>
                        {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-12 lg:h-full min-w-0 items-center justify-between rounded-xl border border-border/50 bg-background/50 lg:border-0 lg:border-r lg:bg-transparent px-5 text-left outline-none hover:bg-white/5 transition-colors">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">{t('howAreYouFeeling')}</span>
                    <span className="block truncate text-sm font-semibold">
                      {vibes.find(v => v.id === activeVibe)?.[language] || activeVibe}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background/95 backdrop-blur-xl border-border shadow-glow rounded-xl z-[100]">
                {vibes.map((v) => (
                  <DropdownMenuItem 
                    key={v.id}
                    onClick={() => {
                      if (!session) {
                        setIsLoginModalOpen(true);
                        return;
                      }
                      setActiveVibe(v.id);
                      searchVenues(activeRegion, v.id);
                    }}
                    className={cn("gap-2 cursor-pointer font-medium rounded-lg py-2 my-1", activeVibe === v.id && "bg-primary/20 text-primary focus:bg-primary/20 focus:text-primary")}
                  >
                    <v.icon className="h-4 w-4" />
                    <span>{v[language]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-12 lg:h-full min-w-0 items-center justify-between rounded-xl border border-border/50 bg-background/50 lg:border-0 lg:border-r lg:bg-transparent px-5 text-left outline-none hover:bg-white/5 transition-colors">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">{t('venueType')}</span>
                    <span className="block truncate text-sm font-semibold">{t(venueType === 'Tümü' ? 'all' : venueType === 'Kafe' ? 'cafe' : venueType === 'Restoran' ? 'restaurant' : venueType === 'Bar' ? 'bar' : venueType === 'Gece Kulübü' ? 'nightclub' : venueType)}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background/95 backdrop-blur-xl border-border shadow-glow rounded-xl z-[100]">
                {[
                  { id: "Tümü", key: "all" },
                  { id: "Kafe", key: "cafe" },
                  { id: "Restoran", key: "restaurant" },
                  { id: "Bar", key: "bar" },
                  { id: "Gece Kulübü", key: "nightclub" }
                ].map(({ id, key }) => (
                  <DropdownMenuItem 
                    key={id}
                    onClick={() => setVenueType(id)}
                    className={cn("gap-2 cursor-pointer font-medium rounded-lg py-2 my-1", venueType === id && "bg-primary/20 text-primary focus:bg-primary/20 focus:text-primary")}
                  >
                    <span>{t(key)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              size="icon" 
              className="mt-2 h-12 w-full lg:mt-0 lg:h-12 lg:w-12 shrink-0 rounded-xl lg:rounded-full" 
              onClick={() => {
                if (!session) {
                  setIsLoginModalOpen(true);
                  return;
                }
                searchVenues(activeRegion, activeVibe);
              }}
            >
              <Search className="h-5 w-5" />
              <span className="ml-2 lg:hidden font-bold">Mekan Bul</span>
            </Button>
          </div>

          <nav className="flex shrink-0 items-center justify-end gap-1 lg:order-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('selectLang')}><Globe2 /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-background/95 backdrop-blur-xl border-border shadow-glow rounded-xl z-[100]">
                <DropdownMenuItem 
                  onClick={() => setLanguage("tr")}
                  className={cn("cursor-pointer font-medium rounded-lg py-2 my-1", language === "tr" && "bg-primary/20 text-primary")}
                >
                  TR - Türkçe
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLanguage("en")}
                  className={cn("cursor-pointer font-medium rounded-lg py-2 my-1", language === "en" && "bg-primary/20 text-primary")}
                >
                  EN - English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" aria-label={t('notifications')} className="relative"><Bell /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></Button>
            {session ? (
              <Button variant="glass" className="ml-1 rounded-full px-2 sm:px-3" onClick={() => navigate({ to: '/profile' })}>
                <User /><span className="hidden sm:inline">{t('profile') || 'Profil'}</span>
              </Button>
            ) : (
              <>
                <Button variant="glass" className="ml-1 rounded-full px-2 sm:px-3" onClick={() => navigate({ to: '/business-register' })}>
                  <Store /><span className="hidden sm:inline">{t('businessRegistration')}</span>
                </Button>
                <Button variant="glass" className="ml-1 rounded-full px-2 sm:px-3" onClick={() => setIsLoginModalOpen(true)}>
                  <User /><span className="hidden sm:inline">{t('login')}</span>
                </Button>
              </>
            )}
            <LoginModal open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen} />
          </nav>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3 [scrollbar-width:none] lg:justify-center lg:px-7">
          <Button variant="glass" className="shrink-0 rounded-full px-4"><ListFilter />{t('allFilters')}</Button>
        </div>
      </header>

      <div id="top" className={cn("flex flex-col lg:items-start", hasInitialSearch ? "lg:flex-row" : "")}>
        <section className={cn("w-full px-4 py-6 lg:px-7 lg:py-7", hasInitialSearch ? "lg:w-[56%]" : "lg:w-full", mobileMap && hasInitialSearch && "hidden lg:block")} aria-label="Mekan sonuçları">
          <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-bold uppercase text-primary">{t('pickedForYou')}</p>
                <h1 className="font-display text-xl font-semibold sm:text-2xl">{`${activeRegion} - ${t('howIsNightFlowing')}`}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{activeRegion} {t('inThisArea')} {visibleVenues.length} {t('venuesFound')}</p>
              </div>
            </div>
            <Button variant="ghost" className="hidden shrink-0 sm:inline-flex">{t('recommended')} <ChevronDown /></Button>
          </div>

          <div className={cn("grid gap-5", "sm:grid-cols-2")}>
            {isSearching ? (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="font-semibold text-foreground">{t('scanningRadar')}</p>
                <p className="mt-1 text-sm">{activeRegion} {t('findingVenuesFor')}</p>
              </div>
            ) : visibleVenues.length === 0 ? (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="font-semibold text-foreground">{t('noVenuesFound')}</p>
                <p className="mt-1 text-sm">{t('tryAnotherSearch')}</p>
                {apiError && (
                  <div className="mt-6 mx-auto max-w-md p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                    <p className="text-sm text-red-500/90 break-words">{apiError}</p>
                  </div>
                )}
              </div>
            ) : (
              visibleVenues.map((venue, index) => (
                <article key={venue.id} onMouseEnter={() => setSelected(venue.id)} onClick={() => navigate({ to: '/venue/$placeId', params: { placeId: venue.placeId } })} className={cn("group animate-rise cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow", selected === venue.id ? "border-primary/60" : "border-border")} style={{ animationDelay: `${index * 70}ms` }}>
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <img src={venue.image} alt={`${venue.name} mekan atmosferi`} width={1280} height={800} loading={index === 0 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-background/20" />
                    <span className="absolute left-3 top-3 rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 text-xs font-bold text-primary backdrop-blur-xl"><Sparkles className="mr-1 inline h-3 w-3" />%{venue.match} {t('match')}</span>
                    <Button variant="glass" size="icon" aria-label={`${venue.name} favorilere ekle`} onClick={(event) => { event.stopPropagation(); toggleFavorite(venue); }} className={cn("absolute right-3 top-3 rounded-full", favorites.includes(venue.placeId) && "bg-primary text-primary-foreground")}><Heart className={cn(favorites.includes(venue.placeId) && "fill-current")} /></Button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h2 className="truncate font-display text-base font-semibold">{venue.name}</h2><p className="mt-1 text-xs text-muted-foreground">{venue.area}</p></div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold"><Star className="h-3.5 w-3.5 fill-primary text-primary" />4.{9 - index}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate rounded-full bg-accent px-2.5 py-1.5 text-accent-foreground">{venue.weather}</span>
                      <span className="shrink-0 text-muted-foreground">{venue.price} · {venue.distance}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {hasInitialSearch && (
          <section className={cn("relative h-[620px] lg:sticky lg:top-[137px] lg:h-[calc(100vh-137px)] lg:w-[44%] overflow-hidden border-l border-border bg-surface-raised lg:block", !mobileMap && "hidden lg:block")} aria-label="Canlı vibe haritası">
            <VibeMap selected={selected} onSelect={setSelected} visibleVenues={visibleVenues} />
            <div className="absolute left-5 top-5 z-20 rounded-2xl border border-border bg-background/80 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-bold"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative h-2.5 w-2.5 rounded-full bg-primary" /></span>{t('liveRadar')}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t('last8Mins')}</p>
            </div>

            {selectedVenue && <div className="absolute bottom-6 left-5 right-5 z-20 flex items-center gap-3 rounded-2xl border border-primary/30 bg-background/90 p-3 shadow-glow backdrop-blur-xl">
              <img src={selectedVenue.image} alt="" width={96} height={96} className="h-16 w-16 shrink-0 rounded-xl object-cover cursor-pointer" onClick={() => navigate({ to: '/venue/$placeId', params: { placeId: selectedVenue.placeId } })} />
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate({ to: '/venue/$placeId', params: { placeId: selectedVenue.placeId } })}>
                <p className="text-xs font-bold text-primary">%{selectedVenue.match} {t('match').toUpperCase()}</p>
                <h3 className="truncate font-display font-semibold">{selectedVenue.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{selectedVenue.area} · {selectedVenue.distance}</p>
              </div>
              <Button variant="glow" onClick={() => navigate({ to: '/venue/$placeId', params: { placeId: selectedVenue.placeId } })} className="shrink-0 rounded-full px-4 text-xs">{t('details')}</Button>
            </div>}
          </section>
        )}
      </div>

      {hasInitialSearch && (
        <Button variant="glow" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 shadow-glow lg:hidden" onClick={() => setMobileMap((value) => !value)}>
          {mobileMap ? <><ListFilter className="mr-2 h-4 w-4" />{t('showList')}</> : <><Map className="mr-2 h-4 w-4" />{t('showMap')}</>}
        </Button>
      )}

      {detailsModalOpen && selectedVenue && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={() => setDetailsModalOpen(false)}>
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-0 shadow-2xl" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3 z-10 rounded-full bg-black/50 text-white hover:bg-black/70" onClick={() => setDetailsModalOpen(false)}>
              <Minus className="h-4 w-4" />
            </Button>
            <div className="relative aspect-video w-full overflow-hidden">
               <img src={selectedVenue.image} alt={selectedVenue.name} className="h-full w-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
            <div className="p-6 pt-2">
              <div className="mb-2 flex items-start justify-between gap-4">
                 <h2 className="font-display text-2xl font-bold">{selectedVenue.name}</h2>
                 <span className="flex shrink-0 items-center gap-1 font-bold text-primary"><Star className="h-4 w-4 fill-primary" />{selectedVenue.weather.split(' ')[0]}</span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{selectedVenue.details?.address || selectedVenue.area}</p>
              
              <div className="mb-6 grid grid-cols-2 gap-3">
                 <div className="rounded-xl bg-accent p-3">
                   <p className="text-xs text-muted-foreground">Fiyat Seviyesi</p>
                   <p className="font-semibold">{selectedVenue.price}</p>
                 </div>
                 <div className="rounded-xl bg-accent p-3">
                   <p className="text-xs text-muted-foreground">Şu Anki Durum</p>
                   <p className={cn("font-semibold", selectedVenue.details?.openNow === false ? "text-red-500" : "text-green-500")}>
                     {selectedVenue.details?.openNow === undefined ? "Bilinmiyor" : (selectedVenue.details?.openNow ? "Açık" : "Kapalı")}
                   </p>
                 </div>
              </div>

              {selectedVenue.details?.phone && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="rounded-full bg-primary/20 p-2 text-primary"><Search className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="font-semibold">{selectedVenue.details.phone}</p>
                  </div>
                </div>
              )}

              <Button variant="glow" className="w-full rounded-xl py-6 text-base" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedVenue.lat},${selectedVenue.lng}`, '_blank')}>
                <MapPin className="mr-2 h-5 w-5" /> Haritada Aç
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}

function FilterPart({ title, value, className }: { title: string; value: string; className?: string }) {
  return <button className={cn("min-w-0 border-border px-5 text-left lg:border-r", className)}><span className="block text-[10px] font-bold uppercase text-muted-foreground">{title}</span><span className="block truncate text-sm font-semibold">{value}</span></button>;
}

function VibeMap({ selected, onSelect, visibleVenues }: { selected: number; onSelect: (id: number) => void; visibleVenues: Venue[] }) {
  const mapRef = useRef<LeafletType.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<typeof LeafletType | null>(null);

  useEffect(() => {
    import("leaflet").then((LModule) => {
      setL(LModule.default || LModule);
    }).catch(err => console.error("Leaflet import error:", err));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !L) return;
    
    // Initialize map only once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      });
      // Use standard OSM but apply CSS filter to make it modern & dark
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'dark-tiles',
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);
    }
  }, [L]);

  useEffect(() => {
    if (!mapRef.current || !L) return;
    
    // Clear previous markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    visibleVenues.forEach(venue => {
      const IconComponent = venue.icon;
      const iconHtml = renderToString(<IconComponent className="h-5 w-5" />);
      const isActive = selected === venue.id;
      
      const customIcon = L.divIcon({
        html: `
          <div class="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-glow transition-transform duration-300 ${isActive ? 'scale-125 z-[1000]' : 'opacity-80 hover:opacity-100 z-[500]'}">
            ${isActive ? '<span class="absolute inset-0 rounded-full bg-primary animate-radar"></span>' : ''}
            <span class="relative">${iconHtml}</span>
          </div>
        `,
        className: 'bg-transparent border-0', 
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
      
      L.marker([venue.lat, venue.lng], { icon: customIcon })
        .addTo(mapRef.current!)
        .on('click', () => onSelect(venue.id));
    });

    const selectedVenue = visibleVenues.find(v => v.id === selected);
    if (selectedVenue) {
      mapRef.current.setView([selectedVenue.lat, selectedVenue.lng], 15, { animate: true, duration: 0.8 });
    }
    
  }, [visibleVenues, selected, onSelect, L]);

  return (
    <>
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-background" />
      <div className="absolute right-5 top-5 z-20 flex flex-col gap-2">
        <div className="overflow-hidden rounded-xl border border-border bg-background/80 backdrop-blur-xl">
          <Button variant="ghost" size="icon" aria-label="Yakınlaştır" onClick={() => mapRef.current?.zoomIn()}>
            <Plus />
          </Button>
          <div className="mx-2 border-t border-border" />
          <Button variant="ghost" size="icon" aria-label="Uzaklaştır" onClick={() => mapRef.current?.zoomOut()}>
            <Minus />
          </Button>
        </div>
        <Button 
          variant="glass" 
          size="icon" 
          aria-label="Konumlara odaklan" 
          className="rounded-xl"
          onClick={() => {
            if (mapRef.current && visibleVenues.length > 0 && L) {
              const bounds = L.latLngBounds(visibleVenues.map(v => [v.lat, v.lng]));
              mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.8 });
            }
          }}
        >
          <LocateFixed />
        </Button>
      </div>
    </>
  );
}