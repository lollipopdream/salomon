import { X, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS } from '../../data/products';

const CATEGORY_LABEL: Record<string, string> = {
  footwear: 'フットウェア',
  apparel:  'アパレル',
  gear:     'ギア',
};

export function EquipmentModal() {
  const messages = useStore((s) => s.messages);
  const selectedRoute = useStore((s) => s.selectedRoute);
  const weather = useStore((s) => s.weather);
  const setActiveModal = useStore((s) => s.setActiveModal);

  const lastMessage = messages[messages.length - 1];
  const recommendedProducts = lastMessage?.products ?? [];
  const recommendedSkus = new Set(recommendedProducts.map((p) => p.sku));

  // Group by category
  const grouped = recommendedProducts.reduce<Record<string, typeof PRODUCTS>>((acc, p) => {
    const key = p.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // Get full product list for the route as a checklist
  const gearSlugs = lastMessage?.advice?.recommended_gear ?? [];
  const allRecommended = PRODUCTS.filter((p) =>
    p.tags.some((t) => gearSlugs.includes(t))
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="装備リスト"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-salomon-black">装備リスト</h2>
            {selectedRoute && (
              <p className="text-xs text-salomon-darkgray mt-0.5">
                {selectedRoute.name}
                {weather && ` · ${weather.temp_c}°C ${weather.weather}`}
              </p>
            )}
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-salomon-red"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {recommendedProducts.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, products]) => (
                <div key={category}>
                  <h3 className="text-xs font-bold tracking-widest text-salomon-darkgray uppercase mb-3">
                    {CATEGORY_LABEL[category] ?? category}
                  </h3>
                  <div className="space-y-3">
                    {products.map((p) => (
                      <div
                        key={p.sku}
                        className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-salomon-gray"
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-white"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://placehold.co/64x64/F5F5F5/666666?text=S';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-salomon-black">{p.name}</p>
                          <p className="text-xs text-salomon-darkgray mt-0.5 line-clamp-2">
                            {p.reason ?? p.descriptionShort}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-salomon-red font-bold text-sm">
                            ¥{p.price.toLocaleString('ja-JP')}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">推薦</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Additional gear from AI slugs not already shown */}
              {allRecommended.filter((p) => !recommendedSkus.has(p.sku)).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold tracking-widest text-salomon-darkgray uppercase mb-3">
                    その他おすすめ
                  </h3>
                  <div className="space-y-2">
                    {allRecommended
                      .filter((p) => !recommendedSkus.has(p.sku))
                      .map((p) => (
                        <div
                          key={p.sku}
                          className="flex items-center gap-3 p-3 rounded-xl border border-gray-100"
                        >
                          <div className="flex-1">
                            <span className="text-sm font-medium text-salomon-black">{p.name}</span>
                            <span className="text-xs text-salomon-darkgray ml-2">
                              ¥{p.price.toLocaleString('ja-JP')}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-salomon-darkgray">
              <p className="text-sm">ルートを選択するとここに装備リストが表示されます</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => setActiveModal('qr')}
            className="flex-1 border-2 border-salomon-black text-salomon-black py-3 rounded-xl text-sm font-bold hover:bg-salomon-black hover:text-white transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-salomon-red focus:ring-offset-2"
          >
            QRコードで受け取る
          </button>
          <button
            onClick={() => setActiveModal(null)}
            className="flex-1 bg-salomon-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-salomon-red focus:ring-offset-2"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
