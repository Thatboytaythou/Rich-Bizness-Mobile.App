/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-editor.js

   PROFILE EDITOR ENGINE
   Text fields + avatar/banner sync
   No auto image swapping outside profile fields
========================= */

import {
  updateMyProfile,
  refreshMyProfile,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  getUser,
  getProfile,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  notifyProfileListeners
} from "/core/features/profile/profile-state.js";

import {
  bindAvatarInputs,
  syncProfileDom,
  syncAvatarToUniverse
} from "/core/features/profile/avatar-sync.js";

const DEFAULT_FIELDS = Object.freeze({
  display_name: "",
  username: "",
  full_name: "",
  bio: "",
  website_url: "",
  instagram_url: "",
  youtube_url: "",
  tiktok_url: "",
  facebook_url: "",
  snapchat_url: "",
  favorite_section: ""
});

let editorBound = false;

const $ = (selector) => document.querySelector(selector);

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function cleanUrl(value = "") {
  const url = String(value || "").trim();

  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `https://${url}`;
}

function cleanProfileValues(values = {}) {
  const cleaned = { ...values };

  if (cleaned.username) {
    cleaned.username = cleanUsername(cleaned.username);
  }

  [
    "website_url",
    "instagram_url",
    "youtube_url",
    "tiktok_url",
    "facebook_url",
    "snapchat_url"
  ].forEach((key) => {
    if (cleaned[key]) cleaned[key] = cleanUrl(cleaned[key]);
  });

  if (cleaned.display_name && !cleaned.full_name) {
    cleaned.full_name = cleaned.display_name;
  }

  return cleaned;
}

function getFormValues(form) {
  const formData = new FormData(form);
  const values = {};

  Object.keys(DEFAULT_FIELDS).forEach((key) => {
    if (!formData.has(key)) return;

    values[key] = String(formData.get(key) || "").trim();
  });

  return cleanProfileValues(values);
}

function setEditorMessage(text = "", type = "info") {
  const el =
    $("[data-rb-profile-message]") ||
    $("#rb-profile-message") ||
    $("#edit-profile-message");

  if (!el) return;

  el.textContent = text;
  el.dataset.type = type;
}

function setLoading(form, isLoading) {
  if (!form) return;

  form.classList.toggle("is-loading", isLoading);

  form
    .querySelectorAll("button, input, textarea, select")
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

function setValue(form, key, value = "") {
  const input = form.elements[key];
  if (!input) return;

  input.value = value || "";
}

export function fillProfileEditor(formSelector = "#rb-profile-editor-form") {
  const form = $(formSelector);
  const profile = getProfile();

  if (!form || !profile) return;

  Object.keys(DEFAULT_FIELDS).forEach((key) => {
    setValue(form, key, profile[key] || "");
  });

  bindProfileShell?.();
  syncProfileDom?.(profile);
}

export async function saveProfileFromForm(form) {
  if (!form) {
    throw new Error("Profile form not found.");
  }

  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  await ensureMyProfile();

  const values = getFormValues(form);
  const profile = await updateMyProfile(values);

  await refreshMyProfile();
  await refreshProfileState();

  bindProfileShell?.();
  syncProfileDom?.(profile);
  notifyProfileListeners?.();

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        type: "profile",
        profile
      }
    })
  );

  return profile;
}

export function bindProfileEditor(formSelector = "#rb-profile-editor-form") {
  const form = $(formSelector);

  if (!form || form.dataset.rbProfileEditorBound === "true") return;

  form.dataset.rbProfileEditorBound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    setLoading(form, true);
    setEditorMessage("Saving profile...", "info");

    try {
      const profile = await saveProfileFromForm(form);

      setEditorMessage("Profile updated.", "success");
      syncProfileDom?.(profile);
      bindProfileShell?.();

      await syncAvatarToUniverse?.();
    } catch (error) {
      console.warn("[RB PROFILE SAVE FAILED]", error);
      setEditorMessage(error?.message || "Profile save failed.", "error");
    } finally {
      setLoading(form, false);
    }
  });

  fillProfileEditor(formSelector);
}

export function bindProfileEditorButtons({
  formSelector = "#rb-profile-editor-form",
  refreshButton = "[data-rb-refresh-profile]",
  resetButton = "[data-rb-reset-profile-form]"
} = {}) {
  document.querySelectorAll(refreshButton).forEach((button) => {
    if (button.dataset.rbRefreshProfileBound === "true") return;

    button.dataset.rbRefreshProfileBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;
      setEditorMessage("Refreshing profile...", "info");

      try {
        await refreshMyProfile();
        await refreshProfileState();

        fillProfileEditor(formSelector);

        setEditorMessage("Profile refreshed.", "success");
      } catch (error) {
        console.warn("[RB PROFILE REFRESH FAILED]", error);
        setEditorMessage(error?.message || "Profile refresh failed.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(resetButton).forEach((button) => {
    if (button.dataset.rbResetProfileFormBound === "true") return;

    button.dataset.rbResetProfileFormBound = "true";

    button.addEventListener("click", () => {
      fillProfileEditor(formSelector);
      setEditorMessage("Changes reset.", "info");
    });
  });
}

export function bootProfileEditor({
  formSelector = "#rb-profile-editor-form"
} = {}) {
  if (editorBound) return;

  editorBound = true;

  bindAvatarInputs?.();
  bindProfileEditor(formSelector);
  bindProfileEditorButtons({ formSelector });

  window.addEventListener("rb:profile-updated", () => {
    fillProfileEditor(formSelector);
  });

  console.log("RB PROFILE EDITOR READY");
}

export function resetProfileEditorBoot() {
  editorBound = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootProfileEditor());
} else {
  bootProfileEditor();
}
