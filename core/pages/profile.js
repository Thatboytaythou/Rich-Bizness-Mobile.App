import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

const PROFILE_TABLE = RB_TABLES.profiles;
const FEED_TABLE = RB_TABLES.feedPosts;
const FOLLOW_TABLE = RB_TABLES.followers;
const THEME_TABLE = RB_TABLES.profileThemeSettings;
const LEVEL_TABLE = RB_TABLES.userLevels;
const META_AVATAR_TABLE = RB_TABLES.metaAvatars;
const SELLER_TABLE = RB_TABLES.storeSellerProfiles;
const GAMER_TABLE = RB_TABLES.gamerProfiles;
const SPORTS_TABLE = RB_TABLES.sportsProfiles;
const CREATOR_TABLE = RB_TABLES.creatorPageSettings;

const DEFAULT_AVATAR = "/images/brand/hero-banner.png";
const DEFAULT_BANNER = "/images/brand/Avatar-hero-Banner.png.jpeg";

const state = {
  supabase: null,
  session: null,
  user: null,
  profile: null,
  targetId: null,
  isOwner: false,
  isFollowing: false,
  posts: [],
  channels: []
};

const $ = (id) => document.getElementById(id);

const els = {
  status: $("profileStatus"),
  banner: $("profileBanner"),
  avatar: $("profileAvatar"),
  name: $("profileName"),
  username: $("profileUsername"),
  bio: $("profileBio"),
  rank: $("profileRank"),
  level: $("profileLevel"),
  points: $("profilePoints"),
  balance: $("profileBalance"),
  followers: $("profileFollowers"),
  following: $("profileFollowing"),
  posts: $("profilePostsCount"),
  editBtn: $("profileEditBtn"),
  followBtn: $("profileFollowBtn"),
  messageBtn: $("profileMessageBtn"),
  website: $("profileWebsite"),
  socials: $("profileSocials"),
  feed: $("profileFeed"),
  empty: $("profileEmpty"),
  tabs: document.querySelectorAll("[data-profile-tab]"),
  panels: document.querySelectorAll("[data-profile-panel]"),
  creatorPanel: $("profileCreatorPanel"),
  storePanel: $("profileStorePanel"),
  gamingPanel: $("profileGamingPanel"),
  sportsPanel: $("profileSportsPanel"),
  metaPanel: $("profileMetaPanel")
};

