import { describe, expect, it } from 'vitest';

import {
  AERIAL_ATTRIBUTION_HREF,
  AERIAL_ATTRIBUTION_TEXT,
  ATTRIBUTION_HREF,
  ATTRIBUTION_TEXT,
  OSM_ATTRIBUTION_HREF,
  OSM_ATTRIBUTION_TEXT,
} from './attribution';

describe('GSI attribution constants', () => {
  it("includes '地理院タイル' in the attribution text", () => {
    expect(ATTRIBUTION_TEXT).toContain('地理院タイル');
  });

  it("includes '標高タイル' in the attribution text", () => {
    expect(ATTRIBUTION_TEXT).toContain('標高タイル');
  });

  it("includes '加工して作成' in the attribution text", () => {
    expect(ATTRIBUTION_TEXT).toContain('加工して作成');
  });

  it("includes '国土地理院' in the attribution text", () => {
    expect(ATTRIBUTION_TEXT).toContain('国土地理院');
  });

  it("uses an 'https://' attribution URL", () => {
    expect(ATTRIBUTION_HREF).toMatch(/^https:\/\//);
  });

  it("links to 'gsi.go.jp'", () => {
    expect(ATTRIBUTION_HREF).toContain('gsi.go.jp');
  });

  it('describes the processed GSI aerial photo tiles', () => {
    expect(AERIAL_ATTRIBUTION_TEXT).toContain('地理院タイル');
    expect(AERIAL_ATTRIBUTION_TEXT).toContain('写真');
    expect(AERIAL_ATTRIBUTION_TEXT).toContain('加工して作成');
  });

  it("uses an 'https://' aerial attribution URL", () => {
    expect(AERIAL_ATTRIBUTION_HREF).toMatch(/^https:\/\//);
  });

  it('credits OpenStreetMap contributors for the route geometry', () => {
    expect(OSM_ATTRIBUTION_TEXT).toBe('© OpenStreetMap contributors');
  });

  it('links to the OpenStreetMap copyright page', () => {
    expect(OSM_ATTRIBUTION_HREF).toBe(
      'https://www.openstreetmap.org/copyright',
    );
  });
});

// mountAttributionOverlay is DOM integration and is excluded from unit tests.
