/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.js

   SINGLE SOURCE OF TRUTH
   Routes + Tables + Buckets
   Motion + Visual System
   No secrets in this file.
========================= */

const RB_CONFIG = Object.freeze({
  /* =========================
     APP
  ========================= */
  app: {
    name: "Rich Bizness Mobile",
    brand: "Rich Bizness LLC",

    version: "1.0.0",
    environment: "production",

    siteUrl: "https://rich-bizness-mobile-app.vercel.app",
    appUrl: "https://rich-bizness-mobile-app.vercel.app",

    build: {
      platform: "web-mobile",
      engine: "universe-preview",
      renderer: "threejs",
    },
  },

  /* =========================
     SUPABASE
  ========================= */
  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",

    url: "https://xfsrqomsiulswbalgknx.supabase.co",

    publishableKey:
      "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8",
  },

  /* =========================
     LIVEKIT
  ========================= */
  livekit: {
    url: "wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud",
  },

  /* =========================
     HOME UNIVERSE MODULES
  ========================= */
  modules: [
    {
      key: "feed",
      label: "FEED",
      icon: "🔥",
      route: "/feed",
      color: "#00ffae",
    },

    {
      key: "live",
      label: "LIVE",
      icon: "📡",
      route: "/live",
      color: "#00ffcc",
    },

    {
      key: "music",
      label: "MUSIC",
      icon: "🎵",
      route: "/music",
      color: "#ffe066",
    },

    {
      key: "gaming",
      label: "GAMING",
      icon: "🎮",
      route: "/gaming",
      color: "#7c5cff",
    },

    {
      key: "sports",
      label: "SPORTS",
      icon: "🏆",
      route: "/sports",
      color: "#00c2ff",
    },

    {
      key: "gallery",
      label: "GALLERY",
      icon: "🖼️",
      route: "/gallery",
      color: "#ff9f43",
    },

    {
      key: "upload",
      label: "UPLOAD",
      icon: "⬆️",
      route: "/upload",
      color: "#00ffaa",
    },

    {
      key: "store",
      label: "STORE",
      icon: "🛒",
      route: "/store",
      color: "#ffd700",
    },

    {
      key: "meta",
      label: "META",
      icon: "🌌",
      route: "/meta",
      color: "#9d4dff",
    },
  ],

  /* =========================
     ROUTES
  ========================= */
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
      studioShowdown: "/games/studio-showdown",
    },
  },

  /* =========================
     DATABASE TABLES
  ========================= */
  tables: {
    /* ADMIN */
    adminAuditLogs: "admin_audit_logs",
    adminRoles: "admin_roles",

    /* API / SYSTEM */
    apiJobs: "api_jobs",
    apiRequestLogs: "api_request_logs",
    apiWebhookEvents: "api_webhook_events",

    featureFlags: "feature_flags",
    storageBucketRoutes: "storage_bucket_routes",
    stripeSyncEvents: "stripe_sync_events",

    systemHealthChecks: "system_health_checks",
    trustEvents: "trust_events",

    /* IDENTITY / PROFILE */
    profiles: "profiles",
    profileThemeSettings: "profile_theme_settings",

    pushDevices: "push_devices",
    userSettings: "user_settings",
    userSessions: "user_sessions",

    /* SOCIAL / FEED */
    feedPosts: "feed_posts",
    feedComments: "feed_comments",

    feedPostLikes: "feed_post_likes",
    feedPostViews: "feed_post_views",

    followers: "followers",

    /* MESSAGES */
    dmThreads: "dm_threads",
    dmThreadMembers: "dm_thread_members",

    dmMessages: "dm_messages",
    dmMessageAttachments: "dm_message_attachments",

    dmMessageReactions: "dm_message_reactions",
    dmMessageReads: "dm_message_reads",

    dmTypingStatus: "dm_typing_status",

    dmCallSessions: "dm_call_sessions",
    dmCallParticipants: "dm_call_participants",

    /* LIVE */
    liveStreams: "live_streams",
    liveStreamMembers: "live_stream_members",

    liveStreamPurchases: "live_stream_purchases",
    liveStreamBans: "live_stream_bans",

    liveStreamCards: "live_stream_cards",

    liveChatMessages: "live_chat_messages",

    liveReactions: "live_reactions",
    liveTips: "live_tips",

    liveViewSessions: "live_view_sessions",

    livekitRoomEvents: "livekit_room_events",

    liveAlertSubscriptions: "live_alert_subscriptions",

    vipLiveAccess: "vip_live_access",

    /* MUSIC / PODCAST / RADIO */
    musicTracks: "music_tracks",
    musicComments: "music_comments",

    musicLikes: "music_likes",
    musicPlayEvents: "music_play_events",

    playlists: "playlists",
    playlistTracks: "playlist_tracks",

    podcastShows: "podcast_shows",
    podcastEpisodes: "podcast_episodes",

    podcastComments: "podcast_comments",
    podcastLikes: "podcast_likes",

    radioStations: "radio_stations",
    radioLikes: "radio_likes",
    radioSessions: "radio_sessions",

    /* GAMING */
    games: "games",
    gamerProfiles: "gamer_profiles",

    gameCategories: "game_categories",
    gameChallenges: "game_challenges",

    gameClips: "game_clips",
    gameComments: "game_comments",
    gameLikes: "game_likes",

    gamePlatformAccounts: "game_platform_accounts",

    gameRewards: "game_rewards",

    gameScores: "game_scores",
    gameSessions: "game_sessions",

    gameStreamLinks: "game_stream_links",

    gameTournaments: "game_tournaments",
    tournamentPlayers: "tournament_players",

    gameAlertSubscriptions: "game_alert_subscriptions",

    /* SPORTS */
    sportsProfiles: "sports_profiles",
    sportsPosts: "sports_posts",

    sportsUploads: "sports_uploads",

    sportsPicks: "sports_picks",
    sportsPickResults: "sports_pick_results",

    sportsBrackets: "sports_brackets",
    sportsBroadcasts: "sports_broadcasts",

    sportsComments: "sports_comments",
    sportsReactions: "sports_reactions",

    sportsLeagues: "sports_leagues",
    sportsTeams: "sports_teams",

    sportsAlertSubscriptions: "sports_alert_subscriptions",

    /* META */
    metaAvatars: "meta_avatars",
    metaWorlds: "meta_worlds",

    metaWorldLikes: "meta_world_likes",

    metaRooms: "meta_rooms",
    metaRoomMembers: "meta_room_members",

    metaChatMessages: "meta_chat_messages",

    metaInventory: "meta_inventory",
    metaItems: "meta_items",

    metaPortals: "meta_portals",

    metaStreamLinks: "meta_stream_links",
    metaVisits: "meta_visits",

    /* STORE */
    products: "products",

    productLikes: "product_likes",
    productViews: "product_views",

    storeCartItems: "store_cart_items",

    storeComments: "store_comments",
    storeNotifications: "store_notifications",

    storeOrders: "store_orders",

    storeSellerProfiles: "store_seller_profiles",

    userProductUnlocks: "user_product_unlocks",

    /* CREATOR / MONEY */
    creatorAvailableBalances:
      "creator_available_balances",

    creatorAlertSubscriptions:
      "creator_alert_subscriptions",

    creatorPageSettings:
      "creator_page_settings",

    /* NOTIFICATIONS */
    notifications: "rich_notifications",
    richNotifications: "rich_notifications",

    notificationGroups: "notification_groups",
    notificationReads: "notification_reads",

    /* UPLOADS / MODERATION */
    uploads: "uploads",

    uploadProcessingQueue:
      "upload_processing_queue",

    contentReviewQueue:
      "content_review_queue",

    moderationReports: "moderation_reports",

    /* THEMES / VISUALS */
    backgroundPresets: "background_presets",
    layoutPresets: "layout_presets",

    sectionThemeSettings:
      "section_theme_settings",

    /* XP / LEVELS */
    badges: "badges",
    userBadges: "user_badges",

    userCustomScreens:
      "user_custom_screens",

    userLevels: "user_levels",

    userXpLedger: "user_xp_ledger",
    xpEvents: "xp_events",

    rankRules: "rank_rules",

    /* ANALYTICS */
    platformAnalyticsEvents:
      "platform_analytics_events",

    platformAnnouncements:
      "platform_announcements",
  },

  /* =========================
     STORAGE BUCKETS
  ========================= */
  buckets: {
    avatars: "avatars",
    profileBanners: "profile-banners",

    metaAvatars: "meta-avatars",
    metaWorlds: "meta-worlds",

    generalUploads: "general-uploads",
    galleryMedia: "gallery-media",

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

    storeProducts: "store-products",
    storeSellerMedia: "store-seller-media",
    storeDigital: "store-digital",
  },

  /* =========================
     STORAGE ACCESS
  ========================= */
  storage: {
    publicBuckets: [
      "avatars",
      "profile-banners",

      "meta-avatars",
      "meta-worlds",

      "general-uploads",
      "gallery-media",

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

      "store-products",
      "store-seller-media",
    ],

    privateBuckets: [
      "store-digital",
      "live-recordings",
    ],
  },

  /* =========================
     VISUAL SYSTEM
  ========================= */
  visuals: {
    theme: "black-green-gold",

    mode: "ultra-hd-cinematic",

    homeStyle:
      "rotating-tv-screens-around-portal",

    brandMood:
      "luxury-futuristic-reality-changers",

    smokeCloud: true,
    cinemaMode: true,

    tvReady: true,
    depth3D: true,

    neonBloom: true,
    motionBlur: true,

    holographicGlow: true,
  },

  /* =========================
     MOTION SYSTEM
  ========================= */
  motion: {
    mobileBreakpoint: 720,

    orbit: {
      desktopRadiusX: 210,
      desktopRadiusY: 120,

      mobileRadiusX: 145,
      mobileRadiusY: 92,

      rotationLerp: 0.055,
      pointerLerp: 0.04,

      speed: 0.00055,
    },

    portal: {
      floatAmount: 5,
      scalePulse: 0.012,

      glowStrength: 1.2,
    },

    camera: {
      depth: 900,
      tilt: 0.12,
    },
  },
});

/* =========================
   EXPORTS
========================= */

export default RB_CONFIG;

export const RB_APP = RB_CONFIG.app;

export const RB_SUPABASE =
  RB_CONFIG.supabase;

export const RB_LIVEKIT =
  RB_CONFIG.livekit;

export const RB_MODULES =
  RB_CONFIG.modules;

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

/* =========================
   DEV LOCK
========================= */

console.log(
  "%cRB CONFIG LOCKED",
  `
    color: #00ffae;
    font-weight: bold;
    font-size: 14px;
  `
);
