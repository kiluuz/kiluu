export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface AchievementSeed {
  id: string;
  emoji: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: string;
  condition: Record<string, unknown>;
  reward?: Record<string, unknown>;
  secret?: boolean;
  seasonal?: boolean;
}

export const ACHIEVEMENT_SEEDS: AchievementSeed[] = [
  { id: "join", emoji: "🎬", name: "DubAniX Citizen", description: "Joined DubAniX", rarity: "common", category: "social", condition: { type: "join" } },
  { id: "first", emoji: "💎", name: "First Purchase", description: "Bought your first anime", rarity: "common", category: "collection", condition: { type: "purchases", gte: 1 } },
  { id: "collector_i", emoji: "📦", name: "Collector I", description: "Own 10 animes", rarity: "common", category: "collection", condition: { type: "purchases", gte: 10 } },
  { id: "collector_ii", emoji: "📚", name: "Collector II", description: "Own 25 animes", rarity: "rare", category: "collection", condition: { type: "purchases", gte: 25 }, reward: { cosmetics: ["frame:gold"], credits: 25 } },
  { id: "collector_iii", emoji: "🏆", name: "Collector III", description: "Own 50 animes", rarity: "epic", category: "collection", condition: { type: "purchases", gte: 50 } },
  { id: "collector_iv", emoji: "👑", name: "Collector IV", description: "Own 100 animes", rarity: "legendary", category: "collection", condition: { type: "purchases", gte: 100 } },
  { id: "genre_hunter", emoji: "🧭", name: "Genre Hunter", description: "Own at least one anime from every listed genre", rarity: "epic", category: "collection", condition: { type: "all_genres" } },
  { id: "genre_master", emoji: "🎯", name: "Genre Master", description: "Own 10 animes in a single genre", rarity: "rare", category: "collection", condition: { type: "genre_count", gte: 10 } },
  { id: "set_complete", emoji: "🧩", name: "Set Complete", description: "Finish an admin-defined collection set", rarity: "epic", category: "collection", condition: { type: "set_complete" } },
  { id: "day_one", emoji: "🚀", name: "Day One", description: "Buy an anime within 24 hours of listing", rarity: "rare", category: "collection", condition: { type: "day_one" } },
  { id: "founding_fan", emoji: "🥇", name: "Founding Fan", description: "Be among the first 100 buyers of an anime", rarity: "legendary", category: "collection", condition: { type: "founding_fan", limit: 100 }, reward: { cosmetics: ["frame:gold"] } },
  { id: "big_spender", emoji: "💸", name: "Big Spender", description: "Spend 1,000 credits lifetime", rarity: "rare", category: "collection", condition: { type: "spent", gte: 1000 } },
  { id: "patron", emoji: "🏦", name: "Patron", description: "Spend 5,000 credits lifetime", rarity: "epic", category: "collection", condition: { type: "spent", gte: 5000 } },
  { id: "whale", emoji: "🐋", name: "Whale", description: "Spend 25,000 credits lifetime", rarity: "mythic", category: "collection", condition: { type: "spent", gte: 25000 } },
  { id: "generous", emoji: "🎁", name: "Generous Soul", description: "Send 1 gift", rarity: "common", category: "gift", condition: { type: "gifts_sent", gte: 1 } },
  { id: "gift_giver", emoji: "🎀", name: "Gift Giver", description: "Send 10 gifts", rarity: "rare", category: "gift", condition: { type: "gifts_sent", gte: 10 } },
  { id: "santa", emoji: "🎅", name: "Santa", description: "Send 50 gifts", rarity: "legendary", category: "gift", condition: { type: "gifts_sent", gte: 50 } },
  { id: "cupid", emoji: "💘", name: "Cupid", description: "Send a gift on Valentine’s Day", rarity: "rare", category: "gift", condition: { type: "gift_date", month: 2, day: 14 }, seasonal: true },
  { id: "secret_santa", emoji: "🎄", name: "Secret Santa", description: "Send a gift in December", rarity: "rare", category: "gift", condition: { type: "gift_month", month: 12 }, seasonal: true },
  { id: "friend_of_many", emoji: "🤝", name: "Friend of Many", description: "Gift 10 different people", rarity: "epic", category: "gift", condition: { type: "gift_unique_recipients", gte: 10 } },
  { id: "completionist_i", emoji: "✅", name: "Completionist I", description: "Finish 1 series", rarity: "common", category: "watch", condition: { type: "completed_series", gte: 1 } },
  { id: "completionist_ii", emoji: "🏁", name: "Completionist II", description: "Finish 5 series", rarity: "rare", category: "watch", condition: { type: "completed_series", gte: 5 } },
  { id: "completionist_iii", emoji: "🎖️", name: "Completionist III", description: "Finish 25 series", rarity: "epic", category: "watch", condition: { type: "completed_series", gte: 25 } },
  { id: "marathon", emoji: "🌠", name: "Marathon Otaku", description: "Watch 10 episodes in 24 hours", rarity: "epic", category: "watch", condition: { type: "eps_in_24h", gte: 10 } },
  { id: "couch_critic", emoji: "🛋️", name: "Couch Critic", description: "Watch 10 hours", rarity: "rare", category: "watch", condition: { type: "watch_hours", gte: 10 } },
  { id: "night_owl", emoji: "🦉", name: "Night Owl", description: "Watch between 02:00 and 05:00", rarity: "rare", category: "watch", condition: { type: "night_owl" } },
  { id: "streak_7", emoji: "🔥", name: "Streak Keeper", description: "7-day watch streak", rarity: "rare", category: "watch", condition: { type: "streak", gte: 7 } },
  { id: "streak_30", emoji: "🔥", name: "Streak Keeper II", description: "30-day watch streak", rarity: "epic", category: "watch", condition: { type: "streak", gte: 30 } },
  { id: "streak_100", emoji: "🔥", name: "Streak Keeper III", description: "100-day watch streak", rarity: "legendary", category: "watch", condition: { type: "streak", gte: 100 } },
  { id: "party_host", emoji: "🎉", name: "Party Host", description: "Host 10 watch parties", rarity: "rare", category: "social", condition: { type: "parties_hosted", gte: 10 } },
  { id: "party_animal", emoji: "🥳", name: "Party Animal", description: "50 total party participants hosted", rarity: "epic", category: "social", condition: { type: "party_guests", gte: 50 } },
  { id: "party_guest", emoji: "🍿", name: "Party Regular", description: "Join 10 watch parties", rarity: "common", category: "social", condition: { type: "parties_joined", gte: 10 } },
  { id: "voice", emoji: "📣", name: "Voice of Community", description: "A post reaches 100 likes", rarity: "epic", category: "social", condition: { type: "post_likes", gte: 100 }, reward: { cosmetics: ["frame:neon"] } },
  { id: "viral", emoji: "📈", name: "Viral", description: "A post reaches 500 likes", rarity: "legendary", category: "social", condition: { type: "post_likes", gte: 500 } },
  { id: "beloved", emoji: "💖", name: "Beloved", description: "Reach 100 followers", rarity: "epic", category: "social", condition: { type: "followers", gte: 100 } },
  { id: "award_giver", emoji: "🏅", name: "Award Giver", description: "Give a post award", rarity: "rare", category: "social", condition: { type: "awards_given", gte: 1 } },
  { id: "published", emoji: "🎥", name: "Published", description: "First approved creator anime", rarity: "rare", category: "creator", condition: { type: "approved_animes", gte: 1 } },
  { id: "best_seller_10", emoji: "⭐", name: "Best Seller", description: "10 buyers on your anime", rarity: "rare", category: "creator", condition: { type: "creator_sales", gte: 10 } },
  { id: "best_seller_100", emoji: "🌟", name: "Best Seller II", description: "100 buyers on your anime", rarity: "epic", category: "creator", condition: { type: "creator_sales", gte: 100 } },
  { id: "best_seller_1000", emoji: "💫", name: "Best Seller III", description: "1000 buyers on your anime", rarity: "legendary", category: "creator", condition: { type: "creator_sales", gte: 1000 } },
  { id: "studio_legend", emoji: "🏛️", name: "Studio Legend", description: "Earn 10,000 credits from sales", rarity: "mythic", category: "creator", condition: { type: "creator_earnings", gte: 10000 } },
  { id: "dub_hero", emoji: "🎙️", name: "Dub Hero", description: "Publish 5 dub versions", rarity: "epic", category: "creator", condition: { type: "dub_versions", gte: 5 } },
  { id: "founding_member", emoji: "🪪", name: "Founding Member", description: "Joined in the platform’s first months", rarity: "legendary", category: "seasonal", condition: { type: "joined_before", before: "2026-12-31" }, seasonal: true },
  { id: "spooky_2026", emoji: "🎃", name: "Spooky Season", description: "Be active during the Halloween 2026 event", rarity: "rare", category: "seasonal", condition: { type: "season_window", start: "2026-10-20", end: "2026-11-02" }, seasonal: true, reward: { cosmetics: ["frame:sakura"] } },
  { id: "winter_2026", emoji: "❄️", name: "Winter 2026", description: "Be active during Winter 2026", rarity: "rare", category: "seasonal", condition: { type: "season_window", start: "2026-12-01", end: "2027-01-10" }, seasonal: true },
  { id: "secret_owl", emoji: "🫣", name: "???", description: "A hidden condition", rarity: "rare", category: "secret", condition: { type: "night_owl" }, secret: true },
  { id: "secret_palindrome", emoji: "🪞", name: "???", description: "A hidden condition", rarity: "epic", category: "secret", condition: { type: "username_palindrome" }, secret: true },
  { id: "secret_zero", emoji: "🫥", name: "???", description: "A hidden condition", rarity: "rare", category: "secret", condition: { type: "zero_credits_after_spend" }, secret: true },
  { id: "curator", emoji: "❤️", name: "Curator", description: "Favorite 10 animes", rarity: "common", category: "collection", condition: { type: "favorites", gte: 10 } },
  { id: "social_butterfly", emoji: "🦋", name: "Social Butterfly", description: "Get 5 followers", rarity: "common", category: "social", condition: { type: "followers", gte: 5 } },
];
