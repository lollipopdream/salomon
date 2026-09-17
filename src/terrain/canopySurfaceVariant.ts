import { canopySurfaceDefaults, canopySurfaceQuerySpec } from '../config/defaults/canopySurface';
import type { CanopySurfaceParameters, CanopySurfaceVariantId } from '../types';

export interface CanopySurfaceSelection {
  variant: CanopySurfaceVariantId;
  parameters: CanopySurfaceParameters;
}

/** No browser state; production and off never consume numeric overrides. */
export function resolveCanopySurfaceFlags(
  query: URLSearchParams,
  isDev: boolean,
): CanopySurfaceSelection {
  const raw = isDev ? query.get('canopySurface') : null;
  const variant = raw === 'base' || raw === 'a' || raw === 'b' ? raw : 'off';
  const parameters = { ...canopySurfaceDefaults.parameters };
  if (variant !== 'off') {
    for (const key of Object.keys(canopySurfaceQuerySpec) as (keyof CanopySurfaceParameters)[]) {
      const spec = canopySurfaceQuerySpec[key];
      const rawValue = query.get(spec.query);
      if (rawValue === null || rawValue.trim() === '') continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      if ('choices' in spec && !(spec.choices as readonly number[]).includes(value)) continue;
      const clamped = Math.min(spec.max, Math.max(spec.min, value));
      parameters[key] = 'integer' in spec ? Math.round(clamped) : clamped;
    }
  }
  return { variant, parameters };
}
