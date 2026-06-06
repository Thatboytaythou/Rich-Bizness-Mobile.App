/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-realtime.js

   FEED REALTIME ENGINE
   Uses shared rb-realtime manager
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  rbChannelName,
  subscribeToTable,
  unsubscribeChannel
} from "/core/shared/rb-realtime.js";

import {
  loadFeedComments,
  syncFeedLikeCount,
  syncFeedCommentCount,
  syncFeedViewCount
} from "/core/features/feed/feed-actions.js";

const FEED_REALTIME = {
  channelKey: null,
  listeners: new Set(),
  refreshHandler: null,
  refreshTimer: null,
  syncingPosts: new Set()
};

/* =========================
   EVENTS
========================= */

function emitRealtime(payload) {
  FEED_REALTIME.listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn("[RB FEED REALTIME LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:feed-realtime", {
      detail: payload
    })
  );
}

export function onFeedRealtime(callback) {
  if (typeof callback !== "function") return () => {};

  FEED_REALTIME.listeners.add(callback);

  return () => {
    FEED_REALTIME.listeners.delete(callback);
  };
}

/* =========================
   REFRESH CONTROL
========================= */

function scheduleRefresh(delay = 180) {
  if (typeof FEED_REALTIME.refreshHandler !== "function") return;

  clearTimeout(FEED_REALTIME.refreshTimer);

  FEED_REALTIME.refreshTimer = window.setTimeout(async () => {
    try {
      await FEED_REALTIME.refreshHandler();
    } catch (error) {
      console.warn("[RB FEED REALTIME REFRESH SKIPPED]", error);
    }
  }, delay);
}

async function syncPostActions(postId) {
  if (!postId) return;

  if (FEED_REALTIME.syncingPosts.has(postId)) return;

  FEED_REALTIME.syncingPosts.add(postId);

  try {
    await Promise.allSettled([
      loadFeedComments(postId),
      syncFeedLikeCount(postId),
      syncFeedCommentCount(postId),
      syncFeedViewCount(postId)
    ]);
  } finally {
    FEED_REALTIME.syncingPosts.delete(postId);
  }
}

/* =========================
   BIND
========================= */

export function bindFeedRealtime({
  onRefresh = null,
  channelName = "rich-bizness-feed-sync"
} = {}) {
  clearFeedRealtime();

  FEED_REALTIME.channelKey = rbChannelName(channelName);
  FEED_REALTIME.refreshHandler =
    typeof onRefresh === "function" ? onRefresh : null;

  const key = FEED_REALTIME.channelKey;

  subscribeToTable({
    key,
    table: RB_TABLES.feedPosts,
    event: "*",
    onChange: async (payload) => {
      emitRealtime({
        type: "posts",
        payload
      });

      scheduleRefresh();
    },
    onStatus: (status) => {
      emitRealtime({
        type: "status",
        status
      });
    }
  });

  subscribeToTable({
    key: rbChannelName(key, "comments"),
    table: RB_TABLES.feedComments,
    event: "*",
    onChange: async (payload) => {
      const postId =
        payload.new?.post_id ||
        payload.old?.post_id ||
        null;

      emitRealtime({
        type: "comments",
        postId,
        payload
      });

      await syncPostActions(postId);
      scheduleRefresh();
    }
  });

  subscribeToTable({
    key: rbChannelName(key, "likes"),
    table: RB_TABLES.feedPostLikes,
    event: "*",
    onChange: async (payload) => {
      const postId =
        payload.new?.post_id ||
        payload.old?.post_id ||
        null;

      emitRealtime({
        type: "likes",
        postId,
        payload
      });

      if (postId) {
        await syncFeedLikeCount(postId);
      }

      scheduleRefresh();
    }
  });

  subscribeToTable({
    key: rbChannelName(key, "views"),
    table: RB_TABLES.feedPostViews,
    event: "*",
    onChange: async (payload) => {
      const postId =
        payload.new?.post_id ||
        payload.old?.post_id ||
        null;

      emitRealtime({
        type: "views",
        postId,
        payload
      });

      if (postId) {
        await syncFeedViewCount(postId);
      }

      scheduleRefresh();
    }
  });

  subscribeToTable({
    key: rbChannelName(key, "profiles"),
    table: RB_TABLES.profiles,
    event: "*",
    onChange: async (payload) => {
      emitRealtime({
        type: "profiles",
        payload
      });

      scheduleRefresh(300);
    }
  });

  return {
    key,
    clear: clearFeedRealtime
  };
}

/* =========================
   CLEAR
========================= */

export async function clearFeedRealtime() {
  clearTimeout(FEED_REALTIME.refreshTimer);

  if (FEED_REALTIME.channelKey) {
    await Promise.allSettled([
      unsubscribeChannel(FEED_REALTIME.channelKey),
      unsubscribeChannel(rbChannelName(FEED_REALTIME.channelKey, "comments")),
      unsubscribeChannel(rbChannelName(FEED_REALTIME.channelKey, "likes")),
      unsubscribeChannel(rbChannelName(FEED_REALTIME.channelKey, "views")),
      unsubscribeChannel(rbChannelName(FEED_REALTIME.channelKey, "profiles"))
    ]);
  }

  FEED_REALTIME.channelKey = null;
  FEED_REALTIME.refreshHandler = null;
  FEED_REALTIME.refreshTimer = null;
  FEED_REALTIME.syncingPosts.clear();
}

window.addEventListener("beforeunload", () => {
  clearFeedRealtime();
});

console.log("RB FEED REALTIME READY");
