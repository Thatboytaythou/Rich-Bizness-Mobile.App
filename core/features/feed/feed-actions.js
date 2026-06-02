/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-actions.js

   FEED ACTION ENGINE
   Public view + signed-in actions
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
  setPostLikeState,
  setPostViewCount
} from "/core/features/feed/feed-state.js";

const supabase = getSupabase();

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
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
  return String(profileHandle(profile) || "@rich_user").replace("@", "");
}

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

  const payload = {
    user_id: user.id,
    username: currentUsername(profile),
    display_name: profileName(profile),
    avatar_url: profileAvatar(profile),
    title: cleanTitle || null,
    body: cleanBody || null,
    media_url: cleanMediaUrl || null,
    media_type: safeText(mediaType, cleanMediaUrl ? "image" : ""),
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
      ...metadata
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function toggleFeedLike(postId) {
  const user = requireSignedIn();

  if (!postId) throw new Error("Missing post id.");

  const { data: existing } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

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
        user_id: user.id
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
  const { count, error } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      like_count: finalCount,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);

  return finalCount;
}

export async function addFeedComment(postId, body) {
  const user = requireSignedIn();
  const profile = await ensureMyProfile();

  const cleanBody = safeText(body);

  if (!postId) throw new Error("Missing post id.");
  if (!cleanBody) throw new Error("Comment is empty.");

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .insert({
      post_id: postId,
      user_id: user.id,
      username: currentUsername(profile),
      display_name: profileName(profile),
      body: cleanBody,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "feed-actions.js",
        avatar_url: profileAvatar(profile)
      }
    })
    .select("*")
    .single();

  if (error) throw error;

  await syncFeedCommentCount(postId);
  await loadFeedComments(postId);

  return data;
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
  const { count, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      comment_count: finalCount,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);

  return finalCount;
}

export async function addFeedView(postId) {
  if (!postId) return 0;

  const user = getUser();

  const sessionId =
    localStorage.getItem("rb_session_id") ||
    crypto.randomUUID();

  localStorage.setItem("rb_session_id", sessionId);

  await supabase
    .from(RB_TABLES.feedPostViews)
    .insert({
      post_id: postId,
      user_id: user?.id || null,
      session_id: sessionId
    });

  const count = await syncFeedViewCount(postId);
  setPostViewCount(postId, count);

  return count;
}

export async function syncFeedViewCount(postId) {
  const { count, error } = await supabase
    .from(RB_TABLES.feedPostViews)
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw error;

  const finalCount = count || 0;

  await supabase
    .from(RB_TABLES.feedPosts)
    .update({
      view_count: finalCount,
      updated_at: new Date().toISOString()
    })
    .eq("id", postId);

  return finalCount;
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
  return true;
}

console.log("RB FEED ACTIONS READY");
