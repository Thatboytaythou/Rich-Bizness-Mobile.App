/* =========================
   RICH BIZNESS MOBILE
   /core/pages/profile.js

   PROFILE PAGE CONTROLLER
   Page-owned profile render
   Supabase connected
   Meta world connected
   XP Gauge Enabled

   Image Lock:
   - Profile avatar = profiles.avatar_url only
   - Profile banner = profile_theme_settings.background_url OR profiles.banner_url
   - Meta avatar = Meta tab only

   Brand Asset Lock:
   - No project-avatar fallback
   - Uses active_brand_assets defaults when available
========================= */

import {
  RB_TABLES,
  RB_ROUTES,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileName,
  profileHandle,
  profileBadge,
  profileLevel,
  getProfileIdentity,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

const FALLBACK_ASSETS = {
  defaultProfileAvatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
  defaultProfileBanner: "/images/brand/hero-banner.png",
  defaultMetaAvatar: "/images/brand/meta-avatar.png.jpeg",
  defaultGamingHero: "/images/brand/gaming-hero.png.jpeg"
};

const brandAssets = {
  defaultProfileAvatar:
    RB_BRAND_ASSETS?.defaultProfileAvatar ||
    FALLBACK_ASSETS.defaultProfileAvatar,

  defaultProfileBanner:
    RB_BRAND_ASSETS?.defaultProfileBanner ||
    FALLBACK_ASSETS.defaultProfileBanner,

  defaultMetaAvatar:
    RB_BRAND_ASSETS?.defaultMetaAvatar ||
    FALLBACK_ASSETS.defaultMetaAvatar,

  defaultGamingHero:
    RB_BRAND_ASSETS?.defaultGamingHero ||
    FALLBACK_ASSETS.defaultGamingHero
};

const XP_PER_LEVEL = 1000;

const state = {
  profile: null,
  identity: null,
  isMine: false,
  isFollowing: false,
  counts: {
    followers: 0,
    following: 0,
    posts: 0,
    live: 0,
    worlds: 0,
    rooms: 0,
    uploads: 0
  },
  posts: [],
  extras: {},
  channels: []
};

const $ = (id) => document.getElementById(id);

const els = {
  status: $("profileStatus"),
  banner: $("profileBanner"),
  avatar: $("profileAvatar"),
  name: $("profileName"),
  username: $("profileUsername"),
  bio: $("profileBio"),
  rank: $("profileRank"),
  level: $("profileLevel"),
  points: $("profilePoints"),
  balance: $("profileBalance"),

  followers: $("profileFollowers"),
  following: $("profileFollowing"),
  postsCount: $("profilePostsCount"),
  liveCount: $("profileLiveCount"),

  editBtn: $("profileEditBtn"),
  followBtn: $("profileFollowBtn"),
  messageBtn: $("profileMessageBtn"),

  website: $("profileWebsite"),
  socials: $("profileSocials"),

  feed: $("profileFeed"),
  empty: $("profileEmpty"),

  tabs: document.querySelectorAll("[data-profile-tab]"),
  panels: document.querySelectorAll("[data-profile-panel]"),

  creatorPanel: $("profileCreatorPanel"),
  storePanel: $("profileStorePanel"),
  gamingPanel: $("profileGamingPanel"),
  sportsPanel: $("profileSportsPanel"),
  metaPanel: $("profileMetaPanel"),

  xpGauge: $("profileXpGauge") || $("profile-xp-gauge"),
  xpGaugeFill: $("profileXpGaugeFill") || $("profile-xp-gauge-fill"),
  xpGaugeText: $("profileXpGaugeText") || $("profile-xp-gauge-text"),
  xpGaugeNext: $("profileXpGaugeNext") || $("profile-xp-gauge-next"),
  xpLevel: $("profile-xp-level"),
  xpRank: $("profile-xp-rank")
};

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function num(value = 0) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(cents = 0) {
  return `$${(num(cents) / 100).toFixed(2)}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatMetaCount(label, value) {
  return `${label}: ${formatNumber(value)}`;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safePath(value = "") {
  const src = String(value || "").trim();

  if (!src) return "";

  if (
    src === "/images/brand/project-avatar.png.jpeg" ||
    src.includes("/project-avatar") ||
    src.includes("project-avatar")
  ) {
    return "";
  }

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return "";
}

function setText(el, value = "") {
  if (el) {
    el.textContent = value ?? "";
  }
}

function setDisplay(el, show = true, display = "block") {
  if (el) {
    el.style.display = show ? display : "none";
  }
}

function setImageOnce(img, src, alt = "Profile") {
  if (!img) return;

  const finalSrc = safePath(src) || brandAssets.defaultProfileAvatar;

  if (img.dataset.rbLockedSrc === finalSrc) {
    img.alt = alt;
    return;
  }

  img.dataset.rbLockedSrc = finalSrc;
  img.src = finalSrc;
  img.alt = alt;
}

function setBackground(el, src) {
  if (!el) return;

  const finalSrc = safePath(src) || brandAssets.defaultProfileBanner;
  el.style.backgroundImage = `url("${finalSrc}")`;
}

function hasPublicProfileRoute() {
  const params = new URLSearchParams(window.location.search);

  return Boolean(
    params.get("u") ||
      params.get("username") ||
      params.get("id") ||
      params.get("user")
  );
}

function routeTarget() {
  const params = new URLSearchParams(window.location.search);

  return {
    id: params.get("id") || params.get("user") || null,
    username: params.get("u") || params.get("username") || null
  };
}

function lockedProfileAvatar(profile = {}) {
  return safePath(profile?.avatar_url) || brandAssets.defaultProfileAvatar;
}

function lockedProfileBanner(profile = {}, extras = {}) {
  return (
    safePath(extras?.theme?.background_url) ||
    safePath(profile?.banner_url) ||
    brandAssets.defaultProfileBanner
  );
}

/* =========================
   PROFILE LOCK
========================= */

function syncProfileLock() {
  const user = getUser?.() || null;

  state.identity =
    getProfileIdentity?.(state.profile) ||
    state.identity ||
    null;

  const profileId =
    state.identity?.id ||
    state.profile?.id ||
    "";

  document.body.dataset.rbPage = "profile";
  document.body.dataset.rbRoute = "profile";
  document.body.dataset.rbUserId = user?.id || "";
  document.body.dataset.rbProfileId = profileId;
  document.body.dataset.rbProfileLocked = profileId ? "true" : "false";
  document.body.dataset.rbProfileLock = profileId ? "true" : "false";

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href =
      buildProfileUrl?.(state.profile) ||
      RB_ROUTES?.profile ||
      "/profile";
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = lockedProfileAvatar(state.profile || {});
    const name = profileName(state.profile || {});

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt = name;
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });
}

/* =========================
   BRAND ASSETS
========================= */

async function loadBrandAssets() {
  const { data, error } = await supabase
    .from("active_brand_assets")
    .select("asset_key,public_path")
    .eq("is_default", true);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("[RB BRAND ASSETS WARNING]", error.message);
    }

    return brandAssets;
  }

  data.forEach((asset) => {
    const path = safePath(asset.public_path);
    if (!path) return;

    if (asset.asset_key === "default_profile_avatar") {
      brandAssets.defaultProfileAvatar = path;
    }

    if (asset.asset_key === "hero_banner") {
      brandAssets.defaultProfileBanner = path;
    }

    if (asset.asset_key === "meta_avatar") {
      brandAssets.defaultMetaAvatar = path;
    }

    if (asset.asset_key === "gaming_hero") {
      brandAssets.defaultGamingHero = path;
    }
  });

  return brandAssets;
}

/* =========================
   PROFILE LOAD
========================= */

async function loadProfileDirect() {
  const user = getUser?.() || null;
  const target = routeTarget();

  state.identity = user || null;

  if (target.id) {
    const { data, error } = await supabase
      .from(table("profiles", "profiles"))
      .select("*")
      .eq("id", target.id)
      .maybeSingle();

    if (error) throw error;

    state.profile = data || null;
    state.identity = getProfileIdentity?.(state.profile) || null;
    state.isMine = Boolean(user?.id && data?.id === user.id);

    syncProfileLock();

    return state.profile;
  }

  if (target.username) {
    const username = String(target.username).replace(/^@/, "").trim();

    const { data, error } = await supabase
      .from(table("profiles", "profiles"))
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    state.profile = data || null;
    state.identity = getProfileIdentity?.(state.profile) || null;
    state.isMine = Boolean(user?.id && data?.id === user.id);

    syncProfileLock();

    return state.profile;
  }

  if (user?.id) {
    const ensured = await ensureMyProfile();

    if (ensured?.id) {
      state.profile = ensured;
      state.identity = getProfileIdentity?.(state.profile) || null;
      state.isMine = true;

      syncProfileLock();

      return ensured;
    }

    const { data, error } = await supabase
      .from(table("profiles", "profiles"))
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    state.profile = data || null;
    state.identity = getProfileIdentity?.(state.profile) || null;
    state.isMine = Boolean(data?.id === user.id);

    syncProfileLock();

    return state.profile;
  }

  state.profile = null;
  state.identity = null;
  state.isMine = false;

  syncProfileLock();

  return null;
}

/* =========================
   DATA FETCH
========================= */

async function countBy(tableName, column, value) {
  if (!tableName || !column || !value) return 0;

  const { count, error } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    console.warn(`[RB PROFILE COUNT WARNING: ${tableName}.${column}]`, error.message);
    return 0;
  }

  return count || 0;
}

async function fetchCounts(profileId) {
  if (!profileId) return state.counts;

  const [
    followers,
    following,
    posts,
    liveByCreator,
    liveByUser,
    worlds,
    rooms,
    uploads
  ] = await Promise.all([
    countBy(table("followers", "followers"), "following_id", profileId),
    countBy(table("followers", "followers"), "follower_id", profileId),
    countBy(table("feedPosts", "feed_posts"), "user_id", profileId),
    countBy(table("liveStreams", "live_streams"), "creator_id", profileId),
    countBy(table("liveStreams", "live_streams"), "user_id", profileId),
    countBy(table("metaWorlds", "meta_worlds"), "owner_id", profileId),
    countBy(table("metaRooms", "meta_rooms"), "owner_id", profileId),
    countBy(table("uploads", "uploads"), "user_id", profileId)
  ]);

  state.counts = {
    followers,
    following,
    posts,
    live: liveByCreator || liveByUser || 0,
    worlds,
    rooms,
    uploads
  };

  return state.counts;
}

async function fetchPosts(profileId) {
  if (!profileId) {
    state.posts = [];
    return [];
  }

  const { data, error } = await supabase
    .from(table("feedPosts", "feed_posts"))
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.warn("[RB PROFILE POSTS WARNING]", error.message);
    state.posts = [];
    return [];
  }

  state.posts = data || [];
  return state.posts;
}

async function fetchFollowing(profileId) {
  const user = getUser?.() || null;

  if (!user?.id || !profileId || user.id === profileId) {
    state.isFollowing = false;
    return false;
  }

  const { data, error } = await supabase
    .from(table("followers", "followers"))
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", profileId)
    .maybeSingle();

  if (error) {
    console.warn("[RB FOLLOW CHECK WARNING]", error.message);
    state.isFollowing = false;
    return false;
  }

  state.isFollowing = Boolean(data);
  return state.isFollowing;
}

async function fetchOneByUser(tableName, profileId) {
  if (!tableName || !profileId) return null;

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("user_id", profileId)
    .maybeSingle();

  if (error) {
    console.warn(`[RB PROFILE EXTRA WARNING: ${tableName}]`, error.message);
    return null;
  }

  return data || null;
}

async function fetchExtras(profileId) {
  if (!profileId) {
    state.extras = {};
    return {};
  }

  const [
    theme,
    level,
    meta,
    seller,
    gamer,
    sports,
    creator
  ] = await Promise.all([
    fetchOneByUser(table("profileThemeSettings", "profile_theme_settings"), profileId),
    fetchOneByUser(table("userLevels", "user_levels"), profileId),
    fetchOneByUser(table("metaAvatars", "meta_avatars"), profileId),
    fetchOneByUser(table("storeSellerProfiles", "store_seller_profiles"), profileId),
    fetchOneByUser(table("gamerProfiles", "gamer_profiles"), profileId),
    fetchOneByUser(table("sportsProfiles", "sports_profiles"), profileId),
    fetchOneByUser(table("creatorPageSettings", "creator_page_settings"), profileId)
  ]);

  state.extras = {
    theme,
    level,
    meta,
    seller,
    gamer,
    sports,
    creator
  };

  return state.extras;
}

/* =========================
   XP MODEL
========================= */

function xpModel(profile = state.profile || {}, extras = state.extras || {}) {
  const meta = extras.meta || {};
  const gamer = extras.gamer || {};
  const levelRow = extras.level || {};

  const level =
    num(meta.level) ||
    num(gamer.rank_level) ||
    num(levelRow.level) ||
    num(profile.rich_level) ||
    num(profileLevel(profile)) ||
    1;

  const xp =
    num(meta.xp) ||
    num(gamer.xp) ||
    num(levelRow.xp_total) ||
    num(levelRow.xp) ||
    num(levelRow.rich_points) ||
    num(profile.xp) ||
    num(profile.rich_points) ||
    num(profile.points) ||
    0;

  const rank =
    meta.rank ||
    gamer.rank_title ||
    levelRow.rank_title ||
    profile.rank_title ||
    profileBadge(profile) ||
    "Member";

  const levelBase = Math.max(0, (level - 1) * XP_PER_LEVEL);
  const nextLevel = level * XP_PER_LEVEL;
  const inLevel = Math.max(0, xp - levelBase);
  const needed = Math.max(1, nextLevel - levelBase);
  const progress = Math.max(0, Math.min(100, (inLevel / needed) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    level,
    xp,
    rank,
    nextLevel,
    remaining,
    progress
  };
}

function renderXpGauge() {
  const xp = xpModel();

  document.documentElement.style.setProperty(
    "--rb-xp-percent",
    `${xp.progress}%`
  );

  document.body.dataset.rbXp = String(xp.xp);
  document.body.dataset.rbLevel = String(xp.level);
  document.body.dataset.rbRank = xp.rank;
  document.body.dataset.rbXpPercent = String(Math.round(xp.progress));

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(xp.level);
    els.xpGauge.dataset.rank = xp.rank;
    els.xpGauge.dataset.xp = String(xp.xp);
  }

  if (els.xpGaugeFill) {
    els.xpGaugeFill.style.width = `${xp.progress}%`;
  }

  if (els.xpGaugeText) {
    els.xpGaugeText.textContent = `${xp.xp.toLocaleString()} XP`;
  }

  if (els.xpGaugeNext) {
    els.xpGaugeNext.textContent =
      `${xp.remaining.toLocaleString()} XP TO LVL ${xp.level + 1}`;
  }

  if (els.xpLevel) {
    els.xpLevel.textContent = `LVL ${xp.level}`;
  }

  if (els.xpRank) {
    els.xpRank.textContent = xp.rank;
  }

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "profile",
        xp: xp.xp,
        level: xp.level,
        rank: xp.rank,
        nextLevel: xp.nextLevel,
        remaining: xp.remaining,
        percent: xp.progress
      }
    })
  );
}

/* =========================
   RENDER
========================= */

function mediaMarkup(post) {
  const url = safePath(post.media_url || post.file_url || post.image_url || "");
  if (!url) return "";

  const lower = url.toLowerCase();

  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) {
    return `<video src="${escapeHtml(url)}" controls playsinline></video>`;
  }

  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) {
    return `<audio src="${escapeHtml(url)}" controls></audio>`;
  }

  return `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`;
}

function renderProfile() {
  const profile = state.profile || {};
  const extras = state.extras || {};
  const xp = xpModel(profile, extras);

  const name = profileName(profile);
  const avatar = lockedProfileAvatar(profile);
  const banner = lockedProfileBanner(profile, extras);

  setText(
    els.status,
    state.isMine ? "Your Universe Profile" : "Universe Profile"
  );

  setBackground(els.banner, banner);

  if (els.avatar) {
    setImageOnce(els.avatar, avatar, name);
    els.avatar.dataset.profileId = profile.id || "";
    els.avatar.dataset.username = profile.username || "";
  }

  setText(els.name, name);
  setText(els.username, profileHandle(profile));
  setText(els.bio, profile.bio || "Building in the Rich Bizness Universe.");

  setText(els.rank, xp.rank);
  setText(els.level, `LVL ${xp.level}`);
  setText(els.points, `${xp.xp.toLocaleString()} pts`);
  setText(els.balance, money(profile.balance_cents));

  setText(els.followers, state.counts.followers);
  setText(els.following, state.counts.following);
  setText(els.postsCount, state.counts.posts);
  setText(els.liveCount, state.counts.live || 0);

  setDisplay(els.editBtn, state.isMine, "inline-flex");

  syncProfileLock();
  renderXpGauge();
  renderFollowButton();
  renderLinks(profile);
  renderExtras();
}

function renderFollowButton() {
  if (!els.followBtn) return;

  if (state.isMine || !getUser?.()?.id) {
    setDisplay(els.followBtn, false);
    return;
  }

  setDisplay(els.followBtn, true, "inline-flex");
  els.followBtn.textContent = state.isFollowing ? "Following" : "Follow";
  els.followBtn.classList.toggle("is-active", state.isFollowing);
}

function renderLinks(profile = {}) {
  if (els.website) {
    const website = safePath(profile.website_url);

    if (website) {
      els.website.href = website;
      els.website.textContent = "Website";
      setDisplay(els.website, true, "inline-flex");
    } else {
      setDisplay(els.website, false);
    }
  }

  if (!els.socials) return;

  const links = [
    ["Instagram", safePath(profile.instagram_url)],
    ["YouTube", safePath(profile.youtube_url)],
    ["TikTok", safePath(profile.tiktok_url)],
    ["Facebook", safePath(profile.facebook_url)],
    ["Snapchat", safePath(profile.snapchat_url)]
  ].filter(([, url]) => url);

  els.socials.innerHTML = links
    .map(([label, url]) => {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderMiniCard(el, title, detail, stat = "") {
  if (!el) return;

  el.innerHTML = `
    <article class="rb-mini-card">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail || "Connected")}</span>
      ${stat ? `<small>${escapeHtml(stat)}</small>` : ""}
    </article>
  `;
}

function renderMetaPanel() {
  if (!els.metaPanel) return;

  const profile = state.profile || {};
  const meta = state.extras.meta;
  const name = profileName(profile);

  const metaRoute = RB_ROUTES?.meta || "/meta";

  if (!meta) {
    els.metaPanel.innerHTML = `
      <div class="rb-profile-meta-avatar-card">
        <div class="rb-profile-meta-avatar-stage">
          <img
            src="${escapeHtml(brandAssets.defaultMetaAvatar)}"
            alt="Meta Avatar"
            loading="lazy"
          />
          <div class="rb-profile-meta-orbit"></div>
          <div class="rb-profile-meta-aura"></div>
        </div>

        <div class="rb-profile-meta-avatar-copy">
          <p class="rb-kicker">META WORLD</p>
          <h3>No Meta Avatar Yet</h3>
          <p>Build your avatar, enter your cinematic world, and move through real app sections.</p>

          <div class="rb-profile-meta-badges">
            <span>${formatMetaCount("Worlds", state.counts.worlds)}</span>
            <span>${formatMetaCount("Rooms", state.counts.rooms)}</span>
            <span>${formatMetaCount("Uploads", state.counts.uploads)}</span>
          </div>

          <a class="rb-btn ghost" href="${metaRoute}">Enter Meta World</a>
        </div>
      </div>
    `;
    return;
  }

  const avatar =
    safePath(meta.avatar_url) ||
    brandAssets.defaultMetaAvatar;

  const model = safePath(meta.model_url);
  const aura = meta.aura || "green-gold";
  const rank = meta.rank || "Traveler";
  const level = num(meta.level) || 1;
  const xp = num(meta.xp);

  els.metaPanel.innerHTML = `
    <div class="rb-profile-meta-avatar-card" data-aura="${escapeHtml(aura)}">
      <div
        class="rb-profile-meta-avatar-stage"
        data-model-url="${escapeHtml(model)}"
      >
        ${
          model
            ? `
              <model-viewer
                src="${escapeHtml(model)}"
                camera-controls
                auto-rotate
                autoplay
                ar
                shadow-intensity="0.8"
                exposure="1"
                environment-image="neutral"
                alt="${escapeHtml(meta.display_name || name)}"
              ></model-viewer>
            `
            : `
              <img
                src="${escapeHtml(avatar)}"
                alt="${escapeHtml(meta.display_name || name)}"
                loading="lazy"
              />
            `
        }

        <div class="rb-profile-meta-orbit"></div>
        <div class="rb-profile-meta-aura"></div>
      </div>

      <div class="rb-profile-meta-avatar-copy">
        <p class="rb-kicker">META WORLD</p>
        <h3>${escapeHtml(meta.display_name || name)}</h3>

        <div class="rb-profile-meta-badges">
          <span>${escapeHtml(rank)}</span>
          <span>LVL ${level}</span>
          <span>${escapeHtml(aura)}</span>
          <span>${xp.toLocaleString()} XP</span>
          <span>${formatMetaCount("Worlds", state.counts.worlds)}</span>
          <span>${formatMetaCount("Rooms", state.counts.rooms)}</span>
        </div>

        <a class="rb-btn ghost" href="${metaRoute}">Enter Meta World</a>
      </div>
    </div>
  `;
}

function renderExtras() {
  const creator = state.extras.creator;
  const seller = state.extras.seller;
  const gamer = state.extras.gamer;
  const sports = state.extras.sports;

  renderMiniCard(
    els.creatorPanel,
    "Creator Hub",
    creator?.page_theme || "Creator system connected"
  );

  renderMiniCard(
    els.storePanel,
    seller?.seller_name || seller?.display_name || "Store",
    seller?.seller_rank || "Seller profile connected",
    seller?.total_sales_cents ? money(seller.total_sales_cents) : ""
  );

  renderMiniCard(
    els.gamingPanel,
    gamer?.gamer_tag || gamer?.display_name || "Gaming",
    gamer?.rank_title || "Gaming profile connected",
    gamer?.xp ? `${num(gamer.xp).toLocaleString()} XP` : ""
  );

  renderMiniCard(
    els.sportsPanel,
    sports?.fan_tag || sports?.display_name || "Sports",
    sports?.rank_title || "Sports profile connected",
    sports?.points ? `${num(sports.points).toLocaleString()} pts` : ""
  );

  renderMetaPanel();
}

function renderPosts() {
  if (!els.feed) return;

  if (!state.posts.length) {
    setDisplay(els.empty, true);
    els.feed.innerHTML = "";
    return;
  }

  setDisplay(els.empty, false);

  els.feed.innerHTML = state.posts
    .map((post) => {
      const body =
        post.body ||
        post.caption ||
        post.content ||
        post.description ||
        "";

      return `
        <article class="rb-card rb-feed-card">
          <div class="rb-card-body">
            ${body ? `<p>${escapeHtml(body)}</p>` : ""}
            ${mediaMarkup(post)}
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================
   ACTIONS
