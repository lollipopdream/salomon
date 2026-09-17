export type PresentationMode = 'full' | 'lite';

export function resolvePresentationMode(search: string): PresentationMode {
  try {
    const query = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(query).get('mode') === 'lite' ? 'lite' : 'full';
  } catch {
    return 'full';
  }
}
