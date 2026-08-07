import { ChevronRight, MapPin, Clock, TrendingUp } from 'lucide-react';
import { ROUTES } from '../data/routes';
import { useStore } from '../store/useStore';
import type { Difficulty } from '../types';

const DIFFICULTY_TABS: { value: Difficulty; label: string }[] = [
  { value: 'beginner',     label: '初心者' },
  { value: 'intermediate', label: '中級者' },
  { value: 'advanced',     label: '上級者' },
];

// Demo timeline for the selected route (1号路)
const TIMELINE = [
  { time: '08:00', event: '清滝駅 出発' },
  { time: '08:45', event: '1号路 登山開始' },
  { time: '10:15', event: '高尾山山頂 到着' },
  { time: '11:30', event: '山頂 出発' },
  { time: '13:00', event: '清滝駅 下山完了' },
];

export function RoutePanel() {
  const selectedRoute     = useStore(s => s.selectedRoute);
  const selectedDifficulty = useStore(s => s.selectedDifficulty);
  const setSelectedRoute      = useStore(s => s.setSelectedRoute);
  const setSelectedDifficulty = useStore(s => s.setSelectedDifficulty);

  const filteredRoutes = selectedDifficulty
    ? ROUTES.filter(r => r.difficulty === selectedDifficulty)
    : ROUTES;

  // Hoist outside conditional branches to avoid TypeScript narrowing to `never`
  const activeRouteId: string | null = selectedRoute ? selectedRoute.id : null;

  return (
    <div className="glass-card p-4 flex flex-col gap-3 animate-fadeInLeft opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between">
        <p className="section-label">ルート案内</p>
      </div>

      {/* Difficulty tabs */}
      <div className="flex gap-1.5">
        {DIFFICULTY_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => {
              setSelectedDifficulty(tab.value);
              const first = ROUTES.find(r => r.difficulty === tab.value);
              if (first) setSelectedRoute(first);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              selectedDifficulty === tab.value
                ? 'bg-salomon-cyan text-salomon-black shadow-glow-cyan'
                : 'bg-white/8 text-salomon-muted hover:text-white hover:bg-white/15 border border-salomon-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Route list or timeline */}
      {selectedRoute ? (
        <div className="flex-1 space-y-0">
          {TIMELINE.map((item, i) => (
            <div key={i} className="flex items-start gap-3 group" style={{ animationDelay: `${i * 0.08}s` }}>
              {/* Dot + line */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                  i === 2 ? 'border-salomon-cyan bg-salomon-cyan shadow-glow-cyan' : 'border-salomon-muted bg-transparent'
                }`} />
                {i < TIMELINE.length - 1 && (
                  <div className="w-px flex-1 bg-gradient-to-b from-salomon-muted/40 to-transparent mt-0.5" style={{ height: '28px' }} />
                )}
              </div>
              <div className="pb-2">
                <span className="text-salomon-cyan text-xs font-mono font-bold">{item.time}</span>
                <p className="text-salomon-text text-xs leading-tight">{item.event}</p>
              </div>
            </div>
          ))}

          {/* Stats */}
          <div className="divider my-2" />
          <div className="flex items-center gap-3 text-xs text-salomon-muted">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-salomon-cyan" />
              {selectedRoute.distanceKm}km
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-salomon-cyan" />
              約{selectedRoute.durationMin}分
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-salomon-cyan" />
              {selectedRoute.elevationM}m
            </span>
          </div>

          {/* Detail button */}
          <button
            onClick={() => setSelectedRoute(null)}
            className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-salomon-border hover:border-salomon-cyan/60 text-xs text-salomon-muted hover:text-salomon-cyan transition-all duration-200 group"
          >
            <span>全ルート一覧を見る</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {filteredRoutes.map((route, i) => {
            const currentRouteId = activeRouteId;
            const isSelected = currentRouteId === route.id;
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-salomon-cyan/60 bg-salomon-cyan/10'
                    : 'border-salomon-border hover:border-salomon-cyan/40 hover:bg-white/5'
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-salomon-cyan shadow-glow-cyan' : 'bg-salomon-muted'}`} />
                  <span className={`text-xs font-bold ${isSelected ? 'text-salomon-cyan' : 'text-salomon-text'}`}>{route.name}</span>
                </div>
                <div className="flex gap-3 mt-1 ml-4 text-xs text-salomon-muted">
                  <span>{route.distanceKm}km</span>
                  <span>{route.durationMin}分</span>
                  <span>↑{route.elevationM}m</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
