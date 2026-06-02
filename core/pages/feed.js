/* =========================================
   RICH BIZNESS LLC
   /core/pages/feed.js

   FEED PAGE CONTROLLER
   Public view + signed-in posting
========================================= */

import {
  RB_TABLES
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
  profileName
} from "/core/shared/rb-profile.js";

import {
  setFeedLoading,
  setFeedPosts,
  setFeedError
} from "/core/features/feed/feed-state.js";

import {
  renderFeedList,
  renderComposerIdentity,
  renderCommentList
} from "/core/features/feed/feed-render.js";

import {
  createFeedPost,
  toggleFeedLike,
  addFeedView,
  addFeedComment,
  loadFeedComments
} from "/core/features/feed/feed-actions.js";

import {
  bindFeedRealtime,
  clearFeedRealtime
} from "/core/features/feed/feed-realtime.js";

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
  actionsBound: false,
  booted: false,
  openComments: new Set()
};

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function signInUrl() {
  return `/auth?next=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`;
}

function currentAvatar() {
  return profileAvatar(FEED.profile) || DEFAULT_AVATAR;
}

function currentName() {
  return profileName(FEED.profile) || "Rich Bizness User";
}

function paintComposer() {
  renderComposerIdentity({
    avatarEl: els.composerAvatar,
    nameEl: els.composerName,
    avatarUrl: FEED.user?.id ? currentAvatar() : DEFAULT_AVATAR,
    displayName: FEED.user?.id ? currentName() : "Guest Viewer"
  });
}

async function initFeedAuth() {
  await initAuthState();

  const auth = getAuthState();

  FEED.user = auth.user || getUser() || null;
  FEED.profile = auth.profile || null;

  if (FEED.user?.id) {
    FEED.profile = await ensureMyProfile();
    await refreshProfileState();
  }

  paintComposer();

  setStatus(
    FEED.user?.id
      ? `Signed in as ${currentName()}`
      : "Public feed. Sign in to post, like, and comment."
  );

  return !!FEED.user?.id;
}

async function loadPosts() {
  if (!els.list) return;

  setFeedLoading(true);
  setStatus("Loading feed...");

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .eq("visibility", "public")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setFeedError(error);
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
      avatar_url:
        post.avatar_url ||
        post.metadata?.profile_avatar ||
        profile.avatar_url ||
        DEFAULT_AVATAR,
      username:
        post.username ||
        profile.username ||
        "rich_user",
      display_name:
        post.display_name ||
        profile.display_name ||
        profile.username ||
        "Rich User"
    };
  });

  setFeedPosts(FEED.posts);

  renderFeedList({
    target: els.list,
    posts: FEED.posts,
    emptyTarget: els.empty,
    options: {
      openComments: Array.from(FEED.openComments)
    }
  });

  setStatus(`${FEED.posts.length} feed posts loaded.`);
}

async function createPost(event) {
  event.preventDefault();

  if (!FEED.user?.id) {
    setStatus("Sign in first.");
    window.location.href = signInUrl();
    return;
  }

  if (els.submit) els.submit.disabled = true;

  try {
    await createFeedPost({
      title: safeText(els.title?.value),
      body: safeText(els.body?.value),
      mediaUrl: safeText(els.mediaUrl?.value),
      mediaType: safeText(els.mediaType?.value),
      section: safeText(els.section?.value, "feed"),
      visibility: safeText(els.visibility?.value, "public"),
      metadata: {
        source_page: "feed.js"
      }
    });

    els.form?.reset();
    setStatus("Posted to feed.");
    await loadPosts();
  } catch (error) {
    setStatus(error?.message || "Post failed.");
  } finally {
    if (els.submit) els.submit.disabled = false;
  }
}

async function handleLike(postId) {
  try {
    await toggleFeedLike(postId);
    await loadPosts();
  } catch (error) {
    setStatus(error?.message || "Like failed.");
  }
}

async function handleView(postId) {
  try {
    await addFeedView(postId);
    await loadPosts();
  } catch (error) {
    setStatus(error?.message || "View failed.");
  }
}

async function handleComments(postId) {
  try {
    FEED.openComments.add(postId);

    const comments = await loadFeedComments(postId);

    renderCommentList({
      postId,
      comments
    });
  } catch (error) {
    setStatus(error?.message || "Comments failed.");
  }
}

async function handleCommentSubmit(form) {
  const postId = form.dataset.commentForm;
  const input = form.querySelector("input");

  if (!postId || !input) return;

  try {
    await addFeedComment(postId, input.value);
    input.value = "";

    FEED.openComments.add(postId);

    const comments = await loadFeedComments(postId);

    await loadPosts();

    renderCommentList({
      postId,
      comments
    });
  } catch (error) {
    setStatus(error?.message || "Comment failed.");
  }
}

function bindClicks() {
  if (FEED.actionsBound) return;
  FEED.actionsBound = true;

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (!id) return;

    if (action === "like") await handleLike(id);
    if (action === "view") await handleView(id);
    if (action === "comment") await handleComments(id);
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;

    event.preventDefault();
    await handleCommentSubmit(form);
  });
}

function bindUI() {
  els.form?.addEventListener("submit", createPost);
  els.refresh?.addEventListener("click", loadPosts);

  onProfileState((profileState) => {
    if (!profileState.ready) return;

    FEED.profile = profileState.profile || FEED.profile;
    FEED.user = profileState.auth?.user || FEED.user;

    paintComposer();
  });
}

async function init() {
  if (FEED.booted) return;
  FEED.booted = true;

  if (!localStorage.getItem("rb_session_id")) {
    localStorage.setItem("rb_session_id", crypto.randomUUID());
  }

  bindUI();
  bindClicks();

  await initFeedAuth();
  await loadPosts();

  bindFeedRealtime({
    onRefresh: loadPosts
  });

  window.addEventListener("beforeunload", () => {
    clearFeedRealtime();
  });

  document.body.classList.add("rb-feed-ready");

  console.log("RB FEED PAGE READY");
}

init().catch((error) => {
  console.error("[RB FEED INIT FAILED]", error);
  setFeedError(error);
  setStatus(error?.message || "Feed failed to load.");
});
