/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/avatar-sync.js

   AVATAR + BANNER SYNC ENGINE
   Profiles table + storage buckets
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
} from "/core/shared/rb-auth.js";

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

const supabase = getSupabase();

const DEFAULT_AVATAR =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const MAX_IMAGE_SIZE_MB = 12;

function createSafeFileName(file, prefix = "image") {
  const user = getUser();
  const ext = String(file?.name || "upload.png")
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

  const bucket = isBanner
    ? RB_BUCKETS.profileBanners
    : RB_BUCKETS.avatars;

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

  await loadProfile(user.id);
  await refreshProfileState();

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        type,
        profile,
        url: publicUrl
      }
    })
  );

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

export async function resetAvatar() {
  const profile = await updateMyProfile({
    avatar_url: DEFAULT_AVATAR
  });

  await refreshProfileState();

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        type: "avatar",
        profile,
        url: DEFAULT_AVATAR
      }
    })
  );

  return profile;
}

export async function resetBanner() {
  const profile = await updateMyProfile({
    banner_url: DEFAULT_BANNER
  });

  await refreshProfileState();

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        type: "banner",
        profile,
        url: DEFAULT_BANNER
      }
    })
  );

  return profile;
}

export function syncAvatarDom(profile = getProfile()) {
  document.querySelectorAll("[data-rb-avatar], [data-rb-auth-avatar]").forEach((el) => {
    const url = profileAvatar(profile);

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
  document.querySelectorAll("[data-rb-banner]").forEach((el) => {
    el.style.backgroundImage = `url("${profileBanner(profile)}")`;
  });
}

export function syncProfileDom(profile = getProfile()) {
  bindProfileShell();
  syncAvatarDom(profile);
  syncBannerDom(profile);
}

export function bindAvatarInputs({
  avatarInput = "[data-rb-avatar-input]",
  bannerInput = "[data-rb-banner-input]",
  resetAvatarButton = "[data-rb-reset-avatar]",
  resetBannerButton = "[data-rb-reset-banner]"
} = {}) {
  document.querySelectorAll(avatarInput).forEach((input) => {
    if (input.dataset.rbAvatarInputBound === "true") return;
    input.dataset.rbAvatarInputBound = "true";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      input.disabled = true;

      try {
        const result = await uploadAvatar(file);
        syncProfileDom(result.profile);
      } catch (error) {
        console.warn("[RB AVATAR UPLOAD FAILED]", error);
        alert(error.message || "Avatar upload failed.");
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
        alert(error.message || "Banner upload failed.");
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
        syncProfileDom(profile);
      } catch (error) {
        console.warn("[RB AVATAR RESET FAILED]", error);
        alert(error.message || "Avatar reset failed.");
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
        alert(error.message || "Banner reset failed.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function bootAvatarSync() {
  bindAvatarInputs();

  window.addEventListener("rb:profile-updated", () => {
    syncProfileDom(getProfile());
    notifyProfileListeners();
  });

  syncProfileDom(getProfile());

  console.log("RB AVATAR SYNC READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAvatarSync);
} else {
  bootAvatarSync();
}
