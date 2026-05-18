/* =========================
   RICH BIZNESS MOBILE
   /core/nav.js

   GLOBAL NAV SYSTEM
   Uses locked router + auth/profile engines.
========================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

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
  profileAvatar,
  profileName,
  profileHandle
} from "/core/shared/rb-profile.js";

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
  { key: "messages", label: "DMs", href: RB_ROUTES.messages, icon: "💨" },
  { key: "notifications", label: "Alerts", href: RB_ROUTES.notifications, icon: "⚡" },
  { key: "profile", label: "Profile", href: RB_ROUTES.profile, icon: "◉" },
  { key: "settings", label: "Settings", href: RB_ROUTES.settings, icon: "⚙" }
];

let navMounted = false;

function navItemTemplate(item) {
  const active =
    getCurrentPath() === item.href ||
    getCurrentPath() === `${item.href}.html`;

  return `
    <button
      class="rb-nav-item ${active ? "is-active" : ""}"
      type="button"
      data-route="${item.href}"
      data-key="${item.key}"
    >
      <span class="rb-nav-icon">${item.icon}</span>
      <span class="rb-nav-label">${item.label}</span>
    </button>
  `;
}

function renderNavShell(target) {
  target.innerHTML = `
    <nav class="rb-global-nav" data-rb-global-nav>
      <div class="rb-nav-brand" data-route="/">
        <span class="rb-brand-mark">R</span>
        <span>
          <strong>Rich Bizness</strong>
          <small>Mobile Universe</small>
        </span>
      </div>

      <div class="rb-nav-scroll">
        ${NAV_ITEMS.map(navItemTemplate).join("")}
      </div>

      <div class="rb-nav-profile" data-route="/profile">
        <img
          data-nav-avatar
          src="/images/brand/project-avatar.png.jpeg"
          alt="Profile"
        />
        <span>
          <strong data-nav-name>Guest</strong>
          <small data-nav-handle>@guest</small>
        </span>
      </div>
    </nav>
  `;
}

function bindNavClicks(target) {
  target.querySelectorAll("[data-route]").forEach((el) => {
    el.addEventListener("click", () => {
      const route = el.dataset.route;
      if (route) goTo(route);
    });
  });
}

function paintNavIdentity() {
  const state = getAuthState();
  const profile = state.profile;

  document.querySelectorAll("[data-nav-avatar]").forEach((img) => {
    img.src = state.isAuthed
      ? profileAvatar(profile)
      : "/images/brand/project-avatar.png.jpeg";
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

  renderNavShell(mount);
  bindNavClicks(mount);
  paintNavIdentity();

  onAuthState(() => {
    paintNavIdentity();
  });

  navMounted = true;

  document.body.classList.add("rb-nav-mounted");

  return mount;
}

export function isNavMounted() {
  return navMounted;
}

export { NAV_ITEMS };

console.log("RB NAV READY");
