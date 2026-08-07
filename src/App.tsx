import { useEffect, useState } from 'react';
import { HeroSplash } from './components/HeroSplash';
import { MainHeader } from './components/MainHeader';
import { WeatherPanel } from './components/WeatherPanel';
import { RoutePanel } from './components/RoutePanel';
import { MountainMap } from './components/MountainMap';
import { RightPanel } from './components/RightPanel';
import { ProductCarousel } from './components/ProductCarousel';
import { QuickActions } from './components/QuickActions';
import { QRModal } from './components/modals/QRModal';
import { EquipmentModal } from './components/modals/EquipmentModal';
import { StaffModal } from './components/modals/StaffModal';
import { useStore } from './store/useStore';
import { fetchWeather } from './api/weather';
import { getAIAdvice } from './api/llm';
import { getRecommendedProducts } from './data/products';
import { getCurrentSeason } from './lib/season';

function makeKey(routeId: string, difficulty: string) {
  return `${routeId}__${difficulty}`;
}

function MainApp() {
  const weather             = useStore(s => s.weather);
  const selectedRoute       = useStore(s => s.selectedRoute);
  const selectedDifficulty  = useStore(s => s.selectedDifficulty);
  const activeModal         = useStore(s => s.activeModal);
  const setWeather          = useStore(s => s.setWeather);
  const setWeatherLoading   = useStore(s => s.setWeatherLoading);
  const addMessage          = useStore(s => s.addMessage);
  const clearMessages       = useStore(s => s.clearMessages);
  const setIsGenerating     = useStore(s => s.setIsGenerating);
  const setRecommendedProducts = useStore(s => s.setRecommendedProducts);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Fetch weather on mount + every 10 min
  useEffect(() => {
    const load = async () => {
      setWeatherLoading(true);
      try { setWeather(await fetchWeather()); }
      catch (e) { console.error('Weather error:', e); }
      finally { setWeatherLoading(false); }
    };
    load();
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [setWeather, setWeatherLoading]);

  // Generate AI advice when route + difficulty + weather ready
  useEffect(() => {
    if (!selectedRoute || !selectedDifficulty || !weather) return;
    const key = makeKey(selectedRoute.id, selectedDifficulty);
    if (key === lastKey) return;

    const go = async () => {
      clearMessages();
      setIsGenerating(true);
      setLastKey(key);
      try {
        const advice  = await getAIAdvice(weather, selectedRoute, selectedDifficulty);
        const season  = getCurrentSeason();
        const products = getRecommendedProducts(
          selectedDifficulty, weather.weatherCode, season, advice.recommended_gear, 6
        );
        setRecommendedProducts(products);
        addMessage({
          id: crypto.randomUUID(),
          role: 'ai',
          text: advice.advice_text,
          advice,
          products,
          timestamp: new Date(),
        });
      } catch (e) {
        console.error('Advice error:', e);
        addMessage({ id: crypto.randomUUID(), role: 'system', text: 'AIアドバイスの取得に失敗しました。', timestamp: new Date() });
      } finally {
        setIsGenerating(false);
      }
    };
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute?.id, selectedDifficulty, weather?.weatherCode]);

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-salomon-black">
      {/* Full-screen mountain map as background */}
      <MountainMap />

      {/* Subtle gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-salomon-dark/20 via-transparent to-salomon-dark/40 pointer-events-none z-5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[250px] bg-gradient-to-b from-salomon-cyan/3 to-transparent blur-3xl pointer-events-none z-5" />

      {/* Header — floats above map */}
      <div className="relative z-20">
        <MainHeader />
      </div>

      {/* ─── Main 3-column grid — all panels float above map ─────────── */}
      <div className="relative z-20 flex-1 grid gap-3 px-4 pb-2 min-h-0" style={{ gridTemplateColumns: '220px 1fr 220px' }}>

        {/* LEFT: weather + route */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <WeatherPanel />
          <div className="flex-1 min-h-0 overflow-hidden">
            <RoutePanel />
          </div>
        </div>

        {/* CENTER: Product carousel at bottom */}
        <div className="flex flex-col justify-end gap-3 min-h-0 overflow-hidden pointer-events-none">
          <div className="space-y-2.5 pointer-events-auto">
            <ProductCarousel />
          </div>
        </div>

        {/* RIGHT: trail status + facilities + AI advice */}
        <div className="min-h-0 overflow-hidden">
          <RightPanel />
        </div>
      </div>

      {/* ─── Bottom quick actions ────────────────────────────────────── */}
      <div className="relative z-20 px-4 pb-3">
        <QuickActions />
      </div>

      {/* Modals */}
      {activeModal === 'qr'        && <QRModal />}
      {activeModal === 'equipment' && <EquipmentModal />}
      {activeModal === 'staff'     && <StaffModal />}
    </div>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return splashDone ? <MainApp /> : <HeroSplash onComplete={() => setSplashDone(true)} />;
}

export default App;
