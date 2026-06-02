/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-realtime.js

   FEED REALTIME ENGINE
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-auth.js";

import {
  loadFeedComments,
  syncFeedLikeCount,
  syncFeedCommentCount,
  syncFeedViewCount
} from "/core/features/feed/feed-actions.js";

const supabase = getSupabase();

const FEED_REALTIME = {
  channel: null,
  listeners: new Set(),
  refreshHandler: null
};

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

export function bindFeedRealtime({
  onRefresh = null,
  channelName = "rich-bizness-feed-sync"
} = {}) {
  clearFeedRealtime();

  FEED_REALTIME.refreshHandler =
    typeof onRefresh === "function" ? onRefresh : null;

  FEED_REALTIME.channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPosts
      },
      async (payload) => {
        emitRealtime({
          type: "posts",
          payload
        });

        await refreshFeedSafe();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedComments
      },
      async (payload) => {
        const postId =
          payload.new?.post_id ||
          payload.old?.post_id ||
          null;

        emitRealtime({
          type: "comments",
          postId,
          payload
        });

        if (postId) {
          await Promise.allSettled([
            loadFeedComments(postId),
            syncFeedCommentCount(postId)
          ]);
        }

        await refreshFeedSafe();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPostLikes
      },
      async (payload) => {
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

        await refreshFeedSafe();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPostViews
      },
      async (payload) => {
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

        await refreshFeedSafe();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles
      },
      async (payload) => {
        emitRealtime({
          type: "profiles",
          payload
        });

        await refreshFeedSafe();
      }
    )
    .subscribe((status) => {
      console.log(`[RB FEED REALTIME] ${status}`);

      emitRealtime({
        type: "status",
        status
      });
    });

  return FEED_REALTIME.channel;
}

async function refreshFeedSafe() {
  if (typeof FEED_REALTIME.refreshHandler !== "function") return;

  try {
    await FEED_REALTIME.refreshHandler();
  } catch (error) {
    console.warn("[RB FEED REALTIME REFRESH SKIPPED]", error);
  }
}

export function clearFeedRealtime() {
  if (FEED_REALTIME.channel) {
    supabase.removeChannel(FEED_REALTIME.channel);
  }

  FEED_REALTIME.channel = null;
  FEED_REALTIME.refreshHandler = null;
}

window.addEventListener("beforeunload", () => {
  clearFeedRealtime();
});

console.log("RB FEED REALTIME READY");
