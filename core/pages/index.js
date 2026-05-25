/* =========================================
   8. core/pages/index.js
   INDEX ROUTES + HUB CONTROL
========================================= */

const RB_ROUTES = Object.freeze({
  feed: "/feed.html",
  music: "/music.html",
  live: "/live.html",
  gallery: "/gallery.html",
  podcast: "/podcast.html",
  radio: "/radio.html",
  gaming: "/gaming.html",
  upload: "/upload.html",
  sports: "/sports.html",
  meta: "/meta.html",
  store: "/store.html",
  profile: "/profile.html",
  admin: "/admin.html",
  creator: "/creator.html",
  watch: "/watch.html",
  notifications: "/notifications.html",
  settings: "/settings.html",
  edit: "/edit.html",
  messages: "/messages.html"
});

function goToSection(section) {
  const route = RB_ROUTES[section];

  if (!route) {
    console.warn("Missing Rich Bizness route:", section);
    return;
  }

  document.body.dataset.activeSection = section;
  window.location.href = route;
}

function bindIndexRoutes() {
  const routeButtons = document.querySelectorAll("[data-route]");

  routeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      goToSection(button.dataset.route);
    });
  });
}

document.addEventListener("DOMContentLoaded", bindIndexRoutes);

window.RB_ROUTES = RB_ROUTES;
window.goToSection = goToSection;