========================= */

async function toggleFollow() {
  const user = getUser?.() || null;
  const profileId = state.profile?.id;

  if (!user?.id || !profileId || state.isMine || !els.followBtn) return;

  els.followBtn.disabled = true;

  try {
    if (state.isFollowing) {
      await supabase
        .from(table("followers", "followers"))
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);

      state.isFollowing = false;
    } else {
      await supabase
        .from(table("followers", "followers"))
        .upsert(
          {
            follower_id: user.id,
            following_id: profileId,
            created_at: new Date().toISOString()
          },
          {
            onConflict: "follower_id,following_id"
          }
        );

      state.isFollowing = true;
    }

    await fetchCounts(profileId);
    renderProfile();
  } catch (error) {
    console.warn("[RB FOLLOW TOGGLE FAILED]", error.message);
  } finally {
    els.followBtn.disabled = false;
  }
}

function bindActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES?.edit || "/edit";
  });

  els.followBtn?.addEventListener("click", toggleFollow);

  els.messageBtn?.addEventListener("click", () => {
    if (!state.profile?.id) return;

    window.location.href =
      `${RB_ROUTES?.messages || "/messages"}?user=${encodeURIComponent(state.profile.id)}`;
  });
}

function bindTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.profileTab;

      els.tabs.forEach((item) => {
        item.classList.toggle("is-active", item === tab);
      });

      els.panels.forEach((panel) => {
        const active = panel.dataset.profilePanel === target;
        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "block" : "none";
      });
    });
  });
}