function setStatus(message) {
  if (els.status) els.status.textContent = message;
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function publicName(profile) {
  return (
    safeText(profile?.display_name) ||
    safeText(profile?.full_name) ||
    safeText(profile?.username) ||
    "Rich Bizness User"
  );
}

function username(profile) {
  const name = safeText(profile?.username);
  return name ? `@${name}` : "@richbizness";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mediaTypeFromUrl(url = "") {
  const clean = url.toLowerCase();
  if (clean.match(/\.(mp4|mov|webm|m4v)(\?|$)/)) return "video";
  if (clean.match(/\.(mp3|wav|m4a|ogg)(\?|$)/)) return "audio";
  if (clean.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/)) return "image";
  return "";
}

function getQueryProfileId() {
  const url = new URL(window.location.href);
  return (
    url.searchParams.get("id") ||
    url.searchParams.get("user") ||
    url.searchParams.get("u")
  );
}

async function initAuth() {
  await initApp({
    guard: false,
    bindProfile: true,
    toast: false
  });

  state.supabase = getSupabase();

  const auth = getCurrentUserState();

  state.session = auth?.session || null;
  state.user = auth?.user || null;
  state.profile = auth?.profile || null;

  state.targetId = getQueryProfileId() || state.user?.id || null;

  state.isOwner =
    !!state.user?.id &&
    state.user.id === state.targetId;

  return true;
}

async function fetchProfile() {
  if (!state.targetId) {
    setStatus("Sign in to view your profile.");
    return null;
  }

  const { data, error } = await state.supabase
    .from(PROFILE_TABLE)
    .select("*")
    .eq("id", state.targetId)
    .maybeSingle();

  if (error) throw error;

  if (!data && state.isOwner) {
    const userMeta = state.user?.user_metadata || {};

    const seed = {
      id: state.user.id,
      username: userMeta.username || state.user.email?.split("@")[0] || null,
      display_name:
        userMeta.display_name ||
        userMeta.full_name ||
        "Rich Bizness User",
      full_name: userMeta.full_name || null,
      avatar_url: userMeta.avatar_url || DEFAULT_AVATAR,
      banner_url: DEFAULT_BANNER,
      online_status: "online",
      last_seen_at: new Date().toISOString(),
      metadata: {
        source: "profile.js:auto-create"
      }
    };

    const { data: created, error: createError } = await state.supabase
      .from(PROFILE_TABLE)
      .insert(seed)
      .select("*")
      .single();

    if (createError) throw createError;

    state.profile = created;
    return created;
  }

  state.profile = data;
  return data;
}

async function updatePresence() {
  if (!state.isOwner || !state.user) return;

  await state.supabase
    .from(PROFILE_TABLE)
    .update({
      online_status: "online",
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", state.user.id);
}

async function fetchCounts() {
  const [followersRes, followingRes, postsRes] = await Promise.all([
    state.supabase
      .from(FOLLOW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("following_id", state.targetId),

    state.supabase
      .from(FOLLOW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("follower_id", state.targetId),

    state.supabase
      .from(FEED_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", state.targetId)
  ]);

  return {
    followers: followersRes.count || 0,
    following: followingRes.count || 0,
    posts: postsRes.count || 0
  };
}

async function fetchOwnerExtras() {
  const [theme, level, meta, seller, gamer, sports, creator] =
    await Promise.allSettled([
      state.supabase.from(THEME_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(LEVEL_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(META_AVATAR_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(SELLER_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(GAMER_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(SPORTS_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
      state.supabase.from(CREATOR_TABLE).select("*").eq("user_id", state.targetId).maybeSingle()
    ]);

  return {
    theme: theme.value?.data || null,
    level: level.value?.data || null,
    meta: meta.value?.data || null,
    seller: seller.value?.data || null,
    gamer: gamer.value?.data || null,
    sports: sports.value?.data || null,
    creator: creator.value?.data || null
  };
}

async function fetchPosts() {
  const { data, error } = await state.supabase
    .from(FEED_TABLE)
    .select("*")
    .eq("user_id", state.targetId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  state.posts = data || [];
}

async function checkFollowing() {
  if (!state.user || state.isOwner) return false;

  const { data } = await state.supabase
    .from(FOLLOW_TABLE)
    .select("id")
    .eq("follower_id", state.user.id)
    .eq("following_id", state.targetId)
    .maybeSingle();

  state.isFollowing = !!data?.id;
  return state.isFollowing;
}

function renderProfile(counts, extras) {
  const p = state.profile || {};
  const avatar = p.avatar_url || DEFAULT_AVATAR;
  const banner = extras?.theme?.background_url || p.banner_url || DEFAULT_BANNER;

  if (els.banner) {
    els.banner.style.backgroundImage =
      `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.75)), url("${banner}")`;
  }

  if (els.avatar) els.avatar.src = avatar;
  if (els.name) els.name.textContent = publicName(p);
  if (els.username) els.username.textContent = username(p);
  if (els.bio) els.bio.textContent = safeText(p.bio, "Building the Rich Bizness universe.");

  if (els.rank) {
    els.rank.textContent = safeText(
      extras?.level?.rank_title || p.rank_title,
      "Member"
    );
  }

  if (els.level) els.level.textContent = `Level ${extras?.level?.level || p.rich_level || 1}`;
  if (els.points) els.points.textContent = `${extras?.level?.rich_points || p.rich_points || 0} pts`;
  if (els.balance) els.balance.textContent = money(p.balance_cents || 0);

  if (els.followers) els.followers.textContent = counts.followers;
  if (els.following) els.following.textContent = counts.following;
  if (els.posts) els.posts.textContent = counts.posts;

  if (els.editBtn) els.editBtn.style.display = state.isOwner ? "" : "none";

  if (els.followBtn) {
    els.followBtn.style.display = !state.isOwner && state.user ? "" : "none";
    els.followBtn.textContent = state.isFollowing ? "Following" : "Follow";
    els.followBtn.classList.toggle("is-active", state.isFollowing);
  }

  if (els.messageBtn) {
    els.messageBtn.style.display = !state.isOwner && state.user ? "" : "none";
  }

  renderLinks(p);
  renderExtras(extras);
}

function renderLinks(profile) {
  if (els.website) {
    const website = safeText(profile.website_url);
    els.website.style.display = website ? "" : "none";
    els.website.href = website || "#";
    els.website.textContent = website ? "Website" : "";
  }

  if (!els.socials) return;

  const links = [
    ["Instagram", profile.instagram_url],
    ["YouTube", profile.youtube_url],
    ["TikTok", profile.tiktok_url],
    ["Facebook", profile.facebook_url],
    ["Snapchat", profile.snapchat_url]
  ].filter(([, url]) => safeText(url));

  els.socials.innerHTML = links
    .map(([label, url]) => {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`;
    })
    .join("");
}

function renderExtras(extras) {
  fillPanel(els.creatorPanel, extras.creator, "Creator Hub", [
    ["Title", extras.creator?.creator_title],
    ["Tagline", extras.creator?.creator_tagline],
    ["Theme", extras.creator?.page_theme]
  ]);

  fillPanel(els.storePanel, extras.seller, "Store Seller", [
    ["Seller", extras.seller?.seller_name],
    ["Rank", extras.seller?.seller_rank],
    ["Sales", money(extras.seller?.total_sales_cents)]
  ]);

  fillPanel(els.gamingPanel, extras.gamer, "Gaming Profile", [
    ["Gamer Tag", extras.gamer?.gamer_tag],
    ["Rank", extras.gamer?.rank_title],
    ["Wins", extras.gamer?.wins]
  ]);

  fillPanel(els.sportsPanel, extras.sports, "Sports Profile", [
    ["Fan Tag", extras.sports?.fan_tag],
    ["Team", extras.sports?.favorite_team],
    ["Points", extras.sports?.points]
  ]);

  fillPanel(els.metaPanel, extras.meta, "Meta Avatar", [
    ["Display", extras.meta?.display_name],
    ["Aura", extras.meta?.aura],
    ["Level", extras.meta?.level]
  ]);
}

function fillPanel(el, data, title, rows) {
  if (!el) return;

  if (!data) {
    el.innerHTML = `<div class="rb-mini-empty">No ${escapeHtml(title)} data yet.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="rb-mini-card">
      <h3>${escapeHtml(title)}</h3>
      ${rows
        .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v ?? "—")}</p>`)
        .join("")}
    </div>
  `;
}

function renderPosts() {
  if (!els.feed) return;

  if (!state.posts.length) {
    if (els.empty) els.empty.style.display = "";
    els.feed.innerHTML = "";
    return;
  }

  if (els.empty) els.empty.style.display = "none";
  els.feed.innerHTML = state.posts.map(renderPost).join("");
}

function renderPost(post) {
  const mediaUrl = post.media_url || "";
  const type = post.media_type || mediaTypeFromUrl(mediaUrl);
  let media = "";

  if (mediaUrl && type === "image") {
    media = `<img class="rb-post-media" src="${escapeHtml(mediaUrl)}" alt="" loading="lazy" />`;
  }

  if (mediaUrl && type === "video") {
    media = `<video class="rb-post-media" src="${escapeHtml(mediaUrl)}" controls playsinline></video>`;
  }

  if (mediaUrl && type === "audio") {
    media = `<audio class="rb-post-audio" src="${escapeHtml(mediaUrl)}" controls></audio>`;
  }

  return `
    <article class="rb-card rb-post-card" data-post-id="${escapeHtml(post.id)}">
      <div class="rb-post-top">
        <div>
          <strong>${escapeHtml(post.display_name || post.username || publicName(state.profile))}</strong>
          <small>${escapeHtml(post.section || "feed")} • ${new Date(post.created_at).toLocaleString()}</small>
        </div>
      </div>

      ${post.body ? `<p class="rb-post-body">${escapeHtml(post.body)}</p>` : ""}
      ${media}

      <div class="rb-post-actions">
        <span>❤️ ${post.like_count || 0}</span>
        <span>💬 ${post.comment_count || 0}</span>
        <span>👁️ ${post.view_count || 0}</span>
      </div>
    </article>
  `;
}

async function toggleFollow() {
  if (!state.user || state.isOwner) return;

  els.followBtn?.setAttribute("disabled", "true");

  try {
    if (state.isFollowing) {
      await state.supabase
        .from(FOLLOW_TABLE)
        .delete()
        .eq("follower_id", state.user.id)
        .eq("following_id", state.targetId);

      state.isFollowing = false;
    } else {
      await state.supabase.from(FOLLOW_TABLE).insert({
        follower_id: state.user.id,
        following_id: state.targetId
      });

      state.isFollowing = true;
    }

    const counts = await fetchCounts();

    if (els.followBtn) {
      els.followBtn.textContent = state.isFollowing ? "Following" : "Follow";
      els.followBtn.classList.toggle("is-active", state.isFollowing);
    }

    if (els.followers) els.followers.textContent = counts.followers;
  } finally {
    els.followBtn?.removeAttribute("disabled");
  }
}

function bindTabs() {
  els.tabs?.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.profileTab;

      els.tabs.forEach((item) => {
        item.classList.toggle("is-active", item === tab);
      });

      els.panels.forEach((panel) => {
        panel.style.display =
          panel.dataset.profilePanel === key ? "" : "none";
      });
    });
  });
}

function bindActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.edit || "/edit";
  });

  els.followBtn?.addEventListener("click", toggleFollow);

  els.messageBtn?.addEventListener("click", () => {
    if (!state.targetId) return;
    window.location.href = `${RB_ROUTES.messages || "/messages"}?user=${encodeURIComponent(state.targetId)}`;
  });

  window.addEventListener("beforeunload", () => {
    if (!state.isOwner || !state.user || !state.supabase) return;

    state.supabase
      .from(PROFILE_TABLE)
      .update({
        online_status: "offline",
        last_seen_at: new Date().toISOString()
      })
      .eq("id", state.user.id);
  });
}

function subscribeRealtime() {
  if (!state.supabase || !state.targetId) return;

  clearRealtime();

  const profileChannel = state.supabase
    .channel(`profile-page-${state.targetId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: PROFILE_TABLE,
        filter: `id=eq.${state.targetId}`
      },
      async () => reloadSoft()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: FEED_TABLE,
        filter: `user_id=eq.${state.targetId}`
      },
      async () => {
        await fetchPosts();
        renderPosts();
      }
    )
    .subscribe();

  state.channels.push(profileChannel);
}

function clearRealtime() {
  state.channels.forEach((channel) => {
    state.supabase?.removeChannel(channel);
  });

  state.channels = [];
}

async function reloadSoft() {
  const [profile, counts, extras] = await Promise.all([
    fetchProfile(),
    fetchCounts(),
    fetchOwnerExtras()
  ]);

  if (profile) renderProfile(counts, extras);
}

async function boot() {
  bindTabs();
  bindActions();

  try {
    setStatus("Loading profile...");

    await initAuth();

    if (!state.supabase) {
      setStatus("Supabase client not found.");
      return;
    }

    await updatePresence();
    await fetchProfile();
    await checkFollowing();

    const [counts, extras] = await Promise.all([
      fetchCounts(),
      fetchOwnerExtras(),
      fetchPosts()
    ]);

    renderProfile(counts, extras);
    renderPosts();
    subscribeRealtime();

    setStatus(state.isOwner ? "Your profile is synced." : "Profile loaded.");

    markPageReady("profile");
  } catch (error) {
    console.error("[profile.js]", error);
    setStatus(error.message || "Profile failed to load.");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
