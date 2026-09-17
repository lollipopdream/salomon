import type { RoutePath } from '../types';

/**
 * PoC v0.1用の仮登山ルート(非公式)。
 * 地理院地図等を参考にしつつ、実際のDEM標高データを用いて清滝駅相当の低標高点と
 * 高尾山頂の実際の位置を確認した上で選定した模式的な経路であり、
 * 実測または公式機関が提供するルートデータではない。正確な1号路のトレースとして扱わないこと。
 * 公式ルートデータが確保できた場合は本ファイルを差し替える。
 */
export const mockTakaoRoute: RoutePath = {
  isOfficial: false,
  points: [
    { lat: 35.6173, lng: 139.2400, label: '清滝駅相当(仮)', poiId: 'kiyotaki' },
    { lat: 35.6181, lng: 139.2408, label: '1号路 中間点(仮)' },
    { lat: 35.6189, lng: 139.2416, label: '1号路 中間点(仮)' },
    { lat: 35.6197, lng: 139.2423, label: '1号路 中間点(仮)' },
    { lat: 35.6205, lng: 139.2429, label: '1号路 中間点(仮)' },
    { lat: 35.6213, lng: 139.2433, label: '1号路 中間点(仮)' },
    { lat: 35.6220, lng: 139.2436, label: '薬王院付近(仮)', poiId: 'yakuoin' },
    { lat: 35.6228, lng: 139.2437, label: '1号路 中間点(仮)' },
    { lat: 35.6236, lng: 139.2437, label: '1号路 中間点(仮)' },
    { lat: 35.6244, lng: 139.2437, label: '山頂直下(仮)' },
    { lat: 35.6252, lng: 139.2436, label: '高尾山頂(仮)', poiId: 'summit' },
  ],
};
