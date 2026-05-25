/* =========================================
   RICH BIZNESS LLC
   /core/pages/feed.js

   FEED PAGE CONTROLLER
   Synced with auth + profile-state
========================================= */

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  initAuthState,
  getAuthState
} from "/core/features/auth/auth-state.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  profileAvatar,
  profileName,
  profileHandle
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const $ = (id) => document.getElementById(id);

const els = {
  status: $("feedStatus"),
  list: $("feedList"),
  form: $("feedForm"),
  body: $("feedBody"),
  mediaUrl: $("feedMediaUrl"),
  mediaType: $("feedMediaType"),
  title: $("feedTitle"),
  section: $("feedSection"),
  visibility: $("feedVisibility"),
  submit: $("feedSubmitBtn"),
  refresh: $("feedRefreshBtn"),
  composerAvatar: $("composerAvatar"),
  composerName: $("composerName"),
  empty: $("feedEmpty")
};

const FEED = {
  user: null,
  profile: null,
  posts: [],
  channel: null,
  actionsBound: false
};

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timeAgo(value) {
  if (!value) return "";

  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;

  return `${Math.floor(hrs / 24)}d`;
}

function currentAvatar() {
  return profileAvatar(FEED.profile) || DEFAULT_AVATAR;
}

function currentName() {
  return profileName(FEED.profile) || "Rich Bizness User";
}

function currentUsername() {
  return String(profileHandle(FEED.profile) || "@rich_user").replace("@", "");
}

function profileUrl(userId) {
  return `${RB_ROUTES.profile || "/profile"}?user=${encodeURIComponent(userId)}`;
}

function paintComposer() {
  if (els.composerAvatar) {
    els.composerAvatar.src = currentAvatar();
  }

  if (els.composerName) {
    els.composerName.textContent = currentName();
  }
}

function mediaHtml(post) {
  const url = safeText(post.media_url || post.file_url || post.image_url);
  if (!url) return "";

  const type = safeText(post.media_type, "image").toLowerCase();

  if (type.includes("video")) {
    return `<video class="feed-media" src="${escapeHtml(url)}" controls playsinline></video>`;
  }

  if (type.includes("audio")) {
    return `<audio class="feed-audio" src="${escapeHtml(url)}" controls></audio>`;
  }

  return `<img class="feed-media" src="${escapeHtml(url)}" alt="${escapeHtml(post.title || "Feed media")}" loading="lazy" />`;
}

function postCard(post) {
  const avatar = post.avatar_url || DEFAULT_AVATAR;
  const name = post.display_name || post.username || "Rich User";
  const username = post.username || "rich_user";

  return `
    <article class="feed-card rb-feed-card" data-post-id="${escapeHtml(post.id)}">
      <header class="feed-card-head">
        <a class="feed-user" href="${profileUrl(post.user_id)}">
          <img src="${escapeHtml(avatar)}" alt="" />
          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>@${escapeHtml(username)} · ${escapeHtml(timeAgo(post.created_at))}</small>
          </span>
        </a>

        <span class="feed-chip">${escapeHtml(post.section || "feed")}</span>
      </header>

      ${post.title ? `<h2>${escapeHtml(post.title)}</h2>` : ""}
      ${post.body ? `<p class="feed-body">${escapeHtml(post.body)}</p>` : ""}

      ${mediaHtml(post)}

      <footer class="feed-actions">
        <button type="button" data-action="like" data-id="${escapeHtml(post.id)}">💚 <span>${Number(post.like_count || 0)}</span></button>
        <button type="button" data-action="comment" data-id="${escapeHtml(post.id)}">💬 <span>${Number(post.comment_count || 0)}</span></button>
        <button type="button" data-action="repost" data-id="${escapeHtml(post.id)}">🔁 <span>${Number(post.repost_count || 0)}</span></button>
        <button type="button" data-action="view" data-id="${escapeHtml(post.id)}">👁 <span>${Number(post.view_count || 0)}</span></button>
      </footer>

      <form class="feed-comment-form" data-comment-form="${escapeHtml(post.id)}">
        <input type="text" placeholder="Drop a Rich Bizness comment..." />
        <button type="submit">Send</button>
      </form>

      <div class="feed-comments" data-comments="${escapeHtml(post.id)}"></div>
    </article>
  `;
}

async function initFeedAuth() {
  await initAuthState();

  const auth = getAuthState();

  FEED.user = auth.user || null;
  FEED.profile = auth.profile || null;

  if (FEED.user?.id) {
    FEED.profile = await ensureMyProfile();
    await refreshProfileState();
  }

  paintComposer();

  setStatus(
    FEED.user?.id
      ? `Signed in as ${currentName()}`
      : "Sign in to post, like, and comment."
  );

  return !!FEED.user?.id;
}

async function loadPosts() {
  if (!els.list) return;

  setStatus("Loading feed...");

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .eq("visibility", "public")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus(error.message);
    return;
  }

  const userIds = [
    ...new Set((data || []).map((post) => post.user_id).filter(Boolean))
  ];

  let profilesById = {};

  if (userIds.length) {
    const { data: profiles } = await supabase
      .from(RB_TABLES.profiles)
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    profilesById = Object.fromEntries(
      (profiles || []).map((profile) => [profile.id, profile])
    );
  }

  FEED.posts = (data || []).map((post) => {
    const profile = profilesById[post.user_id] || {};

    return {
      ...post,
      avatar_url: post.avatar_url || profile.avatar_url || DEFAULT_AVATAR,
      username: post.username || profile.username || "rich_user",
      display_name: post.display_name || profile.display_name || "Rich User"
    };
  });

  renderPosts();

  setStatus(`${FEED.posts.length} feed posts loaded.`);
}

