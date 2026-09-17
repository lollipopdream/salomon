export function assetUrl(absolutePath: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? '/';

  if (baseUrl === '/') {
    return absolutePath;
  }

  return `${baseUrl.replace(/\/+$/, '')}/${absolutePath.replace(/^\/+/, '')}`;
}
