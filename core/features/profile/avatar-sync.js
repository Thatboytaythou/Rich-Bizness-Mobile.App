/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/avatar-sync.js

   AVATAR + BANNER SYNC ENGINE
   Profiles table + storage buckets
   Profile avatar stays profile avatar
   Meta avatar stays meta avatar

   Source-of-truth rule:
   - rb-supabase.js owns client/user/profile
   - rb-profile.js owns profile helpers/update
   - profile-state.js mirrors page profile state
========================= */

import {
  RB_BUCKETS,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-supabase.js";

import {
  updateMyProfile,
  profileAvatar,
  profileBanner,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  refreshProfileState,
  notifyProfileListeners
} from "/core/features/profile/profile-state.js";

import {
  toastError
} from "/core/shared/rb-toast.js";

const supabase = getSupabase();

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const MAX_IMAGE_SIZE_MB = 12;

let avatarSyncBooted = false;

/* =========================
   HELPERS
========================= */

function hasDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getBucket(type = "avatar") {
  if (type === "banner") {
    return RB_BUCKETS.profileBanners || "profile-banners";
  }

  return RB_BUCKETS.avatars || "avatars";
}

function createSafeFileName(file, prefix = "image") {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  const ext =
    String(file?.name || "upload.png")
      .split(".")
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "png";

  const stamp = Date.now();

  return `${user.id}/${prefix}-${stamp}.${ext}`;
}

function validateImageFile(file) {
  if (!file) {
    throw new Error("No image selected.");
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please upload JPG, PNG, WEBP, or GIF.");
  }

  const sizeMb = file.size / 1024 / 1024;

  if (sizeMb > MAX_IMAGE_SIZE_MB) {
    throw new Error(`Image must be under ${MAX_IMAGE_SIZE_MB}MB.`);
  }

  return true;
}

function dispatchProfileUpdated({
  type,
  profile,
  url
}) {
  if (!hasDOM()) return;

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        type,
        profile,
        url
      }
    })
  );
}

async function refreshAfterProfileImageChange(profile, type, url) {
  const user = getUser();

  if (user?.id) {
    await loadProfile(user.id);
  }

  await refreshProfileState();

  syncProfileDom(profile);

  notifyProfileListeners?.();

  dispatchProfileUpdated({
    type,
    profile,
    url
  });
}

/* =========================
   UPLOAD
========================= */

export async function uploadProfileImage({
  file,
  type = "avatar"
}) {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  validateImageFile(file);

  const isBanner = type === "banner";

  const bucket = getBucket(type);

  const column = isBanner
    ? "banner_url"
    : "avatar_url";

  const filePath = createSafeFileName(
    file,
    isBanner ? "banner" : "avatar"
  );

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    throw new Error("Could not create public image URL.");
  }

  const profile = await updateMyProfile({
    [column]: publicUrl
  });

  await refreshAfterProfileImageChange(profile, type, publicUrl);

  return {
    type,
    bucket,
    path: filePath,
    url: publicUrl,
    profile
  };
}

export async function uploadAvatar(file) {
  return await uploadProfileImage({
    file,
    type: "avatar"
  });
}

export async function uploadBanner(file) {
  return await uploadProfileImage({
    file,
    type: "banner"
  });
}

/* =========================
   RESET
========================= */

export async function resetAvatar() {
  const profile = await updateMyProfile({
    avatar_url: DEFAULT_AVATAR
  });

  await refreshAfterProfileImageChange(
    profile,
    "avatar",
    DEFAULT_AVATAR
  );

  return profile;
}

export async function resetBanner() {
  const profile = await updateMyProfile({
    banner_url: DEFAULT_BANNER
  });

  await refreshAfterProfileImageChange(
    profile,
    "banner",
    DEFAULT_BANNER
  );

  return profile;
}

/* =========================
   DOM SYNC
========================= */

export function syncAvatarDom(profile = getProfile()) {
  if (!hasDOM()) return;

  document
    .querySelectorAll("[data-rb-avatar], [data-rb-profile-avatar], [data-rb-auth-avatar]")
    .forEach((el) => {
      const url = profileAvatar(profile) || DEFAULT_AVATAR;

      if (el.tagName === "IMG") {
        el.src = url;
        el.alt =
          profile?.display_name ||
          profile?.username ||
          "Rich Bizness Avatar";
      } else {
        el.style.backgroundImage = `url("${url}")`;
      }
    });
}

