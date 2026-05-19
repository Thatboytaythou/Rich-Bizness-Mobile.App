/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js
   FINAL OMNI INDEX LOCK
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xfsrqomsiulswbalgknx.supabase.co";
const SUPABASE_KEY = "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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

let activeIndex = Math.max(
  0,
  SECTIONS.findIndex((s) => s.key === document.body.dataset.activeSection)
);

function currentSection(){
  return SECTIONS[activeIndex] || SECTIONS[1];
}

function setText(id,value){
  const el = $(id);
  if(el) el.textContent = value;
}

function paint(){
  const section = currentSection();

  document.body.dataset.activeSection = section.key;

  setText("rb-active-label", section.label);
  setText("rb-active-title", section.title);
  setText("rb-active-meta", section.meta);

  const launch = $("rb-launch-section");
  if(launch) launch.textContent = `ENTER ${section.label}`;

  document.querySelectorAll("[data-rb-section]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.rbSection === section.key);
  });

  document.querySelectorAll("[data-rb-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.rbRoute === section.key);
  });

  const orbit = $("rb-tv-orbit");
  if(orbit){
    orbit.style.setProperty("--rb-active-index", activeIndex);
    orbit.style.setProperty("--rb-total-sections", SECTIONS.length);
  }
}

function rotate(dir){
  activeIndex = (activeIndex + dir + SECTIONS.length) % SECTIONS.length;
  paint();
}

function go(url){
  if(!url) return;
  window.location.href = url;
}

function bindClicks(){
  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("button,a");
    if(!target) return;

    if(target.id === "rb-rotate-next"){
      event.preventDefault();
      rotate(1);
      return;
    }

    if(target.id === "rb-rotate-prev"){
      event.preventDefault();
      rotate(-1);
      return;
    }

    if(target.id === "rb-launch-section"){
      event.preventDefault();
      go(currentSection().route);
      return;
    }

    if(target.id === "rb-open-upload"){
      event.preventDefault();
      go("/upload");
      return;
    }

    if(target.id === "rb-open-auth"){
      event.preventDefault();
      go("/auth");
      return;
    }

    if(target.id === "rb-open-profile"){
      event.preventDefault();
      go("/profile");
      return;
    }

    const key = target.dataset.rbRoute || target.dataset.rbSection;
    if(key){
      event.preventDefault();
      const nextIndex = SECTIONS.findIndex((s) => s.key === key);
      if(nextIndex >= 0){
        activeIndex = nextIndex;
        paint();
      }
    }
  });
}

async function loadUser(){
  try{
    const { data:{ user } } = await supabase.auth.getUser();

    if(!user){
      setText("rb-home-name","Guest Mode");
      setText("rb-home-badge","SIGN IN");
      return;
    }

    const { data:profile } = await supabase
      .from("profiles")
      .select("username,display_name,avatar_url,rank_title,rich_level,favorite_section")
      .eq("id", user.id)
      .maybeSingle();

    const name = profile?.display_name || profile?.username || user.email || "Rich Bizness User";
    const badge = profile?.rank_title || `Level ${profile?.rich_level || 1}`;

    setText("rb-home-name", name);
    setText("rb-home-badge", badge);

    const avatar = $("rb-home-avatar");
    if(avatar && profile?.avatar_url){
      avatar.src = profile.avatar_url;
    }

    if(profile?.favorite_section){
      const nextIndex = SECTIONS.findIndex((s) => s.key === profile.favorite_section);
      if(nextIndex >= 0){
        activeIndex = nextIndex;
        paint();
      }
    }
  }catch(error){
    console.warn("RB INDEX PROFILE LOAD:", error?.message || error);
  }
}

function bindKeyboard(){
  window.addEventListener("keydown", (event) => {
    if(event.key === "ArrowRight") rotate(1);
    if(event.key === "ArrowLeft") rotate(-1);
    if(event.key === "Enter") go(currentSection().route);
  });
}

function bindSwipe(){
  let startX = 0;

  window.addEventListener("touchstart", (event) => {
    startX = event.touches?.[0]?.clientX || 0;
  }, { passive:true });

  window.addEventListener("touchend", (event) => {
    const endX = event.changedTouches?.[0]?.clientX || 0;
    const diff = endX - startX;

    if(Math.abs(diff) < 55) return;
    rotate(diff < 0 ? 1 : -1);
  }, { passive:true });
}

async function loadOptionalFx(){
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduced) return;

  const run = async () => {
    try{ await import("/core/engine/rb-depth.js"); }catch{}
    try{ await import("/core/engine/rb-camera-parallax.js"); }catch{}
    try{ await import("/core/engine/omni-fx.js"); }catch{}
  };

  if("requestIdleCallback" in window){
    requestIdleCallback(run, { timeout:1800 });
  }else{
    setTimeout(run, 900);
  }
}

function boot(){
  paint();
  bindClicks();
  bindKeyboard();
  bindSwipe();
  loadUser();
  loadOptionalFx();

  document.body.classList.add("rb-index-ready");
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
}else{
  boot();
}
