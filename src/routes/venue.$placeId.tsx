import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Globe2, 
  Clock, 
  Star, 
  Navigation,
  Loader2,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "../contexts/LanguageContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { fetchPlaceDetailsFromServer, getPhotoUrlFromServer } from "@/api/placesApi";

export const Route = createFileRoute("/venue/$placeId")({
  component: VenueDetails,
});

function getInitials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts[parts.length - 1]?.[0] || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  }
  return name.substring(0, 2).toUpperCase() || "U";
}

function ReviewAvatar({ name, photoUri }: { name: string; photoUri?: string }) {
  const [error, setError] = useState(false);
  const initials = getInitials(name);
  
  if (!photoUri || error) {
    return (
      <div className="w-10 h-10 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={photoUri} 
      alt={name} 
      className="w-10 h-10 shrink-0 rounded-full object-cover" 
      onError={() => setError(true)}
    />
  );
}

function ReviewForm({ onSubmit, user }: { onSubmit: (text: string, rating: number) => void, user: any }) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const { t } = useLanguage();
  
  if (!user) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md mb-8 text-center">
        <h3 className="font-bold mb-4 text-lg">{t('shareExperience')}</h3>
        <p className="text-muted-foreground mb-4">Yorum yapabilmek için lütfen giriş yapın.</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md mb-8">
      <h3 className="font-bold mb-4 text-lg">{t('shareExperience')}</h3>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star} 
            className={cn("h-7 w-7 cursor-pointer transition-colors", star <= rating ? "fill-yellow-500 text-yellow-500" : "text-white/20")} 
            onClick={() => setRating(star)} 
          />
        ))}
      </div>
      <textarea 
        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none" 
        placeholder={t('writeReview')}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="flex justify-end mt-4">
        <Button 
          variant="glow" 
          className="rounded-full px-6"
          onClick={() => {
            if (text.trim()) {
              onSubmit(text, rating);
              setText("");
              setRating(5);
            }
          }}
          disabled={!text.trim()}
        >
          {t('submitReview')}
        </Button>
      </div>
    </div>
  );
}

