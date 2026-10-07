"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Sun, Moon, Monitor, LogOut, Palette, User, Info, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { user, setAuthOpen } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted] = useState(() => true);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      useAppStore.getState().setUser(null);
      useAppStore.getState().navigate("home");
      toast.success("Signed out. See you soon! 👋");
    } catch {
      toast.error("Failed to sign out");
    }
  }

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-white" />
        </span>
        Settings
      </h1>

      {/* Appearance */}
      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-primary" /> Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
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
          AniVerse looks best in dark mode — but light mode is here when you need it ☀️
        </p>
      </section>

      {/* Account */}
      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" /> Account
        </h2>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Username</span>
              <span className="font-bold">@{user.username}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-bold">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-bold">{user.role === "CREATOR" ? "👑 Creator" : "Viewer"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits</span>
              <span className="font-bold text-amber-500">{user.credits.toLocaleString()}</span>
            </div>
            <Button variant="destructive" className="w-full rounded-xl mt-2" onClick={logout}>
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">You&apos;re not signed in</p>
            <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setAuthOpen(true)}>
              Sign in
            </Button>
          </div>
        )}
      </section>

      {/* About */}
      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" /> About AniVerse
        </h2>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            AniVerse is a premium anime streaming universe — watch free and purchased animes,
            collect credits, trade with other collectors, and host synced watch parties.
          </p>
          <p className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" />
            Exchange unlocks after 20 anime purchases
          </p>
          <p>Version 1.0 · Made with 💜 for anime fans</p>
        </div>
      </section>
    </div>
  );
}
