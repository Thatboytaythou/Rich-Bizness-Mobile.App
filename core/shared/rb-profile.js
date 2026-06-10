/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-profile.js

   GLOBAL PROFILE + IDENTITY ENGINE

   Locked purpose:
   - read profile identity
   - profile avatar/banner helpers
   - profile URL builder
   - insert payload builders
   - update profile
   - load profile extension rows
   - bind profile shell elements

   Identity rules:
   - profile avatar = profiles.avatar_url
   - profile banner = profiles.banner_url
   - meta avatar = meta_avatars row only
   - playable avatar = avatar engine only
========================= */

import {
  RB_ROUTES,
  RB_TABLES,
  RB_PROFILE_KEYS,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  loadProfile,
  getProfileIdentity as getSupabaseProfileIdentity
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

const DEFAULT_META_AVATAR =
  RB_BRAND_ASSETS?.defaultMetaAvatar ||
  "/images/brand/meta-avatar.png.jpeg";

function cleanUsername(username = "") {
  return String(username || "")
    .replace("@", "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 32);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) {
    return fallback;
  }

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function metadataFromUser() {
  return getUser()?.user_metadata || {};
}

/* =========================
   BASIC PROFILE VALUES
========================= */

export function profileAvatar(profile = null) {
  const active = profile || getProfile();
  const metadata = metadataFromUser();

  return safeImage(
    active?.avatar_url ||
      metadata.avatar_url ||
      metadata.picture,
    DEFAULT_AVATAR
  );
}

export function profileBanner(profile = null) {
  const active = profile || getProfile();
  const metadata = metadataFromUser();

  return safeImage(
    active?.banner_url ||
      metadata.banner_url ||
      metadata.cover_url,
    DEFAULT_BANNER
  );
}

export function profileMetaAvatar(profile = null, metaAvatar = null) {
  return safeImage(
    metaAvatar?.avatar_url ||
      profile?.meta_avatar_url ||
      DEFAULT_META_AVATAR,
    DEFAULT_META_AVATAR
  );
}

export function profileName(profile = null) {
  const user = getUser();
  const active = profile || getProfile();
  const metadata = metadataFromUser();

  return (
    active?.display_name ||
    active?.full_name ||
    active?.username ||
    metadata.display_name ||
    metadata.full_name ||
    user?.email?.split("@")?.[0] ||
    "Rich User"
  );
}

export function profileUsername(profile = null) {
  const user = getUser();
  const active = profile || getProfile();
  const metadata = metadataFromUser();

  return (
    active?.username ||
    cleanUsername(metadata.username) ||
    cleanUsername(user?.email?.split("@")?.[0]) ||
    "richuser"
  );
}

export function profileHandle(profile = null) {
  const username = profileUsername(profile);
  return username ? `@${username}` : "@richuser";
}

export function profileBadge(profile = null) {
  const active = profile || getProfile();
  const role = active?.role || "user";

  if (role === "founder") return "FOUNDER";
  if (role === "rich_admin") return "RICH ADMIN";
  if (role === "admin") return "ADMIN";
  if (active?.is_verified) return "VERIFIED";
  if (active?.is_artist) return "ARTIST";
  if (active?.is_seller) return "SELLER";
  if (active?.is_creator) return "CREATOR";

  return active?.rank_title || active?.rank || "MEMBER";
}

export function profileLevel(profile = null) {
  const active = profile || getProfile();

  return safeNumber(
    active?.rich_level ??
      active?.level,
    1
  );
}

export function profileRank(profile = null) {
  const active = profile || getProfile();

  return (
    active?.rank_title ||
    active?.rank ||
    "Biz Legend"
  );
}

export function profilePoints(profile = null) {
  const active = profile || getProfile();

  return safeNumber(
    active?.rich_points ??
      active?.points ??
      active?.xp,
    0
  );
}

export function profileBalanceCents(profile = null) {
  const active = profile || getProfile();
  return safeNumber(active?.balance_cents, 0);
}

export function isProfileOwner(profile = null) {
  const user = getUser();
  const active = profile || getProfile();

  return Boolean(user?.id && active?.id && user.id === active.id);
}

/* =========================
   FULL IDENTITY
========================= */

export function getProfileIdentity(profileOverride = null) {
  const user = getUser();
  const profile = profileOverride || getProfile();
  const fromSupabase = getSupabaseProfileIdentity?.() || {};

  const id =
    profile?.id ||
    fromSupabase?.id ||
    fromSupabase?.user_id ||
    user?.id ||
    null;

  const username =
    profile?.username ||
    fromSupabase?.username ||
    cleanUsername(user?.user_metadata?.username) ||
    cleanUsername(user?.email?.split("@")?.[0]) ||
    "";

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    fromSupabase?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    username ||
    user?.email?.split("@")?.[0] ||
    "Rich User";

  const avatar = profileAvatar(profile || fromSupabase);
  const banner = profileBanner(profile || fromSupabase);

  const richLevel = profileLevel(profile || fromSupabase);
  const rankTitle = profileRank(profile || fromSupabase);
  const richPoints = profilePoints(profile || fromSupabase);
  const balanceCents = profileBalanceCents(profile || fromSupabase);

  return {
    id,
    user_id: id,
    profile_id: id,
    creator_id: id,
    owner_id: id,
    seller_id: id,
    artist_user_id: id,
    from_user_id: id,
    to_user_id: id,

    email: user?.email || "",

    username,
    handle: username ? `@${username}` : "@richuser",

    display_name: displayName,
    displayName,

    full_name: profile?.full_name || displayName,
    bio: profile?.bio || "",

    avatar_url: avatar,
    avatarUrl: avatar,

    banner_url: banner,
    bannerUrl: banner,

    meta_avatar_url: DEFAULT_META_AVATAR,
    metaAvatarUrl: DEFAULT_META_AVATAR,

    role: profile?.role || fromSupabase?.role || "user",

    rich_level: richLevel,
    richLevel,

    rank_title: rankTitle,
    rankTitle,

    rich_points: richPoints,
    richPoints,

    xp: richPoints,

    balance_cents: balanceCents,
    balanceCents,

    online_status: profile?.online_status || fromSupabase?.online_status || "offline",
    onlineStatus: profile?.online_status || fromSupabase?.online_status || "offline",

    is_creator: Boolean(profile?.is_creator),
    isCreator: Boolean(profile?.is_creator),

    is_artist: Boolean(profile?.is_artist),
    isArtist: Boolean(profile?.is_artist),

    is_seller: Boolean(profile?.is_seller),
    isSeller: Boolean(profile?.is_seller),

    is_verified: Boolean(profile?.is_verified),
    isVerified: Boolean(profile?.is_verified)
  };
}

export function getProfileKey(profileOverride = null) {
  return getProfileIdentity(profileOverride).id;
}

/* =========================
   PAYLOAD BUILDERS
========================= */

export function buildProfileInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    user_id: identity.user_id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildUserInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    user_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildCreatorInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    creator_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildOwnerInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    owner_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildSellerInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    seller_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildArtistInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    artist_user_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...values
  };
}

