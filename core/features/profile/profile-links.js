/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-links.js

   UNIVERSAL PROFILE LINK ENGINE
   Avatar + Username Routing
   No duplicate routing / no forced image swapping
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getProfileById,
  getProfileByUsername,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

import {
  go
} from "/core/shared/rb-navigation.js";

const PROFILE_SELECTOR = `
  [data-profile-id],
  [data-profile-username],
  [data-rb-profile-link],
  [data-rb-avatar-link],
  [data-rb-username-link]
`;

let linksBound = false;
let observer = null;

/* =========================
   CLEAN HELPERS
========================= */

function cleanUsername(username = "") {
  return String(username || "")
    .replace("@", "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function cleanId(id = "") {
  return String(id || "").trim();
}

function getElementProfileTarget(el) {
  return {
    id:
      cleanId(el?.dataset?.profileId) ||
      cleanId(el?.getAttribute?.("data-profile-id")),
    username:
      cleanUsername(el?.dataset?.profileUsername) ||
      cleanUsername(el?.getAttribute?.("data-profile-username"))
  };
}

/* =========================
   PROFILE URL HELPERS
========================= */

export function buildProfileRoute({
  id = "",
  username = ""
} = {}) {
  const cleanUser = cleanUsername(username);
  const cleanUserId = cleanId(id);

  if (cleanUser) {
    return `${RB_ROUTES.profile || "/profile"}?u=${encodeURIComponent(cleanUser)}`;
  }

  if (cleanUserId) {
    return `${RB_ROUTES.profile || "/profile"}?id=${encodeURIComponent(cleanUserId)}`;
  }

  return RB_ROUTES.profile || "/profile";
}

export async function resolveProfileRoute({
  id = "",
  username = ""
} = {}) {
  const cleanUser = cleanUsername(username);
  const cleanUserId = cleanId(id);

  try {
    if (cleanUser) {
      const profile = await getProfileByUsername(cleanUser);

      if (profile?.id) {
        return buildProfileUrl(profile);
      }
    }

    if (cleanUserId) {
      const profile = await getProfileById(cleanUserId);

      if (profile?.id) {
        return buildProfileUrl(profile);
      }
    }
  } catch (error) {
    console.warn("[RB PROFILE ROUTE RESOLVE SKIPPED]", error?.message || error);
  }

  return buildProfileRoute({
    id: cleanUserId,
    username: cleanUser
  });
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
    return url;
  }

  go(url);
  return url;
}

export function attachProfileRoute(
  el,
  {
    id = "",
    username = ""
  } = {}
) {
  if (!el) return null;

  const cleanUserId = cleanId(id);
  const cleanUser = cleanUsername(username);

  if (cleanUserId) {
    el.dataset.profileId = cleanUserId;
  }

  if (cleanUser) {
    el.dataset.profileUsername = cleanUser;
  }

  el.dataset.rbProfileLink = "true";

  if (!el.hasAttribute("role") && el.tagName !== "A" && el.tagName !== "BUTTON") {
    el.setAttribute("role", "link");
  }

  if (!el.hasAttribute("tabindex") && el.tagName !== "A" && el.tagName !== "BUTTON") {
    el.tabIndex = 0;
  }

  return el;
}

/* =========================
   BIND ONE
========================= */

function bindOneProfileLink(el) {
  if (!el || el.dataset.rbProfileBound === "true") return;

  el.dataset.rbProfileBound = "true";
  el.style.cursor = "pointer";

  if (!el.hasAttribute("role") && el.tagName !== "A" && el.tagName !== "BUTTON") {
    el.setAttribute("role", "link");
  }

  if (!el.hasAttribute("tabindex") && el.tagName !== "A" && el.tagName !== "BUTTON") {
    el.tabIndex = 0;
  }

  const handler = async (event) => {
    const nestedAction = event.target.closest(
      "button, input, textarea, select, audio, video, [data-no-profile-link]"
    );

    if (nestedAction && nestedAction !== el) return;

    event.preventDefault();
    event.stopPropagation();

    const target = getElementProfileTarget(el);

    await openProfile(target);
  };

  el.addEventListener("click", handler);

  el.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();

    const target = getElementProfileTarget(el);

    await openProfile(target);
  });
}

/* =========================
   CLICK BINDING
========================= */

export function bindProfileLinks(root = document) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll(PROFILE_SELECTOR).forEach(bindOneProfileLink);
}

/* =========================
   PROFILE CARD ROUTING
========================= */

export function bindProfileCards(selector = ".rb-profile-card") {
  document.querySelectorAll(selector).forEach((card) => {
    if (card.dataset.rbProfileCardBound === "true") return;

    card.dataset.rbProfileCardBound = "true";

    attachProfileRoute(card, {
      id: card.dataset.profileId || "",
      username: card.dataset.profileUsername || ""
    });

    bindOneProfileLink(card);
  });
}

/* =========================
   AVATAR ROUTING
========================= */

export function bindAvatarLinks(selector = "[data-rb-avatar-link]") {
  document.querySelectorAll(selector).forEach((avatar) => {
    attachProfileRoute(avatar, {
      id: avatar.dataset.profileId || "",
      username: avatar.dataset.profileUsername || ""
    });

    bindOneProfileLink(avatar);
  });
}

/* =========================
   USERNAME ROUTING
========================= */

export function bindUsernameLinks(selector = "[data-rb-username-link]") {
  document.querySelectorAll(selector).forEach((username) => {
    attachProfileRoute(username, {
      id: username.dataset.profileId || "",
      username: username.dataset.profileUsername || username.textContent || ""
    });

    bindOneProfileLink(username);
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

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches?.(PROFILE_SELECTOR)) {
          bindOneProfileLink(node);
        }

        bindProfileLinks(node);
      });
    });
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  console.log("RB PROFILE LINKS READY");
}

export function stopProfileLinks() {
  observer?.disconnect?.();
  observer = null;
  linksBound = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProfileLinks);
} else {
  bootProfileLinks();
}
