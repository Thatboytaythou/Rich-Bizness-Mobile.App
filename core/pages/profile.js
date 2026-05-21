const PROFILE_TABLE = "profiles";
const FEED_TABLE = "feed_posts";
const FOLLOW_TABLE = "followers";
const THEME_TABLE = "profile_theme_settings";
const LEVEL_TABLE = "user_levels";
const META_AVATAR_TABLE = "meta_avatars";
const SELLER_TABLE = "store_seller_profiles";
const GAMER_TABLE = "gamer_profiles";
const SPORTS_TABLE = "sports_profiles";
const CREATOR_TABLE = "creator_page_settings";

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
  channels: [],
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
  musicPanel: $("profileMusicPanel"),
  livePanel: $("profileLivePanel"),
  storePanel: $("profileStorePanel"),
  gamingPanel: $("profileGamingPanel"),
  sportsPanel: $("profileSportsPanel"),
  metaPanel: $("profileMetaPanel"),
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

function mediaTypeFromUrl(url = "") {
  const clean = url.toLowerCase();
  if (clean.match(/\.(mp4|mov|webm|m4v)(\?|$)/)) return "video";
  if (clean.match(/\.(mp3|wav|m4a|ogg)(\?|$)/)) return "audio";
  if (clean.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/)) return "image";
  return "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQueryProfileId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id") || url.searchParams.get("user") || url.searchParams.get("u");
}

async function resolveSupabase() {
  if (window.rbSupabase) return window.rbSupabase;
  if (window.supabase?.createClient) {
    const url =
      window.RB_SUPABASE_URL ||
      window.SUPABASE_URL ||
      window.RB_CONFIG?.SUPABASE_URL ||
      window.__RB_CONFIG__?.SUPABASE_URL;
    const key =
      window.RB_SUPABASE_ANON_KEY ||
      window.SUPABASE_ANON_KEY ||
      window.RB_CONFIG?.SUPABASE_ANON_KEY ||
      window.__RB_CONFIG__?.SUPABASE_ANON_KEY;

    if (url && key) {
      window.rbSupabase = window.supabase.createClient(url, key);
      return window.rbSupabase;
    }
  }

  try {
    const mod = await import("/core/shared/supabase.js");
    return mod.supabase || mod.rbSupabase || mod.default;
  } catch {
    return null;
  }
}

async function initAuth() {
  state.supabase = await resolveSupabase();
  if (!state.supabase) {
    setStatus("Supabase client not found.");
    return false;
  }

  const { data } = await state.supabase.auth.getSession();
  state.session = data?.session || null;
  state.user = state.session?.user || null;
  state.targetId = getQueryProfileId() || state.user?.id || null;
  state.isOwner = !!state.user?.id && state.user.id === state.targetId;

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
      display_name: userMeta.display_name || userMeta.full_name || "Rich Bizness User",
      full_name: userMeta.full_name || null,
      avatar_url: userMeta.avatar_url || DEFAULT_AVATAR,
      banner_url: DEFAULT_BANNER,
      online_status: "online",
      last_seen_at: new Date().toISOString(),
      metadata: { source: "profile.js:auto-create" },
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.user.id);
}

async function fetchCounts() {
  const [followersRes, followingRes, postsRes] = await Promise.all([
    state.supabase.from(FOLLOW_TABLE).select("id", { count: "exact", head: true }).eq("following_id", state.targetId),
    state.supabase.from(FOLLOW_TABLE).select("id", { count: "exact", head: true }).eq("follower_id", state.targetId),
    state.supabase.from(FEED_TABLE).select("id", { count: "exact", head: true }).eq("user_id", state.targetId),
  ]);

  return {
    followers: followersRes.count || 0,
    following: followingRes.count || 0,
    posts: postsRes.count || 0,
  };
}

