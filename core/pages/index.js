/* =========================================
   RICH BIZNESS LLC
   /core/pages/index.js
   OMNI HUB CONTROLLER
   No Supabase. No imports. No freeze.
========================================= */

const SECTIONS = [
  { key:"feed", label:"FEED", title:"Global Feed", meta:"Posts • Drops • Community", route:"/feed" },
  { key:"live", label:"LIVE", title:"Go Live", meta:"Broadcast • VIP • Realtime", route:"/live" },
  { key:"music", label:"MUSIC", title:"Music Universe", meta:"Tracks • Radio • Podcasts", route:"/music" },
  { key:"gaming", label:"GAMES", title:"Arcade District", meta:"Play • Scores • Challenges", route:"/gaming" },
  { key:"sports", label:"SPORTS", title:"Sports Arena", meta:"Picks • Clips • Broadcasts", route:"/sports" },
  { key:"gallery", label:"ART", title:"Gallery Vault", meta:"Art • Visuals • Showcase", route:"/gallery" },
  { key:"store", label:"STORE", title:"Creator Market", meta:"Products • Drops • Unlocks", route:"/store" },
  { key:"meta", label:"META", title:"Meta World", meta:"Worlds • Avatars • Portals", route:"/meta" }
];

const $ = (id) => document.getElementById(id);

let activeIndex = SECTIONS.findIndex(s => s.key === document.body.dataset.activeSection);
if (activeIndex < 0) activeIndex = 1;

function mod(n, m){
  return ((n % m) + m) % m;
}

function activeSection(){
  return SECTIONS[activeIndex] || SECTIONS[1];
}

function paintCards(){
  const cards = [...document.querySelectorAll("[data-rb-section]")];

  cards.forEach((card) => {
    const cardIndex = SECTIONS.findIndex(s => s.key === card.dataset.rbSection);
    const diff = mod(cardIndex - activeIndex, SECTIONS.length);

    card.classList.remove(
      "is-active",
      "rb-pos-left",
      "rb-pos-right",
      "rb-pos-back-left",
      "rb-pos-back-right",
      "rb-pos-hidden"
    );

    if (diff === 0) {
      card.classList.add("is-active");
    } else if (diff === 1) {
      card.classList.add("rb-pos-right");
    } else if (diff === 7) {
      card.classList.add("rb-pos-left");
    } else if (diff === 2) {
      card.classList.add("rb-pos-back-right");
    } else if (diff === 6) {
      card.classList.add("rb-pos-back-left");
    } else {
      card.classList.add("rb-pos-hidden");
    }
  });
}

function paintSection(){
  const section = activeSection();

  document.body.dataset.activeSection = section.key;

  const label = $("rb-active-label");
  const title = $("rb-active-title");
  const meta = $("rb-active-meta");
  const launch = $("rb-launch-section");

  if (label) label.textContent = section.label;
  if (title) title.textContent = section.title;
  if (meta) meta.textContent = section.meta;
  if (launch) launch.textContent = `ENTER ${section.label}`;

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.rbRoute === section.key);
  });

  paintCards();
}

function moveNext(){
  activeIndex = mod(activeIndex + 1, SECTIONS.length);
  paintSection();
}

function movePrev(){
  activeIndex = mod(activeIndex - 1, SECTIONS.length);
  paintSection();
}

function setActiveByKey(key){
  const nextIndex = SECTIONS.findIndex(s => s.key === key);
  if (nextIndex < 0) return;
  activeIndex = nextIndex;
  paintSection();
}

function go(route){
  if (route) window.location.href = route;
}

function bindClicks(){
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button,a");
    if (!target) return;

    if (target.id === "rb-rotate-next") {
      event.preventDefault();
      moveNext();
      return;
    }

    if (target.id === "rb-rotate-prev") {
      event.preventDefault();
      movePrev();
      return;
    }

    if (target.id === "rb-launch-section") {
      event.preventDefault();
      go(activeSection().route);
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      go("/upload");
      return;
    }

    if (target.id === "rb-open-auth" || target.id === "rb-open-profile") {
      event.preventDefault();
      go("/auth");
      return;
    }

    if (target.dataset.rbSection) {
      event.preventDefault();
      setActiveByKey(target.dataset.rbSection);
      return;
    }

    if (target.dataset.rbRoute) {
      event.preventDefault();
      setActiveByKey(target.dataset.rbRoute);
    }
  });
}

function boot(){
  paintSection();
  bindClicks();
  document.body.classList.add("rb-index-ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
