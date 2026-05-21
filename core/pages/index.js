/* =========================================
   RICH BIZNESS LLC
   /core/pages/index.js
   FINAL 3-CARD OMNI CONTROLLER
   CINEMA STACK EDITION
========================================= */

const SECTIONS = [
  {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    meta: "Posts • Drops • Community",
    route: "/feed"
  },

  {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    meta: "Broadcast • VIP • Realtime",
    route: "/live"
  },

  {
    key: "music",
    label: "MUSIC",
    title: "Music Universe",
    meta: "Tracks • Radio • Podcasts",
    route: "/music"
  },

  {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    meta: "Play • Scores • Challenges",
    route: "/gaming"
  },

  {
    key: "sports",
    label: "SPORTS",
    title: "Sports Arena",
    meta: "Picks • Clips • Broadcasts",
    route: "/sports"
  },

  {
    key: "gallery",
    label: "ART",
    title: "Gallery Vault",
    meta: "Art • Visuals • Showcase",
    route: "/gallery"
  },

  {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    meta: "Products • Drops • Unlocks",
    route: "/store"
  },

  {
    key: "meta",
    label: "META",
    title: "Meta World",
    meta: "Worlds • Avatars • Portals",
    route: "/meta"
  }
];

const $ = (id) => document.getElementById(id);

const POSITION_CLASSES = [
  "rb-pos-left",
  "rb-pos-right",
  "rb-pos-back-left",
  "rb-pos-back-right",
  "rb-pos-hidden"
];

let activeIndex = SECTIONS.findIndex(
  (section) =>
    section.key === document.body.dataset.activeSection
);

if(activeIndex < 0){
  activeIndex = 1;
}

/* =========================================
   HELPERS
========================================= */

function activeSection(){
  return SECTIONS[activeIndex] || SECTIONS[1];
}

function normalizeIndex(index){
  return (
    (index + SECTIONS.length) %
    SECTIONS.length
  );
}

function clearPositionClasses(card){
  POSITION_CLASSES.forEach((className)=>{
    card.classList.remove(className);
  });
}

/* =========================================
   PAINT
========================================= */

function paintSection(){

  const section = activeSection();

  document.body.dataset.activeSection = section.key;

  /* =========================
     PORTAL TEXT
  ========================= */

  const label = $("rb-active-label");
  const title = $("rb-active-title");
  const meta = $("rb-active-meta");
  const launch = $("rb-launch-section");

  if(label){
    label.textContent = section.label;
  }

  if(title){
    title.textContent = section.title;
  }

  if(meta){
    meta.textContent = section.meta;
  }

  if(launch){
    launch.textContent =
      `ENTER ${section.label}`;
  }

  /* =========================
     BOTTOM NAV
  ========================= */

  document
    .querySelectorAll("[data-rb-route]")
    .forEach((button)=>{

      button.classList.toggle(
        "active",
        button.dataset.rbRoute === section.key
      );

    });

  /* =========================
     CARD STACK
  ========================= */

  const cards = [
    ...document.querySelectorAll(".rb-tv-screen")
  ];

  cards.forEach((card, index)=>{

    const distance =
      normalizeIndex(index - activeIndex);

    clearPositionClasses(card);

    card.classList.remove("is-active");

    /* ACTIVE */

    if(distance === 0){

      card.classList.add("is-active");

      return;
    }

    /* RIGHT */

    if(distance === 1){

      card.classList.add("rb-pos-right");

      return;
    }

    /* LEFT */

    if(distance === SECTIONS.length - 1){

      card.classList.add("rb-pos-left");

      return;
    }

    /* BACK RIGHT */

    if(distance === 2){

      card.classList.add("rb-pos-back-right");

      return;
    }

    /* BACK LEFT */

    if(distance === SECTIONS.length - 2){

      card.classList.add("rb-pos-back-left");

      return;
    }

    /* HIDDEN */

    card.classList.add("rb-pos-hidden");

  });

}

/* =========================================
   MOVEMENT
========================================= */

function moveNext(){

  activeIndex =
    normalizeIndex(activeIndex + 1);

  paintSection();

}

function movePrev(){

  activeIndex =
    normalizeIndex(activeIndex - 1);

  paintSection();

}

function setActiveByKey(key){

  const foundIndex =
    SECTIONS.findIndex(
      (section)=>section.key === key
    );

  if(foundIndex < 0){
    return;
  }

  activeIndex = foundIndex;

  paintSection();

}

/* =========================================
   ROUTING
========================================= */

function go(route){

  if(!route){
    return;
  }

  window.location.href = route;

}

/* =========================================
   CLICK EVENTS
========================================= */

function bindClicks(){

  document.addEventListener(
    "click",
    (event)=>{

      const target =
        event.target.closest(
          "button,a"
        );

      if(!target){
        return;
      }

      /* =====================
         NEXT
      ===================== */

      if(
        target.id === "rb-rotate-next"
      ){

        event.preventDefault();

        moveNext();

        return;
      }

      /* =====================
         PREV
      ===================== */

      if(
        target.id === "rb-rotate-prev"
      ){

        event.preventDefault();

        movePrev();

        return;
      }

      /* =====================
         LAUNCH
      ===================== */

      if(
        target.id === "rb-launch-section"
      ){

        event.preventDefault();

        go(
          activeSection().route
        );

        return;
      }

      /* =====================
         UPLOAD
      ===================== */

      if(
        target.id === "rb-open-upload"
      ){

        event.preventDefault();

        go("/upload");

        return;
      }

      /* =====================
         AUTH
      ===================== */

      if(
        target.id === "rb-open-auth" ||
        target.id === "rb-open-profile"
      ){

        event.preventDefault();

        go("/auth");

        return;
      }

      /* =====================
         TV CARD
      ===================== */

      if(
        target.dataset.rbSection
      ){

        event.preventDefault();

        const key =
          target.dataset.rbSection;

        const current =
          activeSection().key;

        /* already active = enter */

        if(key === current){

          const section =
            SECTIONS.find(
              (item)=>item.key === key
            );

          if(section){
            go(section.route);
          }

          return;
        }

        /* otherwise rotate */

        setActiveByKey(key);

        return;
      }

      /* =====================
         BOTTOM NAV
      ===================== */

      if(
        target.dataset.rbRoute
      ){

        event.preventDefault();

        setActiveByKey(
          target.dataset.rbRoute
        );

      }

    }
  );

}

/* =========================================
   SWIPE SUPPORT
========================================= */

function bindTouch(){

  let startX = 0;
  let endX = 0;

  document.addEventListener(
    "touchstart",
    (event)=>{

      startX =
        event.changedTouches[0].clientX;

    },
    { passive:true }
  );

  document.addEventListener(
    "touchend",
    (event)=>{

      endX =
        event.changedTouches[0].clientX;

      const delta =
        endX - startX;

      if(Math.abs(delta) < 45){
        return;
      }

      if(delta < 0){
        moveNext();
      }else{
        movePrev();
      }

    },
    { passive:true }
  );

}

/* =========================================
   BOOT
========================================= */

function boot(){

  paintSection();

  bindClicks();

  bindTouch();

  document.body.classList.add(
    "rb-index-ready"
  );

}

/* =========================================
   START
========================================= */

if(
  document.readyState === "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    boot
  );

}else{

  boot();

}
