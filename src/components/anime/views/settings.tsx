"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Sun, Moon, Monitor, LogOut, Palette, User, Info, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export function SettingsView() {
  const { user, setAuthOpen } = useAppStore();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mounted] = useState(() => true);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      useAppStore.getState().setUser(null);
      useAppStore.getState().navigate("home");
      toast.success(t("settings.signedOut"));
    } catch {
      toast.error(t("settings.signOutError"));
    }
  }

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-white" />
        </span>
        {t("settings.title")}
      </h1>

      {/* Appearance */}
      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-primary" /> {t("settings.appearance")}
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: "light", label: t("settings.light"), icon: Sun },
            { id: "dark", label: t("settings.dark"), icon: Moon },
            { id: "system", label: t("settings.system"), icon: Monitor },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "rounded-xl border p-4 flex flex-col items-center gap-2 transition",
                mounted && theme === t.id
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "hover:border-primary/40"
              )}
            >
              <t.icon className="w-5 h-5" />
              <span className="text-xs font-bold">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          {t("settings.appearanceHint")}
        </p>
      </section>

      {/* Account */}
      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" /> {t("settings.account")}
        </h2>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("settings.username")}</span>
              <span className="font-bold">@{user.username}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("settings.email")}</span>
              <span className="font-bold">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("settings.role")}</span>
              <span className="font-bold">{user.role === "CREATOR" ? `👑 ${t("settings.creator")}` : t("settings.viewer")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("home.credits")}</span>
              <span className="font-bold text-amber-500">{user.credits.toLocaleString()}</span>
            </div>
            <Button variant="destructive" className="w-full rounded-xl mt-2" onClick={logout}>
              <LogOut className="w-4 h-4" /> {t("settings.signOut")}
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">{t("settings.notSignedIn")}</p>
            <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setAuthOpen(true)}>
              {t("signIn")}
            </Button>
          </div>
        )}
      </section>

      {/* About */}
      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" /> {t("settings.about")}
        </h2>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            {t("settings.aboutDescription")}
          </p>
          <p className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" />
            {t("settings.giftNote")}
          </p>
          <p>{t("settings.version")}</p>
        </div>
      </section>
    </div>
  );
}
