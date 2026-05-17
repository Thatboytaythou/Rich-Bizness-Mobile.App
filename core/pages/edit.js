/* =========================
   RICH BIZNESS MOBILE
   /core/pages/edit.js

   EDIT PROFILE FOUNDATION CONTROLLER
   Correct Guard Import Locked
========================= */

import {
  autoGuardCurrentPage
} from "/core/features/auth/session-guard.js";

import {
  initAuthState,
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

async function uploadProfileMedia() {
  const updates = {};

  const avatar = els.avatarFile?.files?.[0] || null;
  const banner = els.bannerFile?.files?.[0] || null;

  if (avatar) {
    const uploaded = await uploadByRoute({
      type: "profileAvatar",
      file: avatar,
      metadata: {
        purpose: "profile_avatar"
      },
      upsert: false
    });

    if (uploaded?.publicUrl) {
      updates.avatar_url = uploaded.publicUrl;
    }
  }

  if (banner) {
    const uploaded = await uploadByRoute({
      type: "profileBanner",
      file: banner,
      metadata: {
        purpose: "profile_banner"
      },
      upsert: false
    });

    if (uploaded?.publicUrl) {
      updates.banner_url = uploaded.publicUrl;
    }
  }

  return updates;
}

function setLoading(isLoading) {
  els.form?.classList.toggle("is-loading", isLoading);

  els.form
    ?.querySelectorAll("button, input, textarea")
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

function bindEditActions() {
  els.backBtn?.addEventListener("click", () => {
    window.location.href = "/profile";
  });

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

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
      setLoading(false);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootEditPage);
} else {
  bootEditPage();
}
