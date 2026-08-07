import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRODUCTS } from '../data/products';
import { useStore } from '../store/useStore';

const CATEGORY_FILTERS = [
  { label: 'シーズン', value: 'all' },
  { label: 'ベースレイヤー', value: 'base' },
  { label: 'ミッドレイヤー', value: 'mid' },
  { label: 'アウター', value: 'apparel' },
  { label: 'ボトムス', value: 'bottoms' },
  { label: 'ソックス', value: 'socks' },
  { label: 'アクセサリー', value: 'gear' },
];

const CATEGORY_LABEL: Record<string, string> = {
  footwear: 'シューズ',
  apparel:  'ジャケット',
  gear:     'アクセサリー',
};

export function ProductCarousel() {
  const [activeFilter, setActiveFilter] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recommendedProducts = useStore(s => s.recommendedProducts);

  // Use recommended products if available, else all products
  const displayProducts = recommendedProducts.length > 0 ? recommendedProducts : PRODUCTS;

  const filtered = activeFilter === 'all'
    ? displayProducts
    : displayProducts.filter(p =>
        activeFilter === 'gear'
          ? p.category === 'gear'
          : p.category === activeFilter || p.subCategory?.includes(activeFilter)
      );

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  return (
    <div className="glass-card px-4 py-3 animate-fadeInUp opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.35s' }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">おすすめ装備・アイテム（SALOMON）</p>
        <div className="flex gap-1">
          <button onClick={() => scroll('left')}  aria-label="前へ" className="w-6 h-6 rounded-full bg-white/8 border border-salomon-border flex items-center justify-center hover:bg-white/15 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-salomon-muted" />
          </button>
          <button onClick={() => scroll('right')} aria-label="次へ" className="w-6 h-6 rounded-full bg-white/8 border border-salomon-border flex items-center justify-center hover:bg-white/15 transition-colors">
            <ChevronRight className="w-3.5 h-3.5 text-salomon-muted" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {filtered.map((product, i) => (
          <div
            key={product.sku}
            className="flex-shrink-0 w-[110px] glass-card-hover p-2 flex flex-col items-center gap-1.5 animate-fadeInUp opacity-0-start"
            style={{ animationFillMode: 'forwards', animationDelay: `${0.4 + i * 0.07}s` }}
          >
            <div className="w-full h-16 rounded-lg overflow-hidden bg-white/5">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/110x64/0D1529/7B8DB0?text=S'; }}
              />
            </div>
            <div className="text-center w-full">
              <p className="text-salomon-text text-[10px] font-bold leading-tight line-clamp-2">{product.name}</p>
              <p className="text-salomon-muted text-[9px] mt-0.5">{CATEGORY_LABEL[product.category] ?? product.category}</p>
              <p className="text-salomon-cyan text-[10px] font-bold mt-0.5">¥{product.price.toLocaleString('ja-JP')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-200 ${
              activeFilter === f.value
                ? 'bg-salomon-cyan text-salomon-black shadow-glow-cyan'
                : 'bg-white/8 text-salomon-muted border border-salomon-border hover:text-white hover:border-salomon-cyan/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
