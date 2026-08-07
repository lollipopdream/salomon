import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../store/useStore';

export function QRModal() {
  const messages = useStore((s) => s.messages);
  const selectedRoute = useStore((s) => s.selectedRoute);
  const weather = useStore((s) => s.weather);
  const setActiveModal = useStore((s) => s.setActiveModal);

  const lastMessage = messages[messages.length - 1];
  const products = lastMessage?.products ?? [];

  // Encode the recommendation data into the QR URL
  const qrData = JSON.stringify({
    route: selectedRoute?.name ?? '',
    temp: weather?.temp_c ?? '',
    weather: weather?.weather ?? '',
    products: products.map((p) => ({ sku: p.sku, name: p.name, price: p.price })),
    advice: lastMessage?.advice?.advice_short ?? '',
    ts: Date.now(),
  });

  const qrUrl = `https://salomon-concierge.vercel.app/share?data=${encodeURIComponent(qrData)}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="QRコード"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-salomon-black">QRコードで受け取る</h2>
          <button
            onClick={() => setActiveModal(null)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-salomon-red"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-5">
          <div className="p-4 border-2 border-gray-100 rounded-xl">
            <QRCodeSVG
              value={qrUrl}
              size={200}
              bgColor="#FFFFFF"
              fgColor="#1A1A1A"
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        <p className="text-xs text-center text-salomon-darkgray mb-4 leading-relaxed">
          このQRコードをスマートフォンで読み取ると、
          <br />
          本日のおすすめ装備リストを確認できます。
        </p>

        {products.length > 0 && (
          <div className="bg-salomon-gray rounded-xl p-3 space-y-1">
            <p className="text-xs font-bold text-salomon-darkgray mb-2">含まれる商品</p>
            {products.map((p) => (
              <div key={p.sku} className="flex justify-between text-xs">
                <span className="text-salomon-black font-medium truncate mr-2">{p.name}</span>
                <span className="text-salomon-red font-bold flex-shrink-0">
                  ¥{p.price.toLocaleString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setActiveModal(null)}
          className="w-full mt-4 bg-salomon-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-salomon-red focus:ring-offset-2"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
