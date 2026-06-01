/**
 * Compression d'image côté navigateur avant upload (zéro dépendance).
 * Resize au plus grand côté ≤ maxDim, ré-encode en JPEG.
 * Bonus : le passage par canvas retire les métadonnées EXIF (dont GPS).
 *
 * Si la sortie est plus lourde que l'original (image déjà petite), on garde l'original.
 */
export async function compressImage(
  file: File,
  maxDim = 1440,
  quality = 0.8,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    // imageOrientation: applique la rotation EXIF (sinon photos portrait tournées)
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file; // navigateur trop ancien → on upload tel quel
    }
  }

  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close?.(); return file; }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', quality),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}