function renderPosts() {
  if (!els.list) return;

  if (!FEED.posts.length) {
    els.list.innerHTML = "";
    if (els.empty) els.empty.style.display = "block";
    return;
  }

  if (els.empty) els.empty.style.display = "none";

  els.list.innerHTML = FEED.posts.map(postCard).join("");
}

async function createPost(event) {
  event.preventDefault();

  if (!FEED.user?.id) {
    setStatus("Sign in first.");
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  const body = safeText(els.body?.value);
  const mediaUrl = safeText(els.mediaUrl?.value);
  const title = safeText(els.title?.value);

  if (!body && !mediaUrl && !title) {
    setStatus("Add text, title, or media first.");
    return;
  }

  if (els.submit) els.submit.disabled = true;

  const payload = {
    user_id: FEED.user.id,
    username: currentUsername(),
    display_name: currentName(),
    title: title || null,
    body: body || null,
    media_url: mediaUrl || null,
    media_type: safeText(els.mediaType?.value, mediaUrl ? "image" : ""),
    section: safeText(els.section?.value, "feed"),
    visibility: safeText(els.visibility?.value, "public"),
    like_count: 0,
    comment_count: 0,
    repost_count: 0,
    view_count: 0,
    metadata: {
      source: "feed.js",
      app: "Rich Bizness Mobile",
      profile_avatar: currentAvatar()
    }
  };

  const { error } = await supabase
    .from(RB_TABLES.feedPosts)
    .insert(payload);

  if (error) {
    setStatus(error.message);
  } else {
    els.form?.reset();
    setStatus("Posted to feed.");
    await loadPosts();
  }

  if (els.submit) els.submit.disabled = false;
}

async function likePost(postId) {
  if (!FEED.user?.id) {
    setStatus("Sign in to like.");
    return;
  }

  const { data: existing } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", FEED.user.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from(RB_TABLES.feedPostLikes)
      .delete()
      .eq("id", existing.id);
  } else {
    await supabase
      .from(RB_TABLES.feedPostLikes)
      .insert({
        post_id: postId,
        user_id: FEED.user.id
      });
  }

  await syncLikeCount(postId);
}

async function syncLikeCount(postId) {
  const { count } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      like_count: count || 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);
}

async function addView(postId) {
  const sessionId =
    localStorage.getItem("rb_session_id") ||
    crypto.randomUUID();

  localStorage.setItem("rb_session_id", sessionId);

  await supabase
    .from(RB_TABLES.feedPostViews)
    .insert({
      post_id: postId,
      user_id: FEED.user?.id || null,
      session_id: sessionId
    });

  const { count } = await supabase
    .from(RB_TABLES.feedPostViews)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      view_count: count || 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);
}

async function addComment(postId, input) {
  if (!FEED.user?.id) {
    setStatus("Sign in to comment.");
    return;
  }

  const body = safeText(input?.value);
  if (!body) return;

  input.disabled = true;

  const { error } = await supabase
    .from(RB_TABLES.feedComments)
    .insert({
      post_id: postId,
      user_id: FEED.user.id,
      username: currentUsername(),
      display_name: currentName(),
      body,
      metadata: {
        source: "feed.js",
        avatar_url: currentAvatar()
      }
    });

  if (error) {
    setStatus(error.message);
  } else {
    input.value = "";
    await syncCommentCount(postId);
    await loadComments(postId);
  }

  input.disabled = false;
}

async function syncCommentCount(postId) {
  const { count } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      comment_count: count || 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);
}

async function loadComments(postId) {
  const holder = document.querySelector(
    `[data-comments="${CSS.escape(postId)}"]`
  );

  if (!holder) return;

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) return;

  holder.innerHTML = (data || [])
    .map((comment) => {
      return `
        <div class="feed-comment">
          <strong>${escapeHtml(comment.display_name || comment.username || "Rich User")}</strong>
          <span>${escapeHtml(comment.body)}</span>
        </div>
      `;
    })
    .join("");
}

function bindClicks() {
  if (FEED.actionsBound) return;
  FEED.actionsBound = true;

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "like") await likePost(id);
    if (action === "view") await addView(id);
    if (action === "comment") await loadComments(id);
    if (action === "repost") setStatus("Repost table not locked yet.");

    await loadPosts();
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;

    event.preventDefault();

    const postId = form.dataset.commentForm;
    const input = form.querySelector("input");

    await addComment(postId, input);
    await loadPosts();
  });
}

function bindRealtime() {
  if (FEED.channel) {
    supabase.removeChannel(FEED.channel);
  }

  FEED.channel = supabase
    .channel("rich-bizness-feed-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.feedPosts },
      loadPosts
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.feedComments },
      loadPosts
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.feedPostLikes },
      loadPosts
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.profiles },
      async () => {
        await initFeedAuth();
        await loadPosts();
      }
    )
    .subscribe();
}

function bindUI() {
  els.form?.addEventListener("submit", createPost);
  els.refresh?.addEventListener("click", loadPosts);

  onProfileState((profileState) => {
    if (!profileState.ready || !profileState.profile) return;

    FEED.profile = profileState.profile;
    paintComposer();
  });
}

async function init() {
  if (!localStorage.getItem("rb_session_id")) {
    localStorage.setItem("rb_session_id", crypto.randomUUID());
  }

  bindUI();
  bindClicks();

  await initFeedAuth();
  await loadPosts();

  bindRealtime();

  document.body.classList.add("rb-feed-ready");

  console.log("RB FEED PAGE READY");
}

init().catch((error) => {
  console.error("[RB FEED INIT FAILED]", error);
  setStatus(error?.message || "Feed failed to load.");
});