/* =========================
   REALTIME
========================= */

function clearRealtime() {
  state.channels.forEach((channel) => {
    supabase.removeChannel(channel);
  });

  state.channels = [];
}

async function reloadSoft() {
  const profileId = state.profile?.id;
  if (!profileId) return;

  await Promise.all([
    loadProfileDirect(),
    fetchCounts(profileId),
    fetchFollowing(profileId),
    fetchExtras(profileId),
    fetchPosts(profileId)
  ]);

  renderProfile();
  renderPosts();
}

function subscribeRealtime(profileId) {
  if (!profileId) return;

  clearRealtime();

  const channel = supabase
    .channel(`rb-profile-page-${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("profiles", "profiles"),
        filter: `id=eq.${profileId}`
      },
      reloadSoft
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("feedPosts", "feed_posts"),
        filter: `user_id=eq.${profileId}`
      },
      async () => {
        await fetchPosts(profileId);
        renderPosts();
        renderXpGauge();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("followers", "followers")
      },
      reloadSoft
    );

  [
    table("userLevels", "user_levels"),
    table("metaAvatars", "meta_avatars"),
    table("profileThemeSettings", "profile_theme_settings"),
    table("gamerProfiles", "gamer_profiles"),
    table("sportsProfiles", "sports_profiles"),
    table("storeSellerProfiles", "store_seller_profiles"),
    table("creatorPageSettings", "creator_page_settings"),
    table("metaWorlds", "meta_worlds"),
    table("metaRooms", "meta_rooms"),
    table("uploads", "uploads")
  ]
    .filter(Boolean)
    .forEach((tableName) => {
      const userColumn =
        tableName === table("metaWorlds", "meta_worlds") ||
        tableName === table("metaRooms", "meta_rooms")
          ? "owner_id"
          : "user_id";

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: `${userColumn}=eq.${profileId}`
        },
        reloadSoft
      );
    });

  channel.subscribe();
  state.channels.push(channel);
}

/* =========================
   LOAD
========================= */

async function loadEverything() {
  setText(els.status, "Loading profile...");

  await loadBrandAssets();

  const isPublicRoute = hasPublicProfileRoute();

  if (!isPublicRoute && getUser?.()?.id) {
    await ensureMyProfile();
  }

  await loadProfileDirect();

  const profileId = state.profile?.id;

  if (!profileId) {
    throw new Error("Profile not found.");
  }

  await Promise.all([
    fetchCounts(profileId),
    fetchFollowing(profileId),
    fetchExtras(profileId),
    fetchPosts(profileId)
  ]);

  renderProfile();
  renderPosts();
  subscribeRealtime(profileId);

  document.body.classList.add("rb-profile-ready");
}

function markReady() {
  document.body.classList.add("rb-page-ready");
  document.body.classList.remove("rb-page-error");
  document.body.dataset.rbPage = "profile";
  document.body.dataset.rbRoute = "profile";
  document.body.dataset.rbProfileLock =
    state.identity?.id || state.profile?.id ? "true" : "false";

  renderXpGauge();

  console.log("RB PROFILE PAGE READY", {
    profileLocked: Boolean(state.identity?.id || state.profile?.id),
    route: "profile",
    xpGauge: true
  });
}

function markError(error) {
  document.body.classList.add("rb-page-error");
  document.body.classList.remove("rb-page-ready");

  console.warn("[RB PROFILE PAGE ERROR]", error?.message || error);

  setText(els.status, error?.message || "Profile failed to load.");
}

async function bootProfilePage() {
  bindTabs();
  bindActions();

  try {
    await loadEverything();
    markReady();
  } catch (error) {
    markError(error);
  }
}

window.addEventListener("beforeunload", clearRealtime);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProfilePage);
} else {
  bootProfilePage();
}
