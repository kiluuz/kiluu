/* Seed AniVerse database with animes, users, community data */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import * as fs from "fs";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const urls: Record<string, string[]> = JSON.parse(
  fs.readFileSync("/home/z/my-project/image-data/all_urls.json", "utf-8")
);

const pick = (key: string, i = 0) => urls[key]?.[i] || urls.banner_scenic1?.[0] || "";

const V = "/videos";
const VIDEOS = [
  `${V}/bbb-trailer.ogg`,
  `${V}/sintel-trailer.mp4`,
  `${V}/bbb-clip.mp4`,
  `${V}/sintel-clip.mp4`,
  `${V}/jellyfish.mp4`,
  `${V}/flower.mp4`,
];
const DURATIONS = [33, 52, 10, 10, 10, 5];

interface AnimeSeed {
  key: string; slug: string; title: string; altTitle?: string;
  description: string; genres: string[]; year: number; rating: number;
  studio: string; status: string; type: string; isFree: boolean; price: number;
  trending: number; featured?: boolean; episodes: { title: string; description: string }[];
}

const EP_TITLES = [
  ["The Beginning of Everything", "A fateful encounter changes everything as the journey begins."],
  ["Crimson Dawn", "Old wounds reopen while new alliances are forged in the heat of battle."],
  ["Blade of Resolve", "The training arc everyone waited for — sweat, tears and breakthrough."],
  ["Echoes of the Past", "Secrets buried long ago resurface at the worst possible moment."],
  ["The Silent Oath", "A promise made in childhood faces its ultimate test."],
  ["Storm Before Calm", "Enemies become reluctant allies as a greater threat emerges."],
  ["Shattered Sky", "The final battle begins — no retreat, no surrender."],
  ["Where We Go From Here", "Season finale that redefines everything you thought you knew."],
];

function eps(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    title: EP_TITLES[i % EP_TITLES.length][0],
    description: EP_TITLES[i % EP_TITLES.length][1],
  }));
}

