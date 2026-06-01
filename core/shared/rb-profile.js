/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-profile.js

   GLOBAL PROFILE + IDENTITY ENGINE
   Profile Keys For All Systems
========================= */

import {
  RB_ROUTES,
  RB_TABLES,
  RB_BRAND_ASSETS,
  RB_PROFILE_KEYS
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
  RB_BRAND_ASSETS?.defaultAvatar || "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner || "/images/brand/hero-banner.png";

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanUsername(username = "") {
  return String(username || "")
    .replace("@", "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function profileAvatar(profile = null) {
  const active = profile || getProfile();
  return active?.avatar_url || DEFAULT_AVATAR;
}

export function profileBanner(profile = null) {
  const active = profile || getProfile();
  return active?.banner_url || DEFAULT_BANNER;
}

export function profileName(profile = null) {
  const user = getUser();
  const active = profile || getProfile();

  return (
    active?.display_name ||
    active?.full_name ||
    active?.username ||
    user?.email?.split("@")[0] ||
    "Rich User"
  );
}

export function profileUsername(profile = null) {
  const user = getUser();
  const active = profile || getProfile();

  return (
    active?.username ||
    cleanUsername(user?.email?.split("@")[0]) ||
    "richuser"
  );
}

export function profileHandle(profile = null) {
  const username = profileUsername(profile);
  return username ? `@${username}` : "@richuser";
}

export function profileBadge(profile = null) {
  const active = profile || getProfile();

  if (active?.role === "founder") return "FOUNDER";
  if (active?.role === "rich_admin") return "RICH ADMIN";
  if (active?.role === "admin") return "ADMIN";
  if (active?.is_verified) return "VERIFIED";
  if (active?.is_artist) return "ARTIST";
  if (active?.is_seller) return "SELLER";
  if (active?.is_creator) return "CREATOR";

  return active?.rank_title || "MEMBER";
}

export function profileLevel(profile = null) {
  const active = profile || getProfile();
  return Number(active?.rich_level || 1);
}

export function profileRank(profile = null) {
  const active = profile || getProfile();
  return active?.rank_title || "Member";
}

export function profilePoints(profile = null) {
  const active = profile || getProfile();
  return Number(active?.rich_points || 0);
}

export function isProfileOwner(profile = null) {
  const user = getUser();
  const active = profile || getProfile();
  return !!user?.id && !!active?.id && user.id === active.id;
}

export function getProfileIdentity(profileOverride = null) {
  const user = getUser();
  const profile = profileOverride || getProfile();
  const fromSupabase = getSupabaseProfileIdentity?.() || {};

  const id = profile?.id || fromSupabase?.id || fromSupabase?.user_id || user?.id || null;

  const username =
    profile?.username ||
    fromSupabase?.username ||
    cleanUsername(user?.email?.split("@")[0]) ||
    "";

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    fromSupabase?.display_name ||
    username ||
    user?.email?.split("@")[0] ||
    "Rich User";

  return {
    id,
    user_id: id,
    creator_id: id,
    owner_id: id,
    seller_id: id,
    artist_user_id: id,
    from_user_id: id,
    to_user_id: id,

    email: user?.email || "",

    username,
    display_name: displayName,
    displayName,

    full_name: profile?.full_name || displayName,
    bio: profile?.bio || "",

    avatar_url: profileAvatar(profile),
    avatarUrl: profileAvatar(profile),

    banner_url: profileBanner(profile),
    bannerUrl: profileBanner(profile),

    role: profile?.role || "user",

    rich_level: profileLevel(profile),
    richLevel: profileLevel(profile),

    rank_title: profileRank(profile),
    rankTitle: profileRank(profile),

    rich_points: profilePoints(profile),
    richPoints: profilePoints(profile),

    balance_cents: Number(profile?.balance_cents || 0),
    balanceCents: Number(profile?.balance_cents || 0),

    online_status: profile?.online_status || "offline",
    onlineStatus: profile?.online_status || "offline",

    is_creator: !!profile?.is_creator,
    isCreator: !!profile?.is_creator,

    is_artist: !!profile?.is_artist,
    isArtist: !!profile?.is_artist,

    is_seller: !!profile?.is_seller,
    isSeller: !!profile?.is_seller,

    is_verified: !!profile?.is_verified,
    isVerified: !!profile?.is_verified
  };
}

export function getProfileKey(profileOverride = null) {
  return getProfileIdentity(profileOverride).id;
}

export function buildProfileInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    user_id: identity.user_id,
    username: identity.username,
    display_name: identity.display_name,
    ...values
  };
}

