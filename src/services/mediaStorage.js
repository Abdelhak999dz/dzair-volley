import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

// ============================================================
// Media uploads → Supabase Storage.
//
// Root cause of the "black screen" videos and of broken/cropped news
// images: every file the admin picked used to be turned into a base64
// `data:` URL and written straight into a database row. A 20 MB video
// becomes a ~27 MB text cell — too large for a realtime payload, for the
// `select *` every visitor runs, and for many browsers' <video> decoder.
//
// Files are now uploaded to the public `site-assets` bucket (created and
// locked down by supabase/schema.sql: admins-only writes, size + MIME
// limits) and only the small public URL is stored in the row.
// ============================================================

export const MEDIA_BUCKET = 'site-assets';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // picked file, before compression
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Supabase free-plan per-file cap

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};

export class MediaError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'type' | 'size' | 'upload' | 'unavailable'
  }
}

export function validateMediaFile(file, kind) {
  if (!file) throw new MediaError('type');
  const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
  if (!allowed.includes(file.type)) throw new MediaError('type');
  const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) throw new MediaError('size');
}

// Re-encodes a photo to a web-friendly JPEG capped at `maxDim` px. Phone
// photos are often 4000×3000 / 6 MB+; this keeps covers crisp but light,
// and drops EXIF metadata (GPS position etc.) as a privacy bonus.
// Only JPEGs are re-encoded; PNG/WebP/GIF (possible transparency) are untouched.
export async function compressImage(file, { maxDim = 1600, quality = 0.86 } = {}) {
  if (!file || file.type !== 'image/jpeg') return file; // PNG/WebP/GIF may carry transparency — never re-encode those
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  }
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

/**
 * Uploads `file` to Storage under `folder/` and resolves to its public URL.
 * The stored file name is generated (never taken from the user's file
 * name), so path tricks in file names are impossible.
 */
export async function uploadMedia(file, folder, kind = 'image') {
  if (!isSupabaseConfigured || !supabase) throw new MediaError('unavailable');
  validateMediaFile(file, kind);

  const ext = EXT_BY_MIME[file.type] || 'bin';
  const path = `${folder}/${Date.now()}-${randomId()}.${ext}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error('Dzair Volley: media upload failed', error);
    throw new MediaError('upload', error.message);
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  if (!data || !data.publicUrl) throw new MediaError('upload');
  return data.publicUrl;
}
