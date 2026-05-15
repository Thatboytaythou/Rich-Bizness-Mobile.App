/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-profile.js

   GLOBAL PROFILE + IDENTITY ENGINE
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-supabase.js";

export function getProfileIdentity() {
  const user = getUser();
  const profile = getProfile();

  return {
    id: user?.id || null,
    email: user?.email || "",
    username: profile?.username || "",
    displayName:
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      user?.email?.split("@")[0] ||
      "Rich User",
    bio: profile?.bio || "",
    avatarUrl: profile?.avatar_url || "",
    bannerUrl: profile?.banner_url || "",
    metaAvatarUrl: profile?.meta_avatar_url || "",
    role: profile?.role || "user",
    isCreator: !!profile?.is_creator,
    isArtist: !!profile?.is_artist,
    isSeller: !!profile?.is_seller,
    isVerified: !!profile?.is_verified
  };
}

export async function refreshMyProfile() {
  const user = getUser();
  if (!user?.id) return null;

  return await loadProfile(user.id);
}

export async function getProfileById(userId) {
  if (!userId) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

export async function getProfileByUsername(username) {
  if (!username) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("username", username)
    .single();

  if (error) throw error;

  return data;
}

export async function updateMyProfile(values = {}) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");

  const supabase = getSupabase();

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .update(cleanValues)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;

  await loadProfile(user.id);

  return data;
}

export function profileAvatar(profile = null) {
  const active = profile || getProfile();

  return (
    active?.avatar_url ||
    active?.meta_avatar_url ||
    "/images/profile/default-avatar.png"
  );
}

export function profileBanner(profile = null) {
  const active = profile || getProfile();

  return (
    active?.banner_url ||
    "/images/profile/default-banner.png"
  );
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

  return "MEMBER";
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
  badgeSelector = "[data-rb-badge]"
} = {}) {
  const profile = getProfile();

  document.querySelectorAll(avatarSelector).forEach((el) => {
    el.src = profileAvatar(profile);
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
}
