"use client";

import { useEffect, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Send, Flame, Trophy, UserCheck, Shield, MessageSquare, Newspaper, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore, useOpenProfile } from "../store";
import type { CommunityPost, CommentItem, AnimeSummary, PostType, CommunityStats } from "../types";
import { avatarNameGap, FramedAvatar, NameWithFrame, timeAgo, SmartImage } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/api-response";
import { PostComposer, PostCard, RightSidebar } from "./community-ui";
import { useI18n } from "@/components/i18n-provider";
import { ChatPanel } from "../chat/chat-panel";
import { ClubsView } from "../clubs/clubs-view";
import { ReferralView } from "./referral-view";

const CATEGORIES: ("All" | PostType)[] = ["All", "Theories", "Reviews", "Discussions", "Memes", "Fan Art", "Recommendations", "UZ Dubbing", "Watch Parties"];

type CommunityReport = {
  id: string;
  targetType: "POST" | "COMMENT" | "USER";
  targetId: string;
  reason: string;
  reporter: { username: string; displayName: string | null };
  target: { content: string; owner: string } | null;
};

export function CommunityView() {
  const { user, setAuthOpen } = useAppStore();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const openProfile = useOpenProfile();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [communityMode, setCommunityMode] = useState<"feed" | "chat" | "clubs" | "referral">("feed");
  const [tab, setTab] = useState("latest");
  const [activeCategory, setActiveCategory] = useState("All");
  const feedKey = `${user?.id ?? "anonymous"}:${tab}:${activeCategory}`;
  const [loadedFeed, setLoadedFeed] = useState("");
  const loading = loadedFeed !== feedKey;
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [animes, setAnimes] = useState<AnimeSummary[]>([]);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, string | null>>({});
  const scrolledShareId = useRef("");
  const [moderationReports, setModerationReports] = useState<CommunityReport[] | null>(null);
  const [moderationUserId, setModerationUserId] = useState<string | null>(null);
  const openPostIds = Object.keys(openComments).filter((postId) => openComments[postId]);
  const commentsKey = (postId: string) => ["community", "comments", user?.id ?? "anonymous", postId] as const;
  const commentQueries = useQueries({
    queries: openPostIds.map((postId) => ({
      queryKey: commentsKey(postId),
      queryFn: async (): Promise<CommentItem[]> => {
        const key = commentsKey(postId);
        const cached = queryClient.getQueryData<CommentItem[]>(key) ?? [];
        const cursor = cached[cached.length - 1]?.id;
        const url = `/api/community/${encodeURIComponent(postId)}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load comments");
        const fresh = (data.comments || []) as CommentItem[];
        if (!cursor) return fresh;
        const known = new Set(cached.map((comment) => comment.id));
        return [...cached, ...fresh.filter((comment) => !known.has(comment.id))];
      },
      staleTime: 1_500,
      gcTime: 10 * 60_000,
      refetchInterval: 2_000,
      refetchIntervalInBackground: false,
    })),
  });
  const commentsByPostId = Object.fromEntries(
    openPostIds.map((postId, index) => [postId, commentQueries[index]?.data ?? []])
  ) as Record<string, CommentItem[]>;
  const commentsErrorsByPostId = Object.fromEntries(
    openPostIds.map((postId, index) => [postId, commentQueries[index]?.isError ?? false])
  ) as Record<string, boolean>;

  useEffect(() => {
    let alive = true;
    const query = new URLSearchParams({ tab, ...(activeCategory !== "All" ? { category: activeCategory } : {}) });
    let feedErrorShown = false;
    const load = async (initial: boolean) => {
      try {
        const response = await fetch(`/api/community?${query.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load community");
        if (!alive) return;
        const incoming = (data.posts || []) as CommunityPost[];
        setPosts((previous) => {
          if (initial) return incoming;
          const fresh = new Map(incoming.map((post) => [post.id, post]));
          return [...incoming, ...previous.filter((post) => !fresh.has(post.id))];
        });
          if (initial) setCursor(data.nextCursor || null);
      } catch (error) {
        if (alive && !feedErrorShown) {
          feedErrorShown = true;
          toast.error(error instanceof Error ? error.message : "Failed to load community");
        }
      } finally {
        if (alive && initial) setLoadedFeed(feedKey);
      }
    };
    void load(true);
    const refreshVisibleFeed = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const timer = window.setInterval(refreshVisibleFeed, 3_000);
    document.addEventListener("visibilitychange", refreshVisibleFeed);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleFeed);
    };
  }, [tab, activeCategory, user?.id]);

  useEffect(() => {
    fetch("/api/animes")
      .then((r) => r.json())
      .then((d) => setAnimes(d.animes || []))
      .catch(() => toast.error("Could not load anime list"));
  }, []);

  useEffect(() => {
    if (loading) return;
    const postId = window.location.hash.startsWith("#post-")
      ? window.location.hash.slice("#post-".length)
      : "";
    if (!postId || scrolledShareId.current === postId) return;
    scrolledShareId.current = postId;
    const scrollToPost = () => document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (posts.some((post) => post.id === postId)) {
      scrollToPost();
      return;
    }
    fetch(`/api/community/${encodeURIComponent(postId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Shared post not found");
        setPosts((previous) => previous.some((post) => post.id === postId) ? previous : [data.post, ...previous]);
        window.setTimeout(scrollToPost, 0);
      })
      .catch((error) => {
        scrolledShareId.current = "";
        toast.error(error instanceof Error ? error.message : "Shared post not found");
      });
  }, [loading, posts]);

  useEffect(() => {
    let alive = true;
    let statsErrorShown = false;
    const load = () => fetch("/api/community/stats", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load statistics");
        if (alive) {
          statsErrorShown = false;
          setStats(data);
        }
      })
      .catch(() => {
        if (alive) {
          setStats(null);
          if (!statsErrorShown) {
            statsErrorShown = true;
            toast.error("Could not load community statistics");
          }
        }
      });
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "ADMIN") return;
    let alive = true;
    const loadModerationQueue = async () => {
      try {
        const response = await fetch("/api/admin/community", { cache: "no-store" });
        if (response.status === 403) {
          if (alive) {
            setModerationReports(null);
            setModerationUserId(user.id);
          }
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load moderation queue");
        if (alive) {
          setModerationReports(data.reports || []);
          setModerationUserId(user.id);
        }
      } catch (error) {
        if (alive) toast.error(error instanceof Error ? error.message : "Could not load moderation queue");
      }
    };
    void loadModerationQueue();
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let presenceErrorShown = false;
    const ping = async () => {
      try {
        const response = await fetch("/api/presence", { method: "POST" });
        if (!response.ok) throw new Error("Presence update failed");
        presenceErrorShown = false;
      } catch {
        if (!presenceErrorShown) {
          presenceErrorShown = true;
          toast.error("Could not update online presence");
        }
      }
    };
    ping();
    const timer = window.setInterval(ping, 60_000);
    return () => window.clearInterval(timer);
  }, [user]);

  async function handleCreatePost(data: {
    content: string;
    category: PostType;
    spoiler: boolean;
    rating: number | null;
    animeId: string | null;
    imageUrl: string | null;
  }): Promise<boolean> {
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await readApiJson(res);
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : `Failed to create post (HTTP ${res.status})`);
        return false;
      }
      if (!d.post || typeof d.post !== "object" || Array.isArray(d.post)) {
        throw new Error("Post was created, but the server response did not include the post.");
      }
      if (tab === "latest" && (activeCategory === "All" || activeCategory === data.category)) {
        setPosts((prev) => [d.post as CommunityPost, ...prev]);
      }
      toast.success("Posted to the community");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
      return false;
    }
  }

  async function toggleLike(postId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/community/${postId}/like`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not update like");
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, liked: d.liked, likeCount: d.likeCount } : p))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update like");
    }
  }

  async function loadComments(postId: string) {
    try {
      setOpenComments((prev) => ({ ...prev, [postId]: true }));
      await queryClient.fetchQuery({
        queryKey: commentsKey(postId),
        queryFn: async () => {
          const response = await fetch(`/api/community/${encodeURIComponent(postId)}/comments`, { cache: "no-store" });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not load comments");
          return (data.comments || []) as CommentItem[];
        },
        staleTime: 1_500,
      });
    } catch (error) {
      setOpenComments((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Could not load comments");
    }
  }

  async function sendComment(postId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const text = (commentInputs[postId] || "").trim();
    if (!text) return;
    try {
      const res = await fetch(`/api/community/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, parentId: replyTargets[postId] || null }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      queryClient.setQueryData<CommentItem[]>(
        commentsKey(postId),
        (prev = []) => [...prev, d.comment],
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setReplyTargets((prev) => ({ ...prev, [postId]: null }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p))
      );
    } catch {
      toast.error("Failed to comment");
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ tab, cursor, ...(activeCategory !== "All" ? { category: activeCategory } : {}) });
      const response = await fetch(`/api/community?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load more posts");
      setPosts((previous) => [...previous, ...(data.posts || []).filter((p: CommunityPost) => !previous.some((old) => old.id === p.id))]);
      setCursor(data.nextCursor || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load more posts");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleBookmark(postId: string) {
    if (!user) return setAuthOpen(true);
    try {
      const response = await fetch(`/api/community/${postId}/bookmark`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update bookmark");
      setPosts((previous) => previous.map((post) => post.id === postId ? { ...post, bookmarked: data.bookmarked } : post));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update bookmark");
    }
  }

  async function toggleFollow(post: CommunityPost) {
    if (!user) return setAuthOpen(true);
    try {
      const response = await fetch(`/api/community/users/${post.user.id}/follow`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update follow");
      setPosts((previous) => previous.map((item) => item.user.id === post.user.id
        ? { ...item, user: { ...item.user, following: data.following } }
        : item));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update follow");
    }
  }

  async function awardPost(post: CommunityPost) {
    if (!user) return setAuthOpen(true);
    if (!window.confirm("Give this post an award for 10 credits?")) return;
    try {
      const response = await fetch(`/api/community/${post.id}/award`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not award post");
      setPosts((previous) => previous.map((item) => item.id === post.id ? { ...item, awardCount: item.awardCount + 1 } : item));
      toast.success("Award sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not award post");
    }
  }

  async function reportPost(post: CommunityPost) {
    if (!user) return setAuthOpen(true);
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason?.trim()) return;
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "POST", targetId: post.id, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit report");
      toast.success("Report sent to moderators");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit report");
    }
  }

  async function editPost(post: CommunityPost) {
    const content = window.prompt("Edit your post", post.content);
    if (!content?.trim() || content.trim() === post.content) return;
    try {
      const response = await fetch(`/api/community/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not edit post");
      setPosts((previous) => previous.map((item) => item.id === post.id ? { ...item, content: data.post.content, updatedAt: data.post.updatedAt } : item));
      toast.success("Post updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not edit post");
    }
  }

  async function deletePost(postId: string) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    const response = await fetch(`/api/community/${postId}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not delete post");
    setPosts((previous) => previous.filter((post) => post.id !== postId));
    toast.success("Post deleted");
  }

  const visibleModerationReports =
    user?.role === "ADMIN" && moderationUserId === user.id ? moderationReports : null;

  async function moderateReport(report: CommunityReport, action: "hide" | "delete" | "block" | "dismiss") {
    try {
      const response = await fetch("/api/admin/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Moderation action failed");
      setModerationReports((previous) => previous?.filter((item) => item.id !== report.id) ?? null);
      toast.success("Moderation action completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Moderation action failed");
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">{t("community.title")}</h1>

      {/* Top Mode Navigation & Online Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-2xl border">
          <button
            onClick={() => setCommunityMode("feed")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              communityMode === "feed"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Newspaper className="w-4 h-4" /> Lenta
          </button>
          <button
            onClick={() => setCommunityMode("chat")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              communityMode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="w-4 h-4" /> Global Chat
          </button>
          <button
            onClick={() => setCommunityMode("clubs")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              communityMode === "clubs"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shield className="w-4 h-4" /> Klublar
          </button>
          <button
            onClick={() => setCommunityMode("referral")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              communityMode === "referral"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Gift className="w-4 h-4 text-emerald-500" /> Do&apos;stlar (Referral)
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold bg-secondary/50 p-2.5 rounded-2xl border">
          {stats && <div className="flex flex-col"><span className="text-muted-foreground">{t("community.online")}</span><span>{stats.online}</span></div>}
          {stats && <div className="w-px h-6 bg-border" />}
          <div className="flex flex-col"><span className="text-muted-foreground">{t("community.postsToday")}</span><span>{stats?.postsToday ?? "—"}</span></div>
        </div>
      </div>

      {communityMode === "chat" ? (
        <div className="max-w-4xl mx-auto">
          <ChatPanel
            roomId="global"
            title="Global zal (Umumiy chat)"
            subtitle="Barcha anime muxlislari uchun real-time muloqot zali"
          />
        </div>
      ) : communityMode === "clubs" ? (
        <ClubsView />
      ) : communityMode === "referral" ? (
        <div className="max-w-4xl mx-auto">
          <ReferralView />
        </div>
      ) : (
        <>
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto fancy-scroll pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300",
                  activeCategory === cat
                    ? "bg-foreground text-background shadow-md transform scale-105"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {t(`community.category.${cat.toLowerCase().replaceAll(" ", "")}`)}
              </button>
            ))}
          </div>

          <div className="lg:flex lg:gap-6 relative">

        {/* Main Feed Column */}
        <div className="flex-1 min-w-0">
          <PostComposer user={user} animes={animes} onPost={handleCreatePost} />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="mb-5">
            <TabsList className="rounded-xl h-12 p-1 bg-secondary/40">
              <TabsTrigger value="latest" className="rounded-lg gap-2 text-sm font-bold px-5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <Flame className="w-4 h-4" /> {t("community.latest")}
              </TabsTrigger>
              <TabsTrigger value="top" className="rounded-lg gap-2 text-sm font-bold px-5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <Trophy className="w-4 h-4" /> {t("community.top")}
              </TabsTrigger>
              <TabsTrigger value="following" className="rounded-lg gap-2 text-sm font-bold px-5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <UserCheck className="w-4 h-4" /> {t("community.following")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glass rounded-2xl p-5">
                  <div className="flex gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full skeleton" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-40 rounded skeleton" />
                      <div className="h-3 w-24 rounded skeleton" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded skeleton" />
                    <div className="h-3 w-full rounded skeleton" />
                    <div className="h-3 w-2/3 rounded skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-secondary/10 p-16 text-center animate-in fade-in zoom-in duration-500">
              <p className="text-6xl mb-4 animate-bounce">💬</p>
              <p className="text-xl font-bold">{t("community.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("community.emptyHint")}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => (
                <div key={post.id} className="group/post">
                  <PostCard
                    post={post}
                    onLike={() => toggleLike(post.id)}
                    onFollow={() => toggleFollow(post)}
                    onBookmark={() => toggleBookmark(post.id)}
                    onAward={() => awardPost(post)}
                    onReport={() => reportPost(post)}
                    onEdit={() => editPost(post)}
                    onDelete={() => deletePost(post.id)}
                    isOwn={post.user.id === user?.id}
                    onCommentClick={() => {
                      if (openComments[post.id]) {
                        setOpenComments((prev) => {
                          const next = { ...prev };
                          delete next[post.id];
                          return next;
                        });
                      } else {
                        loadComments(post.id);
                      }
                    }}
                  />

                  {/* Inline Comments */}
                  {openComments[post.id] && (
                    <div className="mt-2 ml-4 sm:ml-12 pl-4 border-l-2 border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      {commentsErrorsByPostId[post.id] && (
                        <p className="text-sm text-destructive">{t("community.commentsRetry")}</p>
                      )}
                      {(commentsByPostId[post.id] || []).map((c) => (
                        <div key={c.id} className={cn("flex gap-3 group/comment", c.parentId && "ml-8")}>
                          <FramedAvatar user={c.user} size={32} className="shrink-0" />
                          <div className="flex-1 min-w-0" style={{ marginLeft: avatarNameGap(c.user, 32) }}>
                            <div className="bg-secondary/40 hover:bg-secondary/60 transition rounded-2xl rounded-tl-sm px-4 py-2.5">
                              <p className="text-xs">
                                <button
                                  className="font-bold hover:text-primary transition"
                                  onClick={() => openProfile(c.user.username)}
                                >
                                  <NameWithFrame user={c.user} compact className="font-bold" avatarSize={0} />
                                </button>
                                {c.user.level && <span className="ml-1.5 text-[9px] font-bold bg-secondary/80 px-1 py-0.5 rounded text-muted-foreground">Lv.{c.user.level}</span>}
                              </p>
                              <p className="text-sm mt-1 break-words text-foreground/90">{c.content}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 ml-2 text-[11px] font-bold text-muted-foreground">
                              <span>{timeAgo(c.createdAt)}</span>
                              <button
                                className="hover:text-primary transition"
                                onClick={() => {
                                  setReplyTargets((prev) => ({ ...prev, [post.id]: c.id }));
                                  setCommentInputs((prev) => ({ ...prev, [post.id]: `@${c.user.username} ` }));
                                }}
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Comment Input */}
                      <div className="flex gap-3 mt-4 items-start">
                         {user && <FramedAvatar user={user} size={32} className="shrink-0" />}
                         <div className="flex-1 relative">
                          <Textarea
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendComment(post.id);
                              }
                            }}
                            placeholder={replyTargets[post.id] ? "Write your reply..." : user ? "Write a comment..." : "Sign in to reply"}
                            disabled={!user}
                            maxLength={500}
                            className="min-h-[44px] h-[44px] py-3 pr-12 rounded-2xl bg-secondary/30 border-0 focus-visible:ring-1 focus-visible:bg-secondary/50 resize-none text-sm transition-colors"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 bottom-1 w-8 h-8 rounded-xl text-primary hover:bg-primary hover:text-white transition-colors"
                            onClick={() => sendComment(post.id)}
                            disabled={!user || !(commentInputs[post.id] || "").trim()}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loading && posts.length > 0 && cursor && (
            <div className="flex justify-center pt-5">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
          {visibleModerationReports && (
            <section className="mt-8 rounded-2xl border bg-secondary/20 p-4">
              <h2 className="mb-3 font-bold">{t("community.moderation")}</h2>
              {!visibleModerationReports.length ? (
                <p className="text-sm text-muted-foreground">{t("community.noReports")}</p>
              ) : (
                <div className="space-y-3">
                  {visibleModerationReports.map((report) => {
                    const actions: { action: "hide" | "delete" | "block" | "dismiss"; label: string }[] =
                      report.targetType === "POST"
                        ? [{ action: "hide", label: "Hide post" }, { action: "delete", label: "Delete post" }]
                        : report.targetType === "COMMENT"
                          ? [{ action: "delete", label: "Delete comment" }]
                          : [{ action: "block", label: "Block user" }];
                    return (
                      <div key={report.id} className="rounded-xl border bg-background p-3">
                        <p className="text-xs font-bold">
                          {report.targetType} · reported by {report.reporter.displayName || report.reporter.username}
                        </p>
                        <p className="mt-1 text-sm">{report.target?.content || "Reported content is no longer available"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Reason: {report.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {actions.map(({ action, label }) => (
                            <Button key={action} size="sm" variant="outline" onClick={() => moderateReport(report, action)}>
                              {label}
                            </Button>
                          ))}
                          <Button size="sm" variant="ghost" onClick={() => moderateReport(report, "dismiss")}>{t("community.dismiss")}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Sidebar (Desktop only) */}
        <RightSidebar user={user} stats={stats} />

      </div>
      </>
      )}
    </div>
  );
}
