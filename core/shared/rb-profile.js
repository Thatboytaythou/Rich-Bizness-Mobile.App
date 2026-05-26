/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-profile.js

   GLOBAL PROFILE + IDENTITY ENGINE
   Profile Keys For All Systems
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-supabase.js";

const DEFAULT_AVATAR =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

export function getProfileIdentity(profileOverride = null) {
  const user = getUser();
  const profile = profileOverride || getProfile();

  const id = profile?.id || user?.id || null;

  return {
    id,
    user_id: id,
    creator_id: id,
    owner_id: id,
    seller_id: id,

    email: user?.email || "",

    username: profile?.username || "",
    display_name:
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      user?.email?.split("@")[0] ||
      "Rich User",

    displayName:
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      user?.email?.split("@")[0] ||
      "Rich User",

    bio: profile?.bio || "",

    avatar_url: profileAvatar(profile),
    avatarUrl: profileAvatar(profile),

    banner_url: profileBanner(profile),
    bannerUrl: profileBanner(profile),

    role: profile?.role || "user",
    rich_level: profile?.rich_level || 1,
    richLevel: profile?.rich_level || 1,

    rank_title: profile?.rank_title || "Member",
    rankTitle: profile?.rank_title || "Member",

    rich_points: profile?.rich_points || 0,
    richPoints: profile?.rich_points || 0,

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

export async function refreshMyProfile() {
  const user = getUser();
  if (!user?.id) return null;
  return await loadProfile(user.id);
}

export async function getProfileById(userId) {
  if (!userId) return null;

  const { data, error } = await getSupabase()
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getProfileByUsername(username) {
  if (!username) return null;

  const cleanUsername = String(username)
    .replace("@", "")
    .trim()
    .toLowerCase();

  const { data, error } = await getSupabase()
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("username", cleanUsername)
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

  const { data, error } = await getSupabase()
    .from(RB_TABLES.profiles)
    .update(cleanValues)
    .eq("id", user.id)
    .select()
    .maybeSingle();

  if (error) throw error;

  await loadProfile(user.id);
  return data || null;
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

export function profileHandle(profile = null) {
  const active = profile || getProfile();

  if (active?.username) return `@${active.username}`;
  return "@richuser";
}

export function profileBadge(profile = null) {
  const active = profile || getProfile();

  if (active?.is_verified) return "VERIFIED";
  if (active?.is_artist) return "ARTIST";
  if (active?.is_seller) return "SELLER";
  if (active?.is_creator) return "CREATOR";

  return active?.rank_title || "MEMBER";
}

export function profileLevel(profile = null) {
  const active = profile || getProfile();
  return active?.rich_level || 1;
}

export function buildProfileUrl(profile = null) {
  const active = profile || getProfile();

  if (active?.username) {
    return `/profile?u=${encodeURIComponent(active.username)}`;
  }

  if (active?.id) {
    return `/profile?id=${encodeURIComponent(active.id)}`;
  }

  return "/profile";
}

export function bindProfileShell({
  avatarSelector = "[data-rb-avatar]",
  bannerSelector = "[data-rb-banner]",
  nameSelector = "[data-rb-name]",
  handleSelector = "[data-rb-handle]",
  badgeSelector = "[data-rb-badge]",
  levelSelector = "[data-rb-level]"
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
}

console.log("RB PROFILE READY");
