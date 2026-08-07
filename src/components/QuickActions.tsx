import { Smartphone, MapPinned, FileQuestion, ListChecks } from 'lucide-react';
import { useStore } from '../store/useStore';

const ACTIONS = [
  { icon: MapPinned,    label: '初心者におすすめのルートは？',  action: 'route' },
  { icon: FileQuestion, label: '山頂のライブカメラを見たい',    action: 'camera' },
  { icon: ListChecks,   label: '駐車場の状況は？',             action: 'parking' },
  { icon: Smartphone,   label: '持ち物チェックリスト',         action: 'checklist' },
];

export function QuickActions() {
  const setActiveModal = useStore(s => s.setActiveModal);

  const handleClick = (action: string) => {
    if (action === 'checklist') {
      setActiveModal('equipment');
    } else {
      // Would trigger a chat prompt or modal in full implementation
      console.log('Quick action:', action);
    }
  };

  return (
    <div className="animate-fadeInUp opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.5s' }}>
      <p className="text-salomon-muted text-[10px] text-center mb-2.5 tracking-wide">
        他に聞きたいことはありますか？（音声でも入力できます）
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={i}
              onClick={() => handleClick(a.action)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/8 border border-salomon-border hover:border-salomon-cyan/60 hover:bg-white/12 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-salomon-cyan/20 to-salomon-teal/10 border border-salomon-cyan/30 flex items-center justify-center group-hover:shadow-glow-cyan transition-shadow duration-200">
                <Icon className="w-4.5 h-4.5 text-salomon-cyan" strokeWidth={1.5} />
              </div>
              <span className="text-salomon-text text-[10px] leading-tight text-center font-medium group-hover:text-white transition-colors">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* QR button */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => setActiveModal('qr')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-salomon-border hover:border-salomon-cyan/60 bg-white/8 hover:bg-white/12 transition-all duration-200 group"
        >
          <div className="w-8 h-8 bg-white rounded-md p-1">
            <svg viewBox="0 0 100 100">
              {[...Array(5)].map((_, r) => [...Array(5)].map((__, c) => (
                <rect key={`${r}-${c}`} x={c * 20 + 5} y={r * 20 + 5} width="10" height="10" fill="#0D1529" />
              )))}
            </svg>
          </div>
          <span className="text-salomon-text text-xs font-medium group-hover:text-white transition-colors">
            ルートをスマホに送る<br />
            <span className="text-[9px] text-salomon-muted">(QRコード)</span>
          </span>
        </button>
      </div>
    </div>
  );
}
