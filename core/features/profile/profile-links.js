/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-links.js

   UNIVERSAL PROFILE LINK ENGINE
   Avatar + Username Routing
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getProfileById,
  getProfileByUsername,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const PROFILE_SELECTOR = `
  [data-profile-id],
  [data-profile-username],
  [data-rb-profile-link]
`;

let linksBound = false;

/* =========================
   PROFILE URL HELPERS
========================= */

export function buildProfileRoute({
  id = "",
  username = ""
} = {}) {
  const cleanUsername = String(username || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

  if (cleanUsername) {
    return `${RB_ROUTES.profile}?u=${encodeURIComponent(cleanUsername)}`;
  }

  if (id) {
    return `${RB_ROUTES.profile}?id=${encodeURIComponent(id)}`;
  }

  return RB_ROUTES.profile;
}

export async function resolveProfileRoute({
  id = "",
  username = ""
} = {}) {
  if (username) {
    const profile = await getProfileByUsername(username);

    if (profile) {
      return buildProfileUrl(profile);
    }
  }

  if (id) {
    const profile = await getProfileById(id);

    if (profile) {
      return buildProfileUrl(profile);
    }
  }

  return RB_ROUTES.profile;
}

/* =========================
   NAVIGATION
========================= */

export async function openProfile({
  id = "",
  username = "",
  replace = false
} = {}) {
  const url = await resolveProfileRoute({
    id,
    username
  });

  if (replace) {
    window.location.replace(url);
    return;
  }

  window.location.href = url;
}

export function attachProfileRoute(el, {
  id = "",
  username = ""
} = {}) {
  if (!el) return;

  if (id) {
    el.dataset.profileId = id;
  }

  if (username) {
    el.dataset.profileUsername = username;
  }

  el.dataset.rbProfileLink = "true";
}

/* =========================
   CLICK BINDING
========================= */

export function bindProfileLinks(root = document) {
  if (!root) return;

  root.querySelectorAll(PROFILE_SELECTOR).forEach((el) => {
    if (el.dataset.rbProfileBound === "true") return;

    el.dataset.rbProfileBound = "true";

    el.style.cursor = "pointer";

    el.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const profileId =
        el.dataset.profileId ||
        el.getAttribute("data-profile-id") ||
        "";

      const profileUsername =
        el.dataset.profileUsername ||
        el.getAttribute("data-profile-username") ||
        "";

      await openProfile({
        id: profileId,
        username: profileUsername
      });
    });
  });
}

/* =========================
   PROFILE CARD ROUTING
========================= */

export function bindProfileCards(selector = ".rb-profile-card") {
  document.querySelectorAll(selector).forEach((card) => {
    if (card.dataset.rbProfileCardBound === "true") return;

    card.dataset.rbProfileCardBound = "true";

    const profileId =
      card.dataset.profileId || "";

    const profileUsername =
      card.dataset.profileUsername || "";

    card.addEventListener("click", async () => {
      await openProfile({
        id: profileId,
        username: profileUsername
      });
    });
  });
}

/* =========================
   AVATAR ROUTING
========================= */

export function bindAvatarLinks(selector = "[data-rb-avatar-link]") {
  document.querySelectorAll(selector).forEach((avatar) => {
    if (avatar.dataset.rbAvatarBound === "true") return;

    avatar.dataset.rbAvatarBound = "true";

    avatar.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await openProfile({
        id: avatar.dataset.profileId,
        username: avatar.dataset.profileUsername
      });
    });
  });
}

/* =========================
   USERNAME ROUTING
========================= */

export function bindUsernameLinks(selector = "[data-rb-username-link]") {
  document.querySelectorAll(selector).forEach((username) => {
    if (username.dataset.rbUsernameBound === "true") return;

    username.dataset.rbUsernameBound = "true";

    username.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await openProfile({
        id: username.dataset.profileId,
        username: username.dataset.profileUsername
      });
    });
  });
}

/* =========================
   AUTO BOOT
========================= */

export function bootProfileLinks() {
  if (linksBound) return;

  linksBound = true;

  bindProfileLinks();
  bindProfileCards();
  bindAvatarLinks();
  bindUsernameLinks();

  const observer = new MutationObserver(() => {
    bindProfileLinks();
    bindProfileCards();
    bindAvatarLinks();
    bindUsernameLinks();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("RB PROFILE LINKS READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProfileLinks);
} else {
  bootProfileLinks();
}
