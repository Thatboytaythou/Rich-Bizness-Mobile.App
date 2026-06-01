/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-search.js

   GLOBAL SEARCH ENGINE
   Profiles + Feed + Live + Music + Games + Sports + Store + Meta
========================= */

import {
  RB_ROUTES,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

function cleanQuery(query = "") {
  return String(query || "").trim();
}

function likeQuery(query = "") {
  return `%${cleanQuery(query)}%`;
}

function safeLimit(limit = 12) {
  return Math.min(Math.max(Number(limit || 12), 1), 50);
}

function item({
  type,
  title,
  subtitle = "",
  image = "",
  url = "",
  table = "",
  id = null,
  raw = null
}) {
  return {
    type,
    title,
    subtitle,
    image,
    url,
    table,
    id,
    raw
  };
}

export async function searchProfiles(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("id,username,display_name,bio,avatar_url,banner_url,is_verified,role")
    .or(`username.ilike.${likeQuery(q)},display_name.ilike.${likeQuery(q)},full_name.ilike.${likeQuery(q)}`)
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((p) =>
    item({
      type: "profile",
      title: p.display_name || p.username || "Rich User",
      subtitle: p.username ? `@${p.username}` : p.bio || "Profile",
      image: p.avatar_url || p.banner_url || "",
      url: `${RB_ROUTES.profile}?id=${encodeURIComponent(p.id)}`,
      table: RB_TABLES.profiles,
      id: p.id,
      raw: p
    })
  );
}

export async function searchFeed(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("id,user_id,username,display_name,body,media_url,thumbnail_url,section,created_at")
    .or(`body.ilike.${likeQuery(q)},username.ilike.${likeQuery(q)},display_name.ilike.${likeQuery(q)},section.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((p) =>
    item({
      type: "feed",
      title: p.display_name || p.username || "Feed Post",
      subtitle: p.body || "Rich Bizness post",
      image: p.thumbnail_url || p.media_url || "",
      url: `${RB_ROUTES.feed}?post=${encodeURIComponent(p.id)}`,
      table: RB_TABLES.feedPosts,
      id: p.id,
      raw: p
    })
  );
}

export async function searchLive(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select("id,slug,title,description,status,thumbnail_url,cover_url,viewer_count,created_at")
    .or(`title.ilike.${likeQuery(q)},description.ilike.${likeQuery(q)},category.ilike.${likeQuery(q)},slug.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((s) =>
    item({
      type: "live",
      title: s.title || "Live Room",
      subtitle: `${String(s.status || "draft").toUpperCase()} · ${Number(s.viewer_count || 0)} watching`,
      image: s.thumbnail_url || s.cover_url || "",
      url: `${RB_ROUTES.watch}?stream=${encodeURIComponent(s.slug || s.id)}`,
      table: RB_TABLES.liveStreams,
      id: s.id,
      raw: s
    })
  );
}

export async function searchMusic(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.musicTracks)
    .select("id,user_id,username,display_name,title,description,genre,audio_url,cover_url,created_at")
    .or(`title.ilike.${likeQuery(q)},description.ilike.${likeQuery(q)},genre.ilike.${likeQuery(q)},username.ilike.${likeQuery(q)},display_name.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((t) =>
    item({
      type: "music",
      title: t.title || "Music Track",
      subtitle: t.display_name || t.username || t.genre || "Music",
      image: t.cover_url || "",
      url: `${RB_ROUTES.music}?track=${encodeURIComponent(t.id)}`,
      table: RB_TABLES.musicTracks,
      id: t.id,
      raw: t
    })
  );
}

export async function searchGaming(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.games)
    .select("id,slug,title,description,cover_url,thumbnail_url,game_type,total_plays,created_at")
    .or(`title.ilike.${likeQuery(q)},description.ilike.${likeQuery(q)},slug.ilike.${likeQuery(q)},game_type.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((g) =>
    item({
      type: "gaming",
      title: g.title || "Game",
      subtitle: `${g.game_type || "arcade"} · ${Number(g.total_plays || 0)} plays`,
      image: g.thumbnail_url || g.cover_url || "",
      url: `${RB_ROUTES.gaming}?game=${encodeURIComponent(g.slug || g.id)}`,
      table: RB_TABLES.games,
      id: g.id,
      raw: g
    })
  );
}

export async function searchSports(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.sportsPosts)
    .select("id,user_id,username,display_name,title,body,sport,league,team_name,media_url,thumbnail_url,cover_url,created_at")
    .or(`title.ilike.${likeQuery(q)},body.ilike.${likeQuery(q)},sport.ilike.${likeQuery(q)},league.ilike.${likeQuery(q)},team_name.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((s) =>
    item({
      type: "sports",
      title: s.title || s.team_name || "Sports Post",
      subtitle: s.sport || s.league || s.body || "Sports",
      image: s.thumbnail_url || s.cover_url || s.media_url || "",
      url: `${RB_ROUTES.sports}?post=${encodeURIComponent(s.id)}`,
      table: RB_TABLES.sportsPosts,
      id: s.id,
      raw: s
    })
  );
}

export async function searchStore(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.products)
    .select("id,title,description,category,product_type,price_cents,currency,image_url,cover_url,status,created_at")
    .or(`title.ilike.${likeQuery(q)},description.ilike.${likeQuery(q)},category.ilike.${likeQuery(q)},product_type.ilike.${likeQuery(q)}`)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((p) =>
    item({
      type: "store",
      title: p.title || "Product",
      subtitle: `${p.product_type || "product"} · $${(Number(p.price_cents || 0) / 100).toFixed(2)}`,
      image: p.image_url || p.cover_url || "",
      url: `${RB_ROUTES.store}?product=${encodeURIComponent(p.id)}`,
      table: RB_TABLES.products,
      id: p.id,
      raw: p
    })
  );
}

export async function searchMeta(query, limit = 8) {
  const q = cleanQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.metaWorlds)
    .select("id,slug,title,description,world_type,status,cover_url,background_url,visit_count,created_at")
    .or(`title.ilike.${likeQuery(q)},description.ilike.${likeQuery(q)},slug.ilike.${likeQuery(q)},world_type.ilike.${likeQuery(q)}`)
    .order("created_at", { ascending: false })
    .limit(safeLimit(limit));

  if (error) throw error;

  return (data || []).map((w) =>
    item({
      type: "meta",
      title: w.title || "Meta World",
      subtitle: `${w.world_type || "world"} · ${Number(w.visit_count || 0)} visits`,
      image: w.cover_url || w.background_url || "",
      url: `${RB_ROUTES.meta}?world=${encodeURIComponent(w.slug || w.id)}`,
      table: RB_TABLES.metaWorlds,
      id: w.id,
      raw: w
    })
  );
}

export async function searchAll(query, {
  limitPerSection = 6
} = {}) {
  const q = cleanQuery(query);
  if (!q) return [];

  const results = await Promise.allSettled([
    searchProfiles(q, limitPerSection),
    searchFeed(q, limitPerSection),
    searchLive(q, limitPerSection),
    searchMusic(q, limitPerSection),
    searchGaming(q, limitPerSection),
    searchSports(q, limitPerSection),
    searchStore(q, limitPerSection),
    searchMeta(q, limitPerSection)
  ]);

  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
}

export function groupSearchResults(results = []) {
  return results.reduce((groups, result) => {
    const key = result.type || "other";
    groups[key] ||= [];
    groups[key].push(result);
    return groups;
  }, {});
}

export function renderSearchResult(result = {}) {
  return `
    <a class="rb-search-result" href="${result.url || "#"}">
      <div class="rb-search-thumb" style="background-image:url('${result.image || ""}')"></div>
      <div>
        <strong>${result.title || "Result"}</strong>
        <span>${result.subtitle || result.type || ""}</span>
      </div>
    </a>
  `;
}

console.log("RB SEARCH READY");
