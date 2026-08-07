import { Bot, Coffee, ParkingCircle, Waves } from 'lucide-react';
import { useStore } from '../store/useStore';

export function RightPanel() {
  const messages = useStore(s => s.messages);
  const isGenerating = useStore(s => s.isGenerating);

  const latestMessage = messages[messages.length - 1];
  const advice = latestMessage?.advice;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Trail Status */}
      <div className="glass-card overflow-hidden animate-fadeInRight opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.2s' }}>
        <div className="relative h-28 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1540390769625-2177b8498e91?w=600&q=80"
            alt="登山道の状況"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-salomon-dark/90 via-salomon-dark/30 to-transparent" />
          <p className="absolute bottom-2 left-3 section-label">踏面・登山道の状況</p>
        </div>
        <div className="px-3 py-2.5 space-y-1">
          <p className="text-salomon-text text-xs leading-relaxed">乾いていて歩きやすい</p>
          <p className="text-salomon-text text-xs leading-relaxed">一部に水の根や石あり</p>
          <p className="text-yellow-400 text-xs font-medium">滑りに注意</p>
        </div>
      </div>

      {/* Facilities */}
      <div className="glass-card p-3 animate-fadeInRight opacity-0-start" style={{ animationFillMode: 'forwards', animationDelay: '0.3s' }}>
        <p className="section-label mb-2.5">施設・トイレ情報</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-2.5 border border-salomon-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-salomon-text">茶屋</span>
            </div>
            <p className="text-[10px] text-salomon-muted leading-tight">山頂周辺、薬王院にあり<br />営業中（〜16:30頃）</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-salomon-border relative">
            <div className="flex items-center gap-1.5 mb-1">
              <ParkingCircle className="w-3.5 h-3.5 text-salomon-cyan" />
              <span className="text-xs font-semibold text-salomon-text">駐車場</span>
            </div>
            <p className="text-[10px] text-salomon-muted leading-tight">清滝駅周辺にあり</p>
            <span className="absolute top-2 right-2 text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30 font-medium">空あり</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-salomon-border col-span-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Waves className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-salomon-text">トイレ</span>
            </div>
            <p className="text-[10px] text-salomon-muted leading-tight">全ルートにあり。山頂・薬王院は混雑気味</p>
          </div>
        </div>
      </div>

      {/* AI Advice */}
      <div className="glass-card p-3 border-salomon-cyan/30 flex-1 animate-fadeInRight opacity-0-start relative overflow-hidden" style={{ animationFillMode: 'forwards', animationDelay: '0.4s' }}>
        {/* Subtle glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-salomon-cyan/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-salomon-cyan to-salomon-teal flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
            <Bot className="w-3.5 h-3.5 text-salomon-black" />
          </div>
          <p className="section-label">AIアドバイス</p>
          {isGenerating && (
            <span className="ml-auto flex gap-0.5">
              {[0.0, 0.15, 0.30].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-salomon-cyan animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
          )}
        </div>

        {advice ? (
          <div className="space-y-2">
            <p className="text-salomon-text text-xs leading-relaxed">{advice.advice_text}</p>
            {advice.safety_flags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {advice.safety_flags.slice(0, 3).map(flag => (
                  <span key={flag} className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 font-medium">
                    ⚠ {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-salomon-muted text-xs leading-relaxed">
            {isGenerating
              ? 'ルートと天気情報をもとにアドバイスを生成中...'
              : 'ルートを選ぶとAIがアドバイスします'}
          </p>
        )}
      </div>
    </div>
  );
}