function VenueDetails() {
  const { placeId } = Route.useParams();
  const { t, language, setLanguage } = useLanguage();
  const [venue, setVenue] = useState<any>(null);
  const [localReviews, setLocalReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchVenueDetails = async () => {
      try {
        setLoading(true);
        // Use statically imported server function
        const data = await fetchPlaceDetailsFromServer({ data: { placeId, language } });


        if (data.error) {
          setError(`API Hatası: ${data.error.message}`);
          return;
        }
        setVenue(data);
        setLocalReviews(data.reviews || []);

        // SUPABASE'E MEKAN DETAYLARINI VE YORUMLARI KAYDET (Arka planda)
        try {
          // 1. Mekan detaylarını `venues` tablosuna güncelle (upsert)
          await supabase.from('venues').upsert({
            google_place_id: placeId,
            name: data.displayName?.text || '',
            address: data.formattedAddress,
            rating: data.rating,
            user_rating_count: data.userRatingCount,
            phone: data.internationalPhoneNumber || null,
            website: data.websiteUri || null,
            map_link: null, // Foursquare API'den link alınmıyor
            open_now: null,
            opening_hours: null,
            editorial_summary: data.editorialSummary?.text || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'google_place_id' });

          // 2. Yorumları `venue_reviews` tablosuna kaydet
          if (data.reviews && data.reviews.length > 0) {
            const dbReviews = data.reviews.map((r: any) => ({
              google_place_id: placeId,
              author_name: r.authorAttribution?.displayName || 'Anonim',
              author_photo: r.authorAttribution?.photoUri || null,
              rating: r.rating || 0,
              text: r.text?.text || r.originalText?.text || '',
              publish_time: r.relativePublishTimeDescription || ''
            }));
            
            
            // Yorumları topluca ekle - ON CONFLICT IGNORE yapmamız lazım
            for (const review of dbReviews) {
              const { data: existingReview } = await supabase.from('venue_reviews')
                .select('id')
                .eq('google_place_id', review.google_place_id)
                .eq('author_name', review.author_name)
                .single();
              
              if (!existingReview) {
                await supabase.from('venue_reviews').insert(review);
              }
            }
          }
        } catch (dbErr) {
          console.error("Supabase'e detayları kaydederken hata oluştu:", dbErr);
        }

        // 3. Supabase'den güncel yorumları çek
        const { data: dbAllReviews } = await supabase
          .from('venue_reviews')
          .select('*')
          .eq('google_place_id', placeId)
          .order('id', { ascending: false });

        if (dbAllReviews && dbAllReviews.length > 0) {
          const formattedReviews = dbAllReviews.map((r: any) => ({
            name: `db_${r.id}`,
            authorAttribution: {
              displayName: r.author_name,
              photoUri: r.author_photo
            },
            rating: r.rating,
            text: { text: r.text },
            relativePublishTimeDescription: r.publish_time,
            isUserReview: !!r.user_id
          }));
          
          // Google'dan gelenleri (user_id'si olmayan) ve bizimkileri harmanla
          setLocalReviews(formattedReviews);
        } else {
          setLocalReviews(data.reviews || []);
        }

      } catch (err: any) {
        setError(`${t('networkError')}: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchVenueDetails();
  }, [placeId, language]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
        <p className="mt-4 text-muted-foreground animate-pulse">{t('loadingVenueInfo')}</p>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground items-center justify-center p-4 text-center">
        <p className="text-destructive font-semibold text-lg">{t('anErrorOccurred')}</p>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">{t('goBack')}</Link>
        </Button>
      </div>
    );
  }

  // Helper variables
  const name = venue.displayName?.text || t('unknownVenue');
  const address = venue.formattedAddress;
  const rating = venue.rating;
  const reviewsCount = venue.userRatingCount;
  const phone = venue.internationalPhoneNumber;
  const website = venue.websiteUri;
  const mapLink = venue.googleMapsUri;
  const openNow = venue.currentOpeningHours?.openNow;
  const weekdays = venue.currentOpeningHours?.weekdayDescriptions || [];
  
  const handleAddReview = async (text: string, rating: number) => {
    if (!session?.user) return;
    
    // Geçici olarak ekranda göster
    const newReview = {
      name: `local_${Date.now()}`,
      authorAttribution: {
        displayName: session.user.user_metadata?.full_name || t('you'),
        photoUri: session.user.user_metadata?.custom_avatar_url || session.user.user_metadata?.avatar_url || ""
      },
      rating: rating,
      text: { text },
      relativePublishTimeDescription: t('justNow'),
      isUserReview: true
    };
    setLocalReviews([newReview, ...localReviews]);
    
    // Supabase'e kaydet
    try {
      const { error: insertError } = await supabase.from('venue_reviews').insert({
        google_place_id: placeId,
        author_name: session.user.user_metadata?.full_name || 'Kullanıcı',
        author_photo: session.user.user_metadata?.custom_avatar_url || session.user.user_metadata?.avatar_url || null,
        rating: rating,
        text: text,
        publish_time: 'Az önce',
        user_id: session.user.id,
        venue_name: name
      });
      if (insertError) {
        console.error("Yorum kaydedilemedi:", insertError);
        alert(`Yorum veritabanına kaydedilirken hata oluştu:\n${insertError.message}\n(SQL sorgusunu doğru çalıştırdığınızdan emin olun)`);
      }
    } catch (err: any) {
      console.error("Yorum kaydedilemedi:", err);
      alert(`Hata: ${err.message}`);
    }
  };
  
  // Format price level
  let price = "";
  if (venue.priceLevel === "PRICE_LEVEL_EXPENSIVE") price = "₺₺₺";
  else if (venue.priceLevel === "PRICE_LEVEL_MODERATE") price = "₺₺";
  else if (venue.priceLevel === "PRICE_LEVEL_INEXPENSIVE") price = "₺";

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between bg-background/60 p-4 backdrop-blur-xl border-b border-white/5">
        <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-white/10 shrink-0">
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="text-sm font-semibold truncate px-4">{name}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('selectLang')} className="shrink-0 rounded-full hover:bg-white/10">
              <Globe2 className="h-5 w-5" />
            </Button>
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
      </nav>

      <main className="mx-auto max-w-4xl pt-[72px]">
        {/* Photo Gallery Grid */}
        <div className="px-4 mb-6 mt-4">
          <div className="grid h-[300px] gap-2 md:h-[400px] grid-cols-2 md:grid-cols-4 rounded-3xl overflow-hidden">
            {venue.photos && venue.photos.length > 0 ? (
              venue.photos.slice(0, 4).map((photo: any, index: number) => {
                const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=1280&key=${import.meta.env['VITE_GOOGLE_PLACES_API_KEY']}`;
                return (
                  <div key={photo.name} className={cn("relative overflow-hidden cursor-pointer bg-muted", index === 0 ? "col-span-2 row-span-2 md:col-span-2 md:row-span-2" : "hidden md:block")} onClick={() => setSelectedPhotoIndex(index)}>
                    <img 
                      src={photoUrl} 
                      alt={`Photo ${index + 1}`} 
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80";
                      }}
                      ref={(el) => {
                        if (el && !el.dataset['loadedUrl']) {
                          el.dataset['loadedUrl'] = "fetching";
                          getPhotoUrlFromServer({ data: { photoName: photo.name, maxHeight: 800, maxWidth: 1280 } })
                            .then((res) => { if (res?.url) el.src = res.url; })
                            .catch(() => { el.src = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"; });
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100">
                      {index === 3 && venue.photos.length > 4 ? (
                         <span className="text-white font-bold text-lg bg-black/50 px-4 py-2 rounded-full">+{venue.photos.length - 4}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 md:col-span-4 bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">{t('photoNotFound')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="px-4 grid gap-8 md:grid-cols-3">
          
          {/* Main Details (Left Col) */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {rating && (
                  <span className="flex items-center text-yellow-500 font-medium bg-yellow-500/10 px-2 py-1 rounded-full">
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    {rating} <span className="text-foreground/50 ml-1 text-xs">({reviewsCount} {t('reviews')})</span>
                  </span>
                )}
                {price && (
                  <span className="flex items-center font-medium bg-secondary px-2 py-1 rounded-full text-foreground">
                    {price}
                  </span>
                )}
                {typeof openNow === 'boolean' && (
                  <span className={cn("flex items-center font-medium px-2 py-1 rounded-full", openNow ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                    {openNow ? t('openNow') : t('closed')}
                  </span>
                )}
              </div>
            </div>

            {venue.editorialSummary ? (
              <div className="relative mt-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-primary text-sm">{t('chillspotSummary')}</h3>
                </div>
                <p className="relative z-10 text-base leading-relaxed text-foreground/90 font-medium">
                  {venue.editorialSummary.text}
                </p>
              </div>
            ) : (
              <div className="relative mt-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-primary text-sm">{t('chillspotSummary')}</h3>
                </div>
                <p className="relative z-10 text-base leading-relaxed text-foreground/90 font-medium">
                  {name}, {address?.split(',').slice(-2, -1)[0]?.trim() || t('inThisArea')} {t('fallbackPart1')} {rating ? `${rating} ${t('fallbackPart2_withRating')}` : t('fallbackPart2_noRating')} {t('fallbackPart3')}
                </p>
              </div>
            )}

            {/* Reviews Section */}
            <div className="mt-16 space-y-6">
              <h2 className="text-2xl font-bold tracking-tight">{t('reviews')}</h2>
              
              <ReviewForm onSubmit={handleAddReview} user={session?.user} />

              {localReviews.length > 0 ? (
                <div className="grid gap-4">
                  {localReviews.map((review: any) => (
                    <div key={review.name} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <ReviewAvatar 
                            name={review.authorAttribution?.displayName || t('anonymousUser')} 
                            photoUri={review.authorAttribution?.photoUri} 
                          />
                          <div>
                            <p className="font-semibold">{review.authorAttribution?.displayName || t('anonymousUser')}</p>
                            <span className="text-xs text-muted-foreground">{review.relativePublishTimeDescription}</span>
                          </div>
                        </div>
                        <div className="flex items-center bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-full text-sm font-bold">
                          <Star className="h-4 w-4 mr-1.5 fill-current" /> {review.rating}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/80">{review.text?.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center shadow-sm backdrop-blur-xl">
                  <p className="text-muted-foreground">{t('beFirstToReview')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar (Right Col) */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-xl sticky top-24">
              <h3 className="font-bold mb-4">{t('info')}</h3>
              
              <div className="space-y-4">
                {address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground/80 leading-snug">{address}</span>
                  </div>
                )}
                
                {phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-5 w-5 text-primary shrink-0" />
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-foreground/80 hover:text-primary transition-colors">{phone}</a>
                  </div>
                )}
                
                {website && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe2 className="h-5 w-5 text-primary shrink-0" />
                    <a href={website} target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-primary transition-colors truncate">{t('website')}</a>
                  </div>
                )}

                {weekdays.length > 0 && (
                  <div className="flex items-start gap-3 text-sm pt-4 border-t border-white/10">
                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1 w-full">
                      <span className="font-semibold mb-1">{t('workingHours')}</span>
                      {weekdays.map((day: string) => {
                        const isTR = language === 'tr';
                        let disp = day;
                        if (!isTR) {
                          disp = disp.replace('Pazartesi', t('monday')).replace('Salı', t('tuesday')).replace('Çarşamba', t('wednesday')).replace('Perşembe', t('thursday')).replace('Cuma', t('friday')).replace('Cumartesi', t('saturday')).replace('Pazar', t('sunday')).replace('24 saat açık', t('open24Hours'));
                        }
                        return <span key={day} className="text-xs text-muted-foreground">{disp}</span>;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {mapLink && (
                <Button asChild className="w-full mt-6 shadow-glow">
                  <a href={mapLink} target="_blank" rel="noreferrer">
                    <Navigation className="mr-2 h-4 w-4" />
                    {t('getDirections')}
                  </a>
                </Button>
              )}
            </div>
          </div>
          
        </div>
      </main>

      {/* Lightbox Modal */}
      {selectedPhotoIndex !== null && venue?.photos && venue.photos[selectedPhotoIndex] && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md">
          {/* Controls */}
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 z-[210] rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setSelectedPhotoIndex(null)}>
            <X className="h-6 w-6" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute left-4 top-1/2 z-[210] -translate-y-1/2 rounded-full text-white/70 hover:bg-white/10 hover:text-white" 
            onClick={() => setSelectedPhotoIndex((prev) => (prev! > 0 ? prev! - 1 : venue.photos.length - 1))}
          >
            <ChevronLeft className="h-10 w-10" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-1/2 z-[210] -translate-y-1/2 rounded-full text-white/70 hover:bg-white/10 hover:text-white" 
            onClick={() => setSelectedPhotoIndex((prev) => (prev! < venue.photos.length - 1 ? prev! + 1 : 0))}
          >
            <ChevronRight className="h-10 w-10" />
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white/80 z-[210]">
            {selectedPhotoIndex + 1} / {venue.photos.length}
          </div>

          {/* Image */}
          <div className="relative h-full w-full flex items-center justify-center p-4 md:p-12" onClick={() => setSelectedPhotoIndex(null)}>
            <img 
              src={`https://places.googleapis.com/v1/${venue.photos[selectedPhotoIndex].name}/media?maxHeightPx=1080&maxWidthPx=1920&key=${import.meta.env['VITE_GOOGLE_PLACES_API_KEY']}`}
              alt={`Gallery image ${selectedPhotoIndex + 1}`}
              className="max-h-full max-w-full object-contain shadow-2xl select-none"
              onClick={(e) => e.stopPropagation()}
              ref={(el) => {
                if (el && el.dataset['currentIndex'] !== String(selectedPhotoIndex)) {
                  el.dataset['currentIndex'] = String(selectedPhotoIndex);
                  getPhotoUrlFromServer({ data: { photoName: venue.photos[selectedPhotoIndex].name, maxHeight: 1080, maxWidth: 1920 } })
                    .then((res) => { if (res?.url) el.src = res.url; });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
