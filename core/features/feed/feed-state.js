/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-state.js

   FEED STATE ENGINE
========================= */

const FEED_STATE = {
  ready: false,
  loading: false,
  posts: [],
  comments: {},
  likes: {},
  views: {},
  error: null,
  listeners: new Set()
};

export function getFeedState() {
  return {
    ready: FEED_STATE.ready,
    loading: FEED_STATE.loading,
    posts: [...FEED_STATE.posts],
    comments: { ...FEED_STATE.comments },
    likes: { ...FEED_STATE.likes },
    views: { ...FEED_STATE.views },
    error: FEED_STATE.error
  };
}

export function setFeedLoading(value = true) {
  FEED_STATE.loading = Boolean(value);
  emitFeedState();
}

export function setFeedReady(value = true) {
  FEED_STATE.ready = Boolean(value);
  emitFeedState();
}

export function setFeedError(error = null) {
  FEED_STATE.error = error;
  emitFeedState();
}

export function setFeedPosts(posts = []) {
  FEED_STATE.posts = Array.isArray(posts) ? posts : [];
  FEED_STATE.ready = true;
  FEED_STATE.loading = false;
  FEED_STATE.error = null;
  emitFeedState();
}

export function upsertFeedPost(post) {
  if (!post?.id) return;

  const index = FEED_STATE.posts.findIndex((item) => item.id === post.id);

  if (index >= 0) {
    FEED_STATE.posts[index] = {
      ...FEED_STATE.posts[index],
      ...post
    };
  } else {
    FEED_STATE.posts.unshift(post);
  }

  emitFeedState();
}

export function removeFeedPost(postId) {
  FEED_STATE.posts = FEED_STATE.posts.filter((post) => post.id !== postId);
  emitFeedState();
}

export function setPostComments(postId, comments = []) {
  if (!postId) return;

  FEED_STATE.comments[postId] = Array.isArray(comments) ? comments : [];
  emitFeedState();
}

export function setPostLikeState(postId, liked = false, count = 0) {
  if (!postId) return;

  FEED_STATE.likes[postId] = {
    liked: Boolean(liked),
    count: Number(count || 0)
  };

  emitFeedState();
}

export function setPostViewCount(postId, count = 0) {
  if (!postId) return;

  FEED_STATE.views[postId] = Number(count || 0);
  emitFeedState();
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
  emitFeedState();
}

console.log("RB FEED STATE READY");
