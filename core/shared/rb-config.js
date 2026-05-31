/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.js

   SINGLE SOURCE OF TRUTH
   Routes + Tables + Buckets
   Motion + Visual System
   Profile Lock + Secret Worlds
   No secrets in this file.
========================= */

const RB_CONFIG = Object.freeze({
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
      mode: "cinematic",
    },
  },

  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey: "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8",
  },

  livekit: {
    url: "wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud",
  },

  auth: {
    provider: "supabase",
    sessionStorageKey: "rich-bizness-mobile-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },

  system: {
    schemas: {
      public: "public",
      auth: "auth",
      storage: "storage",
      realtime: "realtime",
    },

    auth: {
      users: "auth.users",
      sessions: "auth.sessions",
      identities: "auth.identities",
      refreshTokens: "auth.refresh_tokens",
    },

    storage: {
      buckets: "storage.buckets",
      objects: "storage.objects",
    },

    realtime: {
      messages: "realtime.messages",
      subscriptions: "realtime.subscription",
    },
  },

  brandAssets: {
    heroBanner: "/images/brand/hero-banner.png",
    avatarHeroBanner: "/images/brand/Avatar-hero-Banner.png.jpeg",
    defaultProfileBanner: "/images/brand/hero-banner.png",
    defaultAvatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
    tabIconImage: "/images/brand/hero-banner.png",
  },

  modules: [
    { key: "feed", label: "FEED", icon: "🔥", route: "/feed", color: "#00ffae" },
    { key: "watch", label: "WATCH", icon: "📺", route: "/watch", color: "#00ffd5" },
    { key: "live", label: "LIVE", icon: "📡", route: "/live", color: "#00ffcc" },
    { key: "music", label: "MUSIC", icon: "🎵", route: "/music", color: "#ffe066" },
    { key: "podcast", label: "PODCAST", icon: "🎙️", route: "/podcast", color: "#ffb347" },
    { key: "radio", label: "RADIO", icon: "📻", route: "/radio", color: "#7ad7ff" },
    { key: "gaming", label: "GAMING", icon: "🎮", route: "/gaming", color: "#7c5cff" },
    { key: "sports", label: "SPORTS", icon: "🏆", route: "/sports", color: "#00c2ff" },
    { key: "gallery", label: "GALLERY", icon: "🖼️", route: "/gallery", color: "#ff9f43" },
    { key: "store", label: "STORE", icon: "🛒", route: "/store", color: "#ffd700" },
    { key: "meta", label: "META", icon: "🌌", route: "/meta", color: "#9d4dff" },
    { key: "messages", label: "DM", icon: "💬", route: "/messages", color: "#00ffaa" },
    { key: "notifications", label: "ALERTS", icon: "🔔", route: "/notifications", color: "#00ff95" },
    { key: "upload", label: "UPLOAD", icon: "⬆️", route: "/upload", color: "#00ffaa" },
    { key: "profile", label: "PROFILE", icon: "👑", route: "/profile", color: "#ffe066" },
    { key: "secretDoor", label: "SECRET DOOR", icon: "/images/brand/hero-banner.png", route: "/rb-secret-door", color: "#00ffae" },
    { key: "secretMeta2", label: "SECRET META 2", icon: "/images/brand/hero-banner.png", route: "/rb-secret-meta2", color: "#00ffaa" },
    { key: "secretMeta3", label: "SECRET META 3", icon: "/images/brand/hero-banner.png", route: "/rb-secret-meta3", color: "#ffe066" },
  ],

  routes: {
    home: "/",
    auth: "/auth",
    feed: "/feed",
    watch: "/watch",
    live: "/live",
    music: "/music",
    podcast: "/podcast",
    radio: "/radio",
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
    creator: "/creator",
    admin: "/admin",
    search: "/search",
    secretDoor: "/rb-secret-door",
    secretMeta2: "/rb-secret-meta2",
    secretMeta3: "/rb-secret-meta3",

    games: {
      richChess: "/games/rich-chess",
      moneyRoadRunner: "/games/money-road-runner",
      smokeCityHustle: "/games/smoke-city-hustle",
      studioShowdown: "/games/studio-showdown",
    },
  },

  tables: {
    adminAuditLogs: "admin_audit_logs",
    adminRoles: "admin_roles",
    apiJobs: "api_jobs",
    apiRequestLogs: "api_request_logs",
    apiWebhookEvents: "api_webhook_events",
    featureFlags: "feature_flags",
    storageBucketRoutes: "storage_bucket_routes",
    stripeSyncEvents: "stripe_sync_events",
    systemHealthChecks: "system_health_checks",
    trustEvents: "trust_events",

    profiles: "profiles",
    profileThemeSettings: "profile_theme_settings",
    pushDevices: "push_devices",
    userSettings: "user_settings",
    userSessions: "user_sessions",

    feedPosts: "feed_posts",
    feedComments: "feed_comments",
    feedPostLikes: "feed_post_likes",
    feedPostViews: "feed_post_views",
    followers: "followers",

    dmThreads: "dm_threads",
    dmThreadMembers: "dm_thread_members",
    dmMessages: "dm_messages",
    dmMessageAttachments: "dm_message_attachments",
    dmMessageReactions: "dm_message_reactions",
    dmMessageReads: "dm_message_reads",
    dmTypingStatus: "dm_typing_status",
    dmCallSessions: "dm_call_sessions",
    dmCallParticipants: "dm_call_participants",

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

    products: "products",
    productLikes: "product_likes",
    productViews: "product_views",
    storeCartItems: "store_cart_items",
    storeComments: "store_comments",
    storeNotifications: "store_notifications",
    storeOrders: "store_orders",
    storeSellerProfiles: "store_seller_profiles",
    userProductUnlocks: "user_product_unlocks",

    creatorAvailableBalances: "creator_available_balances",
    creatorAlertSubscriptions: "creator_alert_subscriptions",
    creatorPageSettings: "creator_page_settings",

    notifications: "rich_notifications",
    richNotifications: "rich_notifications",
    notificationGroups: "notification_groups",
    notificationReads: "notification_reads",

    uploads: "uploads",
    uploadProcessingQueue: "upload_processing_queue",
    contentReviewQueue: "content_review_queue",
    moderationReports: "moderation_reports",

    backgroundPresets: "background_presets",
    layoutPresets: "layout_presets",
    sectionThemeSettings: "section_theme_settings",

    badges: "badges",
    userBadges: "user_badges",
    userCustomScreens: "user_custom_screens",
    userLevels: "user_levels",
    userXpLedger: "user_xp_ledger",
    xpEvents: "xp_events",
    rankRules: "rank_rules",

    platformAnalyticsEvents: "platform_analytics_events",
    platformAnnouncements: "platform_announcements",
  },

  profileKeys: {
    identitySource: "profiles",

    requiredProfileTables: [
      "profiles",
      "user_settings",
      "user_levels",
      "profile_theme_settings",
      "meta_avatars",
      "gamer_profiles",
      "sports_profiles",
      "store_seller_profiles",
      "creator_page_settings",
    ],

    controlledRoutes: [
      "feed",
      "watch",
      "live",
      "music",
      "podcast",
      "radio",
      "gaming",
      "sports",
      "gallery",
      "store",
      "meta",
      "messages",
      "notifications",
      "upload",
      "profile",
      "edit",
      "settings",
      "creator",
      "admin",
      "secretDoor",
      "secretMeta2",
      "secretMeta3",
    ],

    adminCreatorRoutes: [
      "creator",
      "admin",
      "secretDoor",
      "secretMeta2",
      "secretMeta3",
    ],

    secretRoutes: {
      secretDoor: "/rb-secret-door",
      secretMeta2: "/rb-secret-meta2",
      secretMeta3: "/rb-secret-meta3",
    },
  },

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

  uploadRoutes: {
    profileAvatar: {
      bucket: "avatars",
      table: "profiles",
      column: "avatar_url",
    },

    profileBanner: {
      bucket: "profile-banners",
      table: "profiles",
      column: "banner_url",
    },

    metaAvatar: {
      bucket: "meta-avatars",
      table: "meta_avatars",
      column: "avatar_url",
    },

    metaWorld: {
      bucket: "meta-worlds",
      table: "meta_worlds",
      column: "cover_url",
    },

    generalUpload: {
      bucket: "general-uploads",
      table: "uploads",
      column: "public_url",
    },

    feedPost: {
      bucket: "general-uploads",
      table: "feed_posts",
      column: "media_url",
    },

    galleryMedia: {
      bucket: "gallery-media",
      table: "uploads",
      column: "public_url",
    },

    musicTrack: {
      bucket: "music-audio",
      table: "music_tracks",
      column: "audio_url",
    },

    musicCover: {
      bucket: "music-covers",
      table: "music_tracks",
      column: "cover_url",
    },

    podcastAudio: {
      bucket: "podcast-audio",
      table: "podcast_episodes",
      column: "audio_url",
    },

    podcastCover: {
      bucket: "podcast-covers",
      table: "podcast_episodes",
      column: "cover_url",
    },

    radioCover: {
      bucket: "radio-covers",
      table: "radio_stations",
      column: "cover_url",
    },

    liveThumbnail: {
      bucket: "live-thumbnails",
      table: "live_streams",
      column: "thumbnail_url",
    },

    liveRecording: {
      bucket: "live-recordings",
      table: "live_streams",
      column: "recording_url",
    },

    gameAsset: {
      bucket: "game-assets",
      table: "games",
      column: "play_url",
    },

    gameClip: {
      bucket: "game-clips",
      table: "game_clips",
      column: "clip_url",
    },

    gameCover: {
      bucket: "game-covers",
      table: "games",
      column: "cover_url",
    },

    sportsMedia: {
      bucket: "sports-media",
      table: "sports_uploads",
      column: "file_url",
    },

    sportsClip: {
      bucket: "sports-clips",
      table: "sports_uploads",
      column: "file_url",
    },

    sportsCover: {
      bucket: "sports-covers",
      table: "sports_posts",
      column: "cover_url",
    },

    storeProduct: {
      bucket: "store-products",
      table: "products",
      column: "image_url",
    },

    storeSellerMedia: {
      bucket: "store-seller-media",
      table: "store_seller_profiles",
      column: "banner_url",
    },

    storeDigital: {
      bucket: "store-digital",
      table: "products",
      column: "digital_file_url",
    },
  },

  realtime: {
    enabled: true,

    tables: [
      "profiles",
      "feed_posts",
      "feed_comments",
      "feed_post_likes",
      "dm_threads",
      "dm_thread_members",
      "dm_messages",
      "dm_message_reactions",
      "live_streams",
      "live_stream_members",
      "live_chat_messages",
      "live_reactions",
      "live_tips",
      "live_view_sessions",
      "music_tracks",
      "music_comments",
      "music_likes",
      "podcast_episodes",
      "radio_stations",
      "game_scores",
      "game_clips",
      "game_sessions",
      "sports_posts",
      "sports_uploads",
      "sports_picks",
      "sports_broadcasts",
      "products",
      "store_orders",
      "rich_notifications",
      "uploads",
      "meta_avatars",
      "meta_worlds",
      "meta_rooms",
      "meta_chat_messages",
    ],
  },

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-cinematic",
    homeStyle: "rotating-tv-screens-around-portal",
    brandMood: "luxury-futuristic-reality-changers",
    tabIconImage: "/images/brand/hero-banner.png",

    heroBanner: "/images/brand/hero-banner.png",
    avatarHeroBanner: "/images/brand/Avatar-hero-Banner.png.jpeg",
    defaultProfileBanner: "/images/brand/hero-banner.png",
    defaultAvatar: "/images/brand/Avatar-hero-Banner.png.jpeg",

    smokeCloud: true,
    cinemaMode: true,
    tvReady: true,
    depth3D: true,
    neonBloom: true,
    motionBlur: true,
    holographicGlow: true,
    portalFX: true,
    glassFX: true,
    galaxyBackground: true,
  },

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
      rotationSpeed: 0.0008,
    },

    camera: {
      depth: 900,
      tilt: 0.12,
    },

    transitions: {
      routeFade: 260,
      modalFade: 180,
      panelSlide: 240,
    },
  },
});

export default RB_CONFIG;

export const RB_APP = RB_CONFIG.app;
export const RB_SUPABASE = RB_CONFIG.supabase;
export const RB_LIVEKIT = RB_CONFIG.livekit;
export const RB_AUTH = RB_CONFIG.auth;
export const RB_SYSTEM = RB_CONFIG.system;
export const RB_BRAND_ASSETS = RB_CONFIG.brandAssets;
export const RB_MODULES = RB_CONFIG.modules;
export const RB_ROUTES = RB_CONFIG.routes;
export const RB_TABLES = RB_CONFIG.tables;
export const RB_PROFILE_KEYS = RB_CONFIG.profileKeys;
export const RB_BUCKETS = RB_CONFIG.buckets;
export const RB_STORAGE = RB_CONFIG.storage;
export const RB_UPLOAD_ROUTES = RB_CONFIG.uploadRoutes;
export const RB_REALTIME = RB_CONFIG.realtime;
export const RB_VISUALS = RB_CONFIG.visuals;
export const RB_MOTION = RB_CONFIG.motion;

console.log(
  "%cRB CONFIG LOCKED",
  `
    color: #00ffae;
    font-weight: bold;
    font-size: 14px;
    text-shadow: 0 0 12px #00ffae;
  `
);
