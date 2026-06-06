/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-actions.js

   FEED ACTION ENGINE
   Public view + signed-in actions
   Uses shared rb-supabase client only
========================= */

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
  profileAvatar,
  profileName,
  profileHandle
} from "/core/shared/rb-profile.js";

import {
  setPostComments,
  addPostComment,
  setPostLikeState,
  setPostViewCount,
  removeFeedPost
} from "/core/features/feed/feed-state.js";

const supabase = getSupabase();

function now() {
  return new Date().toISOString();
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function inferMediaType(url = "", fallback = "") {
  const clean = safeText(fallback).toLowerCase();
  if (clean) return clean;

  const lower = safeText(url).toLowerCase();

  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";
  if (lower) return "image";

  return "";
}

function signInUrl() {
  return `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`;
}

function requireSignedIn() {
  const user = getUser();

  if (!user?.id) {
    window.location.href = signInUrl();
    throw new Error("Sign in required.");
  }

  return user;
}

function currentUsername(profile) {
  return String(profileHandle(profile) || "@rich_user")
    .replace("@", "")
    .trim()
    .toLowerCase();
}

function safeSessionId() {
  const key = "rb_session_id";
  let sessionId = localStorage.getItem(key);

  if (!sessionId) {
    sessionId =
      globalThis.crypto?.randomUUID?.() ||
      `rb-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(key, sessionId);
  }

  return sessionId;
}

/* =========================
   POSTS
========================= */

export async function createFeedPost({
  title = "",
  body = "",
  mediaUrl = "",
  mediaType = "",
  section = "feed",
  visibility = "public",
  metadata = {}
} = {}) {
  const user = requireSignedIn();
  const profile = await ensureMyProfile();

  const cleanTitle = safeText(title);
  const cleanBody = safeText(body);
  const cleanMediaUrl = safeText(mediaUrl);

  if (!cleanTitle && !cleanBody && !cleanMediaUrl) {
    throw new Error("Add text, title, or media first.");
  }

  const finalMediaType = inferMediaType(cleanMediaUrl, mediaType);

  const payload = {
    user_id: user.id,
    username: currentUsername(profile),
    display_name: profileName(profile),
    avatar_url: profileAvatar(profile),
    title: cleanTitle || null,
    body: cleanBody || null,
    media_url: cleanMediaUrl || null,
    media_type: finalMediaType || null,
    section: safeText(section, "feed"),
    visibility: safeText(visibility, "public"),
    like_count: 0,
    comment_count: 0,
    repost_count: 0,
    view_count: 0,
    metadata: {
      app: "Rich Bizness Mobile",
      source: "feed-actions.js",
      profile_avatar: profileAvatar(profile),
      profile_name: profileName(profile),
      username: currentUsername(profile),
      ...metadata
    },
    created_at: now(),
    updated_at: now()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteFeedPost(postId) {
  const user = requireSignedIn();

  if (!postId) throw new Error("Missing post id.");

  const { error } = await supabase
    .from(RB_TABLES.feedPosts)
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) throw error;

  removeFeedPost(postId);

  return true;
}

/* =========================
   LIKES
========================= */

export async function hasLikedFeedPost(postId, userId = null) {
  const activeUserId = userId || getUser()?.id;

  if (!postId || !activeUserId) return false;

  const { data, error } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", activeUserId)
    .maybeSingle();

  if (error) throw error;

  return !!data?.id;
}

export async function toggleFeedLike(postId) {
  const user = requireSignedIn();

  if (!postId) throw new Error("Missing post id.");

  const { data: existing, error: existingError } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  let liked = false;

  if (existing?.id) {
    const { error } = await supabase
      .from(RB_TABLES.feedPostLikes)
      .delete()
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(RB_TABLES.feedPostLikes)
      .insert({
        post_id: postId,
        user_id: user.id,
        created_at: now()
      });

    if (error) throw error;
    liked = true;
  }

  const count = await syncFeedLikeCount(postId);
  setPostLikeState(postId, liked, count);

  return {
    liked,
    count
  };
}

export async function syncFeedLikeCount(postId) {
  if (!postId) return 0;

  const { count, error } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      like_count: finalCount,
      updated_at: now()
    })
    .eq("id", postId);

  return finalCount;
}

/* =========================
   COMMENTS
========================= */

export async function addFeedComment(postId, body) {
  const user = requireSignedIn();
  const profile = await ensureMyProfile();

  const cleanBody = safeText(body);

  if (!postId) throw new Error("Missing post id.");
  if (!cleanBody) throw new Error("Comment is empty.");

  const payload = {
    post_id: postId,
    user_id: user.id,
    username: currentUsername(profile),
    display_name: profileName(profile),
    body: cleanBody,
    metadata: {
      app: "Rich Bizness Mobile",
      source: "feed-actions.js",
      avatar_url: profileAvatar(profile)
    },
    created_at: now(),
    updated_at: now()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  addPostComment(postId, data);

  const count = await syncFeedCommentCount(postId);
  const comments = await loadFeedComments(postId);

  return {
    comment: data,
    count,
    comments
  };
}

export async function loadFeedComments(postId) {
  if (!postId) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw error;

  setPostComments(postId, data || []);

  return data || [];
}

export async function syncFeedCommentCount(postId) {
  if (!postId) return 0;

  const { count, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      comment_count: finalCount,
      updated_at: now()
    })
    .eq("id", postId);

  return finalCount;
}

/* =========================
   VIEWS
========================= */

export async function addFeedView(postId) {
  if (!postId) return 0;

  const user = getUser();
  const sessionId = safeSessionId();

  try {
    await supabase
      .from(RB_TABLES.feedPostViews)
      .insert({
        post_id: postId,
        user_id: user?.id || null,
        session_id: sessionId,
        created_at: now()
      });
  } catch (error) {
    console.warn("[RB FEED VIEW INSERT SKIPPED]", error?.message || error);
  }

  const count = await syncFeedViewCount(postId);
  setPostViewCount(postId, count);

  return count;
}

export async function syncFeedViewCount(postId) {
  if (!postId) return 0;

  const { count, error } = await supabase
    .from(RB_TABLES.feedPostViews)
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      view_count: finalCount,
      updated_at: now()
    })
    .eq("id", postId);

  return finalCount;
}

/* =========================
   SYNC HELPERS
========================= */

export async function loadPostActionState(postId) {
  if (!postId) {
    return {
      liked: false,
      likes: 0,
      comments: [],
      commentCount: 0,
      views: 0
    };
  }

  const [liked, likes, comments, commentCount, views] = await Promise.all([
    hasLikedFeedPost(postId).catch(() => false),
    syncFeedLikeCount(postId).catch(() => 0),
    loadFeedComments(postId).catch(() => []),
    syncFeedCommentCount(postId).catch(() => 0),
    syncFeedViewCount(postId).catch(() => 0)
  ]);

  setPostLikeState(postId, liked, likes);
  setPostViewCount(postId, views);

  return {
    liked,
    likes,
    comments,
    commentCount,
    views
  };
}

console.log("RB FEED ACTIONS READY");
