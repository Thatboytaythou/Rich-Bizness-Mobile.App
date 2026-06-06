/* =========================
   RICH BIZNESS MOBILE
   /core/pages/profile.js

   PROFILE PAGE CONTROLLER
   Synced with auth + profile-state
   Auto Profile Ensure Enabled

   Image Lock:
   - Profile avatar = profiles.avatar_url only
   - Profile banner = profile_theme_settings.background_url OR profiles.banner_url
   - Meta avatar = Meta tab only
========================= */

import {
  RB_TABLES,
  RB_ROUTES,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  loadProfileByRoute,
  refreshProfileState,
  getProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  profileName,
  profileHandle,
  profileBadge,
  profileLevel
} from "/core/shared/rb-profile.js";

import {
  bootProfileLinks,
  attachProfileRoute
} from "/core/features/profile/profile-links.js";

const supabase = getSupabase();

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

const state = {
  profile: null,
  identity: null,
  isMine: false,
  isFollowing: false,
  counts: {
    followers: 0,
    following: 0,
    posts: 0
  },
  posts: [],
  extras: {},
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
  postsCount: $("profilePostsCount"),
  liveCount: $("profileLiveCount"),
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

function hasPublicProfileRoute() {
  const params = new URLSearchParams(window.location.search);

  return !!(
    params.get("u") ||
    params.get("username") ||
    params.get("id") ||
    params.get("user")
  );
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function lockedProfileAvatar(profile = {}) {
  return profile?.avatar_url || DEFAULT_AVATAR;
}

function lockedProfileBanner(profile = {}, extras = {}) {
  return (
    extras?.theme?.background_url ||
    profile?.banner_url ||
    DEFAULT_BANNER
  );
}

function setImageOnce(img, src, alt = "Profile") {
  if (!img || !src) return;

  if (img.dataset.rbLockedSrc === src) {
    img.alt = alt;
    return;
  }

  img.dataset.rbLockedSrc = src;
  img.src = src;
  img.alt = alt;
}

function mediaMarkup(post) {
  const url = post.media_url || post.file_url || post.image_url || "";
  if (!url) return "";

  const lower = url.toLowerCase();

  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) {
    return `<video src="${escapeHtml(url)}" controls playsinline></video>`;
  }

  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) {
    return `<audio src="${escapeHtml(url)}" controls></audio>`;
  }

  return `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`;
}

async function fetchCounts(profileId) {
  if (!profileId) return state.counts;

  const [followers, following, posts, live] = await Promise.allSettled([
    supabase
      .from(RB_TABLES.followers)
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId),

    supabase
      .from(RB_TABLES.followers)
      .select("id", { count: "exact", head: true })
      .eq("follower_id", profileId),

    supabase
      .from(RB_TABLES.feedPosts)
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId),

    supabase
      .from(RB_TABLES.liveStreams)
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
  ]);

  state.counts = {
    followers: followers.value?.count || 0,
    following: following.value?.count || 0,
    posts: posts.value?.count || 0,
    live: live.value?.count || 0
  };

  return state.counts;
}

async function fetchPosts(profileId) {
  if (!profileId) {
    state.posts = [];
    return [];
  }

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.warn("[RB PROFILE POSTS WARNING]", error.message);
    state.posts = [];
    return [];
  }

  state.posts = data || [];
  return state.posts;
}

async function fetchFollowing(profileId) {
  const user = getUser();

  if (!user?.id || !profileId || user.id === profileId) {
    state.isFollowing = false;
    return false;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.followers)
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", profileId)
    .maybeSingle();

  if (error) {
    console.warn("[RB FOLLOW CHECK WARNING]", error.message);
    state.isFollowing = false;
    return false;
  }

  state.isFollowing = !!data;
  return state.isFollowing;
}

async function fetchExtras(profileId) {
  if (!profileId) {
    state.extras = {};
    return {};
  }

  const tables = {
    theme: RB_TABLES.profileThemeSettings,
    level: RB_TABLES.userLevels,
    meta: RB_TABLES.metaAvatars,
    seller: RB_TABLES.storeSellerProfiles,
    gamer: RB_TABLES.gamerProfiles,
    sports: RB_TABLES.sportsProfiles,
    creator: RB_TABLES.creatorPageSettings
  };

  const entries = await Promise.allSettled(
    Object.entries(tables)
      .filter(([, table]) => Boolean(table))
      .map(async ([key, table]) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", profileId)
          .maybeSingle();

        if (error) {
          console.warn(`[RB PROFILE EXTRA WARNING: ${key}]`, error.message);
          return [key, null];
        }

        return [key, data || null];
      })
  );

  state.extras = Object.fromEntries(
    entries
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value)
  );

  return state.extras;
}