export function buildLiveInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    creator_id: identity.id,
    metadata: {
      profile_name: identity.display_name,
      username: identity.username,
      avatar_url: identity.avatar_url,
      ...(values.metadata || {})
    },
    ...values
  };
}

/* =========================
   PROFILE LOAD / UPDATE
========================= */

export async function refreshMyProfile() {
  const user = getUser();
  if (!user?.id) return null;

  return await loadProfile(user.id);
}

export async function getProfileById(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export async function getProfileByUsername(username) {
  const clean = cleanUsername(username);
  if (!clean) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("username", clean)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export async function updateMyProfile(values = {}) {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.created_at;

  if (cleanValues.username) {
    cleanValues.username = cleanUsername(cleanValues.username);
  }

  if (cleanValues.avatar_url) {
    cleanValues.avatar_url = safeImage(cleanValues.avatar_url, DEFAULT_AVATAR);
  }

  if (cleanValues.banner_url) {
    cleanValues.banner_url = safeImage(cleanValues.banner_url, DEFAULT_BANNER);
  }

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .update(cleanValues)
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await loadProfile(user.id);

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: data || null
    })
  );

  return data || null;
}

export async function updateOnlineStatus(status = "online") {
  const user = getUser();

  if (!user?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .update({
      online_status: status,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await loadProfile(user.id);

  return data || null;
}

/* =========================
   EXTENSIONS
========================= */

export async function loadProfileExtensions(userId = null) {
  const id = userId || getProfileKey();

  if (!id) return {};

  const queries = {
    userSettings: RB_TABLES.userSettings,
    userLevels: RB_TABLES.userLevels,
    profileThemeSettings: RB_TABLES.profileThemeSettings,
    metaAvatar: RB_TABLES.metaAvatars,
    gamerProfile: RB_TABLES.gamerProfiles,
    sportsProfile: RB_TABLES.sportsProfiles,
    storeSellerProfile: RB_TABLES.storeSellerProfiles,
    creatorPageSettings: RB_TABLES.creatorPageSettings
  };

  const entries = await Promise.allSettled(
    Object.entries(queries)
      .filter(([, table]) => Boolean(table))
      .map(async ([key, table]) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", id)
          .maybeSingle();

        if (error) {
          console.warn(`[RB PROFILE EXTENSION WARNING: ${key}]`, error.message);
          return [key, null];
        }

        return [key, data || null];
      })
  );

  return Object.fromEntries(
    entries
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value)
  );
}

export async function getProfileStats(userId = null) {
  const id = userId || getProfileKey();

  if (!id) {
    return {
      followers: 0,
      following: 0,
      posts: 0,
      uploads: 0
    };
  }

  const [followers, following, posts, uploads] = await Promise.allSettled([
    supabase
      .from(RB_TABLES.followers)
      .select("id", { count: "exact", head: true })
      .eq("following_id", id),

    supabase
      .from(RB_TABLES.followers)
      .select("id", { count: "exact", head: true })
      .eq("follower_id", id),

    supabase
      .from(RB_TABLES.feedPosts)
      .select("id", { count: "exact", head: true })
      .eq("user_id", id),

    supabase
      .from(RB_TABLES.uploads)
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
  ]);

  const count = (result) =>
    result.status === "fulfilled" ? result.value?.count || 0 : 0;

  return {
    followers: count(followers),
    following: count(following),
    posts: count(posts),
    uploads: count(uploads)
  };
}

/* =========================
   URLS
========================= */

export function buildProfileUrl(profile = null) {
  const active = profile || getProfile();

  if (active?.username) {
    return `${RB_ROUTES.profile}?u=${encodeURIComponent(active.username)}`;
  }

  if (active?.id) {
    return `${RB_ROUTES.profile}?id=${encodeURIComponent(active.id)}`;
  }

  return RB_ROUTES.profile || "/profile";
}

/* =========================
   DOM BINDING
========================= */

function setImage(el, url, alt = "") {
  if (!el || !url) return;

  const finalUrl = safeImage(url);

  if (el.tagName === "IMG") {
    if (el.dataset.rbLockedSrc !== finalUrl) {
      el.dataset.rbLockedSrc = finalUrl;
      el.src = finalUrl;
    }

    if (alt) {
      el.alt = alt;
    }

    return;
  }

  el.style.backgroundImage = `url("${finalUrl}")`;
}

export function bindProfileShell({
  avatarSelector = "[data-rb-avatar]",
  bannerSelector = "[data-rb-banner]",
  nameSelector = "[data-rb-name]",
  handleSelector = "[data-rb-handle]",
  badgeSelector = "[data-rb-badge]",
  levelSelector = "[data-rb-level]",
  pointsSelector = "[data-rb-points]",
  rankSelector = "[data-rb-rank]",
  balanceSelector = "[data-rb-balance]"
} = {}) {
  const profile = getProfile();
  const identity = getProfileIdentity(profile);
  const name = identity.display_name;

  document.querySelectorAll(avatarSelector).forEach((el) => {
    setImage(el, identity.avatar_url, name);
  });

  document.querySelectorAll(bannerSelector).forEach((el) => {
    setImage(el, identity.banner_url);
  });

  document.querySelectorAll(nameSelector).forEach((el) => {
    el.textContent = name;
  });

  document.querySelectorAll(handleSelector).forEach((el) => {
    el.textContent = identity.handle;
  });

  document.querySelectorAll(badgeSelector).forEach((el) => {
    el.textContent = profileBadge(profile);
  });

  document.querySelectorAll(levelSelector).forEach((el) => {
    el.textContent = String(identity.rich_level);
  });

  document.querySelectorAll(pointsSelector).forEach((el) => {
    el.textContent = `${identity.rich_points.toLocaleString()} pts`;
  });

  document.querySelectorAll(rankSelector).forEach((el) => {
    el.textContent = identity.rank_title;
  });

  document.querySelectorAll(balanceSelector).forEach((el) => {
    const dollars = identity.balance_cents / 100;
    el.textContent = dollars.toLocaleString(undefined, {
      style: "currency",
      currency: "USD"
    });
  });
}

/* =========================
   ROUTE PROFILE RULES
========================= */

export function routeRequiresProfile(routeKey = "") {
  return (RB_PROFILE_KEYS?.controlledRoutes || []).includes(routeKey);
}

export function routeRequiresAdminCreator(routeKey = "") {
  return (RB_PROFILE_KEYS?.adminCreatorRoutes || []).includes(routeKey);
}

console.log("RB PROFILE READY");
