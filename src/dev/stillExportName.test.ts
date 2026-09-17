import { describe, expect, it } from 'vitest';

import { resolveStillExportTarget } from './stillExportName';

describe('resolveStillExportTarget', () => {
  it('appends .png when missing', () => {
    expect(resolveStillExportTarget('stills', 'overview-beauty')).toEqual({
      bucket: 'stills',
      fileName: 'overview-beauty.png',
    });
  });

  it('keeps an existing lowercase .png extension as-is', () => {
    expect(resolveStillExportTarget('stills', 'a.png')).toEqual({
      bucket: 'stills',
      fileName: 'a.png',
    });
  });

  it('accepts all four allowed buckets', () => {
    for (const bucket of ['stills', 'stills-with-labels', 'passes', 'comparisons']) {
      expect(resolveStillExportTarget(bucket, 'sample')).toEqual({
        bucket,
        fileName: 'sample.png',
      });
    }
  });

  it('rejects an unknown bucket', () => {
    expect(resolveStillExportTarget('unknown-bucket', 'sample')).toBeUndefined();
  });

  it('rejects an empty bucket', () => {
    expect(resolveStillExportTarget('', 'sample')).toBeUndefined();
  });

  it('rejects names containing ..', () => {
    expect(resolveStillExportTarget('stills', '..')).toBeUndefined();
  });

  it('rejects names containing ../x', () => {
    expect(resolveStillExportTarget('stills', '../x')).toBeUndefined();
  });

  it('rejects names containing a forward slash', () => {
    expect(resolveStillExportTarget('stills', 'a/b')).toBeUndefined();
  });

  it('rejects names containing a backslash', () => {
    expect(resolveStillExportTarget('stills', 'a\\b')).toBeUndefined();
  });

  it('rejects an empty name', () => {
    expect(resolveStillExportTarget('stills', '')).toBeUndefined();
  });

  it('rejects a name starting with a dot', () => {
    expect(resolveStillExportTarget('stills', '.hidden')).toBeUndefined();
  });

  it('rejects a name containing a space', () => {
    expect(resolveStillExportTarget('stills', 'a b')).toBeUndefined();
  });

  it('rejects a name containing non-ASCII characters', () => {
    expect(resolveStillExportTarget('stills', '高尾山')).toBeUndefined();
  });

  it('rejects a name containing a semicolon', () => {
    expect(resolveStillExportTarget('stills', 'a;b')).toBeUndefined();
  });

  it('rejects a final fileName longer than 120 characters', () => {
    const longName = 'a'.repeat(118); // + '.png' => 122 chars
    expect(resolveStillExportTarget('stills', longName)).toBeUndefined();
  });

  it('accepts a final fileName exactly at the 120 character limit', () => {
    const name = `${'a'.repeat(116)}.png`; // already ends with .png, total 120
    expect(name.length).toBe(120);
    const result = resolveStillExportTarget('stills', name);
    expect(result).toEqual({ bucket: 'stills', fileName: name });
  });
});
