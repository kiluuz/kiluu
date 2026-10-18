"use client";

import { useEffect, useState } from "react";
import {
  Settings2, Loader2, AlertCircle, CheckCircle2, Edit3, Eye, EyeOff,
  RefreshCw, BookOpen, Info, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { SmartImage } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BotAnime {
  slug: string;
  title: string;
  description: string;
  poster: string;
  price: number;
  is_active: boolean;
  episode_count: number;
}

function formatPrice(p: number) {
  return new Intl.NumberFormat("uz-UZ").format(p) + " so'm";
}

function EditModal({ anime, onClose, onSaved }: {
  anime: BotAnime;
  onClose: () => void;
  onSaved: (updated: BotAnime) => void;
}) {
  const [form, setForm] = useState({
    title: anime.title,
    description: anime.description,
    poster: anime.poster,
    price: anime.price,
    is_active: anime.is_active,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/bot/admin/anime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: anime.slug, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
      onSaved({ ...anime, ...form });
      toast.success("O'zgarishlar saqlandi");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-strong rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-black mb-5">Animeni tahrirlash</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Nomi</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Tavsif</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm min-h-[100px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Poster URL</label>
            <Input value={form.poster} onChange={e => setForm(f => ({ ...f, poster: e.target.value }))} className="rounded-xl font-mono text-xs" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Narx (so'm)</label>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
              className="rounded-xl"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                form.is_active ? "bg-primary" : "bg-secondary"
              )}
            >
              <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow", form.is_active && "translate-x-5")} />
            </button>
            <span className="text-sm font-semibold">{form.is_active ? "Faol" : "Nofaol"}</span>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button className="flex-1 rounded-xl brand-gradient text-white gap-2" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BotAdminView() {
  const { user } = useAppStore();
  const [animes, setAnimes] = useState<BotAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<BotAnime | null>(null);

  const isAdmin = user?.role === "ADMIN";

  async function loadAnimes() {
    setLoading(true);
    try {
      const res = await fetch("/api/bot/catalog?only_active=false");
      const data = await res.json();
      setAnimes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Catalog yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAnime(slug: string, title: string) {
    if (!confirm(`Haqiqatan ham "${title}" animesini saytdan butunlay o'chirmoqchimisiz?`)) return;
    try {
      const res = await fetch(`/api/animes/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("O'chirishda xatolik");
      toast.success("Anime o'chirildi");
      setAnimes(prev => prev.filter(a => a.slug !== slug));
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi");
    }
  }

  useEffect(() => { loadAnimes(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive opacity-70 mb-4" />
        <p className="text-xl font-black">Ruxsat yo'q</p>
        <p className="text-sm text-muted-foreground mt-2">Bu sahifa faqat adminlar uchun.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/20">
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Admin Paneli</h1>
            <p className="text-sm text-muted-foreground">Bot katalogini boshqarish</p>
          </div>
        </div>
        <Button onClick={loadAnimes} variant="outline" className="rounded-xl gap-2" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Yangilash
        </Button>
      </div>

      {/* Upload rules */}
      <div className="glass rounded-2xl p-5 mb-8 border-l-4 border-l-primary">
        <h2 className="font-black text-base flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-primary" />
          Kanalga yuklash qoidasi
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Telegram kanaliga anime post yuklash uchun quyidagi formatdan foydalaning:</p>
          <div className="bg-secondary/40 rounded-xl p-4 font-mono text-xs leading-relaxed">
            <p className="text-primary font-bold">#anime naruto</p>
            <p>Nomi: Naruto</p>
            <p>Narx: 30000</p>
            <p>Tavsif: Qisqa tavsif...</p>
          </div>
          <ul className="space-y-1.5 mt-3">
            <li className="flex items-start gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" /> <span><strong>#anime naruto</strong> — anime slug-ini belgilaydi</span></li>
            <li className="flex items-start gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" /> <span>Yangi qism yuklashda faylni <strong>naruto|1</strong> formatida nomlang (naruto 1-qism)</span></li>
            <li className="flex items-start gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" /> <span>Postni tahrirlash metadata-ni avtomatik yangilaydi</span></li>
            <li className="flex items-start gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" /> <span><strong>Faol: yo'q</strong> yozsangiz — anime yashirinadi</span></li>
          </ul>
        </div>
      </div>

      {/* Anime list */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 flex gap-4">
              <div className="w-16 h-24 skeleton rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 skeleton rounded w-3/4" />
                <div className="h-3 skeleton rounded" />
                <div className="h-3 skeleton rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : animes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Hech qanday anime topilmadi</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {animes.map((anime) => (
            <div
              key={anime.slug}
              className={cn(
                "glass rounded-2xl p-4 flex gap-4 border transition",
                !anime.is_active && "opacity-60 border-dashed"
              )}
            >
              <SmartImage
                src={anime.poster}
                alt={anime.title}
                className="w-16 h-24 object-cover rounded-xl shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-sm leading-tight line-clamp-2 flex-1">{anime.title}</p>
                  {anime.is_active ? (
                    <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {anime.episode_count} qism
                </p>
                <p className="text-xs font-bold text-primary mb-3">{formatPrice(anime.price)}</p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1 gap-1.5 text-xs h-7"
                    onClick={() => setEditTarget(anime)}
                  >
                    <Edit3 className="w-3 h-3" /> Tahrirlash
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg px-2 text-xs h-7"
                    title="Animeni o'chirish"
                    onClick={() => deleteAnime(anime.slug, anime.title)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          anime={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setAnimes(prev => prev.map(a => a.slug === updated.slug ? updated : a));
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