function renderProfile() {
  const profile = state.profile || {};
  const extras = state.extras || {};

  const name = profileName(profile);
  const avatar = lockedProfileAvatar(profile);
  const banner = lockedProfileBanner(profile, extras);

  if (els.status) {
    els.status.textContent = state.isMine
      ? "Your Universe Profile"
      : "Universe Profile";
  }

  if (els.banner) {
    els.banner.style.backgroundImage = `url("${banner}")`;
  }

  if (els.avatar) {
    setImageOnce(els.avatar, avatar, name);

    attachProfileRoute(els.avatar, {
      id: profile.id,
      username: profile.username
    });
  }

  if (els.name) els.name.textContent = name;
  if (els.username) els.username.textContent = profileHandle(profile);

  if (els.bio) {
    els.bio.textContent =
      profile.bio || "Building in the Rich Bizness Universe.";
  }

  if (els.rank) {
    els.rank.textContent =
      extras.level?.rank_title ||
      profile.rank_title ||
      profileBadge(profile);
  }

  if (els.level) {
    els.level.textContent = `LVL ${extras.level?.level || profileLevel(profile)}`;
  }

  if (els.points) {
    els.points.textContent =
      `${extras.level?.rich_points || profile.rich_points || 0} pts`;
  }

  if (els.balance) {
    els.balance.textContent = money(profile.balance_cents);
  }

  if (els.followers) els.followers.textContent = state.counts.followers;
  if (els.following) els.following.textContent = state.counts.following;
  if (els.postsCount) els.postsCount.textContent = state.counts.posts;
  if (els.liveCount) els.liveCount.textContent = state.counts.live || 0;

  if (els.editBtn) {
    els.editBtn.style.display = state.isMine ? "block" : "none";
  }

  renderFollowButton();
  renderLinks(profile);
  renderExtras();
}

function renderFollowButton() {
  if (!els.followBtn) return;

  if (state.isMine || !getUser()?.id) {
    els.followBtn.style.display = "none";
    return;
  }

  els.followBtn.style.display = "block";
  els.followBtn.textContent = state.isFollowing ? "Following" : "Follow";
  els.followBtn.classList.toggle("is-active", state.isFollowing);
}

function renderLinks(profile) {
  if (els.website) {
    if (profile.website_url) {
      els.website.href = profile.website_url;
      els.website.textContent = "Website";
      els.website.style.display = "inline-flex";
    } else {
      els.website.style.display = "none";
    }
  }

  if (!els.socials) return;

  const links = [
    ["Instagram", profile.instagram_url],
    ["YouTube", profile.youtube_url],
    ["TikTok", profile.tiktok_url],
    ["Facebook", profile.facebook_url],
    ["Snapchat", profile.snapchat_url]
  ].filter(([, url]) => url);

  els.socials.innerHTML = links
    .map(([label, url]) => {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .join("");
}

function fillPanel(el, data, title, details = "") {
  if (!el) return;

  if (!data) {
    el.innerHTML = `<div class="rb-mini-empty">No ${escapeHtml(title)} data yet.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="rb-mini-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(details || "Connected")}</p>
    </div>
  `;
}

function renderExtras() {
  fillPanel(
    els.creatorPanel,
    state.extras.creator,
    "Creator Hub",
    state.extras.creator?.page_theme || "Creator system connected"
  );

  fillPanel(
    els.storePanel,
    state.extras.seller,
    "Store",
    state.extras.seller?.display_name || "Seller profile connected"
  );

  fillPanel(
    els.gamingPanel,
    state.extras.gamer,
    "Gaming",
    state.extras.gamer?.display_name || "Gaming profile connected"
  );

  fillPanel(
    els.sportsPanel,
    state.extras.sports,
    "Sports",
    state.extras.sports?.display_name || "Sports profile connected"
  );

  fillPanel(
    els.metaPanel,
    state.extras.meta,
    "Meta Avatar",
    state.extras.meta?.display_name || "Meta avatar connected"
  );
}

function renderPosts() {
  if (!els.feed) return;

  if (!state.posts.length) {
    if (els.empty) els.empty.style.display = "block";
    els.feed.innerHTML = "";
    return;
  }

  if (els.empty) els.empty.style.display = "none";

  els.feed.innerHTML = state.posts
    .map((post) => {
      const body =
        post.body ||
        post.caption ||
        post.content ||
        post.description ||
        "";

      return `
        <article class="rb-card rb-feed-card">
          <div class="rb-card-body">
            ${body ? `<p>${escapeHtml(body)}</p>` : ""}
            ${mediaMarkup(post)}
          </div>
        </article>
      `;
    })
    .join("");
}

async function toggleFollow() {
  const user = getUser();
  const profileId = state.profile?.id;

  if (!user?.id || !profileId || state.isMine || !els.followBtn) return;

  els.followBtn.disabled = true;

  try {
    if (state.isFollowing) {
      await supabase
        .from(RB_TABLES.followers)
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);

      state.isFollowing = false;
    } else {
      await supabase
        .from(RB_TABLES.followers)
        .upsert(
          {
            follower_id: user.id,
            following_id: profileId,
            created_at: new Date().toISOString()
          },
          {
            onConflict: "follower_id,following_id"
          }
        );

      state.isFollowing = true;
    }

    await fetchCounts(profileId);
    renderProfile();
  } catch (error) {
    console.warn("[RB FOLLOW TOGGLE FAILED]", error.message);
  } finally {
    els.followBtn.disabled = false;
  }
}

function bindActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.edit;
  });

  els.followBtn?.addEventListener("click", toggleFollow);

  els.messageBtn?.addEventListener("click", () => {
    if (!state.profile?.id) return;

    window.location.href =
      `${RB_ROUTES.messages}?user=${encodeURIComponent(state.profile.id)}`;
  });
}

function bindTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.profileTab;

      els.tabs.forEach((item) => {
        item.classList.toggle("is-active", item === tab);
      });

      els.panels.forEach((panel) => {
        panel.style.display =
          panel.dataset.profilePanel === target ? "block" : "none";
      });
    });
  });
}

function clearRealtime() {
  state.channels.forEach((channel) => {
    supabase.removeChannel(channel);
  });

  state.channels = [];
}

function subscribeRealtime(profileId) {
  if (!profileId) return;

  clearRealtime();

  const channel = supabase
    .channel(`rb-profile-page-${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${profileId}`
      },
      reloadSoft
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPosts,
        filter: `user_id=eq.${profileId}`
      },
      async () => {
        await fetchPosts(profileId);
        renderPosts();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.followers
      },
      reloadSoft
    )
    .subscribe();

  state.channels.push(channel);
}

async function reloadSoft() {
  const profileId = state.profile?.id;
  if (!profileId) return;

  await refreshProfileState();

  const profileState = getProfileState();

  state.profile = profileState.profile || state.profile;
  state.identity = profileState.identity || state.identity;
  state.isMine = profileState.isMine || state.isMine;

  await Promise.all([
    fetchCounts(profileId),
    fetchFollowing(profileId),
    fetchExtras(profileId)
  ]);

  renderProfile();
}

async function loadEverything() {
  if (els.status) {
    els.status.textContent = "Loading profile...";
  }

  const isPublicRoute = hasPublicProfileRoute();

  if (!isPublicRoute && getUser()?.id) {
    const ensuredProfile = await ensureMyProfile();

    if (ensuredProfile?.id) {
      state.profile = ensuredProfile;
      state.isMine = true;
    }
  }

  let profileState = await loadProfileByRoute();

  state.profile = profileState.profile || state.profile;
  state.identity = profileState.identity || state.identity;
  state.isMine = profileState.isMine || state.isMine;

  if (!state.profile?.id && !isPublicRoute && getUser()?.id) {
    const ensuredProfile = await ensureMyProfile();

    if (ensuredProfile?.id) {
      await refreshProfileState();

      profileState = getProfileState();

      state.profile = profileState.profile || ensuredProfile;
      state.identity = profileState.identity;
      state.isMine = true;
    }
  }

  const profileId = state.profile?.id;

  if (!profileId) {
    throw new Error("Profile not found.");
  }

  await Promise.all([
    fetchCounts(profileId),
    fetchFollowing(profileId),
    fetchExtras(profileId),
    fetchPosts(profileId)
  ]);

  renderProfile();
  renderPosts();
  subscribeRealtime(profileId);

  document.body.classList.add("rb-profile-ready");
}

function markReady() {
  document.body.classList.add("rb-page-ready");
  document.body.classList.remove("rb-page-error");
  console.log("RB PROFILE PAGE READY");
}

function markError(error) {
  document.body.classList.add("rb-page-error");
  console.warn("[RB PROFILE PAGE ERROR]", error.message);

  if (els.status) {
    els.status.textContent = error.message || "Profile failed to load.";
  }
}

async function bootProfilePage() {
  bindTabs();
  bindActions();
  bootProfileLinks();

  onProfileState((profileState) => {
    if (!profileState.ready || !profileState.profile) return;

    state.profile = profileState.profile;
    state.identity = profileState.identity;
    state.isMine = profileState.isMine;

    renderProfile();
  });

  try {
    await loadEverything();
    markReady();
  } catch (error) {
    markError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProfilePage);
} else {
  bootProfilePage();
}
