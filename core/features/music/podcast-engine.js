/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/podcast-engine.js

   PODCAST ENGINE
   Podcast shows + episodes CRUD
   Likes + playback helpers
   Uses shared Supabase client
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbSelect,
  rbInsert,
  rbUpdate,
  rbDelete
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

import {
  setPodcasts,
  upsertMusicItem,
  removeMusicItem,
  setLiked,
  setLikedIds
} from "/core/features/music/music-state.js";

import {
  playTrack
} from "/core/features/music/track-player.js";

const supabase = getSupabase();

function showsTable() {
  return RB_TABLES.podcastShows || "podcast_shows";
}

function episodesTable() {
  return RB_TABLES.podcastEpisodes || "podcast_episodes";
}

function likesTable() {
  return RB_TABLES.podcastLikes || "podcast_likes";
}

function commentsTable() {
  return RB_TABLES.podcastComments || "podcast_comments";
}

function requireUser() {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  return user;
}

function cleanText(value = "", fallback = "") {
  return String(value ?? fallback).trim();
}

function cleanVisibility(value = "public") {
  const clean = cleanText(value, "public").toLowerCase();

  return ["public", "private", "followers", "unlisted"].includes(clean)
    ? clean
    : "public";
}

function normalizeEpisode(row = {}) {
  const audioUrl =
    row.audio_url ||
    row.stream_url ||
    row.file_url ||
    row.media_url ||
    row.url ||
    "";

  return {
    ...row,
    title: row.title || row.name || "Untitled Episode",
    name: row.name || row.title || "Untitled Episode",
    audio_url: audioUrl,
    stream_url: row.stream_url || audioUrl,
    cover_url:
      row.cover_url ||
      row.image_url ||
      row.thumbnail_url ||
      row.show?.cover_url ||
      "/images/brand/hero-banner.png",
    episode_number: Number(row.episode_number || row.episode || 0) || null,
    like_count: Number(row.like_count || 0),
    comment_count: Number(row.comment_count || 0),
    play_count: Number(row.play_count || 0),
    status: row.status || "published",
    visibility: row.visibility || "public"
  };
}

function normalizeShow(row = {}) {
  return {
    ...row,
    title: row.title || row.name || "Rich Bizness Podcast",
    name: row.name || row.title || "Rich Bizness Podcast",
    cover_url:
      row.cover_url ||
      row.image_url ||
      row.thumbnail_url ||
      "/images/brand/hero-banner.png",
    episode_count: Number(row.episode_count || 0),
    visibility: row.visibility || "public",
    status: row.status || "active"
  };
}

function publicFilter(query) {
  return query
    .in("status", ["active", "published", "live"])
    .or("visibility.eq.public,is_public.eq.true,visibility.is.null");
}

/* =========================
   SHOWS
========================= */

