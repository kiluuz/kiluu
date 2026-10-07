"use client";

import { useEffect, useState } from "react";
import {
  Repeat, Lock, ArrowLeftRight, Loader2, Inbox, Send, Plus, Trash2, Search,
  Handshake, Sparkles, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "../store";
import type { AnimeSummary, ExchangeOfferItem, ExchangeProposalItem } from "../types";
import { Avatar, SmartImage, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExchangeData {
  offers: ExchangeOfferItem[];
  eligibility: {
    unlocked: boolean;
    purchaseCount: number;
    required: number;
    ownedAnimes: { id: string; title: string; coverImage: string; slug: string }[];
  };
}

export function ExchangeView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [proposals, setProposals] = useState<{ received: ExchangeProposalItem[]; sent: ExchangeProposalItem[] }>({ received: [], sent: [] });

  // dialogs
  const [offerDialog, setOfferDialog] = useState(false);
  const [offerAnime, setOfferAnime] = useState<string>("");
  const [wantedNote, setWantedNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [proposeFor, setProposeFor] = useState<ExchangeOfferItem | null>(null);
  const [proposeAnime, setProposeAnime] = useState<string>("");
  const [proposeMsg, setProposeMsg] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/exchange${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load exchange"))
      .finally(() => setLoading(false));
  };

  const loadProposals = () => {
    if (!user) return;
    fetch("/api/exchange/proposals")
      .then((r) => r.json())
      .then(setProposals)
      .catch(() => {});
  };

  useEffect(load, [user, search]);
  useEffect(loadProposals, [user]);

  async function createOffer() {
    if (!offerAnime) {
      toast.error("Pick one of your animes to offer");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/exchange/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: offerAnime, wantedNote }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      toast.success("Offer listed on the marketplace!");
      setOfferDialog(false);
      setOfferAnime("");
      setWantedNote("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function sendProposal() {
    if (!proposeFor || !proposeAnime) {
      toast.error("Pick one of your animes to swap");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/exchange/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: proposeFor.id, animeId: proposeAnime, message: proposeMsg }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      toast.success("Proposal sent! The owner will review it.");
      setProposeFor(null);
      setProposeAnime("");
      setProposeMsg("");
      load();
      loadProposals();
    } finally {
      setBusy(false);
    }
  }

  async function respondProposal(id: string, action: "accept" | "decline") {
    setBusy(true);
    try {
      const res = await fetch("/api/exchange/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: id, action }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      toast.success(action === "accept" ? "Exchange complete! Ownership swapped 🔄" : "Proposal declined");
      load();
      loadProposals();
    } finally {
      setBusy(false);
    }
  }

  async function deleteOffer(id: string) {
    const res = await fetch(`/api/exchange/offer?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      toast.success("Offer removed");
      load();
    } else {
      toast.error(d.error);
    }
  }

  if (!user) {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">🔄</p>
        <h1 className="text-2xl font-black mb-2">The Exchange Marketplace</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
          Trade animes with other collectors. Unlock access after purchasing 20 animes.
        </p>
        <Button className="rounded-full brand-gradient text-white font-bold h-11 px-6" onClick={() => setAuthOpen(true)}>
          Sign in to start
        </Button>
      </div>
    );
  }

  const elig = data?.eligibility;
  const progress = elig ? Math.min(100, (elig.purchaseCount / elig.required) * 100) : 0;

  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
          <Repeat className="w-5 h-5 text-white" />
        </span>
        Exchange Market
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Swap animes with collectors — no credits needed, just good trades
      </p>

      {/* Eligibility banner */}
      {elig && !elig.unlocked && (
        <div className="glass rounded-3xl p-6 sm:p-8 mb-8 text-center relative overflow-hidden aurora">
          <div className="relative">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
              <Lock className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="font-black text-xl">Almost there, collector!</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
              The Exchange unlocks when you own <span className="font-bold text-foreground">{elig.required} animes</span>.
              You have <span className="font-bold text-primary">{elig.purchaseCount}</span> — keep collecting!
            </p>
            <div className="max-w-sm mx-auto">
              <Progress value={progress} className="h-3 [&>div]:brand-gradient" />
              <p className="text-xs text-muted-foreground mt-2 tabular-nums">{elig.purchaseCount} / {elig.required}</p>
            </div>
            <Button
              className="mt-5 rounded-full brand-gradient text-white font-bold"
              onClick={() => navigate("browse")}
            >
              <Package className="w-4 h-4" /> Browse animes to buy
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="market" className={cn(!elig?.unlocked && "opacity-50 pointer-events-none select-none")}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <TabsList className="rounded-xl">
            <TabsTrigger value="market" className="rounded-lg">Marketplace</TabsTrigger>
            <TabsTrigger value="received" className="rounded-lg">
              <Inbox className="w-3.5 h-3.5 mr-1.5" />
              Received {proposals.received.filter((p) => p.status === "PENDING").length > 0 && (
                <span className="ml-1 bg-primary text-white rounded-full text-[9px] font-black px-1.5 py-0.5">
                  {proposals.received.filter((p) => p.status === "PENDING").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-lg">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Sent
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search offers..."
                className="pl-9 h-9 rounded-full w-52"
              />
            </div>
            <Button
              size="sm"
              className="rounded-full brand-gradient text-white font-bold"
              onClick={() => setOfferDialog(true)}
              disabled={!elig?.unlocked}
            >
              <Plus className="w-4 h-4" /> New Offer
            </Button>
          </div>
        </div>

        {/* MARKETPLACE */}
        <TabsContent value="market">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading offers...
            </div>
          ) : data && data.offers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.offers.map((offer) => (
                <div key={offer.id} className="glass rounded-2xl overflow-hidden glow-hover fade-in-up group">
                  <div className="relative aspect-video">
                    <SmartImage src={offer.anime.coverImage} alt={offer.anime.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur text-white text-[10px] font-black rounded-full px-2.5 py-1 border border-white/15">
                      OFFERING
                    </span>
                    {offer.isMine && (
                      <button
                        onClick={() => deleteOffer(offer.id)}
                        className="absolute top-2.5 right-2.5 bg-rose-500/90 hover:bg-rose-500 text-white rounded-full p-1.5 transition"
                        aria-label="Delete offer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="absolute bottom-0 p-3.5">
                      <p className="text-white font-bold truncate">{offer.anime.title}</p>
                      <p className="text-white/70 text-[11px]">
                        ★ {offer.anime.rating.toFixed(1)} · {offer.anime.year} · {offer.anime.type}
                      </p>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <button
                      className="flex items-center gap-2 w-full p-1.5 rounded-lg hover:bg-accent transition mb-2 text-left"
                      onClick={() => navigate("user-profile", { username: offer.user.username })}
                    >
                      <Avatar src={offer.user.avatarUrl} name={offer.user.displayName} accent={offer.user.accentColor} size={24} />
                      <span className="text-xs text-muted-foreground truncate">
                        by <span className="font-semibold text-foreground">{offer.user.displayName}</span> · {timeAgo(offer.createdAt)}
                      </span>
                    </button>
                    {offer.wantedNote && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 italic">&ldquo;{offer.wantedNote}&rdquo;</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {offer.proposalCount} proposal{offer.proposalCount !== 1 ? "s" : ""}
                      </span>
                      {!offer.isMine ? (
                        <Button
                          size="sm"
                          className="rounded-full h-8 brand-gradient text-white font-bold"
                          onClick={() => {
                            setProposeFor(offer);
                            setProposeAnime("");
                          }}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Propose Swap
                        </Button>
                      ) : (
                        <span className="text-[11px] font-bold text-primary">Your offer</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed p-12 text-center">
              <p className="text-5xl mb-3">🕳️</p>
              <p className="font-bold">No offers on the market</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Be the first to list an anime for exchange</p>
              <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setOfferDialog(true)}>
                <Plus className="w-4 h-4" /> Create offer
              </Button>
            </div>
          )}
        </TabsContent>

        {/* RECEIVED */}
        <TabsContent value="received">
          {proposals.received.length === 0 ? (
            <EmptyTab emoji="📥" title="No proposals received" desc="When someone wants to trade for your animes, it shows up here" />
          ) : (
            <div className="space-y-3">
              {proposals.received.map((p) => (
                <ProposalCard
                  key={p.id}
                  p={p}
                  type="received"
                  busy={busy}
                  onAccept={() => respondProposal(p.id, "accept")}
                  onDecline={() => respondProposal(p.id, "decline")}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* SENT */}
        <TabsContent value="sent">
          {proposals.sent.length === 0 ? (
            <EmptyTab emoji="📤" title="No proposals sent" desc="Propose a swap on marketplace offers — they'll appear here" />
          ) : (
            <div className="space-y-3">
              {proposals.sent.map((p) => (
                <ProposalCard key={p.id} p={p} type="sent" busy={busy} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create offer dialog */}
      <Dialog open={offerDialog} onOpenChange={setOfferDialog}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>List an anime for exchange</DialogTitle>
            <DialogDescription>Pick one you own and tell others what you want for it</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Your animes</Label>
              {elig && elig.ownedAnimes.length > 0 ? (
                <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto fancy-scroll p-1">
                  {elig.ownedAnimes.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setOfferAnime(a.id)}
                      className={cn(
                        "relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition",
                        offerAnime === a.id ? "border-primary shadow-lg shadow-primary/25" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      aria-label={a.title}
                      title={a.title}
                    >
                      <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground border border-dashed rounded-xl p-4">
                  You need to own animes first — buy some in Discover!
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wanted" className="text-xs font-semibold">What do you want for it? (optional)</Label>
              <Textarea
                id="wanted"
                value={wantedNote}
                onChange={(e) => setWantedNote(e.target.value)}
                placeholder="Looking for Steins;Gate or any psychological thriller..."
                maxLength={200}
                className="rounded-xl min-h-20"
              />
            </div>
            <Button
              disabled={!offerAnime || busy}
              onClick={createOffer}
              className="w-full h-11 rounded-xl brand-gradient text-white font-bold"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              List on Marketplace
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Propose swap dialog */}
      <Dialog open={Boolean(proposeFor)} onOpenChange={(open) => !busy && setProposeFor(open ? proposeFor : null)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" /> Propose a Swap
            </DialogTitle>
            <DialogDescription>
              {proposeFor && <>You get <span className="font-bold text-foreground">{proposeFor.anime.title}</span> · They get your pick</>}
            </DialogDescription>
          </DialogHeader>
          {proposeFor && (
            <div className="space-y-4 pt-2">
              {/* Visual swap */}
              <div className="flex items-center justify-center gap-3">
                <div className="w-24 rounded-xl overflow-hidden border-2 border-primary/40">
                  <div className="aspect-[2/3]">
                    <SmartImage src={proposeFor.anime.coverImage} alt={proposeFor.anime.title} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[9px] font-bold text-center py-1 truncate px-1">You get</p>
                </div>
                <ArrowLeftRight className="w-6 h-6 text-primary shrink-0" />
                <div className="w-24 rounded-xl overflow-hidden border-2 border-fuchsia-500/40">
                  <div className="aspect-[2/3]">
                    <SmartImage
                      src={elig?.ownedAnimes.find((a) => a.id === proposeAnime)?.coverImage || ""}
                      alt="Your anime"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[9px] font-bold text-center py-1 truncate px-1">They get</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Offer one of your animes</Label>
                {elig && elig.ownedAnimes.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto fancy-scroll p-1">
                    {elig.ownedAnimes
                      .filter((a) => a.id !== proposeFor.anime.id)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setProposeAnime(a.id)}
                          className={cn(
                            "relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition",
                            proposeAnime === a.id ? "border-fuchsia-500 shadow-lg shadow-fuchsia-500/25" : "border-transparent opacity-70 hover:opacity-100"
                          )}
                          aria-label={a.title}
                          title={a.title}
                        >
                          <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No animes available to offer.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prop-msg" className="text-xs font-semibold">Message (optional)</Label>
                <Input
                  id="prop-msg"
                  value={proposeMsg}
                  onChange={(e) => setProposeMsg(e.target.value)}
                  placeholder="This is a great deal, trust me!"
                  maxLength={300}
                  className="rounded-xl"
                />
              </div>
              <Button
                disabled={!proposeAnime || busy}
                onClick={sendProposal}
                className="w-full h-11 rounded-xl brand-gradient text-white font-bold"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Proposal
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProposalCard({
  p, type, busy, onAccept, onDecline,
}: {
  p: ExchangeProposalItem;
  type: "received" | "sent";
  busy: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const { navigate } = useAppStore();
  const other = type === "received" ? p.proposer : p.offer.user;
  return (
    <div className="glass rounded-2xl p-4 fade-in-up">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Swap visual */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <button onClick={() => navigate("detail", { animeId: p.offer.anime.slug })} className="w-12 rounded-lg overflow-hidden hover:scale-105 transition">
            <div className="aspect-[2/3]">
              <SmartImage src={p.offer.anime.coverImage} alt={p.offer.anime.title} className="w-full h-full object-cover" />
            </div>
          </button>
          <ArrowLeftRight className={cn("w-5 h-5 shrink-0", type === "received" ? "text-primary" : "text-fuchsia-400")} />
          <button onClick={() => navigate("detail", { animeId: p.anime.slug })} className="w-12 rounded-lg overflow-hidden hover:scale-105 transition">
            <div className="aspect-[2/3]">
              <SmartImage src={p.anime.coverImage} alt={p.anime.title} className="w-full h-full object-cover" />
            </div>
          </button>
          <div className="min-w-0">
            <p className="text-sm">
              {type === "received" ? (
                <>
                  <span className="font-bold">{p.proposer.displayName}</span>{" "}
                  <span className="text-muted-foreground">offers</span>{" "}
                  <span className="font-bold">{p.anime.title}</span>{" "}
                  <span className="text-muted-foreground">for your</span>{" "}
                  <span className="font-bold">{p.offer.anime.title}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">You offer</span>{" "}
                  <span className="font-bold">{p.anime.title}</span>{" "}
                  <span className="text-muted-foreground">for</span>{" "}
                  <span className="font-bold">{p.offer.anime.title}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              with <button className="font-semibold hover:text-primary" onClick={() => navigate("user-profile", { username: other.username })}>@{other.username}</button> · {timeAgo(p.createdAt)}
            </p>
            {p.message && <p className="text-xs italic text-muted-foreground mt-1">&ldquo;{p.message}&rdquo;</p>}
          </div>
        </div>

        {/* Status / actions */}
        <div className="ml-auto">
          {p.status === "PENDING" && type === "received" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={onAccept}
                className="rounded-full h-9 brand-gradient text-white font-bold"
              >
                <Handshake className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onDecline} className="rounded-full h-9">
                Decline
              </Button>
            </div>
          ) : (
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider rounded-full px-3 py-1.5 border",
              p.status === "ACCEPTED" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
              p.status === "DECLINED" && "bg-rose-500/10 text-rose-500 border-rose-500/30",
              p.status === "PENDING" && "bg-amber-500/10 text-amber-500 border-amber-500/30"
            )}>
              {p.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTab({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-dashed p-12 text-center">
      <p className="text-5xl mb-3">{emoji}</p>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}
