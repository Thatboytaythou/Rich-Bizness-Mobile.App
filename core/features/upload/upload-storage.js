/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-storage.js

   STORAGE ENGINE
   Bucket Uploads + Public URLs
========================= */

import {
  getSupabase,
  getPublicFileUrl
} from "/core/shared/rb-supabase.js";

import {
  setUploading,
  setUploadProgress,
  setUploadResult,
  setUploadError
} from "/core/features/upload/upload-state.js";

const supabase = getSupabase();

function buildFilePath({
  userId,
  folder = "general",
  fileName = ""
}) {
  const safeName =
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .trim() || crypto.randomUUID();

  return `${userId}/${folder}/${Date.now()}-${safeName}`;
}

export function detectMediaType(file) {
  const mime = String(file?.type || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  return "file";
}

export async function uploadToBucket({
  bucket,
  file,
  userId,
  folder = "uploads",
  upsert = false
}) {
  try {
    if (!bucket) {
      throw new Error("Bucket required.");
    }

    if (!file) {
      throw new Error("File required.");
    }

    if (!userId) {
      throw new Error("User required.");
    }

    setUploading(true);
    setUploadProgress(5);

    const path = buildFilePath({
      userId,
      folder,
      fileName: file.name
    });

    setUploadProgress(20);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert
      });

    if (error) throw error;

    setUploadProgress(80);

    const publicUrl = getPublicFileUrl(
      bucket,
      data.path
    );

    const result = {
      bucket,
      path: data.path,
      publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      mediaType: detectMediaType(file)
    };

    setUploadProgress(100);
    setUploadResult(result);

    return result;
  } catch (error) {
    setUploadError(error.message);
    throw error;
  }
}

export async function deleteStorageFile({
  bucket,
  path
}) {
  if (!bucket || !path) {
    throw new Error("Bucket and path required.");
  }

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .remove([path]);

  if (error) throw error;

  return data;
}

export async function listStorageFiles({
  bucket,
  folder = ""
}) {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .list(folder);

  if (error) throw error;

  return data || [];
}

console.log("RB UPLOAD STORAGE READY");
