import { supabase } from '@/lib/supabaseClient';

export const BUCKET = 'project-media';
export const MAX_FILES = 10;
export const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf';

const MB = 1024 * 1024;

export type MediaKind = 'image' | 'video' | 'document';

export function kindOf(mime: string): MediaKind | null {
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') return 'image';
  if (mime === 'video/mp4' || mime === 'video/webm') return 'video';
  if (mime === 'application/pdf') return 'document';
  return null;
}

function extensionOf(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    default:
      return 'pdf';
  }
}

export function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Shrinks a photo to at most 1600 pixels on its longest side and saves it as a JPEG.
// Re-saving also removes hidden data such as the GPS location.
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Returns a message if the file is not allowed, or null if it is fine.
export function checkFile(file: File): string | null {
  const kind = kindOf(file.type);
  if (!kind) {
    return `"${file.name}" is not a supported file type. Use JPG, PNG, WebP, MP4, WebM or PDF.`;
  }
  if (kind === 'image' && file.size > 25 * MB) {
    return `"${file.name}" is too large (${formatSize(file.size)}). Photos can be up to 25 MB.`;
  }
  if (kind === 'video' && file.size > 25 * MB) {
    return `"${file.name}" is too large (${formatSize(file.size)}). Videos can be up to 25 MB.`;
  }
  if (kind === 'document' && file.size > 10 * MB) {
    return `"${file.name}" is too large (${formatSize(file.size)}). PDFs can be up to 10 MB.`;
  }
  return null;
}

// Uploads one file for a project and records it in the list.
// Returns a message if something went wrong, or null if it worked.
export async function uploadProjectFile(projectId: string, original: File): Promise<string | null> {
  const problem = checkFile(original);
  if (problem) return problem;

  const kind = kindOf(original.type) as MediaKind;
  const file = kind === 'image' ? await shrinkImage(original) : original;

  if (kind === 'image' && file.size > 5 * MB) {
    return `"${original.name}" is still over 5 MB after shrinking. Please choose a smaller photo.`;
  }

  const storagePath = `${projectId}/${crypto.randomUUID()}.${extensionOf(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return `Could not upload "${original.name}": ${uploadError.message}`;

  const { error: insertError } = await supabase.from('project_media').insert({
    project_id: projectId,
    kind,
    file_name: original.name,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (insertError) {
    // Tidy up: remove the file we just uploaded, since it could not be listed.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return `Could not save "${original.name}": ${insertError.message}`;
  }

  return null;
}