const ANIMES: AnimeSeed[] = [
  {
    key: "demonslayer", slug: "demon-slayer", title: "Demon Slayer: Kimetsu no Yaiba",
    altTitle: "Kimetsu no Yaiba",
    description: "After a demon attack leaves his family slaughtered and his sister cursed, Tanjiro Kamado takes up the blade to become a Demon Slayer. His quest: restore Nezuko's humanity and avenge his family. Breath-taking sakuga animation, sword techniques that bloom like flowers, and a story about siblings that refuses to let go.",
    genres: ["Action", "Supernatural", "Adventure", "Drama"], year: 2019, rating: 8.6, studio: "ufotable",
    status: "ONGOING", type: "TV", isFree: false, price: 180, trending: 100, featured: true, episodes: eps(8),
  },
  {
    key: "jjk", slug: "jujutsu-kaisen", title: "Jujutsu Kaisen",
    altTitle: "Sorcery Fight",
    description: "Yuji Itadori swallows a cursed finger and becomes the vessel of the King of Curses, Ryomen Sukuna. Enrolled in Tokyo Jujutsu High, he fights curses alongside sorcerers who treat death as an occupational hazard. MAPPA's stylish action, domain expansions, and morally grey characters make this a modern classic.",
    genres: ["Action", "Supernatural", "Horror", "Shounen"], year: 2020, rating: 8.5, studio: "MAPPA",
    status: "ONGOING", type: "TV", isFree: false, price: 200, trending: 98, featured: true, episodes: eps(8),
  },
  {
    key: "aot", slug: "attack-on-titan", title: "Attack on Titan",
    altTitle: "Shingeki no Kyojin",
    description: "Humanity lives inside cities surrounded by enormous walls — protection against the Titans, gigantic humanoids that devour people. When the outer wall is breached, Eren Yeager watches his mother eaten and vows to exterminate every last Titan. A war epic that evolves into one of anime's greatest moral mazes.",
    genres: ["Action", "Drama", "Fantasy", "Thriller"], year: 2013, rating: 9.1, studio: "WIT Studio",
    status: "COMPLETED", type: "TV", isFree: false, price: 250, trending: 96, featured: true, episodes: eps(8),
  },
  {
    key: "onepiece", slug: "one-piece", title: "One Piece",
    description: "Monkey D. Luffy sails the Grand Line with a crew of misfits, hunting the legendary treasure that will make him King of the Pirates. Twenty-five years of world-building, emotionally devastating backstories, and battles that shake the seas — the best-selling manga of all time deserves its crown.",
    genres: ["Adventure", "Action", "Comedy", "Fantasy"], year: 1999, rating: 9.0, studio: "Toei Animation",
    status: "ONGOING", type: "TV", isFree: false, price: 150, trending: 94, episodes: eps(8),
  },
  {
    key: "frieren", slug: "frieren-beyond-journeys-end", title: "Frieren: Beyond Journey's End",
    altTitle: "Sousou no Frieren",
    description: "The elf mage Frieren defeated the Demon King with her party of heroes — then watched her human friends age and die while she barely changed. Now she retraces their journey, learning what a decade meant to those who lived it. A meditation on time, grief and friendship wrapped in gorgeous fantasy scenery.",
    genres: ["Fantasy", "Drama", "Adventure", "Slice of Life"], year: 2023, rating: 9.3, studio: "Madhouse",
    status: "ONGOING", type: "TV", isFree: false, price: 220, trending: 92, featured: true, episodes: eps(8),
  },
  {
    key: "chainsaw", slug: "chainsaw-man", title: "Chainsaw Man",
    description: "Denji is a debt-riddled teen who merges with his chainsaw devil dog Pochita to become Chainsaw Man. Recruited by Public Safety's devil hunters, he chases a normal life — toast with jam, a girlfriend, a warm bed — while slicing through devils in MAPPA's grungiest, most cinematic production.",
    genres: ["Action", "Supernatural", "Horror", "Comedy"], year: 2022, rating: 8.7, studio: "MAPPA",
    status: "ONGOING", type: "TV", isFree: false, price: 190, trending: 90, episodes: eps(8),
  },
  {
    key: "deathnote", slug: "death-note", title: "Death Note",
    description: "Genius student Light Yagami finds a notebook that kills anyone whose name is written in it. What begins as a crusade against crime becomes a cat-and-mouse thriller against the enigmatic detective L. Psychological warfare at its finest — every episode ends with your jaw on the floor.",
    genres: ["Thriller", "Psychological", "Supernatural", "Mystery"], year: 2006, rating: 9.0, studio: "Madhouse",
    status: "COMPLETED", type: "TV", isFree: true, price: 0, trending: 88, episodes: eps(8),
  },
  {
    key: "spyfamily", slug: "spy-x-family", title: "Spy x Family",
    description: "Master spy Twilight must build a fake family to infiltrate an elite school. Problem: his adopted daughter Anya reads minds, and his wife Yor is an assassin. None of them know the truth about each other. Espionage chaos meets found-family warmth — and Anya's faces cure depression.",
    genres: ["Comedy", "Action", "Slice of Life", "Spy"], year: 2022, rating: 8.5, studio: "WIT Studio / CloverWorks",
    status: "ONGOING", type: "TV", isFree: false, price: 120, trending: 86, episodes: eps(8),
  },
  {
    key: "yourname", slug: "your-name", title: "Your Name",
    altTitle: "Kimi no Na wa",
    description: "Tokyo boy Taki and country girl Mitsuha start swapping bodies in their dreams. What begins as comedic chaos (skirts, bras, awkward mornings) spirals into a race against time involving a comet, red threads of fate and Shinkai's legendary visuals. The film that made the world cry in 2016.",
    genres: ["Romance", "Drama", "Supernatural", "Sci-Fi"], year: 2016, rating: 8.9, studio: "CoMix Wave Films",
    status: "COMPLETED", type: "MOVIE", isFree: false, price: 140, trending: 84, featured: true, episodes: eps(1),
  },
  {
    key: "edgerunners", slug: "cyberpunk-edgerunners", title: "Cyberpunk: Edgerunners",
    description: "Street kid David Martinez loses everything in a Night City drive-by, then rebuilds himself with illegal military chrome. With the mysterious Lucy beside him, he burns bright as an edgerunner — a legend destined to flame out. Studio Trigger's neon-soaked tragedy that won anime of the year.",
    genres: ["Sci-Fi", "Action", "Drama", "Cyberpunk"], year: 2022, rating: 8.6, studio: "Studio Trigger",
    status: "COMPLETED", type: "TV", isFree: false, price: 160, trending: 82, episodes: eps(8),
  },
  {
    key: "spirited", slug: "spirited-away", title: "Spirited Away",
    description: "Ten-year-old Chihiro wanders into a spirit world where her parents become pigs and her name is stolen by the witch Yubaba. Working in a bathhouse for gods, she finds courage she never knew. Miyazaki's Oscar-winning masterpiece remains the highest summit of animated storytelling.",
    genres: ["Fantasy", "Adventure", "Drama", "Supernatural"], year: 2001, rating: 8.9, studio: "Studio Ghibli",
    status: "COMPLETED", type: "MOVIE", isFree: true, price: 0, trending: 80, episodes: eps(1),
  },
  {
    key: "bebop", slug: "cowboy-bebop", title: "Cowboy Bebop",
    description: "Bounty hunter Spike Spiegel drifts through the solar system with ex-cop Jet, con artist Faye, hacker Ed and a corgi. Jazz-soaked episodic adventures shadowed by Spike's inescapable past with the Red Dragon syndicate. See you space cowboy... the coolest anime ever made.",
    genres: ["Sci-Fi", "Action", "Drama", "Noir"], year: 1998, rating: 8.9, studio: "Sunrise",
    status: "COMPLETED", type: "TV", isFree: true, price: 0, trending: 78, episodes: eps(8),
  },
  {
    key: "violet", slug: "violet-evergarden", title: "Violet Evergarden",
    description: "Child soldier Violet loses both arms and the major who gave her orders — and her heart. Rebuilt with mechanical hands, she becomes an Auto Memory Doll writing letters for others, slowly learning what 'I love you' means. Kyoto Animation's flower-petal frames carry devastating emotional weight.",
    genres: ["Drama", "Slice of Life", "Romance", "Fantasy"], year: 2018, rating: 8.7, studio: "Kyoto Animation",
    status: "COMPLETED", type: "TV", isFree: false, price: 130, trending: 76, episodes: eps(8),
  },
  {
    key: "steins", slug: "steins-gate", title: "Steins;Gate",
    description: "Self-proclaimed mad scientist Okabe Rintarou accidentally invents a microwave that texts the past. Every D-mail he sends rearranges reality — and dooms someone he loves. A slow-burn first half detonates into one of the greatest time-travel narratives ever written. El Psy Kongroo.",
    genres: ["Sci-Fi", "Thriller", "Psychological", "Drama"], year: 2011, rating: 9.0, studio: "White Fox",
    status: "COMPLETED", type: "TV", isFree: true, price: 0, trending: 74, episodes: eps(8),
  },
  {
    key: "naruto", slug: "naruto-shippuden", title: "Naruto: Shippuden",
    description: "Two and a half years after leaving with Jiraiya, Naruto returns to a Hidden Leaf that changed — and to Sasuke, who sank deeper into darkness. The ninja world tilts toward war as the Akatsuki hunt the tailed beasts. Belief in friendship versus cycles of hatred, at ninja scale.",
    genres: ["Action", "Adventure", "Shounen", "Drama"], year: 2007, rating: 8.7, studio: "Studio Pierrot",
    status: "COMPLETED", type: "TV", isFree: false, price: 110, trending: 72, episodes: eps(8),
  },
  {
    key: "fma", slug: "fullmetal-alchemist-brotherhood", title: "Fullmetal Alchemist: Brotherhood",
    description: "Brothers Edward and Alphonse Elric break alchemy's ultimate taboo trying to resurrect their mother. Ed loses an arm and a leg; Al loses his entire body. Their hunt for the Philosopher's Stone uncovers a national conspiracy. The gold standard of shounen — no filler, all payoff.",
    genres: ["Action", "Adventure", "Drama", "Fantasy"], year: 2009, rating: 9.1, studio: "Bones",
    status: "COMPLETED", type: "TV", isFree: false, price: 170, trending: 70, episodes: eps(8),
  },
  {
    key: "hxh", slug: "hunter-x-hunter", title: "Hunter x Hunter",
    description: "Gon Freecss leaves Whale Island to find his missing father, a legendary Hunter. With Killua, Kurapika and Leorio, he faces the world's deadliest exam. Togashi's magnum opus subverts shounen at every arc — the Chimera Ant run is literature with superpowers.",
    genres: ["Adventure", "Action", "Fantasy", "Shounen"], year: 2011, rating: 9.0, studio: "Madhouse",
    status: "ONGOING", type: "TV", isFree: false, price: 160, trending: 68, episodes: eps(8),
  },
  {
    key: "tokyorev", slug: "tokyo-revengers", title: "Tokyo Revengers",
    description: "Pushed onto train tracks, Takemichi wakes up twelve years in the past — before his middle-school crush was murdered by the Tokyo Manji Gang. He time-leaps between eras, clawing at fate to save everyone. Crybaby hero, time paradoxes, delinquent warfare and brutal stakes.",
    genres: ["Action", "Drama", "Supernatural", "Romance"], year: 2021, rating: 8.1, studio: "LIDENFILMS",
    status: "ONGOING", type: "TV", isFree: false, price: 100, trending: 66, episodes: eps(8),
  },
  {
    key: "sao", slug: "sword-art-online", title: "Sword Art Online",
    description: "Ten thousand players log into the world's first full-dive VRMMO — and can't log out. Die in the game, die in real life. Swordsman Kirito clears floor after floor to free them all. The isekai that defined a decade of gaming anime.",
    genres: ["Action", "Adventure", "Sci-Fi", "Romance"], year: 2012, rating: 7.9, studio: "A-1 Pictures",
    status: "COMPLETED", type: "TV", isFree: true, price: 0, trending: 64, episodes: eps(8),
  },
  {
    key: "mha", slug: "my-hero-academia", title: "My Hero Academia",
    description: "In a world of superpowers called Quirks, Quirkless Izuku Midoriya still dreams of being a hero. When the world's greatest hero chooses him as successor, he enrolls at U.A. High to inherit the legendary One For All. Superhero shounen with western comics DNA.",
    genres: ["Action", "Shounen", "Comedy", "Superhero"], year: 2016, rating: 8.2, studio: "Bones",
    status: "ONGOING", type: "TV", isFree: false, price: 120, trending: 62, episodes: eps(8),
  },
  {
    key: "mob", slug: "mob-psycho-100", title: "Mob Psycho 100",
    description: "Shigeo 'Mob' Kageyama is the most powerful esper alive — and the most awkward middle schooler. He suppresses his feelings to avoid explosions (literally, his counter hits 100%). ONE's other masterpiece: psychic brawls with incredible animation and a big soft heart.",
    genres: ["Action", "Comedy", "Supernatural", "Slice of Life"], year: 2016, rating: 8.6, studio: "Bones",
    status: "COMPLETED", type: "TV", isFree: true, price: 0, trending: 60, episodes: eps(8),
  },
  {
    key: "dbz", slug: "dragon-ball-super", title: "Dragon Ball Super",
    description: "With peace restored, Goku settles into farming — until Beerus the Destroyer wakes up hungry. Gods, angels and multiverses expand the Saiyan legend beyond imagination. The franchise that taught the world what a power-up looks like.",
    genres: ["Action", "Adventure", "Shounen", "Comedy"], year: 2015, rating: 8.0, studio: "Toei Animation",
    status: "ONGOING", type: "TV", isFree: false, price: 90, trending: 58, episodes: eps(8),
  },
  {
    key: "bleach", slug: "bleach-tybw", title: "Bleach: Thousand-Year Blood War",
    description: "The Quincy army returns from the shadows to declare war on Soul Society. Ichigo's final arc erupts with the truth about his mother, his sword and the Soul King himself. Kubo's stylish paneling translated into jaw-dropping animation by Studio Pierrot's best team.",
    genres: ["Action", "Supernatural", "Adventure", "Shounen"], year: 2022, rating: 8.8, studio: "Studio Pierrot",
    status: "ONGOING", type: "TV", isFree: false, price: 150, trending: 56, episodes: eps(8),
  },
  {
    key: "abyss", slug: "made-in-abyss", title: "Made in Abyss",
    description: "The Abyss: a colossal pit swallowing the world's secrets, layered with a curse that mutates all who ascend. Orphan Riko descends to find her mother, guided by a robot boy named Reg. Cuteness and cosmic horror in the same frame — adventure anime's most beautiful nightmare.",
    genres: ["Adventure", "Fantasy", "Mystery", "Drama"], year: 2017, rating: 8.7, studio: "Kinema Citrus",
    status: "ONGOING", type: "TV", isFree: true, price: 0, trending: 54, episodes: eps(8),
  },
];

