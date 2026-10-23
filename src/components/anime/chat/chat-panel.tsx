// src/components/anime/chat/chat-panel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Smile,
  Image as ImageIcon,
  Pin,
  Reply,
  MoreVertical,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Flame,
  ShieldAlert,
  Play,
  ShoppingCart,
  Gift,
  BarChart2,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore, useOpenProfile } from "../store";
import { FramedAvatar, SmartImage, timeAgo } from "../ui-bits";
import { getRealtimeClient, RealtimeStatus, ChatMessagePayload } from "@/lib/realtime-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  roomId: string; // "global", "club:xyz", "anime:abc"
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onClose?: () => void;
}

export function ChatPanel({
  roomId,
  title,
  subtitle,
  compact = false,
  onClose,
}: ChatPanelProps) {
  const { user, setAuthOpen, navigate } = useAppStore();
  const openProfile = useOpenProfile();

  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessagePayload | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessagePayload | null>(null);
  const [slowMode, setSlowMode] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [emotes, setEmotes] = useState<Array<{ code: string; imageUrl: string; unlocked: boolean }>>([]);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);

  // Xonaga ulanish va dastlabki xabarlarni yuklash
  useEffect(() => {
    let alive = true;
    setLoading(true);

    // 1. Dastlabki xabarlarni GET qilish
    async function loadInitial() {
      try {
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`);
        if (res.ok && alive) {
          const data = await res.json();
          setMessages(data.messages || []);
          if (data.slowMode) setSlowMode(data.slowMode);

          // Xabarlar mualliflarining online statusini serverdan yuklash
          if (data.messages && data.messages.length > 0) {
            const authorIds = Array.from(new Set(data.messages.map((m: any) => m.user?.id).filter(Boolean)));
            if (authorIds.length > 0) {
              fetch(`/api/presence?userIds=${authorIds.join(",")}`)
                .then((r) => r.json())
                .then((pres) => {
                  if (alive && Array.isArray(pres.onlineUserIds)) {
                    setOnlineUserIds((prev) => new Set([...prev, ...pres.onlineUserIds]));
                  }
                })
                .catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error("Initial chat load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadInitial();

    // 2. Emotelarni yuklash
    fetch("/api/chat/emotes")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.emotes) setEmotes(d.emotes);
      })
      .catch(() => {});

    // 3. Realtime mijozga ulanish (WebSocket + Polling fallback)
    const client = getRealtimeClient(roomId);
    const unsubscribe = client.subscribe(
      (data) => {
        if (!alive) return;
        if (data.type === "message" && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          scrollToBottom();
        } else if (data.type === "room_presence" && Array.isArray(data.userIds)) {
          setOnlineUserIds(new Set(data.userIds));
        } else if (data.type === "presence" && data.userId) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            if (data.online) {
              next.add(data.userId);
            } else {
              next.delete(data.userId);
            }
            return next;
          });
        } else if (data.type === "message_edit") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? { ...m, body: data.body, editedAt: data.editedAt }
                : m
            )
          );
        } else if (data.type === "message_delete") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? { ...m, isDeleted: true, body: "Ushbu xabar o'chirildi" }
                : m
            )
          );
        } else if (data.type === "reaction") {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== data.messageId) return m;
              const currentReactions = { ...(m.reactions || {}) };
              if (!currentReactions[data.emote]) {
                currentReactions[data.emote] = { count: 0, users: [], hasReacted: false };
              }
              currentReactions[data.emote] = {
                count: data.count,
                users: currentReactions[data.emote].users,
                hasReacted: data.userId === user?.id ? data.action === "added" : currentReactions[data.emote].hasReacted,
              };
              return { ...m, reactions: currentReactions };
            })
          );
        } else if (data.type === "pin") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId ? { ...m, isPinned: data.isPinned } : m
            )
          );
        } else if (data.type === "typing") {
          setTypingUsers((prev) => [...new Set([...prev, data.userId])]);
          setTimeout(() => {
            if (alive) {
              setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
            }
          }, 3000);
        }
      },
      (status) => {
        if (alive) setRealtimeStatus(status);
      }
    );

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Cooldown taymeri
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleSendMessage = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    const text = inputText.trim();
    if (!text && !editingMsg) return;

    if (cooldown > 0) {
      toast.warning(`Sekin rejim. ${cooldown} soniya kuting.`);
      return;
    }

    setSending(true);

    try {
      if (editingMsg) {
        // Tahrirlash
        const res = await fetch(
          `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${editingMsg.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: text }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Tahrirlashda xatolik");
        setEditingMsg(null);
        setInputText("");
      } else {
        // Yangi xabar yuborish
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: text,
            replyToId: replyingTo?.id || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Xabar yuborilmadi");

        setInputText("");
        setReplyingTo(null);

        // Agar xabar WebSocket orqali kelishdan oldin ko'rinishi kerak bo'lsa
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }

        if (slowMode > 0) {
          setCooldown(slowMode);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi");
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId: string, emote: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emote }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Reaksiyada xatolik");
      }
    } catch {
      toast.error("Reaksiya yuborilmadi");
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.isPinned ? "Xabar qadaldi" : "Qadash bekor qilindi");
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Haqiqatan ham bu xabarni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${messageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Xabar o'chirildi");
    } catch (e: any) {
      toast.error(e.message || "O'chirishda xatolik");
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
      toast.error("Savol va kamida 2 ta variant kiriting");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: pollQuestion,
          type: "poll",
          poll: {
            question: pollQuestion,
            options: pollOptions.filter((o) => o.trim()),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowPollDialog(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      toast.success("So'rovnoma yaratildi");
    } catch (e: any) {
      toast.error(e.message || "So'rovnoma yaratilmadi");
    } finally {
      setSending(false);
    }
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <div className={cn("flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm", compact ? "h-[500px]" : "h-[680px]")}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-secondary/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary border">
              {roomId.startsWith("club:") ? "🛡️" : roomId.startsWith("anime:") ? "🎬" : "💬"}
            </div>
            {/* Status dot */}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                realtimeStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : realtimeStatus === "polling"
                  ? "bg-amber-500"
                  : "bg-muted-foreground"
              )}
              title={
                realtimeStatus === "connected"
                  ? "Real-time ulangan (Cloudflare WebSocket)"
                  : realtimeStatus === "polling"
                  ? "Sekin rejim (Polling fallback)"
                  : "Ulanmoqda..."
              }
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate flex items-center gap-2">
              {title || (roomId === "global" ? "Global zal (Umumiy chat)" : roomId)}
              {realtimeStatus === "polling" && (
                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 text-amber-500 border-amber-500/30 gap-1">
                  <Clock className="w-2.5 h-2.5" /> Sekin rejim
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-2">
              <span>{subtitle || (realtimeStatus === "connected" ? "Real-time faol" : "Ulanmoqda...")}</span>
              {onlineUserIds.size > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineUserIds.size} online
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-primary/10 border-b flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 text-primary shrink-0 rotate-45" />
            <span className="font-semibold text-primary">Qadalgan:</span>
            <span className="truncate text-muted-foreground">
              {pinnedMessages[pinnedMessages.length - 1].body}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
            {pinnedMessages.length} ta
          </span>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 fancy-scroll">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl mb-2">
              💬
            </div>
            <p className="font-bold text-sm">Hali xabarlar yo'q</p>
            <p className="text-xs mt-1">Birinchi bo'lib suhbatni boshlang!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = user?.id === m.user.id;
            const hasSpoiler = !!m.spoiler;
            const isSpoilerRevealed = revealedSpoilers[m.id];
            const isHidden = hasSpoiler && m.spoiler?.hidden && !isSpoilerRevealed;

            return (
              <div
                key={m.id}
                className={cn(
                  "group flex gap-3 max-w-[85%] transition-all",
                  isOwn ? "ml-auto flex-row-reverse" : ""
                )}
              >
                {/* Avatar */}
                <button
                  onClick={() => openProfile(m.user.username)}
                  className="shrink-0 self-end mb-1 relative"
                >
                  <FramedAvatar user={m.user as any} size={34} />
                  {onlineUserIds.has(m.user.id) && (
                    <span
                      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background live-dot"
                      title="Online"
                    />
                  )}
                </button>

                {/* Message Body Wrapper */}
                <div className="space-y-1 min-w-0">
                  {/* Sender Name & Badges */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] text-muted-foreground px-1",
                      isOwn ? "justify-end" : ""
                    )}
                  >
                    <button
                      onClick={() => openProfile(m.user.username)}
                      className="font-bold hover:underline text-foreground truncate max-w-[120px]"
                    >
                      {m.user.displayName}
                    </button>
                    {m.user.clubTag && (
                      <span className="px-1 py-0.2 rounded bg-primary/10 text-primary font-black text-[9px]">
                        [{m.user.clubTag}]
                      </span>
                    )}
                    <span className="text-[10px] bg-secondary px-1 py-0.2 rounded font-semibold">
                      Lv.{m.user.level}
                    </span>
                    <span className="text-[10px] opacity-60">
                      {timeAgo(String(m.createdAt))}
                    </span>
                  </div>

                  {/* Reply preview */}
                  {m.replyTo && (
                    <div className="text-[10px] bg-secondary/40 border-l-2 border-primary/50 px-2 py-1 rounded text-muted-foreground truncate max-w-[280px]">
                      <span className="font-bold">@{m.replyTo.username}: </span>
                      {m.replyTo.body}
                    </div>
                  )}

                  {/* Main Bubble */}
                  <div
                    className={cn(
                      "relative rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-secondary/70 text-foreground rounded-bl-xs",
                      m.isDeleted ? "italic opacity-60 text-xs" : ""
                    )}
                  >
                    {/* Spoiler Tag */}
                    {hasSpoiler && (
                      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-current/20 text-xs font-semibold">
                        <span className="flex items-center gap-1 text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Epizod {m.spoiler?.episodeNo} Spoiler
                        </span>
                        <button
                          onClick={() =>
                            setRevealedSpoilers((p) => ({ ...p, [m.id]: !p[m.id] }))
                          }
                          className="hover:opacity-80 underline text-[10px]"
                        >
                          {isHidden ? "Ko'rish" : "Yashirish"}
                        </button>
                      </div>
                    )}

                    {/* Text content or spoiler blur */}
                    {isHidden ? (
                      <div
                        onClick={() =>
                          setRevealedSpoilers((p) => ({ ...p, [m.id]: true }))
                        }
                        className="filter blur-sm select-none cursor-pointer py-1"
                        title="Ochish uchun bosing"
                      >
                        {m.body}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    )}

                    {/* Anime Card in Message */}
                    {m.animeCard && (
                      <div className="mt-2.5 p-2 rounded-xl bg-background/80 text-foreground border shadow-sm flex gap-2.5 items-center">
                        <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                          <SmartImage
                            src={m.animeCard.coverImage}
                            alt={m.animeCard.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs truncate">{m.animeCard.title}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 text-[10px] px-2 gap-1 rounded-lg"
                              onClick={() => navigate("detail", { animeId: m.animeCard.id })}
                            >
                              <Play className="w-3 h-3" /> Ko'rish
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 gap-1 rounded-lg"
                              onClick={() => navigate("detail", { animeId: m.animeCard.id })}
                            >
                              <ShoppingCart className="w-3 h-3" /> Xarid
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Poll in Message */}
                    {m.poll && (
                      <div className="mt-2 p-3 rounded-xl bg-background/80 text-foreground border space-y-2">
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-primary" />
                          {m.poll.question}
                        </p>
                        <div className="space-y-1.5 pt-1">
                          {m.poll.options.map((opt: string, idx: number) => {
                            const totalVotes = m.poll.votes.length || 0;
                            const optionVotes = m.poll.votes.filter(
                              (v: any) => v.optionIdx === idx
                            ).length;
                            const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                            return (
                              <button
                                key={idx}
                                className="w-full relative overflow-hidden rounded-lg border p-1.5 text-xs font-semibold text-left flex items-center justify-between hover:bg-accent transition"
                              >
                                <div
                                  className="absolute inset-0 bg-primary/15 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <span className="relative z-10 truncate pl-1">{opt}</span>
                                <span className="relative z-10 text-[10px] text-muted-foreground pr-1">
                                  {pct}% ({optionVotes})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Attachment Image */}
                    {m.attachmentUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden max-h-60 border">
                        <img
                          src={m.attachmentUrl}
                          alt="Attachment"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Edited indicator */}
                    {m.editedAt && (
                      <span className="block text-[9px] opacity-60 text-right mt-0.5">
                        (tahrirlangan)
                      </span>
                    )}
                  </div>

                  {/* Reactions Display */}
                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "")}>
                      {Object.entries(m.reactions).map(([emote, data]) => {
                        if (data.count <= 0) return null;
                        return (
                          <button
                            key={emote}
                            onClick={() => handleReaction(m.id, emote)}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition",
                              data.hasReacted
                                ? "bg-primary/15 border-primary text-primary font-bold"
                                : "bg-secondary/50 border-border hover:bg-secondary"
                            )}
                          >
                            <span>{emote}</span>
                            <span className="text-[10px]">{data.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions Dropdown / Quick React */}
                  <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition", isOwn ? "justify-end" : "")}>
                    <button
                      onClick={() => handleReaction(m.id, "🔥")}
                      className="p-1 hover:bg-secondary rounded-full text-xs"
                      title="Olov"
                    >
                      🔥
                    </button>
                    <button
                      onClick={() => handleReaction(m.id, "❤️")}
                      className="p-1 hover:bg-secondary rounded-full text-xs"
                      title="Yurak"
                    >
                      ❤️
                    </button>
                    <button
                      onClick={() => setReplyingTo(m)}
                      className="p-1 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground"
                      title="Javob berish"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-secondary rounded-full text-muted-foreground">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => handlePin(m.id)}>
                          <Pin className="w-3.5 h-3.5 mr-2" />
                          {m.isPinned ? "Qadashni bekor qilish" : "Qadash"}
                        </DropdownMenuItem>
                        {isOwn && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingMsg(m);
                              setInputText(m.body);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-2" /> Tahrirlash
                          </DropdownMenuItem>
                        )}
                        {(isOwn || user?.role === "ADMIN") && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(m.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> O'chirish
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-5 py-1 text-[11px] text-muted-foreground italic flex items-center gap-1.5 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Kimgadir javob yozilmoqda...
        </div>
      )}

      {/* Replying banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-t text-xs">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {replyingTo.user.displayName} ga javob:
            </span>
            <span className="text-muted-foreground truncate">{replyingTo.body}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing banner */}
      {editingMsg && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-t text-xs text-amber-600">
          <div className="flex items-center gap-2 truncate">
            <Edit2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">Xabarni tahrirlash</span>
          </div>
          <button
            onClick={() => {
              setEditingMsg(null);
              setInputText("");
            }}
            className="p-1 hover:opacity-70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Emote Picker Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full h-9 w-9">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-2">
              <div className="grid grid-cols-5 gap-2">
                {emotes.map((em) => (
                  <button
                    key={em.code}
                    type="button"
                    onClick={() => setInputText((t) => `${t} ${em.code} `)}
                    className="p-2 hover:bg-secondary rounded-lg text-lg text-center"
                    title={em.code}
                  >
                    {em.imageUrl}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Poll Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full h-9 w-9 hidden sm:flex"
            onClick={() => setShowPollDialog(true)}
            title="So'rovnoma yaratish"
          >
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* Text Input */}
          <Input
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              // Typing signal yuborish
              const client = getRealtimeClient(roomId);
              client.sendTyping();
            }}
            placeholder={
              cooldown > 0
                ? `Sekin rejim (${cooldown}s)...`
                : user
                ? "Fikringizni yozing..."
                : "Xabar yozish uchun kiring..."
            }
            disabled={sending}
            className="rounded-2xl h-10 bg-secondary/30 focus-visible:ring-1"
          />

          {/* Send Button */}
          <Button
            type="submit"
            disabled={sending || (!inputText.trim() && !editingMsg)}
            size="icon"
            className="shrink-0 rounded-2xl h-10 w-10 shadow-sm"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Poll Creation Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Yangi so'rovnoma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Savol</label>
              <Input
                placeholder="Keyingi qaysi animeni ko'ramiz?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Variantlar</label>
              {pollOptions.map((opt, i) => (
                <Input
                  key={i}
                  placeholder={`Variant ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  className="rounded-xl"
                />
              ))}
              {pollOptions.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs"
                  onClick={() => setPollOptions((p) => [...p, ""])}
                >
                  + Variant qo'shish
                </Button>
              )}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowPollDialog(false)}>
                Bekor qilish
              </Button>
              <Button onClick={handleCreatePoll} disabled={sending}>
                Yaratish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
