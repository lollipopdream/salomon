import { useState } from 'react';
import {
  LayoutDashboard, MessageSquare, Package, Settings,
  ExternalLink, ChevronRight, Clock, Database,
} from 'lucide-react';
import { HeroMessageEditor } from './HeroMessageEditor';
import { ProductEditor } from './ProductEditor';
import { useAdminStore } from '../store/useAdminStore';

type Section = 'dashboard' | 'messages' | 'products';

const NAV: { id: Section; label: string; labelEn: string; icon: typeof LayoutDashboard; badge?: string }[] = [
  { id: 'dashboard', label: 'ダッシュボード', labelEn: 'Dashboard', icon: LayoutDashboard },
  { id: 'messages',  label: 'ヒーローメッセージ', labelEn: 'Hero Messages', icon: MessageSquare, badge: '変更可' },
  { id: 'products',  label: '商品マスター',  labelEn: 'Products', icon: Package, badge: '変更可' },
];

function Dashboard() {
  const products      = useAdminStore(s => s.products);
  const heroMessages  = useAdminStore(s => s.heroMessages);
  const lastSavedAt   = useAdminStore(s => s.lastSavedAt);

  const inStock    = products.filter(p => p.stockStatus === 'in_stock').length;
  const lowStock   = products.filter(p => p.stockStatus === 'low_stock').length;
  const outOfStock = products.filter(p => p.stockStatus === 'out_of_stock').length;

  const savedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">ダッシュボード</h2>
        <p className="text-sm text-slate-400">
          SALOMON 高尾店 AIコンシェルジュ 管理画面（DEMO版）
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '登録商品数', value: products.length, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
          { label: '在庫あり',   value: inStock,          color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
          { label: '残りわずか', value: lowStock,         color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
          { label: '在庫なし',   value: outOfStock,       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} px-5 py-4`}>
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Current hero messages */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">現在のヒーローメッセージ</span>
        </div>
        <div className="space-y-2">
          <div className="flex gap-3">
            <span className="text-xs text-slate-500 w-20 flex-shrink-0 pt-0.5">メインタイトル</span>
            <p className="text-sm text-white font-medium">{heroMessages.greeting}</p>
          </div>
          <div className="flex gap-3">
            <span className="text-xs text-slate-500 w-20 flex-shrink-0 pt-0.5">サブタイトル</span>
            <p className="text-sm text-slate-300">{heroMessages.subtitle}</p>
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">最終保存日時</span>
          </div>
          <p className="text-sm text-white font-mono">{savedTime}</p>
          <p className="text-xs text-slate-500 mt-1">localStorage に自動保存済み</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">データソース</span>
          </div>
          <p className="text-sm text-white">ローカル（DEMO）</p>
          <p className="text-xs text-slate-500 mt-1">本番：Supabase API → 自動取得</p>
        </div>
      </div>

      {/* DEMO notice */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-5">
        <h3 className="text-sm font-bold text-cyan-300 mb-2">🚀 DEMO版 — 管理可能なコンテンツ</h3>
        <ul className="space-y-1.5 text-xs text-slate-300">
          <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />ヒーローメッセージ（挨拶文・サブタイトル）の変更</li>
          <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />おすすめ商品の追加・編集・削除・表示順変更</li>
          <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />商品在庫状況の手動更新</li>
          <li className="flex items-center gap-2 opacity-50"><ChevronRight className="w-3 h-3" />（本番）AIプロンプト調整、天気API設定、ログ分析</li>
        </ul>
      </div>
    </div>
  );
}

export function AdminApp() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'messages':  return <HeroMessageEditor />;
      case 'products':  return <ProductEditor />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#070D1E' }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/8" style={{ background: '#0A1228' }}>
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-base font-black tracking-widest text-white">SALOMON</span>
          </div>
          <p className="text-[10px] text-cyan-400 tracking-widest uppercase font-semibold">Admin Console</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[10px] text-orange-300 font-bold">DEMO版</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                  isActive
                    ? 'bg-cyan-500/15 border border-cyan-500/25 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Link back to concierge */}
        <div className="px-3 py-4 border-t border-white/8">
          <a
            href="/"
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-all text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            コンシェルジュ画面へ
          </a>
          <div className="mt-3 px-3">
            <p className="text-[10px] text-slate-600 leading-relaxed">
              © 2026 SALOMON<br />
              Mountain AI Concierge
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-8 py-4 border-b border-white/8 backdrop-blur-sm" style={{ background: 'rgba(7,13,30,0.9)' }}>
          {NAV.find(n => n.id === activeSection) && (() => {
            const item = NAV.find(n => n.id === activeSection)!;
            const Icon = item.icon;
            return (
              <>
                <Icon className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">{item.label}</span>
                <span className="text-xs text-slate-500">/ {item.labelEn}</span>
              </>
            );
          })()}
          <div className="ml-auto flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-600" />
          </div>
        </div>

        {/* Page content */}
        <div className="px-8 py-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
