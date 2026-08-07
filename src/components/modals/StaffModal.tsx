import { X, UserCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function StaffModal() {
  const setActiveModal = useStore((s) => s.setActiveModal);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="スタッフ呼び出し"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fadeIn">
        <button
          onClick={() => setActiveModal(null)}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-salomon-red"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-20 h-20 bg-salomon-red rounded-full flex items-center justify-center mx-auto mb-5">
          <UserCheck className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>

        <h2 className="text-xl font-bold text-salomon-black mb-2">スタッフをお呼びします</h2>
        <p className="text-sm text-salomon-darkgray mb-6 leading-relaxed">
          スタッフが間もなく参ります。
          <br />
          ご質問や試着などお気軽にご相談ください。
        </p>

        {/* Staff indicator */}
        <div className="bg-salomon-gray rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-salomon-black">スタッフ対応可能</span>
          </div>
          <p className="text-xs text-salomon-darkgray mt-1">
            このエリアのスタッフに通知しました
          </p>
        </div>

        <button
          onClick={() => setActiveModal(null)}
          className="w-full bg-salomon-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-salomon-red focus:ring-offset-2"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
