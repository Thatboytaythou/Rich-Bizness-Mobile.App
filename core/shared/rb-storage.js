/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-storage.js

   STORAGE + MEDIA ENGINE
   Synced To rb-config.js
   Buckets + Upload Routes Locked
========================= */

import {
  RB_BUCKETS,
  RB_TABLES,
  RB_UPLOAD_ROUTES,
  RB_STORAGE
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfileIdentity,
  getPublicFileUrl,
  uploadFile,
  deleteFile,
  rbInsert,
  rbUpdate
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

const MAX_FILE_MB_DEFAULT = 300;
const PRIVATE_BUCKETS = new Set(RB_STORAGE?.privateBuckets || []);
const PUBLIC_BUCKETS = new Set(RB_STORAGE?.publicBuckets || []);

export const bucketFor = Object.freeze({
  avatar: RB_BUCKETS.avatars,
  profileAvatar: RB_BUCKETS.avatars,
  profileBanner: RB_BUCKETS.profileBanners,

  metaAvatar: RB_BUCKETS.metaAvatars,
  metaWorld: RB_BUCKETS.metaWorlds,

  general: RB_BUCKETS.generalUploads,
  feed: RB_BUCKETS.generalUploads,
  gallery: RB_BUCKETS.galleryMedia,

  musicAudio: RB_BUCKETS.musicAudio,
  musicCover: RB_BUCKETS.musicCovers,

  podcastAudio: RB_BUCKETS.podcastAudio,
  podcastCover: RB_BUCKETS.podcastCovers,

  radioCover: RB_BUCKETS.radioCovers,

  liveThumbnail: RB_BUCKETS.liveThumbnails,
  liveRecording: RB_BUCKETS.liveRecordings,

  gameAsset: RB_BUCKETS.gameAssets,
  gameClip: RB_BUCKETS.gameClips,
  gameCover: RB_BUCKETS.gameCovers,

  sportsMedia: RB_BUCKETS.sportsMedia,
  sportsClip: RB_BUCKETS.sportsClips,
  sportsCover: RB_BUCKETS.sportsCovers,

  storeProduct: RB_BUCKETS.storeProducts,
  storeSellerMedia: RB_BUCKETS.storeSellerMedia,
  storeDigital: RB_BUCKETS.storeDigital
});

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanFileName(fileName = "file") {
  const name = String(fileName || "file")
    .replace(/\s+/g, "-")
    .replace(/[^\w.-]/g, "")
    .toLowerCase();

  return name || "file";
}

function cleanFolder(folder = "general") {
  return String(folder || "general")
    .replace(/\s+/g, "-")
    .replace(/[^\w/-]/g, "")
    .toLowerCase();
}

export function isPrivateBucket(bucket) {
  return PRIVATE_BUCKETS.has(bucket);
}

export function isPublicBucket(bucket) {
  return PUBLIC_BUCKETS.has(bucket) || !PRIVATE_BUCKETS.has(bucket);
}

export function createStoragePath({
  folder = "general",
  fileName = "file",
  userId = null
}) {
  const activeUser = userId || getUser()?.id || "anonymous";
  return `${activeUser}/${cleanFolder(folder)}/${Date.now()}-${cleanFileName(fileName)}`;
}

export function getBucketPublicUrl(bucket, path) {
  if (!bucket || !path) return null;
  if (isPrivateBucket(bucket)) return null;
  return getPublicFileUrl(bucket, path);
}

export function detectMediaType(file = null) {
  if (!file?.type) return "file";

  const type = file.type.toLowerCase();

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";

  if (
    type.includes("pdf") ||
    type.includes("zip") ||
    type.includes("document") ||
    type.includes("text") ||
    type.includes("json")
  ) {
    return "document";
  }

  return "file";
}

export function validateFile({
  file,
  maxFileSizeMb = MAX_FILE_MB_DEFAULT,
  allowedTypes = []
}) {
  if (!file) throw new Error("Missing file.");

  const sizeMb = Number(file.size || 0) / 1024 / 1024;

  if (sizeMb > maxFileSizeMb) {
    throw new Error(`File is too large. Max allowed is ${maxFileSizeMb}MB.`);
  }

  if (allowedTypes.length && !allowedTypes.includes(file.type)) {
    throw new Error("This file type is not allowed.");
  }

  return true;
}

export function resolveUploadRoute(routeKey) {
  const route = RB_UPLOAD_ROUTES?.[routeKey];

  if (!route) {
    throw new Error(`Unknown upload route: ${routeKey}`);
  }

  return route;
}

export async function rbUpload({
  bucket,
  file,
  folder = "general",
  mediaType = null,
  section = "general",
  category = "general",
  title = "",
  description = "",
  visibility = "public",
  metadata = {},
  upsert = false,
  maxFileSizeMb = MAX_FILE_MB_DEFAULT,
  allowedTypes = []
}) {
  if (!bucket) throw new Error("Missing bucket.");

  validateFile({
    file,
    maxFileSizeMb,
    allowedTypes
  });

  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");

  const identity = getProfileIdentity();
  const finalMediaType = mediaType || detectMediaType(file);

  const finalVisibility = isPrivateBucket(bucket) ? "private" : visibility;

  const path = createStoragePath({
    folder,
    fileName: file.name,
    userId: user.id
  });

  await uploadFile({
    bucket,
    path,
    file,
    upsert
  });

  const publicUrl =
    finalVisibility === "public"
      ? getBucketPublicUrl(bucket, path)
      : null;

  const uploadRecord = {
    user_id: user.id,
    category,
    section,
    title,
    description,
    bucket,
    file_path: path,
    public_url: publicUrl || "",
    mime_type: file.type || "",
    file_size: file.size || 0,
    media_type: finalMediaType,
    visibility: finalVisibility,
    processing_status: "completed",
    metadata: {
      original_name: file.name || "",
      source: "rb-storage.js",
      username: identity?.username || null,
      display_name: identity?.display_name || null,
      avatar_url: identity?.avatar_url || null,
      ...metadata
    }
  };

  const inserted = await rbInsert({
    table: RB_TABLES.uploads,
    values: uploadRecord
  });

  return {
    bucket,
    path,
    publicUrl,
    mediaType: finalMediaType,
    visibility: finalVisibility,
    upload: inserted?.[0] || null
  };
}

export async function rbRouteUpload({
  routeKey,
  file,
  folder = null,
  title = "",
  description = "",
  metadata = {},
  upsert = false,
  updateTarget = false,
  targetId = null,
  values = {}
}) {
  const route = resolveUploadRoute(routeKey);

  const result = await rbUpload({
    bucket: route.bucket,
    file,
    folder: folder || routeKey,
    section: routeKey,
    category: routeKey,
    title,
    description,
    metadata: {
      upload_route: routeKey,
      target_table: route.table,
      target_column: route.column,
      ...metadata
    },
    upsert
  });

  if (updateTarget && route.table && route.column && targetId) {
    await rbUpdate({
      table: route.table,
      match: { id: targetId },
      values: {
        ...values,
        [route.column]: result.publicUrl || result.path,
        updated_at: new Date().toISOString()
      }
    });
  }

  return {
    ...result,
    route
  };
}

export async function rbDeleteFile({ bucket, path }) {
  if (!bucket || !path) {
    throw new Error("Missing storage delete info.");
  }

  await deleteFile({
    bucket,
    paths: [path]
  });

  return true;
}

export function createObjectPreview(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

export function revokeObjectPreview(url) {
  if (url) URL.revokeObjectURL(url);
}

export async function createSignedDownload({
  bucket,
  path,
  expiresIn = 60
}) {
  if (!bucket || !path) {
    throw new Error("Missing signed download info.");
  }

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data?.signedUrl || null;
}

export async function listBucketFiles({
  bucket,
  path = "",
  limit = 100,
  offset = 0,
  sortBy = {
    column: "created_at",
    order: "desc"
  }
}) {
  if (!bucket) throw new Error("Missing bucket.");

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .list(path, {
        limit,
        offset,
        sortBy
      });

  if (error) throw error;
  return data || [];
}

export async function moveStorageFile({
  bucket,
  fromPath,
  toPath
}) {
  if (!bucket || !fromPath || !toPath) {
    throw new Error("Missing move storage info.");
  }

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .move(fromPath, toPath);

  if (error) throw error;
  return data;
}

export async function copyStorageFile({
  bucket,
  fromPath,
  toPath
}) {
  if (!bucket || !fromPath || !toPath) {
    throw new Error("Missing copy storage info.");
  }

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .copy(fromPath, toPath);

  if (error) throw error;
  return data;
}

export function avatarBucket() {
  return RB_BUCKETS.avatars;
}

export function profileBannerBucket() {
  return RB_BUCKETS.profileBanners;
}

export function musicAudioBucket() {
  return RB_BUCKETS.musicAudio;
}

export function musicCoverBucket() {
  return RB_BUCKETS.musicCovers;
}

export function podcastAudioBucket() {
  return RB_BUCKETS.podcastAudio;
}

export function podcastCoverBucket() {
  return RB_BUCKETS.podcastCovers;
}

export function radioCoverBucket() {
  return RB_BUCKETS.radioCovers;
}

export function liveThumbnailBucket() {
  return RB_BUCKETS.liveThumbnails;
}

export function liveRecordingBucket() {
  return RB_BUCKETS.liveRecordings;
}

export function gameClipBucket() {
  return RB_BUCKETS.gameClips;
}

export function gameAssetBucket() {
  return RB_BUCKETS.gameAssets;
}

export function gameCoverBucket() {
  return RB_BUCKETS.gameCovers;
}

export function sportsMediaBucket() {
  return RB_BUCKETS.sportsMedia;
}

export function sportsClipBucket() {
  return RB_BUCKETS.sportsClips;
}

export function sportsCoverBucket() {
  return RB_BUCKETS.sportsCovers;
}

export function galleryBucket() {
  return RB_BUCKETS.galleryMedia;
}

export function storeProductBucket() {
  return RB_BUCKETS.storeProducts;
}

export function storeSellerMediaBucket() {
  return RB_BUCKETS.storeSellerMedia;
}

export function storeDigitalBucket() {
  return RB_BUCKETS.storeDigital;
}

export function metaAvatarBucket() {
  return RB_BUCKETS.metaAvatars;
}

export function metaWorldBucket() {
  return RB_BUCKETS.metaWorlds;
}

console.log("RB STORAGE READY");
