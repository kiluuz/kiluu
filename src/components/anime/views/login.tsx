"use client";

import { useEffect, useState } from "react";
import { Loader2, Eye, Mail, Lock, User, ArrowLeft, Sparkles, Coins, Clapperboard, Swords } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "../store";
import { Logo } from "../logo";
import { SmartImage } from "../ui-bits";
import type { AuthUser } from "../types";
import { toast } from "sonner";

/** Full-page split login — cinematic image left, auth form right */
export function LoginView() {
  const { setUser, navigate, user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<{ email: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hero, setHero] = useState<{ banner: string | null; cover: string | null; title: string; quote: string } | null>(null);

  // Already signed in → go home
  useEffect(() => {
    if (user) navigate("home");
  }, [user, navigate]);

  // Pick a cinematic backdrop from featured animes
  useEffect(() => {
    let alive = true;
    const QUOTES = [
      "Every voice deserves to be heard — in every language.",
      "Stream it. Love it. Dub it your way.",
      "Where Central Asia meets anime.",
      "Your library. Your language. Your cinema.",
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
        toast.error("Passwords do not match");
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
        toast.error(data.error || "Something went wrong");
        return;
      }
      setUser(data.user as AuthUser);
      toast.success(mode === "login" ? `Welcome back, ${data.user.displayName || data.user.username}!` : "Account created! Welcome to Kiluu ✦");
      navigate("home");
    } catch {
      toast.error("Network error. Please try again.");
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
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }
      // OTP bosqichiga o'tish
      setOtpStep({ email });
      setOtpCode("");
      setResendCooldown(60);
      toast.success("Tasdiqlash kodi emailingizga yuborildi!");
    } catch {
      toast.error("Network error. Please try again.");
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
        toast.error(data.error || "Invalid code");
        return;
      }
      setUser(data.user as AuthUser);
      toast.success("Email tasdiqlandi! Kiluu ga xush kelibsiz ✦");
      navigate("home");
    } catch {
      toast.error("Network error. Please try again.");
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
        toast.success("Yangi kod yuborildi!");
        setResendCooldown(60);
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to resend");
      }
    } catch {
      toast.error("Network error");
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
            {hero?.quote || "Every voice deserves to be heard — in every language."}
          </p>
          <div className="mt-6 flex items-center gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" /> 100 free credits on signup
            </span>
            <span className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> Creators earn from every view
            </span>
            <span className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-400" /> Gift a version even if you already own it
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
          Back to browse
        </button>

        <div className="relative w-full max-w-[420px]">
          {/* Mobile brand (desktop brand lives on image panel) */}
          <div className="lg:hidden flex justify-center mb-6">
            <Logo variant="mark" size={52} />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-black tracking-tight">
              Welcome to <span className="gradient-text">Kiluu</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              Stream, collect and gift premium anime — dubbed your way.
            </p>
          </div>

          {/* OTP Verification Step */}
          {otpStep ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-bold text-lg">Emailingizni tasdiqlang</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  <span className="text-primary font-medium">{otpStep.email}</span> ga 6 xonali kod yuborildi
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp-code" className="text-xs font-semibold">Tasdiqlash kodi</Label>
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tasdiqlash"}
                </Button>
              </form>
              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Qayta yuborish (${resendCooldown}s)` : "Kodni qayta yuborish"}
                </button>
              </div>
              <button
                onClick={() => setOtpStep(null)}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Orqaga
              </button>
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-6 rounded-xl">
                <TabsTrigger value="login" className="rounded-lg">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="rounded-lg">Create Account</TabsTrigger>
              </TabsList>

            <TabsContent value="login">
              <form onSubmit={(e) => handleSubmit("login", e)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pass" className="text-xs font-semibold">Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-pass" name="password" type="password" required placeholder="••••••••" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold text-[15px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                </Button>
                <p className="text-[11.5px] text-center text-muted-foreground">
                  New here? You get <span className="text-amber-500 font-bold">100 free credits</span> when you register
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-xs font-semibold">Username</Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-username" name="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" placeholder="coolotaku_7" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass" className="text-xs font-semibold">Password</Label>
                    <Input id="reg-pass" name="password" type="password" required minLength={6} placeholder="min 6 chars" className="h-12 rounded-xl text-[15px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-xs font-semibold">Confirm</Label>
                    <Input id="reg-confirm" name="confirm" type="password" required minLength={6} placeholder="repeat" className="h-12 rounded-xl text-[15px]" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold text-[15px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                </Button>
                <p className="text-[11.5px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Choose Creator or Viewer after signup — one time only
                </p>
              </form>
            </TabsContent>
          </Tabs>
          )} {/* end otpStep ternary */}

          <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
            By continuing you agree to watch responsibly and pause for snacks.
          </p>
        </div>
      </div>
    </div>
  );
}
