export type StillExportBucket = 'stills' | 'stills-with-labels' | 'passes' | 'comparisons';

export interface StillExportTarget {
  bucket: StillExportBucket;
  fileName: string;
}

const ALLOWED_BUCKETS: readonly StillExportBucket[] = [
  'stills',
  'stills-with-labels',
  'passes',
  'comparisons',
];

const VALID_NAME_CHARS = /^[A-Za-z0-9._-]+$/;
const MAX_FILE_NAME_LENGTH = 120;

const isAllowedBucket = (bucket: string): bucket is StillExportBucket =>
  (ALLOWED_BUCKETS as readonly string[]).includes(bucket);

/**
 * bucket と name を検証し、`.png` 拡張子を保証した保存先 target を返す。
 * 不正な入力(未知 bucket、空文字、path traversal、不正文字、120文字超)は undefined。
 * path 結合はしない。
 */
export function resolveStillExportTarget(
  bucket: string,
  name: string,
): StillExportTarget | undefined {
  if (!isAllowedBucket(bucket)) {
    return undefined;
  }

  if (name.length === 0) {
    return undefined;
  }
  if (name.includes('/') || name.includes('\\')) {
    return undefined;
  }
  if (name.includes('..')) {
    return undefined;
  }
  if (name.startsWith('.')) {
    return undefined;
  }
  if (!VALID_NAME_CHARS.test(name)) {
    return undefined;
  }

  const fileName = name.toLowerCase().endsWith('.png') ? name : `${name}.png`;

  if (fileName.length > MAX_FILE_NAME_LENGTH) {
    return undefined;
  }

  return { bucket, fileName };
}
