"use client";

import { useEffect, useState } from "react";
import {
  Users, Heart, MessageCircle, Send, Loader2, Sparkles, BadgeCheck, Flame, Trophy, Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppStore } from "../store";
import type { CommunityPost, CommentItem, AnimeSummary } from "../types";
import { Avatar as UiAvatar, timeAgo, SmartImage } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CommunityView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("trending");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [animes, setAnimes] = useState<AnimeSummary[]>([]);
  const [attachAnime, setAttachAnime] = useState<string>("");
  const [attachOpen, setAttachOpen] = useState(false);

  // comment state per post
  const [openComments, setOpenComments] = useState<Record<string, CommentItem[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/community?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => toast.error("Failed to load community"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (attachOpen && animes.length === 0) {
      fetch("/api/animes")
        .then((r) => r.json())
        .then((d) => setAnimes(d.animes || []))
        .catch(() => {});
    }
  }, [attachOpen, animes.length]);

  async function createPost() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), animeId: attachAnime || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      setPosts((prev) => [d.post, ...prev]);
      setContent("");
      setAttachAnime("");
      toast.success("Posted to the community! 🎉");
    } catch {
      toast.error("Network error");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const res = await fetch(`/api/community/${postId}/like`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, liked: d.liked, likeCount: d.likeCount } : p))
      );
    }
  }

  async function loadComments(postId: string) {
    const res = await fetch(`/api/community/${postId}/comments`);
    if (res.ok) {
      const d = await res.json();
      setOpenComments((prev) => ({ ...prev, [postId]: d.comments || [] }));
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
        body: JSON.stringify({ content: text }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      setOpenComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), d.comment],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p))
      );
    } catch {
      toast.error("Failed to comment");
    }
  }

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </span>
        Community
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Share theories, reviews and watch parties — be excellent to each other
      </p>

      {/* Composer */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex gap-3">
          <UiAvatar
            src={user?.avatarUrl}
            name={user?.displayName || user?.username || "?"}
            accent={user?.accentColor}
            size={40}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={user ? "Share your anime thoughts..." : "Sign in to join the conversation"}
              disabled={!user}
              maxLength={1000}
              className="min-h-[72px] rounded-xl border-0 bg-background/60 focus-visible:ring-1"
            />
            {attachAnime && (
              <div className="flex items-center gap-2 text-xs bg-secondary/60 rounded-full px-2.5 py-1.5 w-fit">
                <span className="w-6 h-8 rounded overflow-hidden">
                  <SmartImage src={animes.find((a) => a.id === attachAnime)?.coverImage} alt="" className="w-full h-full object-cover" />
                </span>
                <span className="font-semibold truncate max-w-[220px]">
                  {animes.find((a) => a.id === attachAnime)?.title}
                </span>
                <button onClick={() => setAttachAnime("")} className="text-muted-foreground hover:text-destructive" aria-label="Remove">✕</button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  onClick={() => (user ? setAttachOpen(!attachOpen) : setAuthOpen(true))}
                >
                  <Sparkles className="w-4 h-4" /> Attach anime
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums">{content.length}/1000</span>
              </div>
              <Button
                size="sm"
                disabled={!user || !content.trim() || posting}
                onClick={createPost}
                className="rounded-full brand-gradient text-white font-bold"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post
              </Button>
            </div>

            {attachOpen && (
              <div className="border rounded-xl p-2 max-h-44 overflow-y-auto fancy-scroll">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                  {animes.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setAttachAnime(a.id);
                        setAttachOpen(false);
                      }}
                      className={cn(
                        "aspect-[2/3] rounded-lg overflow-hidden border-2 transition",
                        attachAnime === a.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      title={a.title}
                      aria-label={`Attach ${a.title}`}
                    >
                      <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList className="rounded-xl">
          <TabsTrigger value="trending" className="rounded-lg gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Latest
          </TabsTrigger>
          <TabsTrigger value="top" className="rounded-lg gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Top
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 rounded skeleton" />
                  <div className="h-3 w-full rounded skeleton" />
                  <div className="h-3 w-2/3 rounded skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-12 text-center">
          <p className="text-5xl mb-3">💬</p>
          <p className="font-bold">No posts yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <article key={post.id} className="glass rounded-2xl p-4 sm:p-5 fade-in-up">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <UiAvatar
                  src={post.user.avatarUrl}
                  name={post.user.displayName}
                  accent={post.user.accentColor}
                  size={40}
                  onClick={() => navigate("user-profile", { username: post.user.username })}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    <button
                      className="truncate hover:text-primary transition"
                      onClick={() => navigate("user-profile", { username: post.user.username })}
                    >
                      {post.user.displayName || post.user.username}
                    </button>
                    {post.user.role === "CREATOR" && (
                      <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Creator" />
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">@{post.user.username} · {timeAgo(post.createdAt)}</p>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm leading-relaxed whitespace-pre-line break-words">{post.content}</p>

              {/* Attached anime */}
              {post.anime && (
                <button
                  onClick={() => navigate("detail", { animeId: post.anime!.slug })}
                  className="mt-3 flex items-center gap-3 p-2.5 rounded-xl border hover:border-primary/50 hover:bg-accent/40 transition w-full text-left"
                >
                  <span className="w-11 h-16 rounded-lg overflow-hidden shrink-0">
                    <SmartImage src={post.anime.coverImage} alt={post.anime.title} className="w-full h-full object-cover" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{post.anime.title}</p>
                    <p className="text-[11px] text-primary">View anime →</p>
                  </div>
                </button>
              )}

              {/* Actions */}
              <div className="flex items-center gap-5 mt-4 pt-3 border-t">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-bold transition hover:scale-105",
                    post.liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
                  )}
                  aria-label="Like post"
                >
                  <Heart className={cn("w-4 h-4", post.liked && "fill-rose-500")} />
                  {post.likeCount}
                </button>
                <button
                  onClick={() => {
                    if (openComments[post.id]) {
                      setOpenComments((prev) => ({ ...prev, [post.id]: undefined as unknown as CommentItem[] }));
                    } else {
                      loadComments(post.id);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition hover:scale-105"
                  aria-label="Comments"
                >
                  <MessageCircle className="w-4 h-4" />
                  {post.commentCount}
                </button>
              </div>

              {/* Comments */}
              {openComments[post.id] && (
                <div className="mt-3 space-y-3 pt-3 border-t">
                  {(openComments[post.id] || []).map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <UiAvatar src={c.user.avatarUrl} name={c.user.displayName} accent={c.user.accentColor} size={28} />
                      <div className="flex-1 bg-secondary/50 rounded-xl px-3 py-2 min-w-0">
                        <p className="text-xs">
                          <button
                            className="font-bold hover:text-primary"
                            onClick={() => navigate("user-profile", { username: c.user.username })}
                          >
                            {c.user.displayName || c.user.username}
                          </button>{" "}
                          <span className="text-muted-foreground">{timeAgo(c.createdAt)}</span>
                        </p>
                        <p className="text-xs mt-0.5 break-words">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && sendComment(post.id)}
                      placeholder={user ? "Write a comment..." : "Sign in to comment"}
                      disabled={!user}
                      maxLength={500}
                      className="flex-1 h-9 rounded-full bg-secondary/50 border px-4 text-xs outline-none focus:border-primary/50 disabled:opacity-60"
                      aria-label="Write a comment"
                    />
                    <Button
                      size="icon"
                      className="w-9 h-9 rounded-full brand-gradient text-white shrink-0"
                      onClick={() => sendComment(post.id)}
                      disabled={!user || !(commentInputs[post.id] || "").trim()}
                      aria-label="Send comment"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
