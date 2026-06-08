/* =========================================
   RICH BIZNESS LLC
   /core/pages/edit.js

   EDIT PROFILE PAGE CONTROLLER
   Direct Supabase profile update
   Avatar + Banner Upload Locked
   Meta Avatar Sync Locked

   Flow:
   - Edit updates profiles
   - Avatar upload goes to avatars bucket
   - Banner upload goes to profile-banners bucket
   - Meta avatar syncs only avatar_url + identity metadata
   - No project-avatar fallback
========================================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_ROUTES,
  RB_TABLES,
  RB_BUCKETS,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  toastSuccess,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";

const els = {
  form: $("edit-profile-form"),
  displayName: $("edit-display-name"),
  username: $("edit-username"),
  bio: $("edit-bio"),
  avatarFile: $("edit-avatar-file"),
  bannerFile: $("edit-banner-file"),
  backBtn: $("edit-back-btn"),
  saveBtn: $("edit-save-btn"),
  status: $("edit-status")
};

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentIdentity = null;
let isSubmitting = false;

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function bucket(key, fallback) {
  return RB_BUCKETS?.[key] || fallback || key;
}

function safeImage(value = "", fallback = "") {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

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

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function fileExt(file) {
  const fromName = String(file?.name || "").split(".").pop()?.toLowerCase();

  if (fromName && fromName.length <= 6) return fromName;

  const mime = String(file?.type || "");

  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";

  return "jpg";
}

function setStatus(message = "", type = "info") {
  if (!els.status) return;

  els.status.textContent = message;
  els.status.dataset.type = type;
}

function syncState() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || null;
  currentIdentity = getProfileIdentity(currentProfile);
}

async function fetchMyProfile() {
  const user = getUser();

  if (!user?.id) return null;

  const { data, error } = await supabase
    .from(table("profiles", "profiles"))
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  currentUser = user;
  currentProfile = data || null;
  currentIdentity = getProfileIdentity(currentProfile);

  return currentProfile;
}

function fillForm() {
  const profile = currentProfile || getCurrentUserState?.()?.profile || {};

  if (els.displayName) {
    els.displayName.value = profile.display_name || profile.full_name || "";
  }

  if (els.username) {
    els.username.value = profile.username || "";
  }

  if (els.bio) {
    els.bio.value = profile.bio || "";
  }

  bindProfileShell?.();
}

function setLoading(isLoading) {
  isSubmitting = isLoading;

  if (!els.form) return;

  els.form.classList.toggle("is-loading", isLoading);

  els.form
    .querySelectorAll("button, input, textarea, select")
    .forEach((el) => {
      el.disabled = isLoading;
    });

  if (els.saveBtn) {
    if (!els.saveBtn.dataset.originalText) {
      els.saveBtn.dataset.originalText = els.saveBtn.textContent.trim();
    }

    els.saveBtn.textContent = isLoading
      ? "SAVING..."
      : els.saveBtn.dataset.originalText;
  }
}

function validateImageFile(file) {
  if (!file) return;

  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Only image files can be used for profile media.");
  }

  const maxBytes = 8 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error("Profile images must be under 8MB.");
  }
}

async function uploadProfileFile({ file, bucketName, folder }) {
  if (!file || !currentUser?.id) return null;

  validateImageFile(file);

  const ext = fileExt(file);
  const path = `${currentUser.id}/${folder}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg"
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

async function uploadProfileMedia() {
  const updates = {};

  const avatarBucket = bucket("avatars", "avatars");
  const bannerBucket = bucket("profileBanners", "profile-banners");

  const avatarUrl = await uploadProfileFile({
    file: els.avatarFile?.files?.[0],
    bucketName: avatarBucket,
    folder: "avatar"
  });

  if (avatarUrl) {
    updates.avatar_url = safeImage(avatarUrl, DEFAULT_AVATAR);
  }

  const bannerUrl = await uploadProfileFile({
    file: els.bannerFile?.files?.[0],
    bucketName: bannerBucket,
    folder: "banner"
  });

  if (bannerUrl) {
    updates.banner_url = safeImage(bannerUrl, DEFAULT_BANNER);
  }

  return updates;
}

function validateProfilePayload({ displayName, username }) {
  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!username) {
    throw new Error("Username is required.");
  }

  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }
}

async function updateProfileDirect(payload) {
  if (!currentUser?.id) throw new Error("Missing signed-in user.");

  const { data, error } = await supabase
    .from(table("profiles", "profiles"))
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentUser.id)
    .select()
    .maybeSingle();

  if (error) throw error;

  currentProfile = data || currentProfile;
  currentIdentity = getProfileIdentity(currentProfile);

  return currentProfile;
}

async function syncMetaAvatarFromProfile({ avatarChanged = false } = {}) {
  if (!currentUser?.id || !currentProfile) return;

  const { data: oldMeta } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  const avatarUrl = safeImage(currentProfile.avatar_url, DEFAULT_AVATAR);
  const bannerUrl = safeImage(currentProfile.banner_url, DEFAULT_BANNER);

  const payload = {
    user_id: currentUser.id,
    display_name: currentProfile.display_name || currentProfile.full_name || "Rich User",
    avatar_url: avatarChanged ? avatarUrl : safeImage(oldMeta?.avatar_url, avatarUrl),
    model_url: oldMeta?.model_url || null,
    aura: oldMeta?.aura || "green-gold",
    rank: currentProfile.rank_title || oldMeta?.rank || "Traveler",
    level: Number(currentProfile.rich_level || oldMeta?.level || 1),
    xp: Number(oldMeta?.xp || currentProfile.rich_points || 0),
    is_active: true,
    metadata: {
      ...(oldMeta?.metadata || {}),
      source: "edit.js",
      app: "Rich Bizness Mobile",
      profile_lock: true,
      profile_key_source: RB_PROFILE_KEYS?.identitySource || "profiles",
      synced_from: table("profiles", "profiles"),
      profile_avatar_url: avatarUrl,
      banner_url: bannerUrl,
      avatar_changed: Boolean(avatarChanged),
      last_synced_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}

async function saveProfile(event) {
  event.preventDefault();

  if (isSubmitting) return;

  const user = getUser();

  if (!user?.id) {
    toastError("You must be signed in to edit your profile.");
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  setLoading(true);
  setStatus("Saving profile...", "info");

  try {
    currentUser = user;

    await ensureMyProfile();
    await fetchMyProfile();

    const displayName = els.displayName?.value?.trim() || "";
    const username = cleanUsername(els.username?.value || "");
    const bio = els.bio?.value?.trim() || "";

    validateProfilePayload({
      displayName,
      username
    });

    const mediaUpdates = await uploadProfileMedia();

    const nextProfile = await updateProfileDirect({
      display_name: displayName,
      full_name: displayName,
      username,
      bio,
      ...mediaUpdates
    });

    await syncMetaAvatarFromProfile({
      avatarChanged: Boolean(mediaUpdates.avatar_url)
    });

    await refreshAppIdentity();
    await fetchMyProfile();

    bindProfileShell?.();

    setStatus("Profile updated.", "success");
    toastSuccess("Profile updated successfully.", "Rich Bizness");

    window.location.href = RB_ROUTES.profile || "/profile";
  } catch (error) {
    console.error("[RB EDIT SAVE FAILED]", error);
    setStatus(error?.message || "Failed to update profile.", "error");
    toastError(error?.message || "Failed to update profile.");
  } finally {
    setLoading(false);
  }
}

function bindEditActions() {
  els.backBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  els.form?.addEventListener("submit", saveProfile);
}

async function bootEditPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false,
      ensureProfile: true
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshAppIdentity();

    syncState();

    await fetchMyProfile();

    fillForm();
    bindEditActions();

    document.body.dataset.rbPage = "edit";
    document.body.dataset.rbRoute = "edit";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-edit-ready");

    markPageReady("edit");

    console.log("RB EDIT PAGE READY");
  } catch (error) {
    console.error("[RB EDIT BOOT FAILED]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEditPage);
} else {
  bootEditPage();
}
