import type { OverlayLabel, OverlayScreenPoint } from './overlay';

import { assetUrl } from '../../config/assetBase';

export const LITE_BACKGROUND_WIDTH = 1672;
export const LITE_BACKGROUND_HEIGHT = 941;
export const LITE_BACKGROUND_URL =
  assetUrl('/data/lite-background/takao-lite-bg-daylight.png');

/**
 * Fixed anchors in the bundled background image's own natural pixel space
 * (0..1672, 0..941). Each of the three landmark points below (清滝駅 start,
 * 薬王院, 高尾山頂 end) was located by directly sampling pixel colors on the
 * real image against a fine coordinate grid overlay, not estimated by eye
 * alone -- ROUTE_POINT is set equal to LANDMARK_ANCHOR for each (the route
 * itself passes through/arrives at the real landmark, not just "nearby"):
 *
 * - 清滝駅 (start): (640, 870) -- on the road/open ground in the base town
 *   area visible at the bottom of the frame.
 * - 薬王院: (697, 332) -- the center of the temple building's roof/wall
 *   structure itself (roofline ~y300-320, walls ~y320-345, building spans
 *   ~x650-750; sampled pixel (695,330)=(104,104,107), a neutral structure
 *   gray, not the surrounding tree green). The prior point (688,370) was
 *   below the building, in tree shadow -- this was the bug that made the
 *   label read as disconnected from the temple.
 * - 高尾山頂 (end): (970, 172) -- the summit tower's own base structure
 *   (sampled pixel (970,172)=(183,189,205), a neutral low-saturation gray
 *   consistent with the built structure, confirmed NOT sky-blue via a
 *   saturation check: sky pixels here are strongly blue-saturated, e.g.
 *   (128,199,251), while the tower structure is a flat, desaturated gray).
 *   The prior point (968,184) sat on the ridge just below/beside the
 *   tower's visible base rather than on the structure itself.
 * - The waypoints between 薬王院 and 高尾山頂 trace the actual visible
 *   ridge line's undulation (dips and small shoulders) rather than a
 *   straight interpolation.
 */
export const LITE_ROUTE_POINTS: readonly OverlayScreenPoint[] = [
  { x: 640, y: 870 },
  { x: 622, y: 780 },
  { x: 595, y: 690 },
  { x: 580, y: 590 },
  { x: 615, y: 495 },
  { x: 660, y: 425 },
  { x: 697, y: 332 },
  { x: 725, y: 290 },
  { x: 760, y: 240 },
  { x: 800, y: 210 },
  { x: 850, y: 205 },
  { x: 900, y: 195 },
  { x: 940, y: 183 },
  { x: 970, y: 172 },
];

export const LITE_ROUTE_LABELS: readonly OverlayLabel[] = [
  { id: 'kiyotaki-station', x: 640, y: 870, text: '清滝駅' },
  { id: 'yakuoin', x: 697, y: 332, text: '薬王院' },
  { id: 'takao-summit', x: 970, y: 172, text: '高尾山頂' },
];
