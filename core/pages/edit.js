/* =========================
   RICH BIZNESS MOBILE
   /core/pages/edit.js

   EDIT PROFILE FOUNDATION CONTROLLER
========================= */

import {
  autoGuardCurrentPage
} from "/core/shared/rb-guards.js";

import {
  initAuthState,
  getAuthState,
  onAuthState,
  refreshAuthProfile
} from "/core/features/auth/auth-state.js";

import {
  updateMyProfile
} from "/core/shared/rb-profile.js";

import {
  uploadByRoute
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
  backBtn: $("edit-back-btn")
};

function fillForm(state) {
  const profile = state?.profile;
  if (!profile) return;

  if (els.displayName) els.displayName.value = profile.display_name || "";
  if (els.username) els.username.value = profile.username || "";
  if (els.bio) els.bio.value = profile.bio || "";
}

async function uploadProfileMedia() {
  const updates = {};

  const avatar = els.avatarFile?.files?.[0];
  const banner = els.bannerFile?.files?.[0];

  if (avatar) {
    const uploaded = await uploadByRoute({
      type: "profileAvatar",
      file: avatar,
      metadata: { purpose: "profile_avatar" },
      upsert: false
    });

    updates.avatar_url = uploaded.publicUrl;
  }

  if (banner) {
    const uploaded = await uploadByRoute({
      type: "profileBanner",
      file: banner,
      metadata: { purpose: "profile_banner" },
      upsert: false
    });

    updates.banner_url = uploaded.publicUrl;
  }

  return updates;
}

function bindEditActions() {
  els.backBtn?.addEventListener("click", () => {
    window.location.href = "/profile";
  });

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      els.form.classList.add("is-loading");

      const mediaUpdates = await uploadProfileMedia();

      await updateMyProfile({
        display_name: els.displayName?.value?.trim() || "",
        username: els.username?.value?.trim() || "",
        bio: els.bio?.value?.trim() || "",
        ...mediaUpdates
      });

      await refreshAuthProfile();

      toastSuccess("Profile updated.", "Rich Bizness");

      window.location.href = "/profile";
    } catch (error) {
      toastError(error.message || "Profile update failed.");
    } finally {
      els.form.classList.remove("is-loading");
    }
  });
}

async function bootEditPage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  fillForm(state);

  onAuthState((nextState) => {
    fillForm(nextState);
  });

  bindEditActions();

  document.body.classList.add("rb-edit-ready");

  console.log("RB EDIT FOUNDATION READY");
}

bootEditPage();
