// src/components/anime/chat/chat-panel.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Hash,
  Search,
  Pin,
  X,
  Send,
  Smile,
  Plus,
  Reply,
  MoreVertical,
  Trash2,
  Edit2,
  ShieldAlert,
  Play,
  BarChart2,
  Loader2,
  ChevronDown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore, useOpenProfile } from "../store";
import { FramedAvatar, SmartImage } from "../ui-bits";
import { getRealtimeClient, RealtimeStatus, ChatMessagePayload } from "@/lib/realtime-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMember {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
}

interface ChatPanelProps {
  roomId: string; // "global", "club:xyz", "anime:abc"
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onClose?: () => void;
  onlineMembers?: ChatMember[];
  memberCount?: number;
  slowModeSeconds?: number;
}

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "👍", "😮", "😢", "🎉", "💯"];
const NAME_COLORS = [
  "text-rose-400",
  "text-sky-400",
  "text-emerald-400",
  "text-violet-400",
  "text-amber-400",
  "text-cyan-400",
  "text-fuchsia-400",
  "text-lime-400",
];
const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function nameColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function clockOf(value: string | Date) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayStart(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sameDay(a: string | Date, b: string | Date) {
  return dayStart(a) === dayStart(b);
}

function dayLabel(value: string | Date) {
  const date = new Date(value);
  const diff = Math.round((dayStart(new Date()) - dayStart(date)) / 86_400_000);
  if (diff === 0) return "BUGUN";
  if (diff === 1) return "KECHA";
  return `${date.getDate()} ${UZ_MONTHS[date.getMonth()]}${
    date.getFullYear() !== new Date().getFullYear() ? ` ${date.getFullYear()}` : ""
  }`;
}

export function ChatPanel({
  roomId,
  title,
  subtitle,
  compact = false,
  onClose,
  onlineMembers,
  memberCount,
  slowModeSeconds = 0,
}: ChatPanelProps) {
  const { user, setAuthOpen, navigate } = useAppStore();
  const openProfile = useOpenProfile();

  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessagePayload | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessagePayload | null>(null);
  const [slowMode, setSlowMode] = useState(slowModeSeconds);
  const [cooldown, setCooldown] = useState(0);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [emotes, setEmotes] = useState<Array<{ code: string; imageUrl: string; unlocked: boolean }>>([]);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinned, setShowPinned] = useState(true);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [newDividerId, setNewDividerId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const typingSentAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (smooth = true) => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    nearBottomRef.current = true;
    setUnreadCount(0);
    setNewDividerId(null);
  };

  // Xonaga ulanish va dastlabki xabarlarni yuklash
  useEffect(() => {
    let alive = true;

    // 1. Dastlabki xabarlarni GET qilish
    async function loadInitial() {
      try {
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`);
        if (res.ok && alive) {
          const data = await res.json();
          setMessages(data.messages || []);
          setSlowMode(data.slowMode ?? 0);

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
          const incoming = data.message as ChatMessagePayload;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (!nearBottomRef.current && incoming.user?.id !== user?.id) {
            setUnreadCount((count) => count + 1);
            setNewDividerId((current) => current ?? incoming.id);
          }
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
                ? { ...m, isDeleted: true, body: "Ushbu xabar o’chirildi" }
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
    if (!loading) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [loading, roomId]);

  useEffect(() => {
    if (!loading && nearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  // Cooldown taymeri
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleListScroll = () => {
    const node = listRef.current;
    if (!node) return;
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    nearBottomRef.current = near;
    if (near) {
      setUnreadCount(0);
      setNewDividerId(null);
    }
  };

  const jumpToMessage = (id: string) => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const emoteImages = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emote of emotes) map[emote.code] = emote.imageUrl;
    return map;
  }, [emotes]);

  const renderEmote = (code: string) => {
    const src = emoteImages[code];
    if (src) {
      return (
        <img
          src={src}
          alt={code}
          className="inline h-4 w-4 align-[-2px] object-contain"
          loading="lazy"
        />
      );
    }
    return <span>{code}</span>;
  };

  const onlineList = useMemo(() => onlineMembers ?? [], [onlineMembers]);
  const presenceIds = useMemo(() => {
    const set = new Set(onlineUserIds);
    for (const member of onlineList) set.add(member.id);
    return set;
  }, [onlineUserIds, onlineList]);
  const onlineTotal = Math.max(onlineUserIds.size, onlineList.length);
  const shownOnline = onlineList.slice(0, 3);
  const extraOnline = Math.max(0, onlineTotal - shownOnline.length);

  const typingDisplay = useMemo(() => {
    const names = typingUsers
      .filter((id) => id !== user?.id)
      .map(
        (id) =>
          onlineList.find((member) => member.id === id)?.displayName ||
          messages.find((message) => message.user.id === id)?.user.displayName
      )
      .filter(Boolean) as string[];
    return [...new Set(names)];
  }, [typingUsers, user?.id, onlineList, messages]);

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const latestPinned = pinnedMessages[pinnedMessages.length - 1];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = normalizedQuery
    ? messages.filter((message) => {
        const haystack = `${message.body} ${message.user.displayName} ${message.user.username}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : messages;

  const effectiveSlowMode = Math.max(5, slowMode || 0);
  const cooldownBlocked = cooldown > 0;

  const handleSendMessage = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    const text = inputText.trim();
    if (!text && !editingMsg && !attachmentUrl) return;

    if (cooldownBlocked) {
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
            ...(attachmentUrl ? { attachmentUrl } : {}),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429 && Number(data.retryAfter) > 0) {
            setCooldown(Math.max(5, Number(data.retryAfter)));
          }
          throw new Error(data.error || "Xabar yuborilmadi");
        }

        setInputText("");
        setReplyingTo(null);
        setAttachmentUrl(null);

        // Agar xabar WebSocket orqali kelishdan oldin ko'rinishi kerak bo'lsa
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }

        setCooldown(effectiveSlowMode);
        scrollToBottom(true);
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
    if (!confirm("Haqiqatan ham bu xabarni o’chirmoqchimisiz?")) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${messageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Xabar o’chirildi");
    } catch (e: any) {
      toast.error(e.message || "O’chirishda xatolik");
    }
  };

  const handleCreatePoll = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
      toast.error("Savol va kamida 2 ta variant kiriting");
      return;
    }
    if (cooldownBlocked) {
      toast.warning(`Sekin rejim. ${cooldown} soniya kuting.`);
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
      if (!res.ok) {
        if (res.status === 429 && Number(data.retryAfter) > 0) {
          setCooldown(Math.max(5, Number(data.retryAfter)));
        }
        throw new Error(data.error);
      }
      setShowPollDialog(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setCooldown(effectiveSlowMode);
      scrollToBottom(true);
      toast.success("So’rovnoma yaratildi");
    } catch (e: any) {
      toast.error(e.message || "So’rovnoma yaratilmadi");
    } finally {
      setSending(false);
    }
  };

  const handlePickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm fayllarini yuklash mumkin");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Fayl hajmi 8MB dan oshmasligi kerak");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "post");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fayl yuklanmadi");
      setAttachmentUrl(String(data.url));
      toast.success("Rasm biriktirildi");
    } catch (e: any) {
      toast.error(e.message || "Fayl yuklanmadi");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
    const now = Date.now();
    if (now - typingSentAtRef.current > 2000) {
      typingSentAtRef.current = now;
      getRealtimeClient(roomId).sendTyping();
    }
  };

  const statusDot =
    realtimeStatus === "connected"
      ? "bg-emerald-500 live-dot"
      : realtimeStatus === "polling"
      ? "bg-amber-500"
      : realtimeStatus === "connecting"
      ? "bg-muted-foreground animate-pulse"
      : "bg-destructive";
  const statusLabel =
    realtimeStatus === "connected"
      ? "Real vaqt"
      : realtimeStatus === "polling"
      ? "Polling"
      : realtimeStatus === "connecting"
      ? "Ulanmoqda…"
      : "Uzilgan";

  const iconButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/40 text-muted-foreground transition hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[26px] border bg-card shadow-sm",
        compact ? "h-[480px] sm:h-[500px]" : "h-[560px] sm:h-[680px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Hash className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="club-display truncate text-[15px] leading-tight">
              {title || (roomId === "global" ? "global-zal" : roomId)}
            </h3>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary/90">
                <Clock className="h-3 w-3" /> Sekin rejim · {effectiveSlowMode} soniya
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} aria-hidden />
                {statusLabel}
              </span>
              {subtitle && (
                <>
                  <span aria-hidden className="shrink-0">·</span>
                  <span className="truncate">{subtitle}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {shownOnline.length > 0 ? (
            <div className="hidden items-center sm:flex" aria-label={`${onlineTotal} ta a’zo online`}>
              <div className="flex -space-x-2">
                {shownOnline.map((member) => (
                  <span key={member.id} className="rounded-full border-2 border-card">
                    <FramedAvatar user={member as never} size={26} />
                  </span>
                ))}
              </div>
              {extraOnline > 0 && (
                <span className="ml-1.5 rounded-full border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
                  +{extraOnline}
                </span>
              )}
            </div>
          ) : onlineTotal > 0 ? (
            <span className="hidden items-center gap-1 text-[11px] font-bold text-emerald-500 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" aria-hidden />
              {onlineTotal} online
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label="Xabarlarni qidirish"
            aria-pressed={searchOpen}
            className={iconButtonClass}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPinned(true);
              setPinnedCollapsed((value) => !value);
            }}
            aria-label="Qadalgan xabarlar"
            aria-pressed={showPinned && !pinnedCollapsed}
            className={cn(iconButtonClass, "relative")}
          >
            <Pin className="h-4 w-4" />
            {pinnedMessages.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
                {pinnedMessages.length}
              </span>
            )}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Chatni yopish" className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b bg-secondary/20 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Xabarlar ichidan qidirish…"
            className="h-8 rounded-full border-primary/20 bg-background/60 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Qidiruvni tozalash"
              className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Pinned panel */}
      {showPinned && !pinnedCollapsed && latestPinned && (
        <div className="border-b border-primary/15 bg-primary/5 px-3 py-2 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">PIN</span>
            <button
              type="button"
              onClick={() => setPinnedCollapsed(true)}
              aria-label="Qadalgan xabarlarni yashirish"
              className="rounded-full p-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => jumpToMessage(latestPinned.id)}
            className="mt-0.5 flex w-full items-center gap-2 truncate text-left text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            <Pin className="h-3 w-3 shrink-0 rotate-45 text-primary" aria-hidden />
            <span className="shrink-0 font-bold text-foreground/80">{latestPinned.user.displayName}</span>
            <span className="truncate">{latestPinned.body}</span>
          </button>
        </div>
      )}

      {/* Messages feed */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleListScroll}
          className="h-full overflow-y-auto overscroll-contain px-2 py-3 fancy-scroll sm:px-4"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Hash className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {normalizedQuery ? "Hech narsa topilmadi" : "Bu kanal hali jim"}
              </p>
              <p className="mt-1 max-w-[260px] text-xs">
                {normalizedQuery
                  ? "Boshqa so’z bilan qidirib ko’ring."
                  : "Birinchi bo’lib jamoaga xabar yozing va suhbatni boshlang."}
              </p>
            </div>
          ) : (
            visibleMessages.map((message, index) => {
              const previous = index > 0 ? visibleMessages[index - 1] : null;
              const daySeparator = !previous || !sameDay(previous.createdAt, message.createdAt);
              const grouped = Boolean(
                previous &&
                  !daySeparator &&
                  previous.user.id === message.user.id &&
                  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000
              );
              const isOwn = user?.id === message.user.id;
              const isAdmin = message.user.role?.toLowerCase() === "admin";
              const hasSpoiler = Boolean(message.spoiler);
              const isSpoilerRevealed = revealedSpoilers[message.id];
              const isHidden = hasSpoiler && message.spoiler?.hidden && !isSpoilerRevealed;
              const reactions = Object.entries(message.reactions || {}).filter(([, data]) => data.count > 0);

              return (
                <div key={message.id}>
                  {daySeparator && (
                    <div className="my-3 flex items-center gap-3 px-2" role="separator">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">
                        {dayLabel(message.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {!normalizedQuery && newDividerId === message.id && (
                    <div className="my-2 flex items-center gap-2 px-2" role="separator">
                      <span className="h-px flex-1 bg-primary/40" />
                      <span className="text-[9.5px] font-black uppercase tracking-[0.22em] text-primary">
                        Yangi xabarlar
                      </span>
                      <span className="h-px flex-1 bg-primary/40" />
                    </div>
                  )}

                  <div
                    data-message-id={message.id}
                    className={cn(
                      "group relative flex gap-2 rounded-xl px-2 py-0.5 transition-colors",
                      isOwn ? "bg-primary/[0.055]" : "hover:bg-secondary/30",
                      grouped ? "mt-0" : "mt-2"
                    )}
                  >
                    {/* Avatar / time gutter */}
                    <div className="w-10 shrink-0 pt-0.5">
                      {!grouped ? (
                        <button
                          type="button"
                          onClick={() => openProfile(message.user.username)}
                          aria-label={`${message.user.displayName} profili`}
                          className="relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <FramedAvatar user={message.user as never} size={40} />
                          {presenceIds.has(message.user.id) && (
                            <span
                              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500 live-dot"
                              aria-label="Online"
                            />
                          )}
                        </button>
                      ) : (
                        <span className="hidden pt-1.5 text-right text-[10px] tabular-nums text-muted-foreground/60 opacity-0 transition group-hover:opacity-100 sm:block">
                          {clockOf(message.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1 pb-0.5">
                      {!grouped && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <button
                            type="button"
                            onClick={() => openProfile(message.user.username)}
                            className={cn(
                              "max-w-[180px] truncate text-[13px] font-bold hover:underline",
                              nameColor(message.user.id)
                            )}
                          >
                            {message.user.displayName}
                          </button>
                          {isAdmin && (
                            <span className="rounded border border-primary/40 bg-primary/10 px-1 py-px text-[9px] font-black tracking-wider text-primary">
                              ADMIN
                            </span>
                          )}
                          {message.user.clubTag && (
                            <span className="text-[10px] font-black text-primary/70">[{message.user.clubTag}]</span>
                          )}
                          <span className="text-[11px] tabular-nums text-muted-foreground/80">
                            {clockOf(message.createdAt)}
                          </span>
                        </div>
                      )}

                      {message.replyTo && (
                        <div className="mt-1 flex max-w-full items-center gap-1.5 border-l-2 border-primary/40 pl-2 text-[11px] text-muted-foreground">
                          <Reply className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="shrink-0 font-bold text-foreground/80">
                            @{message.replyTo.username}
                          </span>
                          <span className="truncate">{message.replyTo.body}</span>
                        </div>
                      )}

                      <div className="mt-0.5">
                        {hasSpoiler && (
                          <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-semibold">
                            <span className="flex items-center gap-1 text-primary">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Epizod {message.spoiler?.episodeNo} spoiler
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedSpoilers((prev) => ({ ...prev, [message.id]: !prev[message.id] }))
                              }
                              className="text-[10px] font-bold underline underline-offset-2 hover:opacity-80"
                            >
                              {isHidden ? "Ko’rish" : "Yashirish"}
                            </button>
                          </div>
                        )}

                        {isHidden ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setRevealedSpoilers((prev) => ({ ...prev, [message.id]: true }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setRevealedSpoilers((prev) => ({ ...prev, [message.id]: true }));
                              }
                            }}
                            className="cursor-pointer select-none py-0.5 blur-sm"
                            title="Ochish uchun bosing"
                          >
                            {message.body}
                          </div>
                        ) : (
                          <p
                            className={cn(
                              "whitespace-pre-wrap break-words text-[14.5px] leading-[1.55]",
                              message.isDeleted && "text-xs italic text-muted-foreground"
                            )}
                          >
                            {message.body}
                            {message.editedAt && (
                              <span className="ml-1 align-baseline text-[9.5px] text-muted-foreground">
                                (tahrirlangan)
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Anime / episode card */}
                      {message.animeCard && (
                        <div className="mt-2 flex max-w-md items-center gap-3 rounded-xl border bg-secondary/20 p-2">
                          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                            <SmartImage
                              src={message.animeCard.coverImage}
                              alt={message.animeCard.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
                              <Play className="h-2.5 w-2.5" />
                              {message.spoiler?.episodeNo
                                ? `Yangi epizod · ${message.spoiler.episodeNo}`
                                : "Anime"}
                            </span>
                            <p className="truncate text-sm font-bold">{message.animeCard.title}</p>
                            <Button
                              size="sm"
                              className="mt-1.5 h-7 gap-1 rounded-full px-3 text-[11px] font-bold"
                              onClick={() => navigate("detail", { animeId: message.animeCard.id })}
                            >
                              <Play className="h-3 w-3" /> Ko’rish
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Poll */}
                      {message.poll && (
                        <div className="mt-2 max-w-md space-y-2 rounded-xl border bg-secondary/20 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-bold">
                            <BarChart2 className="h-3.5 w-3.5 text-primary" />
                            {message.poll.question}
                          </p>
                          <div className="space-y-1.5 pt-0.5">
                            {message.poll.options.map((option: string, optionIndex: number) => {
                              const totalVotes = message.poll.votes.length || 0;
                              const optionVotes = message.poll.votes.filter(
                                (vote: any) => vote.optionIdx === optionIndex
                              ).length;
                              const percent = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                              return (
                                <div
                                  key={optionIndex}
                                  className="relative w-full overflow-hidden rounded-lg border border-border/70 p-1.5 text-xs font-semibold"
                                >
                                  <div
                                    className="absolute inset-0 bg-primary/15 transition-all"
                                    style={{ width: `${percent}%` }}
                                  />
                                  <div className="relative z-10 flex items-center justify-between gap-2">
                                    <span className="truncate pl-1">{option}</span>
                                    <span className="shrink-0 pr-1 text-[10px] tabular-nums text-muted-foreground">
                                      {percent}% ({optionVotes})
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Attachment */}
                      {message.attachmentUrl && (
                        <div className="mt-2 max-w-sm overflow-hidden rounded-xl border">
                          <img
                            src={message.attachmentUrl}
                            alt="Biriktirilgan rasm"
                            className="max-h-72 w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Reactions */}
                      {reactions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {reactions.map(([emote, data]) => (
                            <button
                              key={emote}
                              type="button"
                              onClick={() => handleReaction(message.id, emote)}
                              aria-pressed={data.hasReacted}
                              className={cn(
                                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold transition",
                                data.hasReacted
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {renderEmote(emote)}
                              <span className="text-[10px] tabular-nums">{data.count}</span>
                            </button>
                          ))}
                          <Popover
                            open={reactionPickerFor === message.id}
                            onOpenChange={(open) => setReactionPickerFor(open ? message.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                aria-label="Reaksiya qo’shish"
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-secondary/40 text-muted-foreground transition hover:text-foreground"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="w-auto p-1.5">
                              <div className="flex items-center gap-0.5">
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      handleReaction(message.id, emoji);
                                      setReactionPickerFor(null);
                                    }}
                                    className="rounded-md p-1 text-base transition hover:bg-secondary"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div
                      className={cn(
                        "absolute -top-2 right-1 z-10 flex items-center gap-0.5 rounded-lg border bg-card p-0.5 opacity-100 shadow-sm transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
                        grouped && "top-0"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleReaction(message.id, "🔥")}
                        className="rounded-md p-1 text-[13px] transition hover:bg-secondary"
                        aria-label="Olov reaksiyasi"
                      >
                        🔥
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReaction(message.id, "❤️")}
                        className="rounded-md p-1 text-[13px] transition hover:bg-secondary"
                        aria-label="Yurak reaksiyasi"
                      >
                        ❤️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(message);
                          setEditingMsg(null);
                        }}
                        className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        aria-label="Javob berish"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      <Popover
                        open={reactionPickerFor === `more-${message.id}`}
                        onOpenChange={(open) =>
                          setReactionPickerFor(open ? `more-${message.id}` : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Boshqa reaksiyalar"
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="w-auto p-1.5">
                          <div className="flex items-center gap-0.5">
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  handleReaction(message.id, emoji);
                                  setReactionPickerFor(null);
                                }}
                                className="rounded-md p-1 text-base transition hover:bg-secondary"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            aria-label="Xabar amallari"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem onClick={() => handlePin(message.id)}>
                            <Pin className="mr-2 h-3.5 w-3.5" />
                            {message.isPinned ? "Qadashni bekor qilish" : "Qadash"}
                          </DropdownMenuItem>
                          {isOwn && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingMsg(message);
                                setInputText(message.body);
                              }}
                            >
                              <Edit2 className="mr-2 h-3.5 w-3.5" /> Tahrirlash
                            </DropdownMenuItem>
                          )}
                          {(isOwn || user?.role === "ADMIN") && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(message.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> O’chirish
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
          <div className="h-1" />
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-amber-500 px-3 py-1.5 text-[11px] font-black text-primary-foreground shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Yangi xabarlar{unreadCount > 1 ? ` (${unreadCount})` : ""}
          </button>
        )}
      </div>

      {/* Typing */}
      {typingDisplay.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {typingDisplay.length > 2
              ? "Bir nechta kishi"
              : typingDisplay.join(", ")}
          </span>
          <span>yozmoqda</span>
          <span className="inline-flex items-center gap-0.5" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1 w-1 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      )}

      {/* Reply / edit banners */}
      {replyingTo && (
        <div className="flex items-center justify-between border-t bg-secondary/30 px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="shrink-0 font-semibold">
              {replyingTo.user.displayName} ga javob:
            </span>
            <span className="truncate text-muted-foreground">{replyingTo.body}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Javobni bekor qilish"
            className="rounded-full p-1 transition hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {editingMsg && (
        <div className="flex items-center justify-between border-t bg-amber-500/10 px-4 py-2 text-xs text-amber-600">
          <div className="flex items-center gap-2 truncate">
            <Edit2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">Xabarni tahrirlash</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMsg(null);
              setInputText("");
            }}
            aria-label="Tahrirlashni bekor qilish"
            className="rounded-full p-1 transition hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5 sm:px-4">
        {attachmentUrl && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-1.5">
            <img src={attachmentUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              Rasm biriktirildi
            </span>
            <button
              type="button"
              onClick={() => setAttachmentUrl(null)}
              aria-label="Biriktirilgan rasmni olib tashlash"
              className="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex min-w-0 flex-1 items-end gap-0.5 rounded-[24px] border border-primary/25 bg-background/60 py-1 pl-1 pr-1 focus-within:border-primary/50">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Rasm biriktirish"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4.5 w-4.5" />}
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Emoji tanlash"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-64 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText((value) => `${value}${emoji}`)}
                      className="rounded-md p-1 text-lg transition hover:bg-secondary"
                    >
                      {emoji}
                    </button>
                  ))}
                  {emotes.map((emote) => (
                    <button
                      key={emote.code}
                      type="button"
                      title={emote.code}
                      onClick={() =>
                        setInputText((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}${emote.code} `)
                      }
                      className="flex items-center justify-center rounded-md p-1 transition hover:bg-secondary"
                    >
                      <img src={emote.imageUrl} alt={emote.code} className="h-6 w-6 object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => gifInputRef.current?.click()}
              disabled={uploading}
              aria-label="GIF yuklash"
              className="flex h-9 shrink-0 items-center justify-center rounded-full px-1.5 text-[9px] font-black tracking-wide text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              GIF
            </button>

            <textarea
              rows={1}
              value={inputText}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                cooldownBlocked
                  ? `Sekin rejim · ${cooldown}s`
                  : user
                  ? "Xabar yozing…"
                  : "Xabar yozish uchun kiring…"
              }
              aria-label="Xabar matni"
              className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-[14px] leading-[1.4] outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          <button
            type="submit"
            disabled={sending || uploading || cooldownBlocked || (!inputText.trim() && !attachmentUrl && !editingMsg)}
            aria-label="Yuborish"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-50"
          >
            {sending || uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : cooldownBlocked ? (
              <span className="text-xs font-black tabular-nums">{cooldown}</span>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70">
          {cooldownBlocked
            ? `Keyingi xabar uchun ${cooldown} soniya`
            : "Enter — yuborish · Shift+Enter — yangi qator"}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickFile}
        />
        <input
          ref={gifInputRef}
          type="file"
          accept="image/gif"
          className="hidden"
          onChange={handlePickFile}
        />
      </div>

      {/* Poll creation dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Yangi so’rovnoma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Savol</label>
              <Input
                placeholder="Keyingi qaysi animeni ko’ramiz?"
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Variantlar</label>
              {pollOptions.map((option, index) => (
                <Input
                  key={index}
                  placeholder={`Variant ${index + 1}`}
                  value={option}
                  onChange={(event) => {
                    const next = [...pollOptions];
                    next[index] = event.target.value;
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
                  onClick={() => setPollOptions((options) => [...options, ""])}
                >
                  + Variant qo’shish
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
