/* =========================
   RICH BIZNESS MOBILE
   /core/pages/edit.js
========================= */

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
  const profile = state?.profile || null;

  if (!profile) return;

  if (els.displayName) els.displayName.value = profile.display_name || "";
  if (els.username) els.username.value = profile.username || "";
  if (els.bio) els.bio.value = profile.bio || "";
}

function setLoading(isLoading) {
  els.form?.classList.toggle("is-loading", isLoading);

  els.form
    ?.querySelectorAll("button,input,textarea,select")
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

async function uploadProfileMedia() {
  const updates = {};

  const avatar = els.avatarFile?.files?.[0] || null;
  const banner = els.bannerFile?.files?.[0] || null;

  if (avatar) {
    const result = await createContentWithUpload({
      type: "profileAvatar",
      file: avatar,
      values: {},
      metadata: {
        purpose: "profile_avatar",
        source: "edit.js"
      },
      upsert: true
    });

    const url = result?.uploaded?.publicUrl || result?.publicUrl || null;

    if (url) updates.avatar_url = url;
  }

  if (banner) {
    const result = await createContentWithUpload({
      type: "profileBanner",
      file: banner,
      values: {},
      metadata: {
        purpose: "profile_banner",
        source: "edit.js"
      },
      upsert: true
    });

    const url = result?.uploaded?.publicUrl || result?.publicUrl || null;

    if (url) updates.banner_url = url;
  }

  return updates;
}

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function bindEditActions() {
  els.backBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      const mediaUpdates = await uploadProfileMedia();

      const displayName = els.displayName?.value?.trim() || "";

      await updateMyProfile({
        display_name: displayName,
        full_name: displayName,
        username: cleanUsername(els.username?.value || ""),
        bio: els.bio?.value?.trim() || "",
        ...mediaUpdates
      });

      await refreshAppIdentity();

      toastSuccess("Profile updated.", "Rich Bizness");

      window.location.href = RB_ROUTES.profile || "/profile";
    } catch (error) {
      console.error("[edit.js]", error);
      toastError(error?.message || "Profile update failed.");
    } finally {
      setLoading(false);
    }
  });
}

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

    console.log("RB EDIT READY");
  } catch (error) {
    console.error("[edit.js]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEditPage);
} else {
  bootEditPage();
}
