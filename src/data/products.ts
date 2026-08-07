import type { Product } from '../types';

export const PRODUCTS: Product[] = [
  {
    sku: 'L47271400',
    name: 'X Ultra 4 GORE-TEX',
    category: 'footwear',
    subCategory: 'trail_shoes',
    price: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    descriptionShort: '防水GORE-TEX採用。舗装路から登山道まで対応。',
    tags: [
      'beginner', 'intermediate',
      'all_weather', 'all_season',
      'waterproof', 'goretex', 'high_grip',
      'trail_shoes_beginner', 'trail_shoes_intermediate', 'waterproof_shoes',
    ],
    isFeatured: true,
    stockStatus: 'in_stock',
  },
  {
    sku: 'L47301700',
    name: 'Speedcross 6',
    category: 'footwear',
    subCategory: 'trail_running',
    price: 18000,
    imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80',
    descriptionShort: '独自のラグパターンで泥道・トレイルを力強く走る。',
    tags: [
      'intermediate', 'advanced',
      'sunny', 'cloudy',
      'spring', 'summer', 'autumn',
      'trail_shoes_intermediate', 'trail_shoes_advanced',
      'high_grip', 'lightweight',
    ],
    isFeatured: true,
    stockStatus: 'in_stock',
  },
  {
    sku: 'LC2007600',
    name: 'Bonatti Trail HS Jacket',
    category: 'apparel',
    subCategory: 'jacket',
    price: 28600,
    imageUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
    descriptionShort: '20000mm防水圧。軽量コンパクトに収納可能。',
    tags: [
      'beginner', 'intermediate', 'advanced',
      'rainy', 'all_season',
      'waterproof', 'lightweight', 'rain_jacket',
    ],
    isFeatured: true,
    stockStatus: 'in_stock',
  },
  {
    sku: 'L47451800',
    name: 'Sense Ride 5',
    category: 'footwear',
    subCategory: 'trail_running',
    price: 16500,
    imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80',
    descriptionShort: 'デイリートレイルに最適。軽快な走り心地。',
    tags: [
      'intermediate',
      'sunny', 'cloudy',
      'spring', 'summer', 'autumn',
      'trail_shoes_intermediate', 'lightweight', 'cushioning',
    ],
    isFeatured: false,
    stockStatus: 'in_stock',
  },
  {
    sku: 'LC2025700',
    name: 'Active Shell Jacket',
    category: 'apparel',
    subCategory: 'jacket',
    price: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    descriptionShort: 'ストレッチ素材で動きやすい防風・防水ジャケット。',
    tags: [
      'beginner', 'intermediate', 'advanced',
      'cloudy', 'rainy', 'all_season',
      'waterproof', 'breathable', 'windshell', 'rain_jacket',
    ],
    isFeatured: true,
    stockStatus: 'in_stock',
  },
  {
    sku: 'LC1522300',
    name: 'XA Alpine 3 Jacket',
    category: 'apparel',
    subCategory: 'jacket',
    price: 42900,
    imageUrl: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&q=80',
    descriptionShort: '山岳環境に対応した高機能防風ジャケット。',
    tags: [
      'intermediate', 'advanced',
      'cloudy', 'rainy', 'snowy', 'winter',
      'waterproof', 'windshell', 'rain_jacket',
    ],
    isFeatured: false,
    stockStatus: 'in_stock',
  },
  {
    sku: 'LC2010100',
    name: 'Mountain Marathon Cap',
    category: 'gear',
    subCategory: 'hat',
    price: 4400,
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80',
    descriptionShort: '軽量・速乾。UV対策にも最適なトレイルキャップ。',
    tags: [
      'beginner', 'intermediate', 'advanced',
      'sunny', 'all_season',
      'lightweight', 'breathable', 'hat',
    ],
    isFeatured: false,
    stockStatus: 'in_stock',
  },
  {
    sku: 'LC2031200',
    name: 'Trail Running Poles',
    category: 'gear',
    subCategory: 'trekking_poles',
    price: 12800,
    imageUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
    descriptionShort: '折りたたみ式。急登・下りの膝負担を軽減。',
    tags: [
      'intermediate', 'advanced',
      'all_weather', 'all_season',
      'trekking_poles',
    ],
    isFeatured: false,
    stockStatus: 'in_stock',
  },
];

/**
 * Score and filter products based on user context.
 * Returns top N products sorted by relevance.
 */
export function getRecommendedProducts(
  userLevel: 'beginner' | 'intermediate' | 'advanced',
  weatherCode: string,
  season: string,
  gearSlugs: string[] = [],
  limit = 3
): Product[] {
  const normalizedWeather = weatherCode === 'partly_cloudy' ? 'cloudy' : weatherCode;

  const scored = PRODUCTS
    .filter(p => p.stockStatus !== 'out_of_stock')
    .map(p => {
      let score = 0;

      for (const tag of p.tags) {
        if (gearSlugs.includes(tag)) score += 3.0;
        else if (tag === userLevel) score += 2.0;
        else if (tag === normalizedWeather || tag === 'all_weather') score += 1.5;
        else if (tag === season || tag === 'all_season') score += 1.0;
      }

      // Must have at least one level tag match
      const hasLevelMatch = p.tags.includes(userLevel);
      return { product: p, score: hasLevelMatch ? score : -1 };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.product.isFeatured ? 1 : 0) - (a.product.isFeatured ? 1 : 0);
    });

  return scored.slice(0, limit).map(s => s.product);
}
