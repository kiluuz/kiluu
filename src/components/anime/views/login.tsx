"use client";

import { useEffect, useState } from "react";
import { Loader2, Eye, Mail, Lock, User, ArrowLeft, Sparkles, Coins, Clapperboard, Swords, Gift, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "../store";
import { Logo } from "../logo";
import { SmartImage } from "../ui-bits";
import type { AuthUser } from "../types";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";

/** Full-page split login — cinematic image left, auth form right */
export function LoginView() {
  const { setUser, navigate, user } = useAppStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<{ email: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hero, setHero] = useState<{ banner: string | null; cover: string | null; title: string; quote: string } | null>(null);

  // Check URL ref query or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get("ref");
      if (refParam) {
        const clean = refParam.trim().toUpperCase();
        setReferralCode(clean);
        try {
          localStorage.setItem("dubanix_ref", clean);
        } catch {}
      } else {
        try {
          const saved = localStorage.getItem("dubanix_ref");
          if (saved) setReferralCode(saved.trim().toUpperCase());
        } catch {}
      }
    }
  }, []);

  // Already signed in → go home
  useEffect(() => {
    if (user) navigate("home");
  }, [user, navigate]);

  // Pick a cinematic backdrop from featured animes
  useEffect(() => {
    let alive = true;
    const QUOTES = [
      t("auth.quote1"),
      t("auth.quote2"),
      t("auth.quote3"),
      t("auth.quote4"),
    ];
    fetch("/api/home")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.featured?.length) return;
        const pick = d.featured[Math.floor(Math.random() * d.featured.length)];
        setHero({
          banner: pick.bannerImage || null,
          cover: pick.coverImage || null,
          title: pick.title,
          quote: QUOTES[Math.floor(Math.random() * QUOTES.length)],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(mode: "login" | "register", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };
    if (mode === "register") {
      payload.username = String(form.get("username") || "");
      if (payload.password !== String(form.get("confirm") || "")) {
        toast.error(t("auth.passwordMismatch"));
        setLoading(false);
        return;
      }
    }
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("auth.genericError"));
        return;
      }
      setUser(data.user as AuthUser);
      toast.success(mode === "login" ? `${t("auth.welcomeBack")}, ${data.user.displayName || data.user.username}!` : t("auth.accountWelcome"));
      navigate("home");
    } catch {
      toast.error(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          displayName: registerDisplayName.trim() || username,
          password,
          referralCode: referralCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("auth.registrationFailed"));
        return;
      }
      if (data.requiresVerification) {
        // OTP bosqichiga o'tish
        setOtpStep({ email });
        setOtpCode("");
        setResendCooldown(60);
        toast.success(t("auth.verificationSent"));
      } else if (data.user) {
        // Email sozlanmagan — to'g'ridan-to'g'ri kirish
        setUser(data.user as AuthUser);
        toast.success(t("auth.accountWelcome"));
        navigate("home");
      }
    } catch {
      toast.error(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpStep) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpStep.email, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("auth.invalidCode"));
        return;
      }
      setUser(data.user as AuthUser);
      toast.success(t("auth.emailVerified"));
      navigate("home");
    } catch {
      toast.error(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!otpStep || resendCooldown > 0) return;
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpStep.email }),
      });
      if (res.ok) {
        toast.success(t("auth.newCodeSent"));
        setResendCooldown(60);
      } else {
        const d = await res.json();
        toast.error(d.error || t("auth.resendFailed"));
      }
    } catch {
      toast.error(t("auth.networkErrorShort"));
    }
  }

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* ===== LEFT — cinematic panel ===== */}
      <div className="relative lg:w-[55%] h-[34vh] lg:h-screen overflow-hidden grain" aria-hidden="true">
        {hero ? (
          <SmartImage
            src={hero.banner || hero.cover}
            alt={hero.title}
            className="absolute inset-0 w-full h-full object-cover ken-burns"
          />
        ) : (
          <div className="absolute inset-0 aurora" />
        )}
        {/* Legibility gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/20 lg:bg-gradient-to-r lg:from-background/25 lg:via-background/10 lg:to-background" />
        <div className="absolute inset-0 bg-primary/[0.04] mix-blend-overlay" />

        {/* Brand top-left */}
        <div className="absolute top-6 left-6 sm:top-8 sm:left-10">
          <Logo variant="full" size={44} tagline />
        </div>

        {/* Bottom caption — hidden on short mobile banner */}
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10 lg:p-14 hidden lg:block max-w-2xl">
          <p className="font-display text-3xl xl:text-4xl font-black leading-tight text-white/95 drop-shadow-lg">
            {hero?.quote || t("auth.quote1")}
          </p>
          <div className="mt-6 flex items-center gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" /> {t("auth.freeCreditsSignup")}
            </span>
            <span className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> {t("auth.creatorEarnings")}
            </span>
            <span className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-400" /> {t("auth.giftOwnedAnime")}
            </span>
          </div>
        </div>
      </div>

      {/* ===== RIGHT — auth form ===== */}
      <div className="flex-1 lg:w-[45%] flex flex-col items-center justify-center px-5 sm:px-10 py-10 lg:py-0 relative">
        <div className="aurora absolute inset-0 pointer-events-none opacity-60" />

        <button
          onClick={() => navigate("home")}
          className="absolute top-6 right-6 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("auth.backToBrowse")}
        </button>

        <div className="relative w-full max-w-[420px]">
          {/* Mobile brand (desktop brand lives on image panel) */}
          <div className="lg:hidden flex justify-center mb-6">
            <Logo variant="mark" size={52} />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-black tracking-tight">
              {t("auth.welcomeTo")} <span className="gradient-text">Kiluu</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              {t("auth.tagline")}
            </p>
          </div>

          {/* OTP Verification Step */}
          {otpStep ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-bold text-lg">{t("auth.verifyEmail")}</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {t("auth.codeSentTo")} <span className="text-primary font-medium">{otpStep.email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp-code" className="text-xs font-semibold">{t("auth.verificationCode")}</Label>
                  <Input
                    id="otp-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="h-14 rounded-xl text-center text-2xl font-mono tracking-widest"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold text-[15px]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.verify")}
                </Button>
              </form>
              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `${t("auth.resendIn")} (${resendCooldown}s)` : t("auth.resendCode")}
                </button>
              </div>
              <button
                onClick={() => setOtpStep(null)}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> {t("common.back")}
              </button>
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-6 rounded-xl">
                <TabsTrigger value="login" className="rounded-lg">{t("auth.signIn")}</TabsTrigger>
                <TabsTrigger value="register" className="rounded-lg">{t("auth.createAccount")}</TabsTrigger>
              </TabsList>

            <TabsContent value="login">
              <form onSubmit={(e) => handleSubmit("login", e)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pass" className="text-xs font-semibold">{t("auth.password")}</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-pass" name="password" type="password" required placeholder="••••••••" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold text-[15px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.signIn")}
                </Button>
                <p className="text-[11.5px] text-center text-muted-foreground">
                  {t("auth.newHere")} <span className="text-amber-500 font-bold">{t("auth.freeCredits100")}</span> {t("auth.whenRegister")}
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-xs font-semibold">{t("auth.username")}</Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-username" name="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" placeholder="coolotaku_7" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reg-display-name" className="text-xs font-semibold">Display name</Label>
                    <span className="text-[10px] text-muted-foreground">{[...registerDisplayName].length}/20</span>
                  </div>
                  <Input
                    id="reg-display-name"
                    name="displayName"
                    value={registerDisplayName}
                    onChange={(event) => setRegisterDisplayName(event.target.value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ""))}
                    minLength={2}
                    maxLength={20}
                    placeholder="How others see you"
                    className="h-12 rounded-xl text-[15px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs font-semibold">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass" className="text-xs font-semibold">{t("auth.password")}</Label>
                    <Input id="reg-pass" name="password" type="password" required minLength={6} placeholder={t("auth.minPassword")} className="h-12 rounded-xl text-[15px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-xs font-semibold">{t("auth.confirm")}</Label>
                    <Input id="reg-confirm" name="confirm" type="password" required minLength={6} placeholder={t("auth.repeat")} className="h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reg-ref" className="text-xs font-semibold flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary" />
                      Referral kodi (ixtiyoriy)
                    </Label>
                    {referralCode && (
                      <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Qo'llandi
                      </span>
                    )}
                  </div>
                  <Input
                    id="reg-ref"
                    name="referralCode"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Masalan: ABC123"
                    maxLength={20}
                    className="h-12 rounded-xl text-[15px] font-mono tracking-wider uppercase"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold text-[15px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.createAccount")}
                </Button>
                <p className="text-[11.5px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {t("auth.chooseRole")}
                </p>
              </form>
            </TabsContent>
          </Tabs>
          )} {/* end otpStep ternary */}

          <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
            {t("auth.terms")}
          </p>
        </div>
      </div>
    </div>
  );
}
