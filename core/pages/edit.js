/* =========================
   RICH BIZNESS MOBILE
   /core/pages/edit.js

   EDIT PROFILE CONTROLLER
   LOCKED TO /core/app.js
========================= */

import {
  initApp,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  getAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  updateMyProfile
} from "/core/shared/rb-profile.js";

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
  backBtn: $("edit-back-btn")
};

function fillForm(state = getAuthState()) {
  const profile = state?.profile || null;

  if (!profile) return;

  if (els.displayName) {
    els.displayName.value = profile.display_name || "";
  }

  if (els.username) {
    els.username.value = profile.username || "";
  }

  if (els.bio) {
    els.bio.value = profile.bio || "";
  }
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

  const avatar =
    els.avatarFile?.files?.[0] || null;

  const banner =
    els.bannerFile?.files?.[0] || null;

  if (avatar) {
    const result = await createContentWithUpload({
      type: "profileAvatar",
      file: avatar,
      values: {},
      metadata: {
        purpose: "profile_avatar",
        source: "edit_profile"
      },
      upsert: true
    });

    const url =
      result?.uploaded?.publicUrl || null;

    if (url) {
      updates.avatar_url = url;
    }
  }

  if (banner) {
    const result = await createContentWithUpload({
      type: "profileBanner",
      file: banner,
      values: {},
      metadata: {
        purpose: "profile_banner",
        source: "edit_profile"
      },
      upsert: true
    });

    const url =
      result?.uploaded?.publicUrl || null;

    if (url) {
      updates.banner_url = url;
    }
  }

  return updates;
}

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function bindEditActions() {
  els.backBtn?.addEventListener("click", () => {
    window.location.href = "/profile";
  });

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      const mediaUpdates =
        await uploadProfileMedia();

      await updateMyProfile({
        display_name:
          els.displayName?.value?.trim() || "",
        full_name:
          els.displayName?.value?.trim() || "",
        username:
          cleanUsername(els.username?.value || ""),
        bio:
          els.bio?.value?.trim() || "",
        ...mediaUpdates
      });

      await refreshAppIdentity();

      toastSuccess(
        "Profile updated.",
        "Rich Bizness"
      );

      window.location.href = "/profile";
    } catch (error) {
      console.error(error);

      toastError(
        error?.message ||
          "Profile update failed."
      );
    } finally {
      setLoading(false);
    }
  });
}

async function bootEditPage() {
  try {
    const appState = await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    fillForm(appState.auth);

    onAuthState((nextState) => {
      fillForm(nextState);
    });

    bindEditActions();

    document.body.classList.add("rb-edit-ready");

    markPageReady("edit");

    console.log("RB EDIT READY");
  } catch (error) {
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEditPage);
} else {
  bootEditPage();
}
