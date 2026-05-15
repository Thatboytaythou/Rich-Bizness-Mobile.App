/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.js

   SINGLE SOURCE OF TRUTH
   No secrets in this file.
========================= */

export const RB_CONFIG = Object.freeze({
  app: {
    name: "Rich Bizness",
    version: "1.0.0",
    environment: "production",

    siteUrl: "https://rich-bizness-mobile-app.vercel.app",
    appUrl: "https://rich-bizness-mobile-app.vercel.app"
  },

  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey: "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8"
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
    profiles: "profiles",

    feedPosts: "feed_posts",
    feedLikes: "feed_likes",
    feedComments: "feed_comments",
    feedReposts: "feed_reposts",

    uploads: "uploads",

    musicTracks: "music_tracks",
    musicLikes: "music_likes",
    playlists: "playlists",
    playlistTracks: "playlist_tracks",
    artistChannels: "artist_channels",

    podcastShows: "podcast_shows",
    podcastEpisodes: "podcast_episodes",
    radioStations: "radio_stations",

    liveStreams: "live_streams",
    liveChatMessages: "live_chat_messages",
    liveViewSessions: "live_view_sessions",
    liveStreamPurchases: "live_stream_purchases",
    liveStreamBans: "live_stream_bans",
    liveReactions: "live_reactions",

    games: "games",
    gameSessions: "game_sessions",
    gameScores: "game_scores",
    gameClips: "game_clips",
    gameChallenges: "game_challenges",

    chessMatches: "chess_matches",
    chessMoves: "chess_moves",
    chessRankings: "chess_rankings",

    sportsProfiles: "sports_profiles",
    sportsPosts: "sports_posts",
    sportsPicks: "sports_picks",
    sportsBrackets: "sports_brackets",
    sportsBroadcasts: "sports_broadcasts",

    artworks: "artworks",
    artworkLikes: "artwork_likes",
    artworkComments: "artwork_comments",
    artworkPurchases: "artwork_purchases",

    products: "products",
    storeOrders: "store_orders",
    userProductUnlocks: "user_product_unlocks",
    storeSellerProfiles: "store_seller_profiles",

    metaAvatars: "meta_avatars",
    metaWorlds: "meta_worlds",
    metaVisits: "meta_visits",

    dmThreads: "dm_threads",
    dmThreadMembers: "dm_thread_members",
    dmMessages: "dm_messages",
    dmMessageReactions: "dm_message_reactions",

    notifications: "notifications",

    userWallets: "user_wallets",
    payoutRequests: "payout_requests"
  },

  buckets: {
    avatars: "avatars",
    profileBanners: "profile-banners",
    metaAvatars: "meta-avatars",

    generalUploads: "general-uploads",

    musicAudio: "music-audio",
    musicCovers: "music-covers",

    podcastAudio: "podcast-audio",
    podcastCovers: "podcast-covers",
    radioCovers: "radio-covers",

    liveThumbnails: "live-thumbnails",
    liveRecordings: "live-recordings",

    gameAssets: "game-assets",
    gameClips: "game-clips",
    gameCovers: "game-covers",

    sportsMedia: "sports-media",
    sportsClips: "sports-clips",
    sportsCovers: "sports-covers",

    galleryMedia: "gallery-media",

    storeProducts: "store-products",
    storeDigital: "store-digital",
    storeSellerMedia: "store-seller-media",

    metaWorlds: "meta-worlds"
  },

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-4d-cinematic",
    homeStyle: "rotating-tv-screens-around-portal",
    brandMood: "luxury-futuristic-reality-changers"
  }
});

export const RB_TABLES = RB_CONFIG.tables;
export const RB_BUCKETS = RB_CONFIG.buckets;
export const RB_ROUTES = RB_CONFIG.routes;
export const RB_SUPABASE = RB_CONFIG.supabase;
