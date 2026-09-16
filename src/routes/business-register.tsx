import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Store, User, Mail, Briefcase, MapPin, Building, Tags, Sparkles, KeyRound, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Globe, Map } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Country, State, City } from "country-state-city";

export const Route = createFileRoute("/business-register")({
  component: BusinessRegister,
});

function BusinessRegister() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    businessName: "",
    businessEmail: "",
    companyInfo: "",
    address: "",
    taxId: "",
    businessType: "",
    venueType: "",
    country: "",
    region: "",
    district: "",
    confirmEmail: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNextStep = () => {
    // Validate step 1
    if (!formData.fullName || !formData.businessName || !formData.businessEmail || !formData.address || !formData.taxId || !formData.businessType || !formData.venueType || !formData.country || !formData.region || !formData.district) {
      setError("Lütfen zorunlu tüm alanları doldurun.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.businessEmail !== formData.confirmEmail) {
      setError("E-posta adresleri birbiriyle uyuşmuyor.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Şifreniz en az 8 karakter uzunluğunda olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      // 1. Supabase Auth Signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.businessEmail,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: 'business'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert into businesses table
        const { error: dbError } = await supabase.from('businesses').insert({
          id: authData.user.id,
          full_name: formData.fullName,
          business_name: formData.businessName,
          business_email: formData.businessEmail,
          company_info: formData.companyInfo,
          address: formData.address,
          tax_id: formData.taxId,
          business_type: formData.businessType,
          venue_type: formData.venueType,
          country: formData.country,
          region: formData.region,
          district: formData.district,
          status: 'pending'
        });

        if (dbError) throw dbError;

        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Kayıt olurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="glass-card max-w-md w-full rounded-3xl p-8 border border-white/10 text-center relative z-10">
          <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-4 text-white">{t('applicationReceived')}</h2>
          <p className="text-muted-foreground mb-8">
            {t('applicationDesc')}
          </p>
          <Button onClick={() => navigate({ to: "/" })} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            {t('goBackHome')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-12 relative overflow-x-hidden">
      {/* Background Ornaments */}
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 w-full">
        
        <button onClick={() => step === 2 ? setStep(1) : navigate({ to: "/" })} className="flex items-center text-muted-foreground hover:text-white transition-colors mb-8 group">
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" /> 
          {step === 2 ? t('goBackPrevious') : t('goBackHome')}
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white mb-4">{t('businessRegistration')}</h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">{t('businessRegistrationDesc')}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors", step >= 1 ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground")}>1</div>
            <div className={cn("w-16 h-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-white/10")} />
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors", step >= 2 ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground")}>2</div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive/50 text-destructive-foreground p-4 rounded-xl mb-8 flex items-center">
            <div className="w-2 h-2 rounded-full bg-destructive mr-3 animate-pulse" />
            {error}
          </div>
        )}

        <div className="glass-card rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold font-display border-b border-white/10 pb-4 mb-6 text-primary">{t('basicInfo')}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('authNameSurname')}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Ahmet Yılmaz" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('businessName')}</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder={t('exampleCafe')} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('businessEmail')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="email" name="businessEmail" value={formData.businessEmail} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="info@isletme.com" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('taxNumber')}</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="text" name="taxId" value={formData.taxId} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="1234567890" required />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('country')}</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <select 
                      name="country" 
                      value={formData.country} 
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, country: e.target.value, region: "", district: "" }));
                      }} 
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" 
                      required
                    >
                      <option value="" disabled className="bg-gray-900">{t('choose')}</option>
                      {Country.getAllCountries().map(c => <option key={c.isoCode} value={c.isoCode} className="bg-gray-900">{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('region')}</label>
                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <select 
                      name="region" 
                      value={formData.region} 
                      disabled={!formData.country}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, region: e.target.value, district: "" }));
                      }} 
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer disabled:opacity-50" 
                      required
                    >
                      <option value="" disabled className="bg-gray-900">{t('choose')}</option>
                      {formData.country && State.getStatesOfCountry(formData.country).map(s => <option key={s.isoCode} value={s.isoCode} className="bg-gray-900">{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('city')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    {(() => {
                      const cities = formData.country && formData.region ? City.getCitiesOfState(formData.country, formData.region) : [];
                      const stateName = formData.region ? (State.getStateByCodeAndCountry(formData.region, formData.country)?.name || formData.region) : "";
                      return (
                        <select 
                          name="district" 
                          value={formData.district}
                          disabled={!formData.region}
                          onChange={handleChange} 
                          className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer disabled:opacity-50" 
                          required
                        >
                          <option value="" disabled className="bg-gray-900">{t('choose')}</option>
                          {cities.length > 0 
                            ? cities.map(c => <option key={c.name} value={c.name} className="bg-gray-900">{c.name}</option>)
                            : (formData.region && <option value={stateName} className="bg-gray-900">{stateName}</option>)
                          }
                        </select>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('businessAddress')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-4 w-5 h-5 text-muted-foreground" />
                  <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" placeholder={t('enterAddress')} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('companyInfoOptional')}</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-4 w-5 h-5 text-muted-foreground" />
                  <textarea name="companyInfo" value={formData.companyInfo} onChange={handleChange} rows={2} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" placeholder={t('shortCompanyInfo')} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('businessTypeReq')}</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <select name="businessType" value={formData.businessType} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" required>
                      <option value="" disabled className="bg-gray-900">{t('choose')}</option>
                      <option value="cafe" className="bg-gray-900">{t('cafe')}</option>
                      <option value="restaurant" className="bg-gray-900">{t('restaurant')}</option>
                      <option value="bar" className="bg-gray-900">{t('bar')}</option>
                      <option value="hotel" className="bg-gray-900">Hotel</option>
                      <option value="other" className="bg-gray-900">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('yourVenueStyle')}</label>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <select name="venueType" value={formData.venueType} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" required>
                      <option value="" disabled className="bg-gray-900">{t('choose')}</option>
                      <option value="Yorgun" className="bg-gray-900">{t('venueTired')}</option>
                      <option value="Keyifli & Enerjik" className="bg-gray-900">{t('venueCheerful')}</option>
                      <option value="Sakin" className="bg-gray-900">{t('venueCalm')}</option>
                      <option value="Melankolik" className="bg-gray-900">{t('venueMelancholic')}</option>
                      <option value="Sosyal" className="bg-gray-900">{t('venueSocial')}</option>
                      <option value="Meraklı" className="bg-gray-900">{t('venueCurious')}</option>
                      <option value="Romantik" className="bg-gray-900">{t('venueRomantic')}</option>
                      <option value="Nostaljik" className="bg-gray-900">{t('venueNostalgic')}</option>
                      <option value="Eğlence" className="bg-gray-900">{t('venueFun')}</option>
                      <option value="Rahat" className="bg-gray-900">{t('venueChill')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button onClick={handleNextStep} className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02]">
                  {t('next')} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <h2 className="text-2xl font-bold font-display border-b border-white/10 pb-4 mb-6 text-primary">{t('accountSecurity')}</h2>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('confirmEmailReq')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="email" name="confirmEmail" value={formData.confirmEmail} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="info@isletme.com" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('setPasswordField')}</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder={t('passPlaceholder')} required minLength={8} />
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" disabled={loading} className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02]">
                  {loading ? (
                    <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> {t('registering')}</>
                  ) : (
                    <><CheckCircle2 className="w-6 h-6 mr-2" /> {t('completeRegistration')}</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