export async function createPodcastShow({
  title = "",
  name = "",
  description = "",
  coverUrl = "",
  category = "",
  visibility = "public",
  status = "active",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  const finalTitle = cleanText(title || name, "Rich Bizness Podcast");
  const finalVisibility = cleanVisibility(visibility);

  const rows = await rbInsert({
    table: showsTable(),
    values: {
      user_id: user.id,
      creator_id: user.id,
      username: identity.username || null,
      display_name: identity.display_name || null,
      avatar_url: identity.avatar_url || null,

      title: finalTitle,
      name: finalTitle,
      description: cleanText(description),
      cover_url: cleanText(coverUrl) || null,
      category: cleanText(category, "podcast"),
      visibility: finalVisibility,
      is_public: finalVisibility === "public",
      status,
      episode_count: 0,

      metadata: {
        source: "podcast-engine.js",
        profile_avatar: identity.avatar_url || null,
        ...metadata
      },
      updated_at: new Date().toISOString()
    }
  });

  return normalizeShow(rows?.[0] || {});
}

export async function updatePodcastShow({
  showId,
  values = {}
} = {}) {
  const user = requireUser();

  if (!showId) {
    throw new Error("Missing podcast show id.");
  }

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.user_id;
  delete cleanValues.creator_id;
  delete cleanValues.created_at;

  if (cleanValues.coverUrl && !cleanValues.cover_url) {
    cleanValues.cover_url = cleanValues.coverUrl;
    delete cleanValues.coverUrl;
  }

  if (cleanValues.title && !cleanValues.name) {
    cleanValues.name = cleanValues.title;
  }

  if (cleanValues.name && !cleanValues.title) {
    cleanValues.title = cleanValues.name;
  }

  if (cleanValues.visibility) {
    cleanValues.visibility = cleanVisibility(cleanValues.visibility);
    cleanValues.is_public = cleanValues.visibility === "public";
  }

  const rows = await rbUpdate({
    table: showsTable(),
    match: {
      id: showId,
      user_id: user.id
    },
    values: cleanValues
  });

  return rows?.[0] ? normalizeShow(rows[0]) : null;
}

export async function deletePodcastShow(showId) {
  const user = requireUser();

  if (!showId) {
    throw new Error("Missing podcast show id.");
  }

  await rbDelete({
    table: episodesTable(),
    match: {
      show_id: showId,
      user_id: user.id
    }
  });

  await rbDelete({
    table: showsTable(),
    match: {
      id: showId,
      user_id: user.id
    }
  });

  return true;
}

export async function loadPodcastShows({
  limit = 50,
  publicOnly = true
} = {}) {
  let query = supabase
    .from(showsTable())
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (publicOnly) {
    query = publicFilter(query);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(normalizeShow);
}

export async function loadMyPodcastShows({
  limit = 50
} = {}) {
  const user = requireUser();

  const rows = await rbSelect({
    table: showsTable(),
    select: "*",
    match: {
      user_id: user.id
    },
    orderBy: "updated_at",
    ascending: false,
    limit
  });

  return (rows || []).map(normalizeShow);
}

export async function getPodcastShowById(showId) {
  if (!showId) return null;

  const row = await rbSelect({
    table: showsTable(),
    select: "*",
    match: {
      id: showId
    },
    maybeSingle: true
  });

  return row ? normalizeShow(row) : null;
}

export async function syncPodcastShowEpisodeCount(showId) {
  if (!showId) return null;

  const { count, error } = await supabase
    .from(episodesTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("show_id", showId);

  if (error) {
    console.warn("[RB PODCAST SHOW COUNT WARNING]", error.message);
    return null;
  }

  const rows = await rbUpdate({
    table: showsTable(),
    match: {
      id: showId
    },
    values: {
      episode_count: count || 0,
      updated_at: new Date().toISOString()
    }
  });

  return rows?.[0] ? normalizeShow(rows[0]) : null;
}

/* =========================
   EPISODES
========================= */

export async function loadPodcastEpisodes({
  showId = null,
  limit = 50,
  publicOnly = true,
  search = ""
} = {}) {
  let query = supabase
    .from(episodesTable())
    .select(`
      *,
      show:${showsTable()}(*)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (showId) {
    query = query.eq("show_id", showId);
  }

  if (publicOnly) {
    query = publicFilter(query);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB PODCAST JOIN LOAD WARNING]", error.message);

    let fallback = supabase
      .from(episodesTable())
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (showId) fallback = fallback.eq("show_id", showId);
    if (publicOnly) fallback = publicFilter(fallback);

    const fallbackResult = await fallback;

    if (fallbackResult.error) throw fallbackResult.error;

    const episodes = (fallbackResult.data || []).map(normalizeEpisode);
    setPodcasts(episodes);
    return episodes;
  }

  const episodes = (data || []).map(normalizeEpisode);

  setPodcasts(episodes);

  return episodes;
}

export async function loadMyPodcastEpisodes({
  limit = 50
} = {}) {
  const user = requireUser();

  const rows = await rbSelect({
    table: episodesTable(),
    select: "*",
    match: {
      user_id: user.id
    },
    orderBy: "created_at",
    ascending: false,
    limit
  });

  const episodes = (rows || []).map(normalizeEpisode);

  setPodcasts(episodes);

  return episodes;
}

export async function getPodcastEpisodeById(episodeId) {
  if (!episodeId) return null;

  const row = await rbSelect({
    table: episodesTable(),
    select: "*",
    match: {
      id: episodeId
    },
    maybeSingle: true
  });

  return row ? normalizeEpisode(row) : null;
}

export async function createPodcastEpisode({
  showId = null,
  title = "",
  name = "",
  description = "",
  body = "",
  audioUrl = "",
  streamUrl = "",
  coverUrl = "",
  episodeNumber = null,
  durationSeconds = null,
  category = "",
  visibility = "public",
  status = "published",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  const finalTitle = cleanText(title || name, "Untitled Episode");
  const finalAudioUrl = cleanText(audioUrl || streamUrl);
  const finalVisibility = cleanVisibility(visibility);

  if (!finalAudioUrl) {
    throw new Error("Podcast audio URL required.");
  }

  const rows = await rbInsert({
    table: episodesTable(),
    values: {
      show_id: showId,
      user_id: user.id,
      creator_id: user.id,
      username: identity.username || null,
      display_name: identity.display_name || null,
      avatar_url: identity.avatar_url || null,

      title: finalTitle,
      name: finalTitle,
      description: cleanText(description || body),
      body: cleanText(body || description),

      audio_url: finalAudioUrl,
      stream_url: finalAudioUrl,
      cover_url: cleanText(coverUrl) || null,

      episode_number: episodeNumber ? Number(episodeNumber) : null,
      duration_seconds: durationSeconds ? Number(durationSeconds) : null,

      category: cleanText(category, "podcast"),
      visibility: finalVisibility,
      is_public: finalVisibility === "public",
      status,

      like_count: 0,
      comment_count: 0,
      play_count: 0,

      metadata: {
        source: "podcast-engine.js",
        profile_avatar: identity.avatar_url || null,
        ...metadata
      },
      updated_at: new Date().toISOString()
    }
  });

  const episode = normalizeEpisode(rows?.[0] || {});

  upsertMusicItem(episode, "podcast");

  if (showId) {
    await syncPodcastShowEpisodeCount(showId);
  }

  return episode;
}

export async function updatePodcastEpisode({
  episodeId,
  values = {}
} = {}) {
  const user = requireUser();

  if (!episodeId) {
    throw new Error("Missing podcast episode id.");
  }

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.user_id;
  delete cleanValues.creator_id;
  delete cleanValues.created_at;

  if (cleanValues.audioUrl && !cleanValues.audio_url) {
    cleanValues.audio_url = cleanValues.audioUrl;
    cleanValues.stream_url = cleanValues.audioUrl;
    delete cleanValues.audioUrl;
  }

  if (cleanValues.streamUrl && !cleanValues.stream_url) {
    cleanValues.stream_url = cleanValues.streamUrl;
    cleanValues.audio_url = cleanValues.streamUrl;
    delete cleanValues.streamUrl;
  }

  if (cleanValues.coverUrl && !cleanValues.cover_url) {
    cleanValues.cover_url = cleanValues.coverUrl;
    delete cleanValues.coverUrl;
  }

  if (cleanValues.episodeNumber && !cleanValues.episode_number) {
    cleanValues.episode_number = Number(cleanValues.episodeNumber);
    delete cleanValues.episodeNumber;
  }

  if (cleanValues.durationSeconds && !cleanValues.duration_seconds) {
    cleanValues.duration_seconds = Number(cleanValues.durationSeconds);
    delete cleanValues.durationSeconds;
  }

  if (cleanValues.title && !cleanValues.name) {
    cleanValues.name = cleanValues.title;
  }

  if (cleanValues.name && !cleanValues.title) {
    cleanValues.title = cleanValues.name;
  }

  if (cleanValues.visibility) {
    cleanValues.visibility = cleanVisibility(cleanValues.visibility);
    cleanValues.is_public = cleanValues.visibility === "public";
  }

  const rows = await rbUpdate({
    table: episodesTable(),
    match: {
      id: episodeId,
      user_id: user.id
    },
    values: cleanValues
  });

  const episode = rows?.[0] ? normalizeEpisode(rows[0]) : null;

  if (episode) {
    upsertMusicItem(episode, "podcast");
  }

  return episode;
}

export async function deletePodcastEpisode(episodeId) {
  const user = requireUser();

  if (!episodeId) {
    throw new Error("Missing podcast episode id.");
  }

  const episode = await getPodcastEpisodeById(episodeId);

  await rbDelete({
    table: episodesTable(),
    match: {
      id: episodeId,
      user_id: user.id
    }
  });

  removeMusicItem(episodeId, "podcast");

  if (episode?.show_id) {
    await syncPodcastShowEpisodeCount(episode.show_id);
  }

  return true;
}

/* =========================
   PLAYBACK
========================= */

export async function playPodcastEpisode(episodeOrId) {
  const episode =
    typeof episodeOrId === "string"
      ? await getPodcastEpisodeById(episodeOrId)
      : normalizeEpisode(episodeOrId || {});

  if (!episode?.id && !episode?.audio_url) {
    throw new Error("Podcast episode not found.");
  }

  if (!episode.audio_url && !episode.stream_url) {
    throw new Error("Podcast episode has no audio URL.");
  }

  await incrementPodcastPlayCount(episode.id);

  return await playTrack(episode, {
    type: "podcast",
    autoplay: true
  });
}

export async function incrementPodcastPlayCount(episodeId) {
  if (!episodeId) return 0;

  const episode = await getPodcastEpisodeById(episodeId);
  const nextCount = Number(episode?.play_count || 0) + 1;

  const rows = await rbUpdate({
    table: episodesTable(),
    match: {
      id: episodeId
    },
    values: {
      play_count: nextCount,
      updated_at: new Date().toISOString()
    }
  });

  if (rows?.[0]) {
    upsertMusicItem(normalizeEpisode(rows[0]), "podcast");
  }

  return nextCount;
}

/* =========================
   LIKES
========================= */

export async function loadMyPodcastLikes() {
  const user = getUser();

  if (!user?.id) {
    setLikedIds({
      type: "podcast",
      ids: []
    });

    return [];
  }

  const rows = await rbSelect({
    table: likesTable(),
    select: "episode_id,podcast_episode_id",
    match: {
      user_id: user.id
    }
  });

  const ids = (rows || [])
    .map((row) => row.episode_id || row.podcast_episode_id)
    .filter(Boolean);

  setLikedIds({
    type: "podcast",
    ids
  });

  return ids;
}

export async function togglePodcastLike(episodeId) {
  const user = requireUser();

  if (!episodeId) {
    throw new Error("Missing podcast episode id.");
  }

  const { data: existing } = await supabase
    .from(likesTable())
    .select("id")
    .eq("user_id", user.id)
    .or(`episode_id.eq.${episodeId},podcast_episode_id.eq.${episodeId}`)
    .maybeSingle();

  let liked = false;

  if (existing?.id) {
    const { error } = await supabase
      .from(likesTable())
      .delete()
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(likesTable())
      .insert({
        user_id: user.id,
        episode_id: episodeId,
        podcast_episode_id: episodeId
      });

    if (error) throw error;

    liked = true;
  }

  const count = await syncPodcastLikeCount(episodeId);

  setLiked("podcast", episodeId, liked);

  return {
    liked,
    count
  };
}

export async function syncPodcastLikeCount(episodeId) {
  if (!episodeId) return 0;

  const { count, error } = await supabase
    .from(likesTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .or(`episode_id.eq.${episodeId},podcast_episode_id.eq.${episodeId}`);

  if (error) throw error;

  const finalCount = count || 0;

  const rows = await rbUpdate({
    table: episodesTable(),
    match: {
      id: episodeId
    },
    values: {
      like_count: finalCount,
      updated_at: new Date().toISOString()
    }
  });

  if (rows?.[0]) {
    upsertMusicItem(normalizeEpisode(rows[0]), "podcast");
  }

  return finalCount;
}

/* =========================
   COMMENTS
========================= */

export async function addPodcastComment({
  episodeId,
  body = "",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  const cleanBody = cleanText(body);

  if (!episodeId) {
    throw new Error("Missing podcast episode id.");
  }

  if (!cleanBody) {
    throw new Error("Comment is empty.");
  }

  const rows = await rbInsert({
    table: commentsTable(),
    values: {
      episode_id: episodeId,
      podcast_episode_id: episodeId,
      user_id: user.id,
      username: identity.username || null,
      display_name: identity.display_name || null,
      avatar_url: identity.avatar_url || null,
      body: cleanBody,
      metadata: {
        source: "podcast-engine.js",
        ...metadata
      }
    }
  });

  await syncPodcastCommentCount(episodeId);

  return rows?.[0] || null;
}

export async function loadPodcastComments({
  episodeId,
  limit = 50
} = {}) {
  if (!episodeId) return [];

  const { data, error } = await supabase
    .from(commentsTable())
    .select("*")
    .or(`episode_id.eq.${episodeId},podcast_episode_id.eq.${episodeId}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

export async function syncPodcastCommentCount(episodeId) {
  if (!episodeId) return 0;

  const { count, error } = await supabase
    .from(commentsTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .or(`episode_id.eq.${episodeId},podcast_episode_id.eq.${episodeId}`);

  if (error) throw error;

  const finalCount = count || 0;

  const rows = await rbUpdate({
    table: episodesTable(),
    match: {
      id: episodeId
    },
    values: {
      comment_count: finalCount,
      updated_at: new Date().toISOString()
    }
  });

  if (rows?.[0]) {
    upsertMusicItem(normalizeEpisode(rows[0]), "podcast");
  }

  return finalCount;
}

/* =========================
   BOOT
========================= */

export async function initPodcastEngine() {
  const episodes = await loadPodcastEpisodes();
  await loadMyPodcastLikes();

  console.log("RB PODCAST ENGINE READY");

  return episodes;
}

console.log("RB PODCAST ENGINE LOADED");
