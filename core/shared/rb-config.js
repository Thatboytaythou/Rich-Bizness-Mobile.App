/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.js

   SINGLE SOURCE OF TRUTH

   Routes + Tables + Buckets
   Portal City + Avatar + XP + Store Flow
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
      engine: "world-engine",
      renderer: "css-3d-webgl-ready",
      mode: "portal-city-home"
    }
  },

  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey: "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8"
  },

  livekit: {
    url: "wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud"
  },

  auth: {
    provider: "supabase",
    sessionStorageKey: "rich-bizness-mobile-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",

    avatarCreation: {
      enabled: true,
      routeAfterAuth: "/profile",
      fallbackRoute: "/",
      createsProfile: true,
      createsMetaAvatar: true,
      starterLevel: 1,
      starterXp: 0
    }
  },

  brandAssets: {
    heroBanner: "/images/brand/hero-banner.png",
    defaultProfileBanner: "/images/brand/hero-banner.png",

    defaultProfileAvatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
    defaultMetaAvatar: "/images/brand/meta-avatar.png.jpeg",

    avatarHeroBanner: "/images/brand/Avatar-hero-Banner.png.jpeg",
    metaLogo: "/images/brand/meta-verse-elite.png.jpeg",

    tabIconImage: "/images/brand/hero-banner.png"
  },

  universe: {
    home: {
      key: "index",
      label: "Rich Bizness Universe",
      route: "/",
      visualMode: "portal-city",
      avatarOnPortal: true,
      xpVisible: true,
      liveVisible: true,
      onlineVisible: true,
      storeCheckoutLinked: true
    },

    identityFlow: {
      authCreatesAvatar: true,
      profileUpgradesAvatar: true,
      indexShowsAvatar: true,
      metaUsesAvatar: true
    },

    metaUnlocks: {
      enabled: true,
      primaryRoute: "/meta",
      secretDoor: "/rb-secret-door",
      secretMeta2: "/rb-secret-meta2",
      secretMeta3: "/rb-secret-meta3",
      unlockBy: ["profile", "creator", "admin", "xp"]
    },

    xp: {
      enabled: true,
      maxStarterGoalLevel: 999,
      levelStep: 1000,
      ledgerTable: "user_xp_ledger",
      eventsTable: "xp_events",
      levelsTable: "user_levels",
      rankRulesTable: "rank_rules",
      defaultRank: "Biz Legend"
    },

    commerce: {
      storeOwnsCheckout: true,
      checkoutRoute: "/store",
      cartRoute: "/store",
      sellableSections: [
        "music",
        "podcast",
        "gallery",
        "gaming",
        "sports",
        "live",
        "meta",
        "store"
      ]
    }
  },

  modules: [
    {
      key: "feed",
      label: "FEED",
      district: "Feed Plaza",
      icon: "🔥",
      route: "/feed",
      color: "#00ffae",
      xpAction: "feed_visit"
    },
    {
      key: "watch",
      label: "WATCH",
      district: "Watch Tower",
      icon: "📺",
      route: "/watch",
      color: "#00ffd5",
      xpAction: "watch_visit",
      protected: true
    },
    {
      key: "live",
      label: "LIVE",
      district: "Live Universe",
      icon: "📡",
      route: "/live",
      color: "#00ffcc",
      xpAction: "live_visit",
      protected: true
    },
    {
      key: "music",
      label: "MUSIC",
      district: "Music District",
      icon: "🎵",
      route: "/music",
      color: "#ffe066",
      xpAction: "music_visit",
      storeLinked: true
    },
    {
      key: "podcast",
      label: "PODCAST",
      district: "Podcast Arena",
      icon: "🎙️",
      route: "/podcast",
      color: "#ffb347",
      xpAction: "podcast_visit",
      storeLinked: true
    },
    {
      key: "radio",
      label: "RADIO",
      district: "RB Radio",
      icon: "📻",
      route: "/radio",
      color: "#7ad7ff",
      xpAction: "radio_visit"
    },
    {
      key: "gaming",
      label: "GAMING",
      district: "Gaming Zone",
      icon: "🎮",
      route: "/gaming",
      color: "#7c5cff",
      xpAction: "gaming_visit",
      storeLinked: true
    },
    {
      key: "sports",
      label: "SPORTS",
      district: "Sports Arena",
      icon: "🏆",
      route: "/sports",
      color: "#00c2ff",
      xpAction: "sports_visit",
      storeLinked: true
    },
    {
      key: "gallery",
      label: "GALLERY",
      district: "Gallery District",
      icon: "🖼️",
      route: "/gallery",
      color: "#ff9f43",
      xpAction: "gallery_visit",
      storeLinked: true
    },
    {
      key: "store",
      label: "STORE",
      district: "Store Market",
      icon: "🛒",
      route: "/store",
      color: "#ffd700",
      xpAction: "store_visit",
      checkoutOwner: true
    },
    {
      key: "upload",
      label: "UPLOAD",
      district: "Upload Zone",
      icon: "⬆️",
      route: "/upload",
      color: "#00ffaa",
      xpAction: "upload_visit"
    },
    {
      key: "meta",
      label: "META",
      district: "Meta World",
      icon: "🌌",
      route: "/meta",
      color: "#9d4dff",
      xpAction: "meta_visit",
      secretLinked: true
    },
    {
      key: "avatar",
      label: "AVATAR",
      district: "Avatar HQ",
      icon: "🧍",
      route: "/avatar",
      color: "#00ffae",
      xpAction: "avatar_visit"
    }
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

    avatar: "/avatar",
    messages: "/messages",
    notifications: "/notifications",

    profile: "/profile",
    edit: "/edit",
    settings: "/settings",

    creator: "/creator",
    admin: "/admin",

    search: "/feed",
    monetization: "/store",
    xp: "/profile",

    secretDoor: "/rb-secret-door",
    secretMeta2: "/rb-secret-meta2",
    secretMeta3: "/rb-secret-meta3",

    games: {
      richChess: "/games/rich-chess",
      moneyRoadRunner: "/games/money-road-runner",
      smokeCityHustle: "/games/smoke-city-hustle",
      studioShowdown: "/games/studio-showdown"
    }
  },

  system: {
    schemas: {
      public: "public",
      auth: "auth",
      storage: "storage",
      realtime: "realtime"
    },

    auth: {
      users: "auth.users",
      sessions: "auth.sessions",
      identities: "auth.identities",
      refreshTokens: "auth.refresh_tokens"
    },

    storage: {
      buckets: "storage.buckets",
      objects: "storage.objects"
    },

    realtime: {
      messages: "realtime.messages",
      subscriptions: "realtime.subscription"
    }
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
    platformAnnouncements: "platform_announcements"
  },

  profileKeys: {
    identitySource: "profiles",
    avatarSource: "meta_avatars",
    playableAvatarSource: "avatar-engine",

    requiredProfileTables: [
      "profiles",
      "user_settings",
      "user_levels",
      "profile_theme_settings",
      "meta_avatars",
      "gamer_profiles",
      "sports_profiles",
      "store_seller_profiles",
      "creator_page_settings"
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
      "avatar",
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
      "secretMeta3"
    ],

    adminCreatorRoutes: [
      "creator",
      "admin",
      "secretDoor",
      "secretMeta2",
      "secretMeta3"
    ],

    secretRoutes: {
      secretDoor: "/rb-secret-door",
      secretMeta2: "/rb-secret-meta2",
      secretMeta3: "/rb-secret-meta3"
    }
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
    storeDigital: "store-digital"
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
      "store-seller-media"
    ],

    privateBuckets: [
      "store-digital",
      "live-recordings"
    ]
  },

  uploadRoutes: {
    profileAvatar: {
      bucket: "avatars",
      table: "profiles",
      column: "avatar_url",
      alsoUpdate: ["meta_avatars.avatar_url"]
    },

    profileBanner: {
      bucket: "profile-banners",
      table: "profiles",
      column: "banner_url"
    },

    metaAvatar: {
      bucket: "meta-avatars",
      table: "meta_avatars",
      column: "avatar_url"
    },

    metaWorld: {
      bucket: "meta-worlds",
      table: "meta_worlds",
      column: "cover_url",
      feedSection: "meta"
    },

    generalUpload: {
      bucket: "general-uploads",
      table: "uploads",
      column: "public_url",
      feedSection: "feed"
    },

    feedPost: {
      bucket: "general-uploads",
      table: "feed_posts",
      column: "media_url",
      feedSection: "feed"
    },

    galleryMedia: {
      bucket: "gallery-media",
      table: "uploads",
      column: "public_url",
      feedSection: "gallery",
      storeEligible: true
    },

    musicTrack: {
      bucket: "music-audio",
      table: "music_tracks",
      column: "audio_url",
      feedSection: "music",
      storeEligible: true
    },

    musicCover: {
      bucket: "music-covers",
      table: "music_tracks",
      column: "cover_url",
      feedSection: "music"
    },

    podcastAudio: {
      bucket: "podcast-audio",
      table: "podcast_episodes",
      column: "audio_url",
      feedSection: "podcast",
      storeEligible: true
    },

    podcastCover: {
      bucket: "podcast-covers",
      table: "podcast_episodes",
      column: "cover_url",
      feedSection: "podcast"
    },

    radioCover: {
      bucket: "radio-covers",
      table: "radio_stations",
      column: "cover_url"
    },

    liveThumbnail: {
      bucket: "live-thumbnails",
      table: "live_streams",
      column: "thumbnail_url",
      feedSection: "live"
    },

    liveRecording: {
      bucket: "live-recordings",
      table: "live_streams",
      column: "recording_url",
      feedSection: "live",
      storeEligible: true
    },

    gameAsset: {
      bucket: "game-assets",
      table: "games",
      column: "play_url",
      feedSection: "gaming",
      storeEligible: true
    },

    gameClip: {
      bucket: "game-clips",
      table: "game_clips",
      column: "clip_url",
      feedSection: "gaming"
    },

    gameCover: {
      bucket: "game-covers",
      table: "games",
      column: "cover_url",
      feedSection: "gaming"
    },

    sportsMedia: {
      bucket: "sports-media",
      table: "sports_uploads",
      column: "file_url",
      feedSection: "sports"
    },

    sportsClip: {
      bucket: "sports-clips",
      table: "sports_uploads",
      column: "file_url",
      feedSection: "sports"
    },

    sportsCover: {
      bucket: "sports-covers",
      table: "sports_posts",
      column: "cover_url",
      feedSection: "sports"
    },

    storeProduct: {
      bucket: "store-products",
      table: "products",
      column: "image_url",
      feedSection: "store",
      checkoutRoute: "/store"
    },

    storeSellerMedia: {
      bucket: "store-seller-media",
      table: "store_seller_profiles",
      column: "banner_url",
      feedSection: "store"
    },

    storeDigital: {
      bucket: "store-digital",
      table: "products",
      column: "digital_file_url",
      checkoutRoute: "/store"
    }
  },

  realtime: {
    enabled: true,

    protectedPages: [
      "live",
      "watch"
    ],

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
      "user_levels",
      "user_xp_ledger",
      "xp_events"
    ]
  },

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-cinematic",
    homeStyle: "portal-city-world",
    brandMood: "luxury-futuristic-community-empire",

    tabIconImage: "/images/brand/hero-banner.png",
    heroBanner: "/images/brand/hero-banner.png",
    avatarHeroBanner: "/images/brand/Avatar-hero-Banner.png.jpeg",
    defaultProfileBanner: "/images/brand/hero-banner.png",
    defaultProfileAvatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
    defaultMetaAvatar: "/images/brand/meta-avatar.png.jpeg",
    metaLogo: "/images/brand/meta-verse-elite.png.jpeg",

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
    cityTowers: true,
    avatarOnIndex: true
  },

  motion: {
    mobileBreakpoint: 720,

    city: {
      enabled: true,
      parallax: true,
      towerPulse: true,
      avatarIdle: true,
      portalSpin: true
    },

    orbit: {
      desktopRadiusX: 210,
      desktopRadiusY: 120,
      mobileRadiusX: 145,
      mobileRadiusY: 92,
      rotationLerp: 0.055,
      pointerLerp: 0.04,
      speed: 0.00055
    },

    portal: {
      floatAmount: 5,
      scalePulse: 0.012,
      glowStrength: 1.2,
      rotationSpeed: 0.0008
    },

    camera: {
      depth: 900,
      tilt: 0.12
    },

    transitions: {
      routeFade: 260,
      modalFade: 180,
      panelSlide: 240
    }
  }
});

export default RB_CONFIG;

export const RB_APP = RB_CONFIG.app;
export const RB_SUPABASE = RB_CONFIG.supabase;
export const RB_LIVEKIT = RB_CONFIG.livekit;
export const RB_AUTH = RB_CONFIG.auth;
export const RB_SYSTEM = RB_CONFIG.system;
export const RB_BRAND_ASSETS = RB_CONFIG.brandAssets;
export const RB_UNIVERSE = RB_CONFIG.universe;
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
