import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getPhotoUrlFromServer } from "@/api/placesApi";
import { Heart, MessageSquare, MapPin, ArrowLeft, Star, LogOut, Pencil, Loader2, Sparkles, TrendingUp, Award, Flame, Store, Building2, FileText, Hash, ImagePlus, X, Trash2, Globe, Map, Compass } from "lucide-react";
import { Country, State, City } from "country-state-city";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  
  // User states
  const [favorites, setFavorites] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  
  // Business states
  const [businessData, setBusinessData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  // Photo Delete Modal State
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);

  // Favorite Delete Modal State
  const [favoriteToDelete, setFavoriteToDelete] = useState<number | null>(null);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    business_name: "",
    address: "",
    tax_id: "",
    business_type: "",
    venue_type: "",
    country: "",
    region: "",
    district: "",
    company_info: ""
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate({ to: "/" });
        return;
      }
      
      setSession(session);
      
      const isBusiness = session.user.user_metadata?.['role'] === 'business';

      try {
        if (isBusiness) {
          // Fetch Business details
          const { data: bData } = await supabase
            .from("businesses")
            .select("*")
            .eq("id", session.user.id)
            .single();
            
          if (bData) setBusinessData(bData);
        } else {
          // Fetch Favorites with venue details
          const { data: favs } = await supabase
            .from("user_favorites")
            .select(`
              id,
              google_place_id,
              venues (
                name,
                address,
                image_url,
                rating
              )
            `)
            .eq("user_id", session.user.id);
            
          if (favs) setFavorites(favs);

          // Fetch User Reviews
          const { data: revs } = await supabase
            .from("venue_reviews")
            .select(`
              id,
              google_place_id,
              rating,
              text,
              publish_time,
              venue_name
            `)
            .eq("user_id", session.user.id);
            
          if (revs) setReviews(revs);
        }
      } catch (error) {
        console.error("Error fetching profile data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      const file = files[0];
      if (!file) return;
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-avatar-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl, custom_avatar_url: data.publicUrl }
      });
      
      if (updateError) throw updateError;
      
      setSession((prev: any) => ({
        ...prev,
        user: {
          ...prev.user,
          user_metadata: {
            ...prev.user.user_metadata,
            avatar_url: data.publicUrl,
            custom_avatar_url: data.publicUrl
          }
        }
      }));
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error.message);
      alert('Avatar yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleVenuePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${session.user.id}-venue-${Date.now()}-${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('venues')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('venues').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }

      // If businessData is null somehow, we still need to update or insert.
      // But let's assume it should exist. If it doesn't, we can't reliably update the images column without an insert.
      const currentImages = businessData?.images || [];
      const newImages = [...currentImages, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from("businesses")
        .update({ images: newImages })
        .eq("id", session.user.id);
        
      if (updateError) {
        console.error("Business update error:", updateError);
        alert("Mekan fotoğrafları kaydedilirken bir hata oluştu. Lütfen 'images' (text[]) sütununun veritabanında olduğundan emin olun.");
      } else {
        setBusinessData((prev: any) => ({ 
          ...prev, 
          images: newImages
        }));
      }
      
    } catch (error: any) {
      console.error('Error uploading venue photo:', error.message);
      alert('Mekan fotoğrafı yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const executeDeleteVenuePhoto = async () => {
    if (photoToDelete === null) return;
    const indexToRemove = photoToDelete;
    
    try {
      const currentImages = [...(businessData?.images || [])];
      const imageToRemove = currentImages[indexToRemove];
      
      // Attempt to delete from storage if possible
      try {
        const fileName = imageToRemove.split('/venues/')[1];
        if (fileName) {
          await supabase.storage.from('venues').remove([fileName]);
        }
      } catch (e) {
        console.warn("Storage delete failed, proceeding with DB update", e);
      }

      currentImages.splice(indexToRemove, 1);

      const { error } = await supabase
        .from("businesses")
        .update({ images: currentImages })
        .eq("id", session.user.id);

      if (error) throw error;

      setBusinessData((prev: any) => ({
        ...prev,
        images: currentImages
      }));

      // Close modal
      setPhotoToDelete(null);
    } catch (error: any) {
      console.error("Fotoğraf silinirken hata oluştu:", error);
      alert("Fotoğraf silinirken bir hata oluştu.");
      setPhotoToDelete(null);
    }
  };

  const handleRemoveFavorite = (e: React.MouseEvent, favId: number) => {
    e.stopPropagation();
    setFavoriteToDelete(favId);
  };

  const executeRemoveFavorite = async () => {
    if (favoriteToDelete === null) return;
    
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', favoriteToDelete)
        .eq('user_id', session?.user?.id);
        
      if (error) throw error;
      
      setFavorites(prev => prev.filter(f => f.id !== favoriteToDelete));
      setFavoriteToDelete(null);
    } catch (err: any) {
      console.error("Favori silinirken hata:", err.message);
      alert("Favori silinemedi: " + err.message);
    }
  };

  const openEditModal = () => {
    setEditFormData({
      business_name: businessData?.business_name || "",
      address: businessData?.address || "",
      tax_id: businessData?.tax_id || "",
      business_type: businessData?.business_type || "",
      venue_type: businessData?.venue_type || "",
      country: businessData?.country || "",
      region: businessData?.region || "",
      district: businessData?.district || "",
      company_info: businessData?.company_info || ""
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        id: session.user.id,
        business_email: session.user.email,
        full_name: session.user.user_metadata?.full_name || "İşletme Yetkilisi",
        status: "pending",
        ...editFormData
      };

      const { error } = await supabase
        .from("businesses")
        .upsert(payload);
        
      if (error) throw error;
      
      setBusinessData((prev: any) => ({ ...prev, ...editFormData }));
      setIsEditModalOpen(false);
    } catch (error: any) {
      console.error(error);
      alert("Güncellenirken hata oluştu: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-foreground">Yükleniyor...</div>;
  }

  const isBusiness = session?.user?.user_metadata?.['role'] === 'business';

  // --- BUSINESS DASHBOARD UI ---
  if (isBusiness) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        {/* Header Controls */}
        <div className="w-full pt-6 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
            <Button variant="ghost" className="text-foreground hover:bg-white/20" onClick={() => navigate({ to: "/" })}>
              <ArrowLeft className="mr-2 h-5 w-5" /> {t('goBackHome')}
            </Button>
            <Button variant="destructive" className="rounded-full shadow-lg" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> {t('logOut')}
            </Button>
          </div>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          multiple
          className="hidden" 
          ref={coverInputRef} 
          onChange={handleVenuePhotoUpload} 
        />

        <div className="max-w-5xl mx-auto px-6 relative z-10 space-y-8">
          
          {/* Business Profile Title */}
          <div className="glass-card border border-border rounded-3xl p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shadow-2xl">
            <div className="flex items-end gap-6 min-w-0">
              <div className="relative group shrink-0">
                {(session?.user?.user_metadata?.custom_avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture) ? (
                  <img 
                    src={session?.user?.user_metadata?.custom_avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture} 
                    alt="Profile" 
                    className="h-24 w-24 rounded-2xl object-cover border-4 border-black" 
                    onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + (businessData?.business_name || 'B') + '&background=random'; }}
                  />
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-primary flex items-center justify-center text-4xl font-bold border-4 border-black">
                    {businessData?.business_name?.charAt(0).toUpperCase() || 'B'}
                  </div>
                )}
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-3 -right-3 p-2 bg-background border border-border rounded-xl text-foreground hover:bg-primary transition-all cursor-pointer shadow-lg"
                  title={t('changeLogo')}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleAvatarUpload} 
                />
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex items-center text-primary text-xs font-bold uppercase tracking-wider mb-1">
                  <Store className="w-3 h-3 mr-1" /> {t('verifiedBusinessAccount')}
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-black font-display truncate">{businessData?.business_name || 'İşletme'}</h1>
                  <button onClick={openEditModal} className="p-2 bg-accent/30 hover:bg-white/10 rounded-full transition-colors group/edit">
                    <Pencil className="w-4 h-4 text-muted-foreground group-hover/edit:text-foreground" />
                  </button>
                </div>
                <p className="text-muted-foreground truncate flex items-center mt-1">
                  <MapPin className="w-4 h-4 mr-1" /> {businessData?.address || t('addressPending')}
                </p>
              </div>
            </div>

            <div className="shrink-0 pb-1">
              <button 
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading}
                className="bg-accent/30 backdrop-blur-md px-5 py-3 rounded-xl border border-border hover:bg-primary transition-colors flex items-center text-sm font-bold shadow-xl cursor-pointer w-full md:w-auto justify-center"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                {t('uploadVenuePhoto')}
              </button>
            </div>
          </div>

          {/* Venue Photos Gallery */}
          {businessData?.images && businessData.images.length > 0 && (
            <div className="glass-card rounded-3xl p-8 border border-border mt-8 mb-8">
              <h2 className="text-2xl font-bold font-display mb-6 flex items-center">
                <ImagePlus className="mr-3 text-primary" /> {t('venuePhotos')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {businessData.images.map((img: string, idx: number) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-border">
                    <img src={img} alt={`${t('photo')} ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                      <span className="text-sm font-bold bg-background/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                        {t('photo')} {idx + 1}
                      </span>
                      <button 
                        onClick={() => setPhotoToDelete(idx)}
                        className="bg-red-500/80 hover:bg-red-600 text-foreground p-2.5 rounded-full backdrop-blur-md transition-all hover:scale-110 shadow-lg"
                        title={t('deletePhoto')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-card rounded-3xl p-6 border border-border bg-gradient-to-br from-rose-500/10 to-transparent">
              <div className="flex items-center text-rose-500 mb-2">
                <Heart className="w-5 h-5 mr-2" />
                <h3 className="font-bold">{t('addedToFavorites')}</h3>
              </div>
              <div className="text-4xl font-black">0</div>
              <p className="text-xs text-muted-foreground mt-2">{t('usersFavoritedVenue')}</p>
            </div>
            
            <div className="glass-card rounded-3xl p-6 border border-border bg-gradient-to-br from-yellow-400/10 to-transparent">
              <div className="flex items-center text-yellow-400 mb-2">
                <Star className="w-5 h-5 mr-2 fill-current" />
                <h3 className="font-bold">{t('averageScore')}</h3>
              </div>
              <div className="text-4xl font-black">0.0</div>
              <p className="text-xs text-muted-foreground mt-2">{t('totalRating')}: 0</p>
            </div>
            
            <div className="glass-card rounded-3xl p-6 border border-border bg-gradient-to-br from-blue-400/10 to-transparent">
              <div className="flex items-center text-blue-400 mb-2">
                <MessageSquare className="w-5 h-5 mr-2" />
                <h3 className="font-bold">{t('customerReviews')}</h3>
              </div>
              <div className="text-4xl font-black">0</div>
              <p className="text-xs text-muted-foreground mt-2">{t('approvedVenueReviews')}</p>
            </div>
          </div>

          {/* Business Information Section */}
          <div className="glass-card rounded-3xl p-8 border border-border relative">
            <button onClick={openEditModal} className="absolute top-8 right-8 p-2 px-4 bg-accent/30 hover:bg-white/10 rounded-xl transition-colors flex items-center text-sm font-bold text-muted-foreground hover:text-foreground">
               <Pencil className="w-4 h-4 mr-2" /> {t('edit')}
            </button>
            <h2 className="text-2xl font-bold font-display mb-6 flex items-center">
              <Building2 className="mr-3 text-primary" /> {t('yourBusinessInfo')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><Store className="w-4 h-4 mr-2" /> {t('businessNameOnly')}</div>
                  <div className="font-semibold text-lg">{businessData?.business_name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><Hash className="w-4 h-4 mr-2" /> {t('taxIdLabel')}</div>
                  <div className="font-mono bg-accent/30 px-3 py-1 rounded-lg inline-block text-lg">{businessData?.tax_id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><MapPin className="w-4 h-4 mr-2" /> {t('addressLabel')}</div>
                  <div className="font-semibold text-gray-300">{businessData?.address}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><Globe className="w-4 h-4 mr-2" /> {t('locationLabel')}</div>
                  <div className="font-semibold text-gray-300">
                    {businessData?.district && businessData?.region && businessData?.country ? 
                      `${businessData.district}, ${State.getStateByCodeAndCountry(businessData.region, businessData.country)?.name}, ${Country.getCountryByCode(businessData.country)?.name}` 
                      : t('notSpecified')}
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><Building2 className="w-4 h-4 mr-2" /> {t('businessTypeReq').replace(' *', '')}</div>
                  <div className="font-semibold text-lg capitalize">{
                    businessData?.business_type === 'cafe' ? t('cafe') : 
                    businessData?.business_type === 'restaurant' ? t('restaurant') : 
                    businessData?.business_type === 'bar' ? t('bar') : 
                    businessData?.business_type === 'hotel' ? 'Hotel' : 
                    businessData?.business_type === 'other' ? 'Other' : businessData?.business_type
                  }</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><Sparkles className="w-4 h-4 mr-2" /> {t('yourVenueStyle').replace(': *', '')}</div>
                  <div className="inline-flex items-center bg-primary/20 text-primary font-bold px-3 py-1 rounded-xl">
                    {businessData?.venue_type}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center"><FileText className="w-4 h-4 mr-2" /> {t('companyInfoLabel')}</div>
                  <div className="text-gray-300 bg-background/30 p-4 rounded-xl border border-white/5 min-h-[100px]">
                    {businessData?.company_info || t('companyInfoNotProvided')}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl bg-background/90 border border-border rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h2 className="text-xl font-bold font-display">{t('editBusinessInfo')}</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{t('businessNameOnly')}</label>
                    <input required type="text" value={editFormData.business_name} onChange={(e) => setEditFormData({...editFormData, business_name: e.target.value})} className="w-full bg-accent/30 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{t('taxNoLabel')}</label>
                    <input required type="text" value={editFormData.tax_id} onChange={(e) => setEditFormData({...editFormData, tax_id: e.target.value})} className="w-full bg-accent/30 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm text-muted-foreground">{t('country')}</label>
                    <select required value={editFormData.country} onChange={(e) => setEditFormData({...editFormData, country: e.target.value, region: "", district: ""})} className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                      <option value="" disabled>{t('choose')}</option>
                      {Country.getAllCountries().map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm text-muted-foreground">{t('region')}</label>
                    <select required value={editFormData.region} disabled={!editFormData.country} onChange={(e) => setEditFormData({...editFormData, region: e.target.value, district: ""})} className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50">
                      <option value="" disabled>{t('choose')}</option>
                      {editFormData.country && State.getStatesOfCountry(editFormData.country).map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm text-muted-foreground">{t('city')}</label>
                    {(() => {
                      const cities = editFormData.country && editFormData.region ? City.getCitiesOfState(editFormData.country, editFormData.region) : [];
                      const stateName = editFormData.region ? (State.getStateByCodeAndCountry(editFormData.region, editFormData.country)?.name || editFormData.region) : "";
                      return (
                        <select required value={editFormData.district} disabled={!editFormData.region} onChange={(e) => setEditFormData({...editFormData, district: e.target.value})} className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50">
                          <option value="" disabled>{t('choose')}</option>
                          {cities.length > 0 
                            ? cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                            : (editFormData.region && <option value={stateName}>{stateName}</option>)
                          }
                        </select>
                      );
                    })()}
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm text-muted-foreground">{t('businessTypeReq').replace(' *', '')}</label>
                    <select required value={editFormData.business_type} onChange={(e) => setEditFormData({...editFormData, business_type: e.target.value})} className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                      <option value="cafe">{t('cafe')}</option>
                      <option value="restaurant">{t('restaurant')}</option>
                      <option value="bar">{t('bar')}</option>
                      <option value="hotel">Hotel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-muted-foreground">{t('addressLabel')}</label>
                    <input required type="text" value={editFormData.address} onChange={(e) => setEditFormData({...editFormData, address: e.target.value})} className="w-full bg-accent/30 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm text-muted-foreground">{t('yourVenueStyle').replace(': *', '')}</label>
                    <select required value={editFormData.venue_type} onChange={(e) => setEditFormData({...editFormData, venue_type: e.target.value})} className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                      <option value="Yorgun">{t('venueTired')}</option>
                      <option value="Keyifli & Enerjik">{t('venueCheerful')}</option>
                      <option value="Sakin">{t('venueCalm')}</option>
                      <option value="Melankolik">{t('venueMelancholic')}</option>
                      <option value="Sosyal">{t('venueSocial')}</option>
                      <option value="Meraklı">{t('venueCurious')}</option>
                      <option value="Romantik">{t('venueRomantic')}</option>
                      <option value="Nostaljik">{t('venueNostalgic')}</option>
                      <option value="Eğlence">{t('venueFun')}</option>
                      <option value="Rahat">{t('venueChill')}</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-muted-foreground">{t('companyInfoLabel')}</label>
                    <textarea value={editFormData.company_info} onChange={(e) => setEditFormData({...editFormData, company_info: e.target.value})} rows={3} className="w-full bg-accent/30 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" />
                  </div>
                </div>
                <div className="flex justify-end pt-4 mt-6 sticky bottom-0 bg-card py-4 border-t border-border/50">
                  <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} className="mr-3">{t('cancel')}</Button>
                  <Button type="submit" disabled={isSaving} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t('saveChanges')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Delete Photo Confirmation Modal */}
        {photoToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold font-display text-center mb-2">{t('deletePhotoConfirmTitle')}</h3>
              <p className="text-muted-foreground text-center mb-8">{t('deletePhotoConfirmDesc')}</p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl py-6 text-base font-bold shadow-lg"
                  onClick={executeDeleteVenuePhoto}
                >
                  {t('yesDelete')}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full rounded-xl py-6 text-base text-muted-foreground hover:text-foreground hover:bg-white/10"
                  onClick={() => setPhotoToDelete(null)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Favorite Confirmation Modal */}
        {favoriteToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-red-500 fill-red-500" />
              </div>
              <h3 className="text-xl font-bold font-display text-center mb-2">Favorilerden Çıkar</h3>
              <p className="text-muted-foreground text-center mb-8">Bu mekanı favorilerinizden çıkarmak istediğinize emin misiniz?</p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl py-6 text-base font-bold shadow-lg"
                  onClick={executeRemoveFavorite}
                >
                  Evet, Çıkar
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full rounded-xl py-6 text-base text-muted-foreground hover:text-foreground hover:bg-white/10"
                  onClick={() => setFavoriteToDelete(null)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // --- USER DASHBOARD UI (Original) ---
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="text-foreground hover:bg-white/10" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Ana Sayfaya Dön
          </Button>
          <Button variant="destructive" className="rounded-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
          </Button>
        </div>

        {/* Profile Info */}
        <div className="glass-card border border-border rounded-3xl p-8 flex items-center gap-6">
          <div className="relative group shrink-0">
            {(session?.user?.user_metadata?.custom_avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture) ? (
              <img 
                src={session?.user?.user_metadata?.custom_avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture} 
                alt="Profile" 
                className="h-20 w-20 rounded-full object-cover border-2 border-primary/20" 
                onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + (session?.user?.email || 'User') + '&background=random'; }}
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold">
                {session?.user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-1.5 bg-background/80 backdrop-blur-md border border-border rounded-full text-foreground hover:bg-primary transition-all cursor-pointer group-hover:scale-110"
              title="Profil fotoğrafını değiştir"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold font-display truncate">{session?.user?.user_metadata?.full_name || 'ChillSpot Kullanıcısı'}</h1>
            <p className="text-muted-foreground truncate">{session?.user?.email}</p>
          </div>
        </div>

        {/* Premium Vibe Stats & Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          
          {/* Card 1: Vibe */}
          <div className="relative group overflow-hidden rounded-3xl bg-background/40 border border-border p-6 transition-all duration-500 hover:border-primary/50 hover:bg-background/60 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/30 transition-colors" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                  <Compass className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">Kişisel Vibe</span>
              </div>
              <div className="mt-auto">
                <h3 className="text-2xl font-black font-display tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">Sakin & Manzaralı</h3>
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 mr-1.5 text-primary/70" />
                  <span>En çok aradığınız tarz</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Card 2: Favorites */}
          <div className="relative group overflow-hidden rounded-3xl bg-background/40 border border-border p-6 transition-all duration-500 hover:border-rose-500/50 hover:bg-background/60 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/20 blur-3xl rounded-full group-hover:bg-rose-500/30 transition-colors" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.2)] group-hover:scale-110 transition-transform duration-500">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">Keşif Karnesi</span>
              </div>
              <div className="mt-auto flex items-end justify-between">
                <div>
                  <h3 className="text-4xl font-black font-display tracking-tighter text-foreground group-hover:text-rose-400 transition-colors duration-300">
                    {favorites.length}
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground mt-1">Favori Mekan</p>
                </div>
                <div className="h-12 w-12 rounded-full border-[3px] border-rose-500/20 flex items-center justify-center border-t-rose-500 rotate-45 group-hover:rotate-[225deg] transition-transform duration-1000">
                  <Flame className="w-5 h-5 text-rose-500 -rotate-45 group-hover:-rotate-[225deg] transition-transform duration-1000" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Role */}
          <div className="relative group overflow-hidden rounded-3xl bg-background/40 border border-border p-6 transition-all duration-500 hover:border-yellow-400/50 hover:bg-background/60 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-400/20 blur-3xl rounded-full group-hover:bg-yellow-400/30 transition-colors" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-400/5 border border-yellow-400/20 flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                  <Award className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">Topluluk Rolü</span>
              </div>
              <div className="mt-auto">
                <h3 className="text-2xl font-black font-display tracking-tight text-foreground group-hover:text-yellow-400 transition-colors duration-300">
                  {reviews.length >= 10 ? 'Şehir Rehberi' : reviews.length >= 5 ? 'Gurme' : 'Yeni Kaşif'}
                </h3>
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-yellow-400/70" />
                  <span>{reviews.length} Mekan Değerlendirmesi</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Tabs */}
        <Tabs defaultValue="favorites" className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 bg-accent/30 border border-border p-1 rounded-2xl">
            <TabsTrigger value="favorites" className="rounded-xl data-[state=active]:bg-primary">
              <Heart className="mr-2 h-4 w-4" /> Favori Mekanlarım
            </TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-xl data-[state=active]:bg-primary">
              <MessageSquare className="mr-2 h-4 w-4" /> Yorumlarım
            </TabsTrigger>
          </TabsList>

          {/* Favorites Content */}
          <TabsContent value="favorites" className="mt-6">
            {favorites.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground glass-card rounded-3xl border border-white/5">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Henüz favoriye eklediğiniz bir mekan bulunmuyor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favorites.map((fav) => (
                  <div key={fav.id} className="glass-card rounded-2xl overflow-hidden border border-border flex flex-col cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate({ to: '/venue/$placeId', params: { placeId: fav.google_place_id } })}>
                    <div className="h-32 bg-accent/50 relative">
                      <img 
                        src={fav.venues?.image_url?.startsWith('http') ? fav.venues?.image_url : "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"} 
                        alt={fav.venues?.name} 
                        className="w-full h-full object-cover opacity-80"
                        ref={(el) => {
                          if (el && fav.venues?.image_url && !fav.venues?.image_url.startsWith('http') && fav.venues?.image_url !== 'placeholder_ref' && fav.venues?.image_url !== 'placeholder_name' && !el.dataset['loadedUrl']) {
                            el.dataset['loadedUrl'] = "fetching";
                            getPhotoUrlFromServer({ data: { photoName: fav.venues?.image_url, maxHeight: 400, maxWidth: 600 } })
                              .then((res) => { if (res?.url) el.src = res.url; });
                          }
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 left-2 h-8 w-8 rounded-full bg-background/60 backdrop-blur-md hover:bg-destructive hover:text-destructive-foreground text-primary/80 transition-colors z-10"
                        onClick={(e) => handleRemoveFavorite(e, fav.id)}
                        aria-label="Favorilerden çıkar"
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </Button>
                      <div className="absolute top-2 right-2 bg-background/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center text-xs font-bold text-yellow-400">
                        <Star className="w-3 h-3 fill-current mr-1" /> {fav.venues?.rating}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg line-clamp-1">{fav.venues?.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" /> {fav.venues?.address}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Reviews Content */}
          <TabsContent value="reviews" className="mt-6">
            {reviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground glass-card rounded-3xl border border-white/5">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Henüz herhangi bir mekana yorum yapmadınız.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="glass-card rounded-2xl overflow-hidden border border-border p-6 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link to="/venue/$placeId" params={{ placeId: rev.google_place_id }} className="font-bold text-lg text-primary hover:underline line-clamp-1">
                          {rev.venue_name || 'Bilinmeyen Mekan'}
                        </Link>
                        <div className="flex items-center gap-2 mt-2 mb-3">
                          <div className="flex text-yellow-400">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star key={star} className={cn("w-4 h-4", star <= rev.rating ? "fill-current" : "text-white/20")} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{rev.publish_time}</span>
                        </div>
                        <p className="text-sm text-foreground/80 break-words">{rev.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
      </div>
    </div>
  );
}
