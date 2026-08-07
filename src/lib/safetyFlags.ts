export interface SafetyFlag {
  key: string;
  label: string;
  severity: 'info' | 'caution' | 'warning';
}

const FLAG_DEFINITIONS: Record<string, SafetyFlag> = {
  high_uv:              { key: 'high_uv',              label: '紫外線が強い',     severity: 'caution' },
  heat_caution:         { key: 'heat_caution',         label: '熱中症注意',       severity: 'caution' },
  heavy_heat:           { key: 'heavy_heat',           label: '高温危険',         severity: 'warning' },
  rain_gear_required:   { key: 'rain_gear_required',   label: '雨具必須',         severity: 'caution' },
  slippery_trail:       { key: 'slippery_trail',       label: '滑りやすい道',     severity: 'caution' },
  strong_wind:          { key: 'strong_wind',          label: '強風注意',         severity: 'caution' },
  low_visibility:       { key: 'low_visibility',       label: '視界不良',         severity: 'warning' },
  long_distance_caution:{ key: 'long_distance_caution',label: '長距離ルート',     severity: 'info'    },
  difficult_terrain:    { key: 'difficult_terrain',    label: '難コース×雨',      severity: 'warning' },
  cold_caution:         { key: 'cold_caution',         label: '防寒対策必要',     severity: 'caution' },
  storm_warning:        { key: 'storm_warning',        label: '悪天候警告',       severity: 'warning' },
};

export function resolveSafetyFlags(flagKeys: string[]): SafetyFlag[] {
  return flagKeys
    .map((key) => FLAG_DEFINITIONS[key])
    .filter((f): f is SafetyFlag => Boolean(f));
}
