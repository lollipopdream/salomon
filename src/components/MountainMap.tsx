import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import course from '../../public/all_course_2016.jpg';

// Anchor points on the SVG canvas (1200×800 viewBox for higher detail)
const ROUTE_PATH_1 = "M 600 720 C 585 650 555 580 510 510 C 465 440 435 370 420 300 C 405 250 398 200 390 150";
const ROUTE_PATH_2 = "M 600 720 C 630 670 660 600 675 530 C 690 460 683 390 660 320 C 638 250 600 190 570 150";

const LABELS = [
  { x: 372, y: 138, text: '高山端', sub: '599m', dot: true, highlight: true },
  { x: 435, y: 330, text: '薬王院', sub: '', dot: true, highlight: false },
  { x: 690, y: 300, text: '1号路', sub: '', dot: false, highlight: false },
  { x: 795, y: 490, text: 'ケーブルカー\n清滝駅', sub: '', dot: true, highlight: false },
];

const ICON_TOILET = { x: 630, y: 460 };

export function MountainMap() {
  const selectedRoute = useStore(s => s.selectedRoute);
  const [drawn, setDrawn] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawn(false);
    const t = setTimeout(() => setDrawn(true), 100);
    return () => clearTimeout(t);
  }, [selectedRoute?.id]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setScale(s => Math.min(Math.max(s + delta, 0.5), 3.0));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const activePath = selectedRoute?.id === 'route_2' ? ROUTE_PATH_2 : ROUTE_PATH_1;

  const handleZoomIn  = () => setScale(s => Math.min(s + 0.2, 3.0));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleReset   = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const { mx, my, px, py } = dragStartRef.current;
    setPosition({ x: px + e.clientX - mx, y: py + e.clientY - my });
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* Full-screen mountain background image */}
      <div
        className="absolute inset-0 transition-transform duration-200 ease-out"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=90"
          // src={course}
          alt="高尾山"
          className="w-full h-full object-cover object-center pointer-events-none select-none"
          draggable={false}
        />
        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-salomon-dark/30 via-transparent to-salomon-dark/50 pointer-events-none" />

        {/* SVG overlay for trails */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="trailGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0AFFE0" stopOpacity="0" />
              <stop offset="40%" stopColor="#00C8FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00C8FF" stopOpacity="1" />
            </linearGradient>
            <filter id="trailGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="whiteGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Inactive route (dim) */}
          <path
            d={selectedRoute?.id === 'route_2' ? ROUTE_PATH_1 : ROUTE_PATH_2}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="3"
            strokeDasharray="8 5"
          />

          {/* Active route — base glow */}
          <path
            d={activePath}
            fill="none"
            stroke="rgba(0,200,255,0.25)"
            strokeWidth="14"
            strokeLinecap="round"
            filter="url(#trailGlow)"
          />

          {/* Active route — main line with draw animation */}
          <path
            key={`trail-${selectedRoute?.id ?? 'default'}-${drawn}`}
            d={activePath}
            fill="none"
            stroke="url(#trailGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="1200"
            strokeDashoffset={drawn ? 0 : 1200}
            filter="url(#trailGlow)"
            style={{
              transition: drawn ? 'stroke-dashoffset 2.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
            }}
          />

          {/* Animated moving dot on trail */}
          {drawn && (
            <circle r="7" fill="#0AFFE0" filter="url(#trailGlow)">
              <animateMotion dur="5s" repeatCount="indefinite" path={activePath} />
            </circle>
          )}

          {/* Label markers */}
          {LABELS.map((label, i) => (
            <g key={i}>
              {label.dot && (
                <>
                  <circle
                    cx={label.x}
                    cy={label.y}
                    r="18"
                    fill={label.highlight ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.08)'}
                    stroke={label.highlight ? '#00C8FF' : 'rgba(255,255,255,0.4)'}
                    strokeWidth="2"
                  />
                  {label.highlight && (
                    <circle
                      cx={label.x}
                      cy={label.y}
                      r="18"
                      fill="none"
                      stroke="#00C8FF"
                      strokeWidth="1.5"
                      opacity="0.5"
                    >
                      <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                </>
              )}
              {label.text.split('\n').map((line, li) => (
                <text
                  key={li}
                  x={label.x + (label.dot ? 24 : 0)}
                  y={label.y + (label.dot ? li * 18 - 6 : li * 18)}
                  fontSize={label.highlight ? '17' : '14'}
                  fontWeight={label.highlight ? '700' : '600'}
                  fill={label.highlight ? '#00C8FF' : 'white'}
                  filter="url(#whiteGlow)"
                  fontFamily="Noto Sans JP, sans-serif"
                >
                  {line}
                </text>
              ))}
              {label.sub && (
                <text
                  x={label.x + 24}
                  y={label.y + 14}
                  fontSize="13"
                  fill="#7B8DB0"
                  fontFamily="Noto Sans JP, sans-serif"
                >
                  {label.sub}
                </text>
              )}
            </g>
          ))}

          {/* Toilet/Facility icon */}
          <g transform={`translate(${ICON_TOILET.x}, ${ICON_TOILET.y})`}>
            <rect
              x="-18"
              y="-18"
              width="36"
              height="36"
              rx="8"
              fill="rgba(20,60,80,0.85)"
              stroke="rgba(0,200,255,0.5)"
              strokeWidth="1.5"
            />
            <text x="0" y="8" fontSize="18" textAnchor="middle" fill="white">
              🚻
            </text>
          </g>
        </svg>
      </div>

      {/* Zoom controls — bottom right, above the map */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2 animate-fadeIn opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.6s' }}>
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-xl bg-salomon-card/90 backdrop-blur-sm border border-salomon-border hover:border-salomon-cyan/60 flex items-center justify-center transition-all duration-200 shadow-glass hover:shadow-card-hover group"
          aria-label="ズームイン"
        >
          <ZoomIn className="w-5 h-5 text-salomon-muted group-hover:text-salomon-cyan transition-colors" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-xl bg-salomon-card/90 backdrop-blur-sm border border-salomon-border hover:border-salomon-cyan/60 flex items-center justify-center transition-all duration-200 shadow-glass hover:shadow-card-hover group"
          aria-label="ズームアウト"
        >
          <ZoomOut className="w-5 h-5 text-salomon-muted group-hover:text-salomon-cyan transition-colors" />
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 rounded-xl bg-salomon-card/90 backdrop-blur-sm border border-salomon-border hover:border-salomon-cyan/60 flex items-center justify-center transition-all duration-200 shadow-glass hover:shadow-card-hover group"
          aria-label="リセット"
        >
          <Maximize2 className="w-5 h-5 text-salomon-muted group-hover:text-salomon-cyan transition-colors" />
        </button>
        <div className="text-center text-[10px] text-salomon-muted font-mono mt-1 bg-salomon-card/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-salomon-border">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Instructions hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-fadeIn opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '1s' }}>
        <div className="bg-salomon-card/80 backdrop-blur-sm border border-salomon-border rounded-full px-4 py-1.5 shadow-glass">
          <p className="text-salomon-muted text-[10px] tracking-wide">
            🖱️ ドラッグで移動 · ズームボタンで拡大縮小
          </p>
        </div>
      </div>
    </div>
  );
}
