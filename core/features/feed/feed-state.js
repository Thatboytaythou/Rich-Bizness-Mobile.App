/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-state.js

   FEED STATE ENGINE
   Local state for posts, comments, likes, views
========================= */

const FEED_STATE = {
  ready: false,
  loading: false,
  posts: [],
  comments: {},
  likes: {},
  views: {},
  error: null,
  activePostId: null,
  listeners: new Set()
};

function clonePost(post = {}) {
  return {
    ...post
  };
}

function cloneList(list = []) {
  return Array.isArray(list)
    ? list.map((item) => ({ ...item }))
    : [];
}

function normalizeError(error = null) {
  if (!error) return null;

  return {
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null
  };
}

function sortPosts(posts = []) {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.created_at || b.updated_at || 0).getTime();

    return bTime - aTime;
  });
}

export function getFeedState() {
  return {
    ready: FEED_STATE.ready,
    loading: FEED_STATE.loading,
    posts: cloneList(FEED_STATE.posts),
    comments: Object.fromEntries(
      Object.entries(FEED_STATE.comments).map(([postId, comments]) => [
        postId,
        cloneList(comments)
      ])
    ),
    likes: Object.fromEntries(
      Object.entries(FEED_STATE.likes).map(([postId, likeState]) => [
        postId,
        { ...likeState }
      ])
    ),
    views: { ...FEED_STATE.views },
    error: FEED_STATE.error ? { ...FEED_STATE.error } : null,
    activePostId: FEED_STATE.activePostId
  };
}

export function setFeedLoading(value = true) {
  FEED_STATE.loading = Boolean(value);

  if (FEED_STATE.loading) {
    FEED_STATE.error = null;
  }

  emitFeedState();
}

export function setFeedReady(value = true) {
  FEED_STATE.ready = Boolean(value);

  if (value) {
    FEED_STATE.loading = false;
  }

  emitFeedState();
}

export function setFeedError(error = null) {
  FEED_STATE.error = normalizeError(error);
  FEED_STATE.loading = false;
  emitFeedState();
}

export function clearFeedError() {
  FEED_STATE.error = null;
  emitFeedState();
}

export function setFeedPosts(posts = []) {
  FEED_STATE.posts = sortPosts(Array.isArray(posts) ? posts : []);
  FEED_STATE.ready = true;
  FEED_STATE.loading = false;
  FEED_STATE.error = null;
  emitFeedState();
}

export function appendFeedPosts(posts = []) {
  if (!Array.isArray(posts) || !posts.length) return;

  posts.forEach((post) => {
    if (post?.id) {
      upsertFeedPost(post, {
        emit: false
      });
    }
  });

  FEED_STATE.posts = sortPosts(FEED_STATE.posts);
  FEED_STATE.ready = true;
  FEED_STATE.loading = false;

  emitFeedState();
}

export function upsertFeedPost(post, options = {}) {
  if (!post?.id) return;

  const index = FEED_STATE.posts.findIndex((item) => item.id === post.id);

  if (index >= 0) {
    FEED_STATE.posts[index] = {
      ...FEED_STATE.posts[index],
      ...clonePost(post)
    };
  } else {
    FEED_STATE.posts.unshift(clonePost(post));
  }

  FEED_STATE.posts = sortPosts(FEED_STATE.posts);

  if (options.emit !== false) {
    emitFeedState();
  }
}

export function removeFeedPost(postId) {
  if (!postId) return;

  FEED_STATE.posts = FEED_STATE.posts.filter((post) => post.id !== postId);

  delete FEED_STATE.comments[postId];
  delete FEED_STATE.likes[postId];
  delete FEED_STATE.views[postId];

  if (FEED_STATE.activePostId === postId) {
    FEED_STATE.activePostId = null;
  }

  emitFeedState();
}

export function getFeedPost(postId) {
  if (!postId) return null;

  const post = FEED_STATE.posts.find((item) => item.id === postId);
  return post ? clonePost(post) : null;
}

export function setActiveFeedPost(postId = null) {
  FEED_STATE.activePostId = postId;
  emitFeedState();
}

export function getActiveFeedPost() {
  return getFeedPost(FEED_STATE.activePostId);
}

export function setPostComments(postId, comments = []) {
  if (!postId) return;

  FEED_STATE.comments[postId] = cloneList(comments);
  emitFeedState();
}

export function addPostComment(postId, comment) {
  if (!postId || !comment?.id) return;

  const comments = FEED_STATE.comments[postId] || [];

  const exists = comments.some((item) => item.id === comment.id);

  FEED_STATE.comments[postId] = exists
    ? comments.map((item) =>
        item.id === comment.id
          ? { ...item, ...comment }
          : item
      )
    : [...comments, comment];

  emitFeedState();
}

export function removePostComment(postId, commentId) {
  if (!postId || !commentId) return;

  FEED_STATE.comments[postId] = (FEED_STATE.comments[postId] || []).filter(
    (comment) => comment.id !== commentId
  );

  emitFeedState();
}

export function setPostLikeState(postId, liked = false, count = 0) {
  if (!postId) return;

  FEED_STATE.likes[postId] = {
    liked: Boolean(liked),
    count: Math.max(0, Number(count || 0))
  };

  emitFeedState();
}

export function togglePostLikeState(postId, liked = null) {
  if (!postId) return;

  const current = FEED_STATE.likes[postId] || {
    liked: false,
    count: 0
  };

  const nextLiked =
    liked === null
      ? !current.liked
      : Boolean(liked);

  const nextCount = Math.max(
    0,
    Number(current.count || 0) + (nextLiked && !current.liked ? 1 : 0) - (!nextLiked && current.liked ? 1 : 0)
  );

  FEED_STATE.likes[postId] = {
    liked: nextLiked,
    count: nextCount
  };

  emitFeedState();

  return FEED_STATE.likes[postId];
}

export function setPostViewCount(postId, count = 0) {
  if (!postId) return;

  FEED_STATE.views[postId] = Math.max(0, Number(count || 0));
  emitFeedState();
}

export function incrementPostViewCount(postId, amount = 1) {
  if (!postId) return;

  FEED_STATE.views[postId] =
    Math.max(0, Number(FEED_STATE.views[postId] || 0)) +
    Math.max(1, Number(amount || 1));

  emitFeedState();

  return FEED_STATE.views[postId];
}

export function onFeedState(callback) {
  if (typeof callback !== "function") return () => {};

  FEED_STATE.listeners.add(callback);

  try {
    callback(getFeedState());
  } catch (error) {
    console.warn("[RB FEED STATE LISTENER ERROR]", error);
  }

  return () => {
    FEED_STATE.listeners.delete(callback);
  };
}

export function emitFeedState() {
  const state = getFeedState();

  FEED_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB FEED STATE LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:feed-state", {
      detail: state
    })
  );
}

export function resetFeedState() {
  FEED_STATE.ready = false;
  FEED_STATE.loading = false;
  FEED_STATE.posts = [];
  FEED_STATE.comments = {};
  FEED_STATE.likes = {};
  FEED_STATE.views = {};
  FEED_STATE.error = null;
  FEED_STATE.activePostId = null;

  emitFeedState();
}

console.log("RB FEED STATE READY");
