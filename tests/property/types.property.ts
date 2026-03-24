import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ViewportState } from '../../src/types';

describe('Type property tests', () => {
  it('ViewportState zoom is always within valid range when constructed properly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.25, max: 4.0, noNaN: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        (zoom, panX, panY) => {
          const viewport: ViewportState = { panX, panY, zoom };
          expect(viewport.zoom).toBeGreaterThanOrEqual(0.25);
          expect(viewport.zoom).toBeLessThanOrEqual(4.0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
