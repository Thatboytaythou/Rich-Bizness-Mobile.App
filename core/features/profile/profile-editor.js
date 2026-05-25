/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-editor.js

   PROFILE EDITOR ENGINE
   Text fields + avatar/banner sync
========================= */

import {
  updateMyProfile,
  refreshMyProfile,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  getUser,
  getProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  notifyProfileListeners
} from "/core/features/profile/profile-state.js";

import {
  bindAvatarInputs,
  syncProfileDom
} from "/core/features/profile/avatar-sync.js";

const DEFAULT_FIELDS = {
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
};

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

function getFormValues(form) {
  const formData = new FormData(form);
  const values = {};

  Object.keys(DEFAULT_FIELDS).forEach((key) => {
    if (!formData.has(key)) return;

    values[key] = String(formData.get(key) || "").trim();
  });

  if (values.username) {
    values.username = cleanUsername(values.username);
  }

  return values;
}

function setEditorMessage(text = "", type = "info") {
  const el = $("[data-rb-profile-message]") || $("#rb-profile-message");
  if (!el) return;

  el.textContent = text;
  el.dataset.type = type;
}

function setLoading(form, isLoading) {
  if (!form) return;

  form.classList.toggle("is-loading", isLoading);

  form.querySelectorAll("button, input, textarea, select").forEach((el) => {
    el.disabled = isLoading;
  });
}

export function fillProfileEditor(formSelector = "#rb-profile-editor-form") {
  const form = $(formSelector);
  const profile = getProfile();

  if (!form || !profile) return;

  Object.keys(DEFAULT_FIELDS).forEach((key) => {
    const input = form.elements[key];
    if (!input) return;

    input.value = profile[key] || "";
  });

  bindProfileShell();
  syncProfileDom(profile);
}

export async function saveProfileFromForm(form) {
  if (!getUser()?.id) {
    throw new Error("You must be signed in.");
  }

  const values = getFormValues(form);

  const profile = await updateMyProfile(values);

  await refreshMyProfile();
  await refreshProfileState();

  syncProfileDom(profile);
  notifyProfileListeners();

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
      syncProfileDom(profile);
    } catch (error) {
      console.warn("[RB PROFILE SAVE FAILED]", error);
      setEditorMessage(error.message || "Profile save failed.", "error");
    } finally {
      setLoading(form, false);
    }
  });

  fillProfileEditor(formSelector);
}

export function bindProfileEditorButtons({
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
        fillProfileEditor();
        setEditorMessage("Profile refreshed.", "success");
      } catch (error) {
        console.warn("[RB PROFILE REFRESH FAILED]", error);
        setEditorMessage(error.message || "Profile refresh failed.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(resetButton).forEach((button) => {
    if (button.dataset.rbResetProfileFormBound === "true") return;
    button.dataset.rbResetProfileFormBound = "true";

    button.addEventListener("click", () => {
      fillProfileEditor();
      setEditorMessage("Changes reset.", "info");
    });
  });
}

export function bootProfileEditor({
  formSelector = "#rb-profile-editor-form"
} = {}) {
  if (editorBound) return;
  editorBound = true;

  bindAvatarInputs();
  bindProfileEditor(formSelector);
  bindProfileEditorButtons();

  window.addEventListener("rb:profile-updated", () => {
    fillProfileEditor(formSelector);
  });

  console.log("RB PROFILE EDITOR READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootProfileEditor());
} else {
  bootProfileEditor();
}