const AVATARS = [...(urls.avatar1 || []), ...(urls.avatar2 || [])];
const BANNERS = [
  ...(urls["banner-scenic1"] || []),
  ...(urls["banner-scenic2"] || []),
  ...(urls["banner-scenic3"] || []),
];

const ACCENTS = ["#a855f7", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#8b5cf6", "#f43f5e"];

const USERS = [
  {
    username: "sakura_dev", displayName: "Sakura", email: "sakura@aniverse.test", role: "CREATOR",
    bio: "Anime connoisseur & DubAniX creator. I publish the classics. 10+ years of watching, still crying at Your Name.",
    credits: 5000, avatarIdx: 0, bannerIdx: 0, accent: ACCENTS[0],
  },
  {
    username: "ryujii", displayName: "Ryujii", email: "ryujii@aniverse.test", role: "VIEWER",
    bio: "Shounen supremacist. One Piece is a lifestyle, not a show. Catch me in watch parties.",
    credits: 2400, avatarIdx: 1, bannerIdx: 1, accent: ACCENTS[1],
  },
  {
    username: "mikasa_ack", displayName: "Mikasa", email: "mikasa@aniverse.test", role: "VIEWER",
    bio: "Attack on Titan changed my life. Edgerunners broke it. Anyway, I'm fine.",
    credits: 1200, avatarIdx: 2, bannerIdx: 2, accent: ACCENTS[2],
  },
  {
    username: "senpai_kot", displayName: "Kotaro", email: "kotaro@aniverse.test", role: "VIEWER",
    bio: "Slice of life enjoyer. If it doesn't have wholesome vibes, I don't watch it. Frieren forever.",
    credits: 800, avatarIdx: 3, bannerIdx: 3, accent: ACCENTS[3],
  },
  {
    username: "luna_chan", displayName: "Luna", email: "luna@aniverse.test", role: "VIEWER",
    bio: "Romance & drama specialist. Your Name apologist. I exchange animes like pokemon cards.",
    credits: 3100, avatarIdx: 4, bannerIdx: 4, accent: ACCENTS[4],
  },
  {
    username: "zenitsu_", displayName: "Zenitsu", email: "zenitsu@aniverse.test", role: "CREATOR",
    bio: "Creator by day, gamer by night. I publish hidden gems you've never heard of.",
    credits: 650, avatarIdx: 5, bannerIdx: 5, accent: ACCENTS[5],
  },
];

const POSTS = [
  { user: 0, content: "Just finished rewatching Frieren and I'm emotionally destroyed all over again. The episode where she visits Himmel's grave... I can't. 😭 Anyone else rewatch it this weekend?", animeSlug: "frieren-beyond-journeys-end" },
  { user: 1, content: "One Piece ep 1025 dropped and the animation was MOVIE QUALITY. Toei really said budget is no object. What did you all think of the fight choreography?", animeSlug: "one-piece" },
  { user: 2, content: "Started Cyberpunk Edgerunners because everyone kept telling me to. Episode 6 wrecked me so hard I had to pause. David deserved better. Everyone deserved better. 😭", animeSlug: "cyberpunk-edgerunners" },
  { user: 4, content: "Watch party tonight for Your Name? Grabbing everyone I know. Bring tissues. That's not a suggestion, it's a requirement. 🌠", animeSlug: "your-name" },
  { user: 3, content: "Hot take: Mob Psycho 100 has better animation than most movies. That fight in ep 11? Pure art. Bones went CRAZY.", animeSlug: "mob-psycho-100" },
  { user: 5, content: "New here! Just discovered DubAniX and the exchange system is genius. Traded my duplicate for something on my wishlist instantly. This community is awesome!", animeSlug: null },
  { user: 1, content: "Chainsaw Man opening went hard but the EDs were the real masterpiece. Each one a different vibe. MAPPA understood the assignment.", animeSlug: "chainsaw-man" },
  { user: 2, content: "Violet Evergarden ep 10 made me cry in front of my whole family. No regrets. 'I love you' will never hit the same again. ✉️", animeSlug: "violet-evergarden" },
];

async function main() {
  console.log("Clearing database...");
  await db.$transaction([
    db.comment.deleteMany(),
    db.postLike.deleteMany(),
    db.post.deleteMany(),
    db.exchangeProposal.deleteMany(),
    db.exchangeOffer.deleteMany(),
    db.creditTransaction.deleteMany(),
    db.watchProgress.deleteMany(),
    db.favoriteUser.deleteMany(),
    db.favoriteAnime.deleteMany(),
    db.purchase.deleteMany(),
    db.episode.deleteMany(),
    db.anime.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);

  console.log("Creating animes...");
  const animeMap = new Map<string, string>();
  for (const a of ANIMES) {
    const cover = pick(a.key, 0);
    const banner = pick(a.key, 1) || cover;
    const anime = await db.anime.create({
      data: {
        slug: a.slug,
        title: a.title,
        altTitle: a.altTitle || null,
        description: a.description,
        coverImage: cover,
        bannerImage: banner,
        genres: a.genres.join(","),
        year: a.year,
        rating: a.rating,
        studio: a.studio,
        status: a.status,
        type: a.type,
        isFree: a.isFree,
        price: a.price,
        trending: a.trending,
        featured: Boolean(a.featured),
      },
    });
    animeMap.set(a.slug, anime.id);

    let vi = 0;
    for (const [i, ep] of a.episodes.entries()) {
      await db.episode.create({
        data: {
          animeId: anime.id,
          number: i + 1,
          title: ep.title,
          description: ep.description,
          videoUrl: VIDEOS[vi % VIDEOS.length],
          duration: DURATIONS[vi % DURATIONS.length],
        },
      });
      vi++;
    }
  }
  console.log(`Created ${ANIMES.length} animes`);

  console.log("Creating users...");
  const userMap = new Map<string, string>();
  for (const [i, u] of USERS.entries()) {
    const user = await db.user.create({
      data: {
        email: u.email,
        username: u.username,
        password: hashPassword("password123"),
        displayName: u.displayName,
        role: u.role,
        avatarUrl: AVATARS[i % AVATARS.length] || null,
        bannerUrl: BANNERS[i % BANNERS.length] || null,
        bio: u.bio,
        accentColor: u.accent,
        credits: u.credits,
        onboardingDone: true,
      },
    });
    userMap.set(u.username, user.id);
    await db.creditTransaction.create({
      data: {
        userId: user.id,
        amount: u.credits,
        type: "TOPUP",
        description: "Initial balance",
      },
    });
  }
  console.log(`Created ${USERS.length} users (password: password123)`);

  // Purchases — give users collections (luna has 20+ for exchange demo)
  const purchasePlan: Array<[string, string[]]> = [
    ["sakura_dev", [
      "demon-slayer", "jujutsu-kaisen", "attack-on-titan", "frieren-beyond-journeys-end", "your-name",
      "one-piece", "chainsaw-man", "spy-x-family", "cyberpunk-edgerunners", "naruto-shippuden",
      "fullmetal-alchemist-brotherhood", "hunter-x-hunter", "tokyo-revengers",
      "my-hero-academia", "bleach-tybw", "steins-gate", "made-in-abyss", "dragon-ball-super", "spirited-away", "sword-art-online",
    ]],
    ["ryujii", ["one-piece", "naruto-shippuden", "dragon-ball-super", "my-hero-academia", "bleach-tybw", "chainsaw-man"]],
    ["mikasa_ack", ["attack-on-titan", "cyberpunk-edgerunners", "violet-evergarden", "jujutsu-kaisen", "tokyo-revengers", "spy-x-family"]],
    ["senpai_kot", ["frieren-beyond-journeys-end", "spy-x-family", "violet-evergarden", "mob-psycho-100", "your-name", "made-in-abyss"]],
    ["luna_chan", [
      "your-name", "demon-slayer", "jujutsu-kaisen", "frieren-beyond-journeys-end",
      "one-piece", "chainsaw-man", "spy-x-family", "cyberpunk-edgerunners", "violet-evergarden",
      "naruto-shippuden", "fullmetal-alchemist-brotherhood", "hunter-x-hunter", "tokyo-revengers",
      "my-hero-academia", "bleach-tybw", "steins-gate", "made-in-abyss", "dragon-ball-super", "spirited-away", "sword-art-online",
    ]],
    ["zenitsu_", ["demon-slayer", "made-in-abyss", "steins-gate"]],
  ];

  console.log("Creating purchases...");
  for (const [username, slugs] of purchasePlan) {
    const userId = userMap.get(username)!;
    const unique = [...new Set(slugs)];
    for (const slug of unique) {
      const anime = ANIMES.find((a) => a.slug === slug)!;
      await db.purchase.create({
        data: { userId, animeId: animeMap.get(slug)!, pricePaid: anime.price },
      });
      if (anime.price > 0) {
        await db.creditTransaction.create({
          data: { userId, amount: -anime.price, type: "PURCHASE", description: `Purchased "${anime.title}"` },
        });
      }
    }
  }

  // Favorites (anime)
  const favPlan: Array<[string, string[]]> = [
    ["sakura_dev", ["frieren-beyond-journeys-end", "your-name"]],
    ["ryujii", ["one-piece", "chainsaw-man", "naruto-shippuden"]],
    ["mikasa_ack", ["attack-on-titan", "cyberpunk-edgerunners"]],
    ["luna_chan", ["your-name", "violet-evergarden", "spy-x-family"]],
    ["senpai_kot", ["frieren-beyond-journeys-end", "mob-psycho-100"]],
  ];
  for (const [username, slugs] of favPlan) {
    const userId = userMap.get(username)!;
    for (const slug of slugs) {
      await db.favoriteAnime.create({ data: { userId, animeId: animeMap.get(slug)! } });
    }
  }

  // Favorite users
  const favUserPlan: Array<[string, string[]]> = [
    ["ryujii", ["sakura_dev", "mikasa_ack", "luna_chan"]],
    ["mikasa_ack", ["sakura_dev", "luna_chan"]],
    ["senpai_kot", ["sakura_dev", "luna_chan", "ryujii"]],
    ["luna_chan", ["sakura_dev", "mikasa_ack"]],
    ["zenitsu_", ["sakura_dev", "ryujii", "mikasa_ack", "luna_chan", "senpai_kot"]],
  ];
  for (const [follower, followings] of favUserPlan) {
    const followerId = userMap.get(follower)!;
    for (const f of followings) {
      await db.favoriteUser.create({
        data: { followerId, followingId: userMap.get(f)! },
      });
    }
  }

  // Watch progress (some in-progress)
  console.log("Creating watch progress...");
  const progressPlan: Array<[string, string, number, number]> = [
    // username, slug, episodeIdx, positionPct
    ["ryujii", "one-piece", 0, 0.4],
    ["ryujii", "one-piece", 1, 0.95],
    ["mikasa_ack", "attack-on-titan", 0, 0.25],
    ["mikasa_ack", "cyberpunk-edgerunners", 2, 0.6],
    ["senpai_kot", "frieren-beyond-journeys-end", 1, 0.5],
    ["luna_chan", "your-name", 0, 0.35],
    ["sakura_dev", "jujutsu-kaisen", 0, 0.8],
    ["zenitsu_", "demon-slayer", 2, 0.15],
  ];
  for (const [username, slug, epIdx, pct] of progressPlan) {
    const userId = userMap.get(username)!;
    const animeId = animeMap.get(slug)!;
    const episode = await db.episode.findFirst({
      where: { animeId, number: epIdx + 1 },
    });
    if (episode) {
      await db.watchProgress.create({
        data: {
          userId,
          episodeId: episode.id,
          animeId,
          position: Math.floor(episode.duration * pct),
          duration: episode.duration,
          completed: pct >= 0.95,
        },
      });
    }
  }

  // Community posts
  console.log("Creating community posts...");
  const posts = [];
  for (const p of POSTS) {
    const post = await db.post.create({
      data: {
        userId: userMap.get(USERS[p.user].username)!,
        content: p.content,
        animeId: p.animeSlug ? animeMap.get(p.animeSlug) : null,
      },
    });
    posts.push(post);
  }

  // Likes & comments
  const likePlan: Array<[number, string[]]> = [
    [0, ["ryujii", "mikasa_ack", "senpai_kot", "luna_chan", "zenitsu_"]],
    [1, ["sakura_dev", "mikasa_ack", "zenitsu_"]],
    [2, ["sakura_dev", "luna_chan", "senpai_kot", "zenitsu_"]],
    [3, ["mikasa_ack", "senpai_kot"]],
    [4, ["ryujii", "luna_chan", "sakura_dev", "zenitsu_"]],
    [5, ["sakura_dev", "ryujii", "mikasa_ack"]],
    [7, ["ryujii", "luna_chan", "sakura_dev", "senpai_kot", "zenitsu_"]],
  ];
  for (const [postIdx, usernames] of likePlan) {
    for (const un of usernames) {
      await db.postLike.create({
        data: { userId: userMap.get(un)!, postId: posts[postIdx].id },
      });
    }
  }

  const commentPlan: Array<[number, string, string]> = [
    [0, "ryujii", "Same here. That scene lives rent-free in my head."],
    [0, "luna_chan", "The grief hits different when you rewatch it knowing the ending."],
    [1, "mikasa_ack", "That Wano arc animation is unmatched, Toei cooked 🔥"],
    [2, "senpai_kot", "I'm scared to watch it now 😅"],
    [3, "zenitsu_", "Count me in! What time?"],
    [4, "sakura_dev", "Bones never misses, absolute wizards."],
    [5, "sakura_dev", "Welcome to DubAniX! Wait till you hit 20 purchases and unlock the exchange market."],
    [7, "mikasa_ack", "Ep 10 is peak fiction, I will not elaborate."],
  ];
  for (const [postIdx, username, content] of commentPlan) {
    await db.comment.create({
      data: { userId: userMap.get(username)!, postId: posts[postIdx].id, content },
    });
  }

  // Exchange offers (luna & sakura have 20 purchases so they can offer)
  console.log("Creating exchange offers...");
  await db.exchangeOffer.create({
    data: {
      userId: userMap.get("luna_chan")!,
      animeId: animeMap.get("jujutsu-kaisen")!,
      wantedNote: "Looking for Made in Abyss or anything wholesome. JJK rewatches complete!",
      status: "OPEN",
    },
  });
  await db.exchangeOffer.create({
    data: {
      userId: userMap.get("luna_chan")!,
      animeId: animeMap.get("dragon-ball-super")!,
      wantedNote: "Will take literally anything slice-of-life. DBS was not my thing.",
      status: "OPEN",
    },
  });
  const sakuraOffer = await db.exchangeOffer.create({
    data: {
      userId: userMap.get("sakura_dev")!,
      animeId: animeMap.get("attack-on-titan")!,
      wantedNote: "Open to offers — especially Frieren or Violet Evergarden.",
      status: "OPEN",
    },
  });
  // A pending proposal from luna on sakura's offer
  await db.exchangeProposal.create({
    data: {
      offerId: sakuraOffer.id,
      proposerId: userMap.get("luna_chan")!,
      animeId: animeMap.get("violet-evergarden")!,
      message: "Violet Evergarden for AoT? I heard you love emotional shows too!",
      status: "PENDING",
    },
  });

  console.log("Seed complete! ✅");
  console.log("Demo accounts: username / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
