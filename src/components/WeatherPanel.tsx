import { Cloud, CloudRain, Sun, CloudSun, CloudSnow, Wind, Droplets, Zap, Sunset, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { WeatherCode } from '../types';

function BigWeatherIcon({ code }: { code: WeatherCode }) {
  const cls = 'w-12 h-12 text-salomon-cyan drop-shadow-[0_0_8px_rgba(0,200,255,0.8)]';
  switch (code) {
    case 'sunny':         return <Sun className={cls} />;
    case 'partly_cloudy': return <CloudSun className={cls} />;
    case 'cloudy':        return <Cloud className={cls} />;
    case 'rainy':         return <CloudRain className={cls} />;
    case 'snowy':         return <CloudSnow className={cls} />;
  }
}

const CROWD_ICONS = 5;

export function WeatherPanel() {
  const weather = useStore(s => s.weather);
  const loading  = useStore(s => s.weatherLoading);

  if (loading || !weather) {
    return (
      <div className="glass-card p-4 space-y-3 animate-pulse">
        <div className="w-20 h-3 bg-white/10 rounded" />
        <div className="w-16 h-10 bg-white/10 rounded" />
        <div className="w-full h-2 bg-white/10 rounded" />
        <div className="w-full h-2 bg-white/10 rounded" />
      </div>
    );
  }

  // Derive crowd level from rain / time of day (demo heuristic)
  const crowdLevel = weather.rainProbability > 50 ? 2 : weather.temp_c > 20 ? 4 : 3;
  const crowdLabel = crowdLevel <= 2 ? 'すいている' : crowdLevel === 3 ? 'やや混雑' : '混雑';

  // Thunder risk heuristic
  const thunderRisk = weather.rainProbability > 70 ? '高' : weather.rainProbability > 40 ? '中' : '低';
  const thunderColor = thunderRisk === '高' ? 'text-red-400' : thunderRisk === '中' ? 'text-yellow-400' : 'text-salomon-teal';

  // Hiking index (1–5 stars)
  const hikeStars = weather.rainProbability > 70 ? 1 : weather.rainProbability > 40 ? 2 : weather.temp_c < 0 ? 2 : weather.temp_c > 30 ? 3 : 4;

  return (
    <div className="glass-card p-4 animate-fadeInLeft opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.15s' }}>
      <p className="section-label mb-3">天気</p>

      {/* Main weather */}
      <div className="flex items-center gap-3 mb-3">
        <BigWeatherIcon code={weather.weatherCode} />
        <div>
          <div className="text-4xl font-black text-white leading-none">{weather.temp_c}°C</div>
          <div className="text-salomon-muted text-xs mt-0.5">{weather.weather}</div>
        </div>
      </div>

      <div className="divider mb-3" />

      {/* Stats grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-salomon-muted">
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
            降水確率
          </div>
          <span className="text-salomon-text font-medium">{weather.rainProbability}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-salomon-muted">
            <Wind className="w-3.5 h-3.5 text-salomon-cyan" />
            風速
          </div>
          <span className="text-salomon-text font-medium">{weather.windSpeed}m/s</span>
        </div>
      </div>

      <div className="divider my-3" />

      {/* Thunder risk */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs text-salomon-muted">雷リスク</span>
        <span className={`text-xs font-bold ml-auto ${thunderColor}`}>{thunderRisk}</span>
      </div>

      {/* Hiking index */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-salomon-muted">登山指数</span>
        <div className="ml-auto flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`text-base leading-none ${i < hikeStars ? 'text-yellow-400' : 'text-white/20'}`}>★</span>
          ))}
        </div>
      </div>

      {/* Sunset */}
      <div className="flex items-center gap-2 mb-3">
        <Sunset className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs text-salomon-muted">日没</span>
        <span className="text-xs text-salomon-text font-medium ml-auto">17:00〜18:00</span>
      </div>

      <div className="divider mb-3" />

      {/* Crowd */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Users className="w-3.5 h-3.5 text-salomon-muted" />
          <span className="text-xs text-salomon-muted">混雑状況</span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          {[...Array(CROWD_ICONS)].map((_, i) => (
            <svg key={i} viewBox="0 0 16 20" className={`w-4 h-5 ${i < crowdLevel ? 'text-salomon-cyan opacity-90' : 'text-white/15'}`} fill="currentColor">
              <circle cx="8" cy="5" r="3.5" />
              <path d="M1 18c0-3.866 3.134-7 7-7s7 3.134 7 7" />
            </svg>
          ))}
        </div>
        <p className="text-salomon-text text-sm font-bold">{crowdLabel}</p>
      </div>
    </div>
  );
}
