/* =========================================
   RICH BIZNESS LLC
   /core/pages/edit.js

   EDIT PROFILE PAGE CONTROLLER
   Locked to shared auth/profile/upload identity chain
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
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  updateMyProfile,
  refreshMyProfile,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  refreshProfileState
} from "/core/features/profile/profile-state.js";

import {
  syncAvatarToUniverse
} from "/core/features/profile/avatar-sync.js";

import {
  createContentWithUpload
} from "/core/shared/rb-upload-router.js";

import {
  toastSuccess,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

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

let isSubmitting = false;

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function currentProfile() {
  return getCurrentUserState()?.profile || {};
}

function setStatus(message = "", type = "info") {
  if (!els.status) return;

  els.status.textContent = message;
  els.status.dataset.type = type;
}

function fillForm() {
  const profile = currentProfile();

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

async function uploadOneProfileFile({ file, type, purpose }) {
  if (!file) return null;

  const result = await createContentWithUpload({
    type,
    file,
    metadata: {
      purpose,
      source: "edit.js",
      section: "profile",
      profile_lock: true,
      profile_key_source: RB_PROFILE_KEYS?.identitySource || "profiles"
    },
    upsert: true
  });

  return (
    result?.uploaded?.publicUrl ||
    result?.uploaded?.public_url ||
    result?.uploaded?.url ||
    result?.publicUrl ||
    result?.public_url ||
    result?.url ||
    null
  );
}

async function uploadProfileMedia() {
  const updates = {};

  const avatarUrl = await uploadOneProfileFile({
    file: els.avatarFile?.files?.[0],
    type: "profileAvatar",
    purpose: "profile_avatar"
  });

  if (avatarUrl) {
    updates.avatar_url = avatarUrl;
  }

  const bannerUrl = await uploadOneProfileFile({
    file: els.bannerFile?.files?.[0],
    type: "profileBanner",
    purpose: "profile_banner"
  });

  if (bannerUrl) {
    updates.banner_url = bannerUrl;
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
    await ensureMyProfile();

    const displayName = els.displayName?.value?.trim() || "";
    const username = cleanUsername(els.username?.value || "");
    const bio = els.bio?.value?.trim() || "";

    validateProfilePayload({
      displayName,
      username
    });

    const mediaUpdates = await uploadProfileMedia();

    await updateMyProfile({
      display_name: displayName,
      full_name: displayName,
      username,
      bio,
      ...mediaUpdates
    });

    await refreshMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    if (mediaUpdates.avatar_url || mediaUpdates.banner_url) {
      await syncAvatarToUniverse();
    }

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
      ensureProfile: true,
      profileState: true
    });

    await ensureMyProfile();
    await refreshAppIdentity();

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
