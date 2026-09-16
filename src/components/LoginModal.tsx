import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { User, Store, Chrome, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

interface LoginModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LoginModal({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: LoginModalProps) {
  const { t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled && controlledOnOpenChange ? controlledOnOpenChange : setInternalOpen;
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent, role: 'user' | 'business') => {
    e.preventDefault();
    try {
      setIsLoading(true);
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: role
            }
          }
        });
        if (error) throw error;
        toast.success(t('createAccount') + " başarılı! E-postanızı kontrol edin.");
        setOpen(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success(t('welcomeBack'));
        setOpen(false);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] glass-card border-white/10 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold text-center">
            {isRegistering ? t('createAccount') : t('welcomeBack')}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            ChillSpot'ın sunduğu deneyimi kişiselleştirin.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setIsRegistering(false); }} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-black/20">
            <TabsTrigger value="user" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="w-4 h-4 mr-2" />
              {t('userLogin')}
            </TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Store className="w-4 h-4 mr-2" />
              {t('businessLogin')}
            </TabsTrigger>
          </TabsList>

          {/* USER TAB */}
          <TabsContent value="user" className="mt-4 space-y-4">
            <Button 
              variant="outline" 
              className="w-full bg-white/5 border-white/10 hover:bg-white/10 transition-colors"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <Chrome className="w-5 h-5 mr-2 text-red-400" />
              {t('loginWithGoogle')}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('or')}
                </span>
              </div>
            </div>

            <form onSubmit={(e) => handleEmailAuth(e, 'user')} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="user-email" 
                    type="email" 
                    placeholder="mail@example.com"
                    className="pl-9 bg-black/20 border-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="user-password" 
                    type="password" 
                    className="pl-9 bg-black/20 border-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                {isRegistering ? t('registerAction') : t('loginAction')}
              </Button>
            </form>
          </TabsContent>

          {/* BUSINESS TAB */}
          <TabsContent value="business" className="mt-4 space-y-4">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-center mb-4">
              İşletmenizi yönetmek ve istatistikleri görmek için giriş yapın.
            </div>
            
            <form onSubmit={(e) => handleEmailAuth(e, 'business')} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="business-email" 
                    type="email" 
                    placeholder="işletme@example.com"
                    className="pl-9 bg-black/20 border-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="business-password" 
                    type="password" 
                    className="pl-9 bg-black/20 border-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold" variant="secondary" disabled={isLoading}>
                {t('loginAction')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">
            {activeTab === 'business' 
              ? "İşletme hesabınız yok mu?" 
              : (isRegistering ? t('haveAccount') : t('noAccount'))}
          </span>
          {activeTab === 'business' ? (
            <button 
              onClick={() => {
                setOpen(false);
                window.location.href = '/business-register';
              }}
              className="ml-1 text-primary hover:underline font-semibold"
            >
              Hemen Kayıt Ol
            </button>
          ) : (
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-1 text-primary hover:underline font-semibold"
            >
              {isRegistering ? t('loginAction') : t('registerAction')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
