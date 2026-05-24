/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-config.ts

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
    appUrl: "https://rich-bizness-mobile-app.vercel.app",
  },

  supabase: {
    projectRef: "xfsrqomsiulswbalgknx",
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey: "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8",
  },

  livekit: {
    url: "wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud",
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
      studioShowdown: "/games/studio-showdown",
    },
  },

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
    creatorAvailableBalances: "creator_available_balances",
    creatorAlertSubscriptions: "creator_alert_subscriptions",
    creatorPageSettings: "creator_page_settings",

    /* NOTIFICATIONS */
    notifications: "rich_notifications",
    richNotifications: "rich_notifications",
    notificationGroups: "notification_groups",
    notificationReads: "notification_reads",

    /* UPLOADS / MODERATION */
    uploads: "uploads",
    uploadProcessingQueue: "upload_processing_queue",
    contentReviewQueue: "content_review_queue",
    moderationReports: "moderation_reports",

    /* THEMES / VISUALS */
    backgroundPresets: "background_presets",
    layoutPresets: "layout_presets",
    sectionThemeSettings: "section_theme_settings",

    /* XP / LEVELS */
    badges: "badges",
    userBadges: "user_badges",
    userCustomScreens: "user_custom_screens",
    userLevels: "user_levels",
    userXpLedger: "user_xp_ledger",
    xpEvents: "xp_events",
    rankRules: "rank_rules",

    /* ANALYTICS */
    platformAnalyticsEvents: "platform_analytics_events",
    platformAnnouncements: "platform_announcements",
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

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-cinematic",
    homeStyle: "rotating-tv-screens-around-portal",
    brandMood: "luxury-futuristic-reality-changers",

    smokeCloud: true,
    cinemaMode: true,
    tvReady: true,
    depth3D: true,
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
    },

    portal: {
      floatAmount: 5,
      scalePulse: 0.012,
    },
  },
});

export const RB_APP = RB_CONFIG.app;
export const RB_SUPABASE = RB_CONFIG.supabase;
export const RB_LIVEKIT = RB_CONFIG.livekit;
export const RB_ROUTES = RB_CONFIG.routes;
export const RB_TABLES = RB_CONFIG.tables;
export const RB_BUCKETS = RB_CONFIG.buckets;
export const RB_STORAGE = RB_CONFIG.storage;
export const RB_VISUALS = RB_CONFIG.visuals;
export const RB_MOTION = RB_CONFIG.motion;

console.log("RB CONFIG LOCKED");
