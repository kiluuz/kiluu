"use client";

import { useRef, useState } from "react";
import {
  Heart, MessageCircle, Share2, Bookmark, Star, Sparkles, Image as ImageIcon,
  Smile, AlignLeft, ShieldAlert, MoreHorizontal, Trophy, Target, TrendingUp, Users, PlayCircle, Shield,
  Award, Zap, CheckCircle2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar as UiAvatar, timeAgo, SmartImage } from "../ui-bits";
import { cn } from "@/lib/utils";
import type { CommunityPost, CommentItem, AuthUser, AnimeSummary, PostType, CommunityStats } from "../types";
import { useAppStore, useOpenProfile } from "../store";
import { toast } from "sonner";
import { readApiJson } from "@/lib/api-response";

// ==========================================
// Right Sidebar Widgets
// ==========================================

export function RightSidebar({ user, stats }: { user: AuthUser | null; stats: CommunityStats | null }) {
  return (
    <div className="w-[320px] shrink-0 hidden lg:flex flex-col gap-5 sticky top-[88px] max-h-[calc(100vh-88px)] overflow-y-auto fancy-scroll pb-10">
      {user && (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <UiAvatar src={user.avatarUrl} name={user.displayName || user.username} accent={user.accentColor} size={48} />
            <div>
              <p className="font-bold leading-tight">{user.displayName || user.username}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <h3 className="font-black flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" /> Trending Anime
        </h3>
        {!stats?.trending.length ? <p className="text-xs text-muted-foreground">No anime posts in the last 7 days.</p> : (
          <div className="space-y-4">
            {stats.trending.map((anime, index) => (
              <div key={anime.id} className="flex items-center gap-3">
                <div className="w-6 text-center text-sm font-bold text-muted-foreground">{index + 1}</div>
                <div className="w-10 h-14 bg-secondary rounded overflow-hidden shrink-0">
                  <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{anime.title}</p>
                  <p className="text-[11px] text-muted-foreground">{anime.posts} posts · {anime.likes} likes</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-black flex items-center gap-2 mb-4">
          <PlayCircle className="w-4 h-4 text-primary" /> Watch Parties
        </h3>
        {!stats?.watchParties.length ? <p className="text-xs text-muted-foreground">No active watch parties right now.</p> : (
          <div className="space-y-3">
            {stats.watchParties.map((party) => (
              <div key={party.id} className="bg-secondary/40 rounded-xl p-3">
                <p className="text-xs font-bold mb-1 truncate">{party.name || party.title}</p>
                <p className="text-[11px] text-muted-foreground">{party.title} · {party.watching} watching</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-black flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-primary" /> Top Contributors
        </h3>
        {!stats?.contributors.length ? <p className="text-xs text-muted-foreground">No community activity yet.</p> : (
          <div className="space-y-3">
            {stats.contributors.map((contributor) => (
              <div key={contributor.id} className="flex items-center gap-3">
                <UiAvatar src={contributor.avatarUrl} name={contributor.displayName || contributor.username} accent={contributor.accentColor} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{contributor.displayName || contributor.username}</p>
                  <p className="text-[11px] text-primary">Lv.{contributor.level} · {contributor.postCount} posts · {contributor.likeCount} likes</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5 text-xs text-muted-foreground">
        <div className="flex justify-between mb-3">
          <span>Online now</span><strong className="text-foreground">{stats?.online ?? "—"}</strong>
        </div>
        <div className="flex justify-between">
          <span>Posts today</span><strong className="text-foreground">{stats?.postsToday ?? "—"}</strong>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 text-xs text-muted-foreground">
        <h4 className="font-bold text-foreground mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> Community Rules</h4>
        <ul className="space-y-2 mb-4">
          <li>1. Treat people respectfully; harassment and hate speech are not allowed.</li>
          <li>2. Mark spoilers so other viewers can avoid them.</li>
          <li>3. Do not spam, impersonate others, or post illegal content.</li>
          <li>4. Report harmful content; do not retaliate.</li>
        </ul>
        <p>© 2026 DubAniX Community</p>
      </div>
    </div>
  );
}

// ==========================================
// Post Composer
// ==========================================

const POST_TYPES: PostType[] = ["Theories", "Reviews", "Discussions", "Memes", "Fan Art", "Recommendations", "UZ Dubbing", "Watch Parties"];

type ComposerData = {
  content: string;
  category: PostType;
  spoiler: boolean;
  rating: number | null;
  animeId: string | null;
  imageUrl: string | null;
};

export function PostComposer({ user, animes, onPost }: { user: AuthUser | null, animes: AnimeSummary[], onPost: (data: ComposerData) => Promise<boolean> }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<PostType>("Discussions");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [rating, setRating] = useState(0);
  const [attachAnime, setAttachAnime] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const { setAuthOpen } = useAppStore();

  async function handleSubmit() {
    if (!user) return setAuthOpen(true);
    if (!content.trim()) return;
    setPosting(true);
    try {
      const created = await onPost({
        content: content.trim(),
        category: type,
        spoiler: isSpoiler,
        rating: type === "Reviews" ? rating : null,
        animeId: attachAnime || null,
        imageUrl,
      });
      if (!created) return;
      setContent("");
      setExpanded(false);
      setAttachAnime("");
      setImageUrl(null);
      setRating(0);
      setIsSpoiler(false);
      setType("Discussions");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={cn("glass rounded-2xl p-4 mb-6 transition-all duration-300", expanded ? "shadow-lg border border-primary/20" : "")}>
      <div className="flex gap-3">
        <UiAvatar src={user?.avatarUrl} name={user?.displayName || user?.username || "?"} accent={user?.accentColor} size={40} className="mt-0.5 shrink-0" />
        <div className="flex-1 space-y-3 min-w-0">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder={user ? "What's on your mind? Share your anime thoughts..." : "Sign in to join the conversation"}
            disabled={!user}
            maxLength={1000}
            className={cn("w-full rounded-xl border-0 bg-background/60 focus-visible:ring-1 transition-all resize-none", expanded ? "min-h-[120px]" : "min-h-[44px] h-[44px] overflow-hidden")}
          />
          
          {expanded && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2 overflow-x-auto fancy-scroll pb-2">
                {POST_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setType(t); if (t !== "Reviews") setRating(0); }}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border", type === t ? "border-primary bg-primary text-white" : "border-transparent bg-secondary/60 text-muted-foreground hover:bg-secondary")}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {type === "Reviews" && (
                <div className="flex items-center gap-2 bg-secondary/30 p-3 rounded-xl border border-dashed">
                  <span className="text-xs font-bold mr-2">Your Score:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                      <Star className={cn("w-5 h-5 transition-transform hover:scale-110", star <= rating ? "fill-orange-400 text-orange-400" : "text-muted-foreground/30")} />
                    </button>
                  ))}
                  <span className="text-sm font-bold ml-2 w-6 text-center">{rating > 0 ? rating : "-"}</span>
                </div>
              )}

              {attachAnime && (
                <div className="flex items-center gap-2 text-xs bg-secondary/60 rounded-xl p-2 pr-4 w-fit">
                  <span className="w-8 h-12 rounded overflow-hidden">
                    <SmartImage src={animes.find((a) => a.id === attachAnime)?.coverImage} alt="" className="w-full h-full object-cover" />
                  </span>
                  <span className="font-bold truncate max-w-[200px]">{animes.find((a) => a.id === attachAnime)?.title}</span>
                  <button onClick={() => setAttachAnime("")} className="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-background/50 hover:bg-destructive/20 hover:text-destructive transition">✕</button>
                </div>
              )}

              {imageUrl && (
                <div className="relative w-fit">
                  <SmartImage src={imageUrl} alt="Post attachment" className="max-h-48 max-w-full rounded-xl object-contain" />
                  <button type="button" onClick={() => setImageUrl(null)} className="absolute -right-2 -top-2 rounded-full bg-background px-2 py-1 text-xs shadow">Remove image</button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" title="Add Image" disabled={uploading} onClick={() => imageInput.current?.click()}>
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <input
                    ref={imageInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setUploading(true);
                      try {
                        const form = new FormData();
                        form.set("file", file);
                        const response = await fetch("/api/community/image", { method: "POST", body: form });
                        const data = await readApiJson(response);
                        if (!response.ok) {
                          throw new Error(typeof data.error === "string" ? data.error : `Image upload failed (HTTP ${response.status})`);
                        }
                        if (typeof data.imageUrl !== "string" || !data.imageUrl) {
                          throw new Error("Image upload response did not include an image URL");
                        }
                        setImageUrl(data.imageUrl);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Image upload failed");
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" onClick={() => setAttachOpen(!attachOpen)} title="Attach Anime">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" title="Add Emoji">
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" title="Add Poll">
                    <AlignLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("rounded-full text-xs h-8 px-3 transition-colors", isSpoiler ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-500" : "text-muted-foreground")}
                    onClick={() => setIsSpoiler(!isSpoiler)}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Spoiler
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className={cn("transition-all duration-300", content.length > 900 ? "text-red-500" : "text-primary")} strokeDasharray={`${(content.length / 1000) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                  </div>
                  <Button size="sm" disabled={!user || !content.trim() || posting || uploading || (type === "Reviews" && rating < 1)} onClick={handleSubmit} className="rounded-full brand-gradient text-white font-bold px-6">
                    {posting ? "Posting..." : uploading ? "Uploading..." : "Post"}
                  </Button>
                </div>
              </div>

              {attachOpen && (
                <div className="border rounded-xl p-3 max-h-48 overflow-y-auto fancy-scroll bg-secondary/20 mt-2">
                  <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Select Anime</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                    {animes.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setAttachAnime(a.id); setAttachOpen(false); }}
                        className={cn("aspect-[2/3] rounded-lg overflow-hidden border-2 transition relative group", attachAnime === a.id ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}
                        title={a.title}
                      >
                        <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        {attachAnime === a.id && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><CheckCircle2 className="text-white w-6 h-6 drop-shadow-md" /></div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Post Card
// ==========================================

export function PostCard({
  post,
  onLike,
  onCommentClick,
  onFollow,
  onBookmark,
  onAward,
  onReport,
  onEdit,
  onDelete,
  isOwn,
}: {
  post: CommunityPost;
  onLike: () => void;
  onCommentClick: () => void;
  onFollow: () => void;
  onBookmark: () => void;
  onAward: () => void;
  onReport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isOwn: boolean;
}) {
  const openProfile = useOpenProfile();
  const [spoilerRevealed, setSpoilerRevealed] = useState(!(post.spoiler ?? post.isSpoiler));
  const { navigate } = useAppStore();

  return (
    <article id={`post-${post.id}`} className="glass rounded-2xl p-4 sm:p-5 fade-in-up">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <UiAvatar src={post.user.avatarUrl} name={post.user.displayName} accent={post.user.accentColor} size={44} onClick={() => openProfile(post.user.username)} />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button className="font-bold hover:text-primary transition truncate text-sm" onClick={() => openProfile(post.user.username)}>
                {post.user.displayName || post.user.username}
              </button>
              {post.user.role === "CREATOR" && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              {post.user.level && <span className="text-[10px] font-bold bg-secondary/80 px-1.5 py-0.5 rounded text-muted-foreground shrink-0">Lv.{post.user.level}</span>}
              {post.user.badges?.map(b => (
                <span key={b.id} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", b.color, b.glow && "animate-pulse shadow-[0_0_8px_currentColor]")}>
                  {b.label}
                </span>
              ))}
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{post.category || post.type}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">@{post.user.username} · {timeAgo(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {!isOwn && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onFollow}>{post.user.following ? "Following" : "Follow"}</Button>}
          {isOwn && <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" title="Edit post" onClick={onEdit}><MoreHorizontal className="w-4 h-4" /></Button>}
          {isOwn && <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={onDelete}>Delete</Button>}
          {!isOwn && <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" title="Report post" onClick={onReport}><ShieldAlert className="w-4 h-4" /></Button>}
        </div>
      </div>

      <div className="relative">
        {(post.spoiler ?? post.isSpoiler) && !spoilerRevealed && (
          <div className="absolute inset-0 z-10 backdrop-blur-xl bg-background/40 flex flex-col items-center justify-center rounded-xl border border-red-500/20 cursor-pointer overflow-hidden transition-all hover:bg-background/20" onClick={() => setSpoilerRevealed(true)}>
             <ShieldAlert className="w-8 h-8 text-red-500 mb-2" />
             <span className="font-bold text-sm">Spoiler Content</span>
             <span className="text-xs text-muted-foreground mt-1">Tap to reveal</span>
          </div>
        )}
        
        <div className={cn("transition-all duration-500", (post.spoiler ?? post.isSpoiler) && !spoilerRevealed ? "opacity-30 blur-md pointer-events-none select-none h-24 overflow-hidden" : "")}>
          <p className="text-[15px] leading-relaxed whitespace-pre-line break-words text-foreground/90">
            {post.content}
          </p>

          {post.imageUrl && (
            <SmartImage src={post.imageUrl} alt="Post attachment" className="mt-3 max-h-[480px] max-w-full rounded-xl object-contain" />
          )}

          {(post.category === "Reviews" || post.type === "Reviews") && post.rating && (
            <div className="flex items-center gap-2 mt-3 bg-secondary/30 w-fit px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-muted-foreground">Rating:</span>
              <div className="flex items-center">
                <Star className="w-4 h-4 fill-orange-400 text-orange-400 mr-1" />
                <span className="font-bold text-sm">{post.rating}/10</span>
              </div>
            </div>
          )}

          {post.anime && (
            <div className="mt-4 border rounded-xl overflow-hidden hover:border-primary/50 transition cursor-pointer group" onClick={() => navigate("detail", { animeId: post.anime!.slug })}>
              <div className="flex items-stretch bg-secondary/20">
                <div className="w-20 sm:w-24 shrink-0 aspect-[2/3] relative">
                  <SmartImage src={post.anime.coverImage} alt={post.anime.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                </div>
                <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                  <h4 className="font-bold text-sm sm:text-base truncate group-hover:text-primary transition">{post.anime.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {post.anime.rating && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-orange-400 text-orange-400" /> {post.anime.rating}%</span>}
                    {post.anime.episodeCount && <span>• {post.anime.episodeCount} Eps</span>}
                    {post.anime.genres && post.anime.genres.length > 0 && <span>• {post.anime.genres[0]}</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition transform translate-x-[-10px] group-hover:translate-x-0">
                    View Anime <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative group/react flex items-center">
            <button onClick={onLike} className={cn("flex items-center gap-1.5 text-xs font-bold transition hover:scale-110", post.liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500")}>
              <Heart className={cn("w-5 h-5", post.liked && "fill-rose-500")} />
              <span>{post.likeCount}</span>
            </button>
          </div>
          
          <button onClick={onCommentClick} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition hover:scale-110">
            <MessageCircle className="w-5 h-5" />
            <span>{post.commentCount}</span>
          </button>
          
          <button onClick={() => {
            const link = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
            void navigator.clipboard.writeText(link)
              .then(() => toast.success("Share link copied"))
              .catch(() => toast.error("Could not copy share link"));
          }} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition hover:scale-110">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-full" onClick={onAward}>
            <Award className="w-4 h-4 mr-1.5" /> Award · {post.awardCount}
          </Button>
          <button aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark"} onClick={onBookmark} className={cn("text-muted-foreground hover:text-primary transition hover:scale-110", post.bookmarked && "text-primary")}>
            <Bookmark className={cn("w-5 h-5", post.bookmarked && "fill-current")} />
          </button>
        </div>
      </div>
    </article>
  );
}
