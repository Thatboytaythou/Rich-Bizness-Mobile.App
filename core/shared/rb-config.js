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
    adminAuditLogs: "admin_audit_logs",
    adminRoles: "admin_roles",

    apiJobs: "api_jobs",
    apiRequestLogs: "api_request_logs",
    apiWebhookEvents: "api_webhook_events",

    backgroundPresets: "background_presets",
    badges: "badges",
    contentReviewQueue: "content_review_queue",

    creatorAlertSubscriptions: "creator_alert_subscriptions",
    creatorAvailableBalances: "creator_available_balances",
    creatorPageSettings: "creator_page_settings",

    dmCallParticipants: "dm_call_participants",
    dmCallSessions: "dm_call_sessions",
    dmMessageAttachments: "dm_message_attachments",
    dmMessageReactions: "dm_message_reactions",
    dmMessageReads: "dm_message_reads",
    dmMessages: "dm_messages",
    dmThreadMembers: "dm_thread_members",
    dmThreads: "dm_threads",
    dmTypingStatus: "dm_typing_status",

    featureFlags: "feature_flags",

    feedComments: "feed_comments",
    feedLikes: "feed_post_likes",
    feedPostLikes: "feed_post_likes",
    feedPostViews: "feed_post_views",
    feedPosts: "feed_posts",

    followers: "followers",

    gameAlertSubscriptions: "game_alert_subscriptions",
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
    gamerProfiles: "gamer_profiles",
    games: "games",
    tournamentPlayers: "tournament_players",

    layoutPresets: "layout_presets",

    liveAlertSubscriptions: "live_alert_subscriptions",
    liveChatMessages: "live_chat_messages",
    liveReactions: "live_reactions",
    liveStreamBans: "live_stream_bans",
    liveStreamCards: "live_stream_cards",
    liveStreamMembers: "live_stream_members",
    liveStreamPurchases: "live_stream_purchases",
    liveStreams: "live_streams",
    liveTips: "live_tips",
    liveViewSessions: "live_view_sessions",
    livekitRoomEvents: "livekit_room_events",
    vipLiveAccess: "vip_live_access",

    metaAvatars: "meta_avatars",
    metaChatMessages: "meta_chat_messages",
    metaInventory: "meta_inventory",
    metaItems: "meta_items",
    metaPortals: "meta_portals",
    metaRoomMembers: "meta_room_members",
    metaRooms: "meta_rooms",
    metaStreamLinks: "meta_stream_links",
    metaVisits: "meta_visits",
    metaWorldLikes: "meta_world_likes",
    metaWorlds: "meta_worlds",

    moderationReports: "moderation_reports",

    musicComments: "music_comments",
    musicLikes: "music_likes",
    musicPlayEvents: "music_play_events",
    musicTracks: "music_tracks",

    notificationGroups: "notification_groups",
    notificationReads: "notification_reads",
    notifications: "rich_notifications",
    richNotifications: "rich_notifications",

    platformAnalyticsEvents: "platform_analytics_events",
    platformAnnouncements: "platform_announcements",

    playlistTracks: "playlist_tracks",
    playlists: "playlists",

    podcastComments: "podcast_comments",
    podcastEpisodes: "podcast_episodes",
    podcastLikes: "podcast_likes",
    podcastShows: "podcast_shows",

    productLikes: "product_likes",
    productViews: "product_views",
    products: "products",

    profileThemeSettings: "profile_theme_settings",
    profiles: "profiles",
    pushDevices: "push_devices",

    radioLikes: "radio_likes",
    radioSessions: "radio_sessions",
    radioStations: "radio_stations",

    rankRules: "rank_rules",

    sectionThemeSettings: "section_theme_settings",

    sportsAlertSubscriptions: "sports_alert_subscriptions",
    sportsBrackets: "sports_brackets",
    sportsBroadcasts: "sports_broadcasts",
    sportsComments: "sports_comments",
    sportsLeagues: "sports_leagues",
    sportsPickResults: "sports_pick_results",
    sportsPicks: "sports_picks",
    sportsPosts: "sports_posts",
    sportsProfiles: "sports_profiles",
    sportsReactions: "sports_reactions",
    sportsTeams: "sports_teams",
    sportsUploads: "sports_uploads",

    storageBucketRoutes: "storage_bucket_routes",

    storeCartItems: "store_cart_items",
    storeComments: "store_comments",
    storeNotifications: "store_notifications",
    storeOrders: "store_orders",
    storeSellerProfiles: "store_seller_profiles",

    stripeSyncEvents: "stripe_sync_events",
    systemHealthChecks: "system_health_checks",
    trustEvents: "trust_events",

    uploadProcessingQueue: "upload_processing_queue",
    uploads: "uploads",

    userBadges: "user_badges",
    userCustomScreens: "user_custom_screens",
    userLevels: "user_levels",
    userProductUnlocks: "user_product_unlocks",
    userSessions: "user_sessions",
    userSettings: "user_settings",
    userXpLedger: "user_xp_ledger",

    xpEvents: "xp_events"
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

  visuals: {
    theme: "black-green-gold",
    mode: "ultra-hd-cinematic",
    homeStyle: "rotating-tv-screens-around-portal",
    brandMood: "luxury-futuristic-reality-changers",
    smokeCloud: true,
    cinemaMode: true,
    tvReady: true,
    depth3D: true
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
export const RB_SUPABASE = RB_CONFIG.supabase;
export const RB_ROUTES = RB_CONFIG.routes;
export const RB_TABLES = RB_CONFIG.tables;
export const RB_BUCKETS = RB_CONFIG.buckets;
export const RB_STORAGE = RB_CONFIG.storage;
export const RB_VISUALS = RB_CONFIG.visuals;
export const RB_MOTION = RB_CONFIG.motion;

console.log("RB CONFIG LOCKED");
