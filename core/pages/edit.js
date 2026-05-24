/* =========================================
   RICH BIZNESS LLC
   /core/pages/edit.js
   PROFILE EDIT PAGE CONTROLLER - POLISHED
========================================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import { updateMyProfile } from "/core/shared/rb-profile.js";

import { createContentWithUpload } from "/core/shared/rb-upload-router.js";

import { RB_ROUTES } from "/core/shared/rb-config.js";

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
  backBtn: $("edit-back-btn")
};

function fillForm() {
  const state = getCurrentUserState();
  const profile = state?.profile || {};

  if (els.displayName) els.displayName.value = profile.display_name || "";
  if (els.username) els.username.value = profile.username || "";
  if (els.bio) els.bio.value = profile.bio || "";
}

function setLoading(isLoading) {
  if (!els.form) return;

  els.form.classList.toggle("is-loading", isLoading);

  els.form.querySelectorAll("button, input, textarea, select").forEach((el) => {
    el.disabled = isLoading;
  });
}

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

async function uploadProfileMedia() {
  const updates = {};

  // Avatar
  if (els.avatarFile?.files?.[0]) {
    try {
      const result = await createContentWithUpload({
        type: "profileAvatar",
        file: els.avatarFile.files[0],
        metadata: { purpose: "profile_avatar", source: "edit.js" },
        upsert: true
      });

      const url = result?.uploaded?.publicUrl || result?.publicUrl;
      if (url) updates.avatar_url = url;
    } catch (err) {
      console.warn("Avatar upload failed:", err);
    }
  }

  // Banner
  if (els.bannerFile?.files?.[0]) {
    try {
      const result = await createContentWithUpload({
        type: "profileBanner",
        file: els.bannerFile.files[0],
        metadata: { purpose: "profile_banner", source: "edit.js" },
        upsert: true
      });

      const url = result?.uploaded?.publicUrl || result?.publicUrl;
      if (url) updates.banner_url = url;
    } catch (err) {
      console.warn("Banner upload failed:", err);
    }
  }

  return updates;
}

function bindEditActions() {
  // Back button
  els.backBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  // Form submit
  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      const mediaUpdates = await uploadProfileMedia();

      const payload = {
        display_name: els.displayName?.value?.trim() || "",
        full_name: els.displayName?.value?.trim() || "",
        username: cleanUsername(els.username?.value),
        bio: els.bio?.value?.trim() || "",
        ...mediaUpdates
      };

      await updateMyProfile(payload);
      await refreshAppIdentity();

      toastSuccess("Profile updated successfully.", "Rich Bizness");
      window.location.href = RB_ROUTES.profile || "/profile";

    } catch (error) {
      console.error("[edit.js]", error);
      toastError(error?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  });
}

/* ====================== BOOT ====================== */

async function bootEditPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    fillForm();
    bindEditActions();

    document.body.classList.add("rb-edit-ready");
    markPageReady("edit");

    console.log("🚀 RB EDIT PAGE READY");
  } catch (error) {
    console.error("[edit.js] Boot failed:", error);
    markPageError(error);
  }
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEditPage);
} else {
  bootEditPage();
}
