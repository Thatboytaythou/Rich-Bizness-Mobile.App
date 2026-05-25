/* =========================
   RICH BIZNESS MOBILE
   /core/nav.js

   GLOBAL NAV SYSTEM
   Synced with router + auth + profile-state
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getCurrentPath,
  goTo
} from "/core/shared/rb-router.js";

import {
  getAuthState,
  onAuthState,
  initAuthState
} from "/core/features/auth/auth-state.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileAvatar,
  profileName,
  profileHandle
} from "/core/shared/rb-profile.js";

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const NAV_ITEMS = [
  { key: "home", label: "Home", href: RB_ROUTES.home, icon: "⌂" },
  { key: "feed", label: "Feed", href: RB_ROUTES.feed, icon: "◆" },
  { key: "watch", label: "Watch", href: RB_ROUTES.watch, icon: "📺" },
  { key: "live", label: "Live", href: RB_ROUTES.live, icon: "●" },
  { key: "music", label: "Music", href: RB_ROUTES.music, icon: "♪" },
  { key: "gaming", label: "Gaming", href: RB_ROUTES.gaming, icon: "🎮" },
  { key: "sports", label: "Sports", href: RB_ROUTES.sports, icon: "🏆" },
  { key: "gallery", label: "Gallery", href: RB_ROUTES.gallery, icon: "◇" },
  { key: "store", label: "Store", href: RB_ROUTES.store, icon: "🛒" },
  { key: "meta", label: "Meta", href: RB_ROUTES.meta, icon: "◎" },
  { key: "upload", label: "Upload", href: RB_ROUTES.upload, icon: "＋" },
  { key: "creator", label: "Creator", href: RB_ROUTES.creator || "/creator", icon: "👑" },
  { key: "admin", label: "Admin", href: RB_ROUTES.admin || "/admin", icon: "🛡️" },
  { key: "messages", label: "DMs", href: RB_ROUTES.messages, icon: "💨" },
  { key: "notifications", label: "Alerts", href: RB_ROUTES.notifications, icon: "⚡" },
  { key: "profile", label: "Profile", href: RB_ROUTES.profile, icon: "◉" },
  { key: "settings", label: "Settings", href: RB_ROUTES.settings, icon: "⚙" }
];

let navMounted = false;
let navIdentityBound = false;

function normalizePath(path = "") {
  if (!path || path === "/index.html") return "/";

  return String(path)
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "")
    .replace(/\/$/, "") || "/";
}

function isActiveRoute(href) {
  const current = normalizePath(getCurrentPath());
  const target = normalizePath(href);

  return current === target;
}

function navItemTemplate(item) {
  return `
    <button
      class="rb-nav-item ${isActiveRoute(item.href) ? "is-active" : ""}"
      type="button"
      data-route="${item.href}"
      data-key="${item.key}"
      aria-label="${item.label}"
    >
      <span class="rb-nav-icon">${item.icon}</span>
      <span class="rb-nav-label">${item.label}</span>
    </button>
  `;
}

function renderNavShell(target) {
  target.innerHTML = `
    <nav class="rb-global-nav" data-rb-global-nav>
      <button class="rb-nav-brand" type="button" data-route="${RB_ROUTES.home || "/"}">
        <span class="rb-brand-mark">R</span>
        <span>
          <strong>Rich Bizness</strong>
          <small>Mobile Universe</small>
        </span>
      </button>

      <div class="rb-nav-scroll">
        ${NAV_ITEMS.map(navItemTemplate).join("")}
      </div>

      <button class="rb-nav-profile" type="button" data-route="${RB_ROUTES.profile || "/profile"}">
        <img
          data-nav-avatar
          src="${DEFAULT_AVATAR}"
          alt="Profile"
        />
        <span>
          <strong data-nav-name>Guest</strong>
          <small data-nav-handle>@guest</small>
        </span>
      </button>
    </nav>
  `;
}

function bindNavClicks(target) {
  target.querySelectorAll("[data-route]").forEach((el) => {
    if (el.dataset.rbNavBound === "true") return;
    el.dataset.rbNavBound = "true";

    el.addEventListener("click", () => {
      const route = el.dataset.route;
      if (route) goTo(route);
    });
  });
}

function paintActiveNav() {
  document.querySelectorAll(".rb-nav-item[data-route]").forEach((item) => {
    item.classList.toggle("is-active", isActiveRoute(item.dataset.route));
  });
}

function paintNavIdentity() {
  const state = getAuthState();
  const profile = state.profile;

  document.querySelectorAll("[data-nav-avatar]").forEach((img) => {
    img.src = state.isAuthed
      ? profileAvatar(profile)
      : DEFAULT_AVATAR;
  });

  document.querySelectorAll("[data-nav-name]").forEach((el) => {
    el.textContent = state.isAuthed
      ? profileName(profile)
      : "Guest";
  });

  document.querySelectorAll("[data-nav-handle]").forEach((el) => {
    el.textContent = state.isAuthed
      ? profileHandle(profile)
      : "@guest";
  });
}

function bindIdentityWatchers() {
  if (navIdentityBound) return;
  navIdentityBound = true;

  onAuthState(() => {
    paintNavIdentity();
  });

  onProfileState((profileState) => {
    if (!profileState.ready) return;
    paintNavIdentity();
  });

  window.addEventListener("popstate", paintActiveNav);
  window.addEventListener("rb:route-change", paintActiveNav);
  window.addEventListener("rb:profile-updated", paintNavIdentity);
}

export async function mountNav({
  target = "#rb-global-nav",
  autoCreate = true
} = {}) {
  let mount = document.querySelector(target);

  if (!mount && autoCreate) {
    mount = document.createElement("div");
    mount.id = target.replace("#", "");
    document.body.prepend(mount);
  }

  if (!mount) return null;

  await initAuthState();

  if (getAuthState().isAuthed) {
    await ensureMyProfile();
    await refreshProfileState();
  }

  renderNavShell(mount);
  bindNavClicks(mount);
  bindIdentityWatchers();

  paintActiveNav();
  paintNavIdentity();

  navMounted = true;

  document.body.classList.add("rb-nav-mounted");

  return mount;
}

export function isNavMounted() {
  return navMounted;
}

export function refreshNav() {
  paintActiveNav();
  paintNavIdentity();
}

export { NAV_ITEMS };

console.log("RB NAV READY");
