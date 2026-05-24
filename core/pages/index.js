import { startUniversePreview } from "/core/engine/universe-preview.js";

const RB_CONFIG = Object.freeze({
  app: {
    name: "Rich Bizness Mobile",
    brand: "Rich Bizness LLC",
    siteUrl: "https://rich-bizness-mobile-app.vercel.app"
  },

  supabase: {
    url: "https://xfsrqomsiulswbalgknx.supabase.co",
    publishableKey: "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8"
  },

  livekit: {
    url: "wss://rich-bizness-mobile-app-ww6cieid.livekit.cloud"
  },

  routes: {
    feed: "/feed.html",
    messages: "/messages.html",
    notifications: "/notifications.html",
    profile: "/profile.html",
    edit: "/edit.html",
    settings: "/settings.html",
    upload: "/upload.html",
    live: "/live.html",
    watch: "/watch.html",
    music: "/music.html",
    podcast: "/podcast.html",
    radio: "/radio.html",
    gaming: "/gaming.html",
    sports: "/sports.html",
    gallery: "/gallery.html",
    store: "/store.html",
    meta: "/meta.html",
    creator: "/creator.html",
    admin: "/admin.html"
  },

  sectionTables: {
    feed: ["feed_posts", "feed_comments", "feed_post_likes", "feed_post_views", "followers"],
    messages: ["dm_threads", "dm_thread_members", "dm_messages", "dm_message_attachments", "dm_message_reactions", "dm_message_reads", "dm_typing_status", "dm_call_sessions", "dm_call_participants"],
    notifications: ["rich_notifications", "notification_groups", "notification_reads", "push_devices"],
    profile: ["profiles", "user_levels", "user_badges", "profile_theme_settings", "creator_page_settings", "gamer_profiles", "sports_profiles", "store_seller_profiles", "meta_avatars"],
    edit: ["profiles", "profile_theme_settings", "section_theme_settings", "user_custom_screens", "background_presets"],
    settings: ["user_settings", "push_devices", "user_sessions", "section_theme_settings"],
    upload: ["uploads", "upload_processing_queue", "storage_bucket_routes"],
    live: ["live_streams", "live_stream_members", "live_chat_messages", "live_reactions", "live_stream_bans", "live_stream_cards", "live_tips", "livekit_room_events", "live_alert_subscriptions"],
    watch: ["live_streams", "live_view_sessions", "live_chat_messages", "live_reactions", "live_stream_purchases", "vip_live_access", "live_stream_cards"],
    music: ["music_tracks", "music_likes", "music_comments", "music_play_events", "playlists", "playlist_tracks"],
    podcast: ["podcast_shows", "podcast_episodes", "podcast_likes", "podcast_comments"],
    radio: ["radio_stations", "radio_sessions", "radio_likes"],
    gaming: ["games", "game_categories", "gamer_profiles", "game_scores", "game_sessions", "game_clips", "game_comments", "game_likes", "game_challenges", "game_tournaments", "tournament_players", "game_rewards", "game_platform_accounts", "game_stream_links"],
    sports: ["sports_profiles", "sports_posts", "sports_uploads", "sports_broadcasts", "sports_picks", "sports_pick_results", "sports_comments", "sports_reactions", "sports_brackets", "sports_leagues", "sports_teams"],
    gallery: ["feed_posts", "uploads", "feed_post_likes", "feed_comments", "feed_post_views"],
    store: ["products", "product_likes", "product_views", "store_cart_items", "store_comments", "store_orders", "store_notifications", "store_seller_profiles", "user_product_unlocks"],
    meta: ["meta_worlds", "meta_avatars", "meta_rooms", "meta_room_members", "meta_chat_messages", "meta_portals", "meta_items", "meta_inventory", "meta_world_likes", "meta_visits", "meta_stream_links"],
    creator: ["creator_page_settings", "creator_available_balances", "creator_alert_subscriptions", "live_streams", "music_tracks", "products", "games", "feed_posts", "store_orders", "live_stream_purchases", "live_tips"],
    admin: ["admin_roles", "admin_audit_logs", "moderation_reports", "content_review_queue", "api_jobs", "api_request_logs", "api_webhook_events", "stripe_sync_events", "system_health_checks", "feature_flags", "platform_analytics_events", "platform_announcements", "trust_events"]
  }
});

window.RB_CONFIG = RB_CONFIG;

function selectModule(section) {
  const route = RB_CONFIG.routes[section];

  if (!route) {
    console.warn("Missing route for section:", section);
    return;
  }

  window.location.href = route;
}

function bindRoutes() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      selectModule(button.dataset.route);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindRoutes();
  startUniversePreview("portal-container");
});
