/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.js

   SINGLE SOURCE OF TRUTH
   Routes + Tables + Buckets
   No secrets in this file.
========================= */

export const RB_CONFIG = Object.freeze({
  app: {
    name: "Rich Bizness Mobile",
    brand: "Rich Bizness LLC",
    version: "1.0.0",
    environment: "production",

    siteUrl: "https://rich-bizness-mobile-app.vercel.app",
    appUrl: "https://rich-bizness-mobile-app.vercel.app"
  },

  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey:
      "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8"
  },

  routes: {
    home: "/",
    auth: "/auth",
    feed: "/feed",
    watch: "/watch",
    live: "/live",
    music: "/music",
    gaming: "/gaming",
    sports: "/sports",
    gallery: "/gallery",
    upload: "/upload",
    store: "/store",
    meta: "/meta",
    messages: "/messages",
    notifications: "/notifications",
    profile: "/profile",
    edit: "/edit",
    settings: "/settings",

    games: {
      richChess: "/games/rich-chess",
      moneyRoadRunner: "/games/money-road-runner",
      smokeCityHustle: "/games/smoke-city-hustle",
      studioShowdown: "/games/studio-showdown"
    }
  },

  tables: {
    artistChannels: "artist_channels",

    artworkComments: "artwork_comments",
    artworkLikes: "artwork_likes",
    artworkPurchases: "artwork_purchases",
    artworks: "artworks",

    chessMatches: "chess_matches",
    chessMoves: "chess_moves",
    chessRankings: "chess_rankings",

    dmMessageReactions: "dm_message_reactions",
    dmMessages: "dm_messages",
    dmThreadMembers: "dm_thread_members",
    dmThreads: "dm_threads",

    feedComments: "feed_comments",
    feedLikes: "feed_likes",
    feedPosts: "feed_posts",
    feedReposts: "feed_reposts",

    gameChallenges: "game_challenges",
    gameClips: "game_clips",
    gameScores: "game_scores",
    gameSessions: "game_sessions",
    games: "games",

    liveChatMessages: "live_chat_messages",
    liveReactions: "live_reactions",
    liveStreamBans: "live_stream_bans",
    liveStreamPurchases: "live_stream_purchases",
    liveStreams: "live_streams",
    liveViewSessions: "live_view_sessions",

    metaAvatars: "meta_avatars",
    metaVisits: "meta_visits",
    metaWorlds: "meta_worlds",

    musicLikes: "music_likes",
    musicTracks: "music_tracks",

    notifications: "notifications",
    payoutRequests: "payout_requests",

    playlistTracks: "playlist_tracks",
    playlists: "playlists",

    podcastEpisodes: "podcast_episodes",
    podcastShows: "podcast_shows",

    products: "products",
    profiles: "profiles",

    radioStations: "radio_stations",

    sportsBrackets: "sports_brackets",
    sportsBroadcasts: "sports_broadcasts",
    sportsPicks: "sports_picks",
    sportsPosts: "sports_posts",
    sportsProfiles: "sports_profiles",

    storeOrders: "store_orders",
    storeSellerProfiles: "store_seller_profiles",

    uploads: "uploads",

    userProductUnlocks: "user_product_unlocks",
    userWallets: "user_wallets"
  },

  buckets: {
    metaWorlds: "meta-worlds",

    storeSellerMedia: "store-seller-media",
    storeDigital: "store-digital",
    storeProducts: "store-products",

    galleryMedia: "gallery-media",

    sportsCovers: "sports-covers",
    sportsClips: "sports-clips",
    sportsMedia: "sports-media",

    gameCovers: "game-covers",
    gameClips: "game-clips",
    gameAssets: "game-assets",

    liveRecordings: "live-recordings",
    liveThumbnails: "live-thumbnails",

    radioCovers: "radio-covers",

    podcastCovers: "podcast-covers",
    podcastAudio: "podcast-audio",

    musicCovers: "music-covers",
    musicAudio: "music-audio",

    generalUploads: "general-uploads",

    metaAvatars: "meta-avatars",
    profileBanners: "profile-banners",
    avatars: "avatars"
  },

  storage: {
    publicBuckets: [
      "avatars",
      "profile-banners",
      "meta-avatars",
      "general-uploads",
      "music-audio",
      "music-covers",
      "podcast-audio",
      "podcast-covers",
      "radio-covers",
      "live-thumbnails",
      "game-assets",
      "game-clips",
      "game-covers",
      "sports-media",
      "sports-clips",
      "sports-covers",
      "gallery-media",
      "store-products",
      "store-seller-media",
      "meta-worlds"
    ],

    privateBuckets: [
      "store-digital",
      "live-recordings"
    ]
  },

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-cinematic",
    homeStyle: "rotating-tv-screens-around-portal",
    brandMood:
      "luxury-futuristic-reality-changers"
  },

  motion: {
    mobileBreakpoint: 720,

    orbit: {
      desktopRadiusX: 210,
      desktopRadiusY: 120,

      mobileRadiusX: 145,
      mobileRadiusY: 92,

      rotationLerp: 0.055,
      pointerLerp: 0.04
    },

    portal: {
      floatAmount: 5,
      scalePulse: 0.012
    }
  }
});

export const RB_APP = RB_CONFIG.app;

export const RB_SUPABASE =
  RB_CONFIG.supabase;

export const RB_ROUTES =
  RB_CONFIG.routes;

export const RB_TABLES =
  RB_CONFIG.tables;

export const RB_BUCKETS =
  RB_CONFIG.buckets;

export const RB_STORAGE =
  RB_CONFIG.storage;

export const RB_VISUALS =
  RB_CONFIG.visuals;

export const RB_MOTION =
  RB_CONFIG.motion;

console.log("RB CONFIG LOCKED");
