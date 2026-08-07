import type { Route } from '../types';

export const ROUTES: Route[] = [
  {
    id: 'route_1',
    name: '高尾山 1号路',
    difficulty: 'beginner',
    distanceKm: 3.8,
    elevationM: 399,
    durationMin: 90,
    features: ['舗装路', 'ケーブルカーあり', 'トイレ完備', '売店あり'],
    description: '全線舗装の歩きやすいルート。初めての方でも安心。',
  },
  {
    id: 'route_2',
    name: '高尾山 稲荷山コース',
    difficulty: 'beginner',
    distanceKm: 3.1,
    elevationM: 401,
    durationMin: 75,
    features: ['自然道', '土道', '急登あり', '尾根歩き'],
    description: '尾根伝いに歩く自然道コース。展望が楽しめる。',
  },
  {
    id: 'route_3',
    name: '景信山縦走',
    difficulty: 'intermediate',
    distanceKm: 8.5,
    elevationM: 727,
    durationMin: 210,
    features: ['縦走路', '土道', '急登あり', '眺望良好'],
    description: '高尾山から景信山への縦走。稜線の景色が爽快。',
  },
  {
    id: 'route_4',
    name: '陣馬山縦走',
    difficulty: 'advanced',
    distanceKm: 20.0,
    elevationM: 857,
    durationMin: 360,
    features: ['長距離縦走', '尾根道', '眺望抜群', '補給ポイント複数'],
    description: '高尾〜陣馬の全縦走。充実感抜群の長距離コース。',
  },
];
