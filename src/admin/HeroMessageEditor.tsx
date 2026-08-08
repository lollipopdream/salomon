import { useState, useEffect } from 'react';
import { Save, RotateCcw, Eye } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';

export function HeroMessageEditor() {
  const heroMessages   = useAdminStore(s => s.heroMessages);
  const setHeroMessages = useAdminStore(s => s.setHeroMessages);

  const [greeting, setGreeting] = useState(heroMessages.greeting);
  const [subtitle, setSubtitle] = useState(heroMessages.subtitle);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when store changes (e.g. reset)
  useEffect(() => {
    setGreeting(heroMessages.greeting);
    setSubtitle(heroMessages.subtitle);
    setIsDirty(false);
  }, [heroMessages]);

  const handleChange = (field: 'greeting' | 'subtitle', val: string) => {
    if (field === 'greeting') setGreeting(val);
    else setSubtitle(val);
    setIsDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    setHeroMessages({ greeting, subtitle });
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setGreeting('こんにちは！今日はどの山の情報が知りたいですか？');
    setSubtitle('高尾山の最新情報をAIがご案内します。');
    setIsDirty(true);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">ヒーローメッセージ編集</h2>
        <p className="text-sm text-slate-400">
          コンシェルジュ画面の上部に表示されるメインメッセージを変更します。
          保存するとコンシェルジュ画面に即時反映されます。
        </p>
      </div>

      {/* Live Preview */}
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 border-b border-white/10">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-400 tracking-wider uppercase">
            ライブプレビュー
          </span>
        </div>
        <div
          className="px-8 py-10 text-center"
          style={{
            background:
              'linear-gradient(135deg, #0A1530 0%, #0D1A3A 50%, #081020 100%)',
            backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=60')`,
            backgroundSize: 'cover',
            backgroundBlendMode: 'overlay',
          }}
        >
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-8 py-6">
            <h1
              className="font-bold text-white text-xl leading-tight mb-2"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              {greeting || <span className="text-white/30 italic">（タイトルを入力してください）</span>}
            </h1>
            <p className="text-slate-300 text-sm">
              {subtitle || <span className="text-white/30 italic">（サブタイトルを入力してください）</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            メインタイトル
            <span className="ml-2 text-xs font-normal text-slate-500">
              （コンシェルジュ画面の大きな見出し）
            </span>
          </label>
          <textarea
            value={greeting}
            onChange={e => handleChange('greeting', e.target.value)}
            rows={2}
            maxLength={80}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm resize-none
                       focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            placeholder="こんにちは！今日はどの山の情報が知りたいですか？"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-500">改行は使用できません</span>
            <span className={`text-xs tabular-nums ${greeting.length > 60 ? 'text-orange-400' : 'text-slate-500'}`}>
              {greeting.length}/80
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            サブタイトル
            <span className="ml-2 text-xs font-normal text-slate-500">
              （メインタイトルの下に表示される説明文）
            </span>
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={e => handleChange('subtitle', e.target.value)}
            maxLength={60}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm
                       focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            placeholder="高尾山の最新情報をAIがご案内します。"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs tabular-nums ${subtitle.length > 45 ? 'text-orange-400' : 'text-slate-500'}`}>
              {subtitle.length}/60
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400
                     hover:text-white hover:border-white/25 transition-all text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          デフォルトに戻す
        </button>

        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            saved
              ? 'bg-green-500/20 border border-green-500/40 text-green-400'
              : isDirty
              ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.3)]'
              : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? '保存しました ✓' : '保存して反映'}
        </button>
      </div>

      {/* Note */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
        <p className="text-xs text-blue-300 leading-relaxed">
          <span className="font-bold">📝 DEMO版について：</span>
          変更はこのブラウザの localStorage に保存されます。
          本番環境ではAPIを通じてサーバーに保存され、全端末に自動反映される予定です。
        </p>
      </div>
    </div>
  );
}
