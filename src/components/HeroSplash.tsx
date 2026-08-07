import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export function HeroSplash({ onComplete }: Props) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 800);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-mountain bg-cover bg-center transition-opacity duration-700 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Dark overlay with gradient */}
      <div className="absolute inset-0 bg-hero-gradient" />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-salomon-teal rounded-full animate-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${80 + Math.random() * 20}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${4 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 animate-fadeInUp">
        <div className="mb-4 inline-block animate-pulse-slow">
          <svg className="w-24 h-24 mx-auto" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="58" stroke="url(#grad)" strokeWidth="2" opacity="0.3" />
            <circle cx="60" cy="60" r="54" fill="url(#gradFill)" opacity="0.1" />
            <text
              x="60"
              y="70"
              fontSize="28"
              fontWeight="700"
              textAnchor="middle"
              fill="#0AFFE0"
            >
              AI
            </text>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00C8FF" />
                <stop offset="100%" stopColor="#0AFFE0" />
              </linearGradient>
              <radialGradient id="gradFill" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#0AFFE0" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0AFFE0" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-salomon-text mb-3 tracking-tight">
          SALOMON
        </h1>
        <h2 className="text-3xl md:text-4xl font-light text-salomon-text mb-6">
          AI Mountain Concierge
        </h2>
        <p className="text-salomon-cyan text-sm tracking-widest uppercase">
          Mountain Information Station × Customer Experience
        </p>

        {/* Loading indicator */}
        <div className="mt-10 flex justify-center">
          <div className="w-32 h-1 bg-salomon-navy rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-salomon-cyan to-salomon-teal animate-shimmer bg-[length:200%_100%]" />
          </div>
        </div>
      </div>

      {/* Glowing corner accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-glow-cyan opacity-30 blur-3xl pointer-events-none" />
    </div>
  );
}
