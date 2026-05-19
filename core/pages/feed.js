import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RB_SUPABASE, RB_TABLES, RB_ROUTES } from "/core/shared/rb-config.js";

const supabase = createClient(RB_SUPABASE.url, RB_SUPABASE.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
  channel: null
};

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function avatarUrl(profile = FEED.profile) {
  return profile?.avatar_url || "/images/brand/project-avatar.png.jpeg";
}

function displayName(profile = FEED.profile, user = FEED.user) {
  return (
    profile?.display_name ||
    profile?.username ||
    user?.email ||
    "Rich Bizness User"
  );
}

function username(profile = FEED.profile, user = FEED.user) {
  return profile?.username || user?.email || "rich_user";
}

function route(path) {
  return path || "/";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function mediaHtml(post) {
  const url = safeText(post.media_url);
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
  const profileUrl = `${route(RB_ROUTES.profile)}?user=${encodeURIComponent(post.user_id)}`;

  return `
    <article class="feed-card" data-post-id="${escapeHtml(post.id)}">
      <header class="feed-card-head">
        <a class="feed-user" href="${profileUrl}">
          <img src="${escapeHtml(post.avatar_url || "/images/brand/project-avatar.png.jpeg")}" alt="" />
          <span>
            <strong>${escapeHtml(post.display_name || post.username || "Rich User")}</strong>
            <small>@${escapeHtml(post.username || "rich_user")} · ${escapeHtml(timeAgo(post.created_at))}</small>
          </span>
        </a>
        <span class="feed-chip">${escapeHtml(post.section || "feed")}</span>
      </header>

      ${post.title ? `<h2>${escapeHtml(post.title)}</h2>` : ""}
      ${post.body ? `<p class="feed-body">${escapeHtml(post.body)}</p>` : ""}

      ${mediaHtml(post)}

      <footer class="feed-actions">
        <button data-action="like" data-id="${escapeHtml(post.id)}">💚 <span>${Number(post.like_count || 0)}</span></button>
        <button data-action="comment" data-id="${escapeHtml(post.id)}">💬 <span>${Number(post.comment_count || 0)}</span></button>
        <button data-action="repost" data-id="${escapeHtml(post.id)}">🔁 <span>${Number(post.repost_count || 0)}</span></button>
        <button data-action="view" data-id="${escapeHtml(post.id)}">👁 <span>${Number(post.view_count || 0)}</span></button>
      </footer>

      <form class="feed-comment-form" data-comment-form="${escapeHtml(post.id)}">
        <input type="text" placeholder="Drop a Rich Bizness comment..." />
        <button type="submit">Send</button>
      </form>

      <div class="feed-comments" data-comments="${escapeHtml(post.id)}"></div>
    </article>
  `;
}

async function initAuth() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    setStatus("Sign in to post, like, and comment.");
    return false;
  }

  FEED.user = data.user;

  const { data: profile } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  FEED.profile = profile || {
    id: data.user.id,
    username: data.user.email,
    display_name: data.user.email,
    avatar_url: "/images/brand/project-avatar.png.jpeg"
  };

  if (els.composerAvatar) els.composerAvatar.src = avatarUrl();
  if (els.composerName) els.composerName.textContent = displayName();

  setStatus(`Signed in as ${displayName()}`);
  return true;
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

  const userIds = [...new Set((data || []).map((post) => post.user_id).filter(Boolean))];

  let profilesById = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from(RB_TABLES.profiles)
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  FEED.posts = (data || []).map((post) => ({
    ...post,
    avatar_url: profilesById[post.user_id]?.avatar_url,
    username: post.username || profilesById[post.user_id]?.username,
    display_name: post.display_name || profilesById[post.user_id]?.display_name
  }));

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

  if (!FEED.user) {
    setStatus("Sign in first.");
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
    username: username(),
    display_name: displayName(),
    title: title || null,
    body,
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
      profile_avatar: avatarUrl()
    }
  };

  const { error } = await supabase.from(RB_TABLES.feedPosts).insert(payload);

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
  if (!FEED.user) return setStatus("Sign in to like.");

  const { data: existing } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", FEED.user.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from(RB_TABLES.feedPostLikes).delete().eq("id", existing.id);
  } else {
    await supabase.from(RB_TABLES.feedPostLikes).insert({
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
    .update({ like_count: count || 0, updated_at: new Date().toISOString() })
    .eq("id", postId);
}

async function addView(postId) {
  await supabase.from(RB_TABLES.feedPostViews).insert({
    post_id: postId,
    user_id: FEED.user?.id || null,
    session_id: localStorage.getItem("rb_session_id") || crypto.randomUUID()
  });

  const { count } = await supabase
    .from(RB_TABLES.feedPostViews)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({ view_count: count || 0, updated_at: new Date().toISOString() })
    .eq("id", postId);
}

async function addComment(postId, input) {
  if (!FEED.user) return setStatus("Sign in to comment.");

  const body = safeText(input.value);
  if (!body) return;

  input.disabled = true;

  const { error } = await supabase.from(RB_TABLES.feedComments).insert({
    post_id: postId,
    user_id: FEED.user.id,
    username: username(),
    display_name: displayName(),
    body,
    metadata: {
      source: "feed.js",
      avatar_url: avatarUrl()
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
    .update({ comment_count: count || 0, updated_at: new Date().toISOString() })
    .eq("id", postId);
}

async function loadComments(postId) {
  const holder = document.querySelector(`[data-comments="${CSS.escape(postId)}"]`);
  if (!holder) return;

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) return;

  holder.innerHTML = (data || [])
    .map(
      (comment) => `
        <div class="feed-comment">
          <strong>${escapeHtml(comment.display_name || comment.username || "Rich User")}</strong>
          <span>${escapeHtml(comment.body)}</span>
        </div>
      `
    )
    .join("");
}

function bindClicks() {
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
  if (FEED.channel) supabase.removeChannel(FEED.channel);

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
    .subscribe();
}

function bindUI() {
  if (els.form) els.form.addEventListener("submit", createPost);
  if (els.refresh) els.refresh.addEventListener("click", loadPosts);
}

async function init() {
  if (!localStorage.getItem("rb_session_id")) {
    localStorage.setItem("rb_session_id", crypto.randomUUID());
  }

  bindUI();
  bindClicks();
  await initAuth();
  await loadPosts();
  bindRealtime();
}

init();