async function fetchOwnerExtras() {
  const [theme, level, meta, seller, gamer, sports, creator] = await Promise.allSettled([
    state.supabase.from(THEME_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(LEVEL_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(META_AVATAR_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(SELLER_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(GAMER_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(SPORTS_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
    state.supabase.from(CREATOR_TABLE).select("*").eq("user_id", state.targetId).maybeSingle(),
  ]);

  return {
    theme: theme.value?.data || null,
    level: level.value?.data || null,
    meta: meta.value?.data || null,
    seller: seller.value?.data || null,
    gamer: gamer.value?.data || null,
    sports: sports.value?.data || null,
    creator: creator.value?.data || null,
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

  if (els.banner) els.banner.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.75)), url("${banner}")`;
  if (els.avatar) els.avatar.src = avatar;
  if (els.name) els.name.textContent = publicName(p);
  if (els.username) els.username.textContent = username(p);
  if (els.bio) els.bio.textContent = safeText(p.bio, "Building the Rich Bizness universe.");
  if (els.rank) els.rank.textContent = safeText(extras?.level?.rank_title || p.rank_title, "Member");
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
  if (els.messageBtn) els.messageBtn.style.display = !state.isOwner && state.user ? "" : "none";

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
    ["Snapchat", profile.snapchat_url],
  ].filter(([, url]) => safeText(url));

  els.socials.innerHTML = links
    .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`)
    .join("");
}

function renderExtras(extras) {
  fillPanel(els.creatorPanel, extras.creator, "Creator Hub", [
    ["Title", extras.creator?.creator_title],
    ["Tagline", extras.creator?.creator_tagline],
    ["Theme", extras.creator?.page_theme],
  ]);

  fillPanel(els.storePanel, extras.seller, "Store Seller", [
    ["Seller", extras.seller?.seller_name],
    ["Rank", extras.seller?.seller_rank],
    ["Sales", money(extras.seller?.total_sales_cents)],
  ]);

  fillPanel(els.gamingPanel, extras.gamer, "Gaming Profile", [
    ["Gamer Tag", extras.gamer?.gamer_tag],
    ["Rank", extras.gamer?.rank_title],
    ["Wins", extras.gamer?.wins],
  ]);

  fillPanel(els.sportsPanel, extras.sports, "Sports Profile", [
    ["Fan Tag", extras.sports?.fan_tag],
    ["Team", extras.sports?.favorite_team],
    ["Points", extras.sports?.points],
  ]);

  fillPanel(els.metaPanel, extras.meta, "Meta Avatar", [
    ["Display", extras.meta?.display_name],
    ["Aura", extras.meta?.aura],
    ["Level", extras.meta?.level],
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
  } else if (mediaUrl && type === "video") {
    media = `<video class="rb-post-media" src="${escapeHtml(mediaUrl)}" controls playsinline></video>`;
  } else if (mediaUrl && type === "audio") {
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
        following_id: state.targetId,
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

      els.tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      els.panels.forEach((panel) => {
        panel.style.display = panel.dataset.profilePanel === key ? "" : "none";
      });
    });
  });
}

function bindActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = "/edit";
  });

  els.followBtn?.addEventListener("click", toggleFollow);

  els.messageBtn?.addEventListener("click", () => {
    if (!state.targetId) return;
    window.location.href = `/messages?user=${encodeURIComponent(state.targetId)}`;
  });

  window.addEventListener("beforeunload", () => {
    if (!state.isOwner || !state.user || !state.supabase) return;
    state.supabase
      .from(PROFILE_TABLE)
      .update({
        online_status: "offline",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", state.user.id);
  });
}

function subscribeRealtime() {
  if (!state.supabase || !state.targetId) return;

  const profileChannel = state.supabase
    .channel(`profile-page-${state.targetId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: PROFILE_TABLE, filter: `id=eq.${state.targetId}` },
      async () => reloadSoft()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: FEED_TABLE, filter: `user_id=eq.${state.targetId}` },
      async () => {
        await fetchPosts();
        renderPosts();
      }
    )
    .subscribe();

  state.channels.push(profileChannel);
}

async function reloadSoft() {
  const [profile, counts, extras] = await Promise.all([
    fetchProfile(),
    fetchCounts(),
    fetchOwnerExtras(),
  ]);

  if (profile) renderProfile(counts, extras);
}

async function boot() {
  bindTabs();
  bindActions();

  const ready = await initAuth();
  if (!ready) return;

  try {
    setStatus("Loading profile...");
    await updatePresence();
    await fetchProfile();
    await checkFollowing();

    const [counts, extras] = await Promise.all([
      fetchCounts(),
      fetchOwnerExtras(),
      fetchPosts(),
    ]);

    renderProfile(counts, extras);
    renderPosts();
    subscribeRealtime();

    setStatus(state.isOwner ? "Your profile is synced." : "Profile loaded.");
  } catch (error) {
    console.error("[profile.js]", error);
    setStatus(error.message || "Profile failed to load.");
  }
}

document.addEventListener("DOMContentLoaded", boot);
