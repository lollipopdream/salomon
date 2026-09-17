export type IsolationVariant =
  | 'baseline'
  | 'no-route-update'
  | 'no-label-occlusion'
  | 'no-spot-animation'
  | 'no-route-and-labels';

export interface IsolationFlags {
  skipRouteVisualUpdate: boolean;
  skipLabelOcclusion: boolean;
  skipSpotAnimation: boolean;
}

export function parseIsolationVariant(rawValue: string | null): IsolationVariant {
  switch (rawValue) {
    case 'baseline':
    case 'no-route-update':
    case 'no-label-occlusion':
    case 'no-spot-animation':
    case 'no-route-and-labels':
      return rawValue;
    default:
      return 'baseline';
  }
}

export function resolveIsolationFlags(variant: IsolationVariant): IsolationFlags {
  switch (variant) {
    case 'no-route-update':
      return {
        skipRouteVisualUpdate: true,
        skipLabelOcclusion: false,
        skipSpotAnimation: false,
      };
    case 'no-label-occlusion':
      return {
        skipRouteVisualUpdate: false,
        skipLabelOcclusion: true,
        skipSpotAnimation: false,
      };
    case 'no-spot-animation':
      return {
        skipRouteVisualUpdate: false,
        skipLabelOcclusion: false,
        skipSpotAnimation: true,
      };
    case 'no-route-and-labels':
      return {
        skipRouteVisualUpdate: true,
        skipLabelOcclusion: true,
        skipSpotAnimation: false,
      };
    case 'baseline':
      return {
        skipRouteVisualUpdate: false,
        skipLabelOcclusion: false,
        skipSpotAnimation: false,
      };
  }
}