export function syncBannerDom(profile = getProfile()) {
  if (!hasDOM()) return;

  document
    .querySelectorAll("[data-rb-banner], [data-rb-profile-banner]")
    .forEach((el) => {
      el.style.backgroundImage = `url("${profileBanner(profile) || DEFAULT_BANNER}")`;
    });
}

export function syncProfileDom(profile = getProfile()) {
  bindProfileShell?.();
  syncAvatarDom(profile);
  syncBannerDom(profile);
}

/* =========================
   META AVATAR SEPARATION
========================= */

export async function syncAvatarToUniverse() {
  const profile = getProfile();
  const user = getUser();

  if (!user?.id || !profile?.id) return null;

  const now = new Date().toISOString();

  const payload = {
    user_id: user.id,
    display_name:
      profile.display_name ||
      profile.full_name ||
      profile.username ||
      "Rich User",
    avatar_url: profile.avatar_url || DEFAULT_AVATAR,
    updated_at: now,
    metadata: {
      source: "avatar-sync.js",
      synced_from_profile: true
    }
  };

  const table = RB_TABLES.metaAvatars || "meta_avatars";

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, {
      onConflict: "user_id"
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[RB META AVATAR SYNC SKIPPED]", error.message);
    return null;
  }

  if (hasDOM()) {
    window.dispatchEvent(
      new CustomEvent("rb:avatar-synced", {
        detail: {
          profile,
          metaAvatar: data
        }
      })
    );
  }

  return data;
}

/* =========================
   INPUT BINDING
========================= */

export function bindAvatarInputs({
  avatarInput = "[data-rb-avatar-input]",
  bannerInput = "[data-rb-banner-input]",
  resetAvatarButton = "[data-rb-reset-avatar]",
  resetBannerButton = "[data-rb-reset-banner]"
} = {}) {
  if (!hasDOM()) return;

  document.querySelectorAll(avatarInput).forEach((input) => {
    if (input.dataset.rbAvatarInputBound === "true") return;

    input.dataset.rbAvatarInputBound = "true";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      input.disabled = true;

      try {
        const result = await uploadAvatar(file);
        await syncAvatarToUniverse();
        syncProfileDom(result.profile);
      } catch (error) {
        console.warn("[RB AVATAR UPLOAD FAILED]", error);
        toastError(error?.message || "Avatar upload failed.");
      } finally {
        input.value = "";
        input.disabled = false;
      }
    });
  });

  document.querySelectorAll(bannerInput).forEach((input) => {
    if (input.dataset.rbBannerInputBound === "true") return;

    input.dataset.rbBannerInputBound = "true";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      input.disabled = true;

      try {
        const result = await uploadBanner(file);
        syncProfileDom(result.profile);
      } catch (error) {
        console.warn("[RB BANNER UPLOAD FAILED]", error);
        toastError(error?.message || "Banner upload failed.");
      } finally {
        input.value = "";
        input.disabled = false;
      }
    });
  });

  document.querySelectorAll(resetAvatarButton).forEach((button) => {
    if (button.dataset.rbResetAvatarBound === "true") return;

    button.dataset.rbResetAvatarBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        const profile = await resetAvatar();
        await syncAvatarToUniverse();
        syncProfileDom(profile);
      } catch (error) {
        console.warn("[RB AVATAR RESET FAILED]", error);
        toastError(error?.message || "Avatar reset failed.");
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(resetBannerButton).forEach((button) => {
    if (button.dataset.rbResetBannerBound === "true") return;

    button.dataset.rbResetBannerBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        const profile = await resetBanner();
        syncProfileDom(profile);
      } catch (error) {
        console.warn("[RB BANNER RESET FAILED]", error);
        toastError(error?.message || "Banner reset failed.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

/* =========================
   BOOT
========================= */

export function bootAvatarSync() {
  if (!hasDOM()) return;
  if (avatarSyncBooted) return;

  avatarSyncBooted = true;

  bindAvatarInputs();

  window.addEventListener("rb:profile-updated", () => {
    syncProfileDom(getProfile());
    notifyProfileListeners?.();
  });

  syncProfileDom(getProfile());

  console.log("RB AVATAR SYNC READY");
}

export function resetAvatarSyncBoot() {
  avatarSyncBooted = false;
}

if (hasDOM()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAvatarSync);
  } else {
    bootAvatarSync();
  }
}
