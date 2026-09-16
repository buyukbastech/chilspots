import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "tr" | "en";

interface Translations {
  [key: string]: {
    tr: string;
    en: string;
  };
}

const translations: Translations = {
  // Common / Header
  login: { tr: "Giriş yap", en: "Login" },
  selectLang: { tr: "Dil seç", en: "Select Language" },
  notifications: { tr: "Bildirimler", en: "Notifications" },
  
  // Auth Modal
  userLogin: { tr: "Kullanıcı Girişi", en: "User Login" },
  businessLogin: { tr: "İşletme Girişi", en: "Business Login" },
  loginWithGoogle: { tr: "Google ile Giriş Yap", en: "Sign in with Google" },
  email: { tr: "E-posta", en: "Email" },
  password: { tr: "Şifre", en: "Password" },
  loginAction: { tr: "Giriş Yap", en: "Log In" },
  registerAction: { tr: "Kayıt Ol", en: "Register" },
  or: { tr: "veya", en: "or" },
  noAccount: { tr: "Hesabınız yok mu?", en: "Don't have an account?" },
  haveAccount: { tr: "Zaten hesabınız var mı?", en: "Already have an account?" },
  welcomeBack: { tr: "Tekrar Hoş Geldiniz", en: "Welcome Back" },
  createAccount: { tr: "Hesap Oluşturun", en: "Create an Account" },
  
  // Search Bar
  where: { tr: "Nereye?", en: "Where?" },
  selectLocation: { tr: "Konum Seçin", en: "Select Location" },
  country: { tr: "Ülke", en: "Country" },
  selectCountry: { tr: "Ülke Seçin", en: "Select Country" },
  region: { tr: "Bölge / Eyalet", en: "Region / State" },
  selectRegion: { tr: "Bölge Seçin", en: "Select Region" },
  city: { tr: "İlçe / Şehir", en: "City" },
  selectCity: { tr: "İlçe Seçin", en: "Select City" },
  typeCityOptional: { tr: "İlçe/Şehir yazın (Opsiyonel)", en: "Type City/District (Optional)" },
  howAreYouFeeling: { tr: "Nasıl Hissediyorsun?", en: "How are you feeling?" },
  venueType: { tr: "MEKAN TÜRÜ", en: "VENUE TYPE" },
  all: { tr: "Tümü", en: "All" },
  cafe: { tr: "Kafe", en: "Cafe" },
  restaurant: { tr: "Restoran", en: "Restaurant" },
  bar: { tr: "Bar", en: "Bar" },
  nightclub: { tr: "Gece Kulübü", en: "Nightclub" },
  searchVenues: { tr: "Mekanları ara", en: "Search Venues" },
  allFilters: { tr: "Tüm filtreler", en: "All filters" },

  // Venues List (Index)
  pickedForYou: { tr: "Sana özel seçildi", en: "Picked for you" },
  howIsNightFlowing: { tr: "gece nasıl akıyor?", en: "how is the night flowing?" },
  venuesFound: { tr: "mekan bulundu.", en: "venues found." },
  recommended: { tr: "Önerilen", en: "Recommended" },
  scanningRadar: { tr: "Vibe radarı taranıyor...", en: "Scanning vibe radar..." },
  findingVenuesFor: { tr: "için mekanlar bulunuyor", en: "finding venues for" },
  noVenuesFound: { tr: "Bu bölgede mekan bulunamadı.", en: "No venues found in this area." },
  tryAnotherSearch: { tr: "Başka bir yer aramayı veya filtreleri değiştirmeyi dene.", en: "Try searching another place or change the filters." },
  devError: { tr: "Geliştirici Hata Çıktısı:", en: "Developer Error Output:" },
  match: { tr: "EŞLEŞME", en: "MATCH" },
  points: { tr: "Puan", en: "Points" },
  reviews: { tr: "Yorum", en: "Reviews" },
  priceNotSet: { tr: "Fiyat Belli Değil", en: "Price Not Set" },
  realLocation: { tr: "Gerçek Konum", en: "Real Location" },
  showMap: { tr: "Haritayı göster", en: "Show map" },
  showList: { tr: "Listeyi göster", en: "Show list" },
  liveRadar: { tr: "Canlı Vibe Radarı", en: "Live Vibe Radar" },
  last8Mins: { tr: "Son 8 dakika · 148 sinyal", en: "Last 8 minutes · 148 signals" },
  details: { tr: "Detaylar", en: "Details" },
  unknownVenue: { tr: "Bilinmeyen Mekan", en: "Unknown Venue" },
  
  // Venue Details Modal
  priceLevel: { tr: "Fiyat Seviyesi", en: "Price Level" },
  currentStatus: { tr: "Şu Anki Durum", en: "Current Status" },
  openNow: { tr: "Şu an Açık", en: "Open Now" },
  closed: { tr: "Kapalı", en: "Closed" },
  unknown: { tr: "Bilinmiyor", en: "Unknown" },
  apiErrorFallback: { tr: "API Hatası (Fallback): ", en: "API Error (Fallback): " },
  newVenue: { tr: "Yeni", en: "New" },
  zeroResults: { tr: "Arama yapıldı fakat Google hiçbir mekan döndürmedi (Sıfır sonuç).", en: "Search completed but Google returned no venues (Zero results)." },
  networkError: { tr: "Ağ Hatası", en: "Network Error" },
  networkErrorCors: { tr: "Ağ Hatası (CORS / Bağlantı): ", en: "Network Error (CORS / Connection): " },
  anonymousUser: { tr: "Gizli Kullanıcı", en: "Anonymous User" },
  justNow: { tr: "Az önce", en: "Just now" },
  anErrorOccurred: { tr: "Bir hata oluştu", en: "An error occurred" },
  loadingVenueInfo: { tr: "Mekan bilgileri yükleniyor...", en: "Loading venue information..." },
  goBack: { tr: "Geri Dön", en: "Go Back" },
  beFirstToReview: { tr: "İlk yorumu siz yapın!", en: "Be the first to review!" },
  you: { tr: "Siz", en: "You" },

  // Venue Details Page
  info: { tr: "Bilgiler", en: "Information" },
  website: { tr: "Web Sitesi", en: "Website" },
  workingHours: { tr: "Çalışma Saatleri", en: "Working Hours" },
  monday: { tr: "Pazartesi", en: "Monday" },
  tuesday: { tr: "Salı", en: "Tuesday" },
  wednesday: { tr: "Çarşamba", en: "Wednesday" },
  thursday: { tr: "Perşembe", en: "Thursday" },
  friday: { tr: "Cuma", en: "Friday" },
  saturday: { tr: "Cumartesi", en: "Saturday" },
  sunday: { tr: "Pazar", en: "Sunday" },
  open24Hours: { tr: "24 saat açık", en: "Open 24 hours" },
  getDirections: { tr: "Yol Tarifi Al", en: "Get Directions" },
  chillspotSummary: { tr: "ChillSpot Özet", en: "ChillSpot Summary" },
  shareExperience: { tr: "Deneyiminizi Paylaşın", en: "Share Your Experience" },
  writeReview: { tr: "Bu mekan hakkında ne düşünüyorsunuz?", en: "What do you think about this venue?" },
  submitReview: { tr: "Yorum Gönder", en: "Submit Review" },
  photoNotFound: { tr: "Fotoğraf bulunamadı", en: "Photo not found" },
  hiddenUser: { tr: "Gizli Kullanıcı", en: "Hidden User" },

  // AI Fallback text templates
  fallbackPart1: { tr: "öne çıkan ve atmosferiyle dikkat çeken mekanlardan biridir.", en: "is one of the prominent venues in this area, drawing attention with its atmosphere." },
  fallbackPart2_withRating: { tr: "puan ile ziyaretçilerin beğenisini kazanan bu mekanı ChillSpot sizin için keşfetti.", en: "rating, ChillSpot discovered this highly appreciated venue just for you." },
  fallbackPart2_noRating: { tr: "Şu an keşfedilmeyi bekleyen bu özel mekanı deneyimleyen ilk kişilerden olabilirsiniz.", en: "You can be one of the first to experience this special venue waiting to be discovered." },
  fallbackPart3: { tr: "Keyifli zaman geçirmek için ziyaret listenize eklemeyi unutmayın!", en: "Don't forget to add it to your visit list for a great time!" },
  inThisArea: { tr: "bu bölgede", en: "in this area" },
  
  // Business Registration
  businessRegistration: { tr: "İşletme Kaydı", en: "Business Registration" },
  businessRegistrationDesc: { tr: "ChillSpot ağında yerinizi alın ve yeni müşterilerle mekanınızın vibe'ını buluşturun.", en: "Join the ChillSpot network and connect your venue's vibe with new customers." },
  goBackPrevious: { tr: "Önceki Adıma Dön", en: "Go Back to Previous Step" },
  goBackHome: { tr: "Ana Sayfaya Dön", en: "Go Back Home" },
  basicInfo: { tr: "Temel Bilgiler", en: "Basic Information" },
  authNameSurname: { tr: "Yetkili Ad-Soyad *", en: "Authorized Full Name *" },
  businessName: { tr: "İşletme İsmi *", en: "Business Name *" },
  businessEmail: { tr: "İşletme E-Posta *", en: "Business Email *" },
  taxNumber: { tr: "Vergi Numarası (VKN) *", en: "Tax ID Number *" },
  businessAddress: { tr: "İşletme Adresi *", en: "Business Address *" },
  companyInfoOptional: { tr: "Firma Bilgisi (Opsiyonel)", en: "Company Info (Optional)" },
  businessTypeReq: { tr: "İşletme Türü *", en: "Business Type *" },
  yourVenueStyle: { tr: "Mekanınızın Tarzı: *", en: "Your Venue's Style: *" },
  next: { tr: "İleri", en: "Next" },
  accountSecurity: { tr: "Hesap Güvenliği", en: "Account Security" },
  confirmEmailReq: { tr: "E-Posta Tekrar *", en: "Confirm Email *" },
  setPasswordField: { tr: "Şifre Belirleyin (En az 8 haneli) *", en: "Set Password (Min 8 chars) *" },
  registering: { tr: "Kayıt Ediliyor...", en: "Registering..." },
  completeRegistration: { tr: "Kaydı Tamamla", en: "Complete Registration" },
  applicationReceived: { tr: "Başvurunuz Alındı!", en: "Application Received!" },
  applicationDesc: { tr: "İşletme kaydınız başarıyla oluşturuldu. Profiliniz onay sürecinden geçtikten sonra aktif hale gelecektir. Aramıza hoş geldiniz!", en: "Your business registration has been successfully created. Your profile will become active after the approval process. Welcome aboard!" },
  choose: { tr: "Seçiniz", en: "Choose" },
  enterAddress: { tr: "Açık adresinizi giriniz...", en: "Enter your full address..." },
  shortCompanyInfo: { tr: "Kısa bir hakkımızda veya firma detayları...", en: "A short about us or company details..." },
  typeCityPlaceholder2: { tr: "İlçe/Şehir giriniz...", en: "Enter City/District..." },
  exampleCafe: { tr: "Örn: Chill Kafe", en: "e.g., Chill Cafe" },
  passPlaceholder: { tr: "••••••••", en: "••••••••" },
  
  // Venue Styles
  venueTired: { tr: "Yorgun", en: "Tired" },
  venueCheerful: { tr: "Keyifli & Enerjik", en: "Cheerful" },
  venueCalm: { tr: "Sakin", en: "Calm" },
  venueMelancholic: { tr: "Melankolik", en: "Melancholic" },
  venueSocial: { tr: "Sosyal", en: "Social" },
  venueCurious: { tr: "Meraklı", en: "Curious" },
  venueRomantic: { tr: "Romantik", en: "Romantic" },
  venueNostalgic: { tr: "Nostaljik", en: "Nostalgic" },
  venueFun: { tr: "Eğlence", en: "Fun" },
  venueChill: { tr: "Rahat", en: "Chill" },

  // Business Profile Dashboard
  logOut: { tr: "Çıkış Yap", en: "Log Out" },
  changeLogo: { tr: "Logoyu değiştir", en: "Change Logo" },
  verifiedBusinessAccount: { tr: "Onaylı İşletme Hesabı", en: "Verified Business Account" },
  addressPending: { tr: "Adres bekleniyor", en: "Address pending" },
  uploadVenuePhoto: { tr: "Mekan Fotoğrafı Yükle", en: "Upload Venue Photo" },
  venuePhotos: { tr: "Mekan Fotoğrafları", en: "Venue Photos" },
  photo: { tr: "Fotoğraf", en: "Photo" },
  deletePhoto: { tr: "Fotoğrafı Sil", en: "Delete Photo" },
  addedToFavorites: { tr: "Favoriye Eklenme", en: "Added to Favorites" },
  usersFavoritedVenue: { tr: "Mekanınızı favorileyen kullanıcılar", en: "Users who favorited your venue" },
  averageScore: { tr: "Ortalama Puan", en: "Average Score" },
  totalRating: { tr: "Toplam değerlendirme", en: "Total ratings" },
  customerReviews: { tr: "Müşteri Yorumları", en: "Customer Reviews" },
  approvedVenueReviews: { tr: "Onaylanmış mekan yorumları", en: "Approved venue reviews" },
  edit: { tr: "Düzenle", en: "Edit" },
  yourBusinessInfo: { tr: "İşletme Bilgileriniz", en: "Your Business Information" },
  businessNameOnly: { tr: "İşletme Adı", en: "Business Name" },
  taxIdLabel: { tr: "Vergi Kimlik No (VKN)", en: "Tax ID" },
  addressLabel: { tr: "Adres", en: "Address" },
  locationLabel: { tr: "Konum", en: "Location" },
  notSpecified: { tr: "Belirtilmemiş", en: "Not specified" },
  companyInfoLabel: { tr: "Firma Bilgisi", en: "Company Info" },
  companyInfoNotProvided: { tr: "Firma bilgisi girilmemiş.", en: "Company info not provided." },
  editBusinessInfo: { tr: "İşletme Bilgilerini Düzenle", en: "Edit Business Information" },
  taxNoLabel: { tr: "Vergi No (VKN)", en: "Tax ID" },
  cancel: { tr: "İptal", en: "Cancel" },
  saveChanges: { tr: "Değişiklikleri Kaydet", en: "Save Changes" },
  deletePhotoConfirmTitle: { tr: "Fotoğrafı Sil", en: "Delete Photo" },
  deletePhotoConfirmDesc: { tr: "Bu fotoğrafı mekan galerinizden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.", en: "Are you sure you want to delete this photo from your venue gallery? This action cannot be undone." },
  yesDelete: { tr: "Evet, Sil", en: "Yes, Delete" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    const storedLang = localStorage.getItem("chillspot_lang") as Language;
    if (storedLang && (storedLang === "tr" || storedLang === "en")) {
      setLanguageState(storedLang);
      document.documentElement.lang = storedLang;
    } else {
      document.documentElement.lang = "tr";
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("chillspot_lang", lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string) => {
    if (translations[key]) {
      return translations[key][language] || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
