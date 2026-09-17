import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/update-password")({
  component: UpdatePassword,
});

function UpdatePassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Check if the user is in a password recovery session
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        toast.error("Oturum süresi dolmuş veya geçersiz link. Lütfen tekrar şifre sıfırlama isteği gönderin.");
        setTimeout(() => {
          navigate({ to: "/" });
        }, 2000);
      } else {
        setIsVerifying(false);
      }
    };
    
    // Sometimes the hash takes a moment to process after redirect
    setTimeout(() => {
      checkSession();
    }, 500);
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch') || "Şifreler eşleşmiyor.");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      toast.success(t('passwordUpdated') || "Şifreniz başarıyla güncellendi!");
      setTimeout(() => {
        navigate({ to: "/" });
      }, 1500);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 animate-pulse">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Bağlantı doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pt-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="glass-card border-white/10 rounded-2xl p-8 shadow-glow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t('updatePassword') || "Şifrenizi Güncelleyin"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Lütfen hesabınız için yeni, güçlü bir şifre belirleyin.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('newPassword') || "Yeni Şifre"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="new-password" 
                  type="password" 
                  className="pl-9 bg-black/20 border-white/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('confirmPassword') || "Yeni Şifre (Tekrar)"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="confirm-password" 
                  type="password" 
                  className="pl-9 bg-black/20 border-white/10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full font-bold group" 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  {t('updatePassword') || "Şifreyi Güncelle"}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