export function buildCreatorInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    creator_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    ...values
  };
}

export function buildOwnerInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    owner_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    ...values
  };
}

export function buildSellerInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    seller_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
    ...values
  };
}

export function buildArtistInsert(values = {}, profileOverride = null) {
  const identity = getProfileIdentity(profileOverride);

  return {
    artist_user_id: identity.id,
    username: identity.username,
    display_name: identity.display_name,
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
  if (!user?.id) throw new Error("You must be signed in.");

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.created_at;

  if (cleanValues.username) {
    cleanValues.username = cleanUsername(cleanValues.username);
  }

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .update(cleanValues)
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await loadProfile(user.id);
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

export async function loadProfileExtensions(userId = null) {
  const id = userId || getProfileKey();
  if (!id) return {};

  const [
    userSettings,
    userLevels,
    theme,
    metaAvatar,
    gamer,
    sports,
    seller,
    creator
  ] = await Promise.allSettled([
    supabase.from(RB_TABLES.userSettings).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.userLevels).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.profileThemeSettings).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.metaAvatars).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.gamerProfiles).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.sportsProfiles).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.storeSellerProfiles).select("*").eq("user_id", id).maybeSingle(),
    supabase.from(RB_TABLES.creatorPageSettings).select("*").eq("user_id", id).maybeSingle()
  ]);

  const unwrap = (result) =>
    result.status === "fulfilled" ? result.value?.data || null : null;

  return {
    userSettings: unwrap(userSettings),
    userLevels: unwrap(userLevels),
    profileThemeSettings: unwrap(theme),
    metaAvatar: unwrap(metaAvatar),
    gamerProfile: unwrap(gamer),
    sportsProfile: unwrap(sports),
    storeSellerProfile: unwrap(seller),
    creatorPageSettings: unwrap(creator)
  };
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

export function buildProfileUrl(profile = null) {
  const active = profile || getProfile();

  if (active?.username) {
    return `${RB_ROUTES.profile}?u=${encodeURIComponent(active.username)}`;
  }

  if (active?.id) {
    return `${RB_ROUTES.profile}?id=${encodeURIComponent(active.id)}`;
  }

  return RB_ROUTES.profile;
}

export function bindProfileShell({
  avatarSelector = "[data-rb-avatar]",
  bannerSelector = "[data-rb-banner]",
  nameSelector = "[data-rb-name]",
  handleSelector = "[data-rb-handle]",
  badgeSelector = "[data-rb-badge]",
  levelSelector = "[data-rb-level]",
  pointsSelector = "[data-rb-points]"
} = {}) {
  const profile = getProfile();

  document.querySelectorAll(avatarSelector).forEach((el) => {
    const url = profileAvatar(profile);

    if (el.tagName === "IMG") {
      el.src = url;
      el.alt = profileName(profile);
    } else {
      el.style.backgroundImage = `url("${url}")`;
    }
  });

  document.querySelectorAll(bannerSelector).forEach((el) => {
    el.style.backgroundImage = `url("${profileBanner(profile)}")`;
  });

  document.querySelectorAll(nameSelector).forEach((el) => {
    el.textContent = profileName(profile);
  });

  document.querySelectorAll(handleSelector).forEach((el) => {
    el.textContent = profileHandle(profile);
  });

  document.querySelectorAll(badgeSelector).forEach((el) => {
    el.textContent = profileBadge(profile);
  });

  document.querySelectorAll(levelSelector).forEach((el) => {
    el.textContent = `LVL ${profileLevel(profile)}`;
  });

  document.querySelectorAll(pointsSelector).forEach((el) => {
    el.textContent = `${profilePoints(profile)} pts`;
  });
}

export function routeRequiresProfile(routeKey = "") {
  return (RB_PROFILE_KEYS?.controlledRoutes || []).includes(routeKey);
}

console.log("RB PROFILE READY");
