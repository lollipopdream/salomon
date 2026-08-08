import { useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Save, ChevronUp, ChevronDown,
  Package, Eye, EyeOff,
} from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';
import type { Product, ProductCategory } from '../types';

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'footwear', label: 'フットウェア（シューズ）' },
  { value: 'apparel',  label: 'アパレル（ウェア）' },
  { value: 'gear',     label: 'ギア（アクセサリー）' },
];

const STOCK_OPTIONS = [
  { value: 'in_stock',    label: '在庫あり' },
  { value: 'low_stock',   label: '残りわずか' },
  { value: 'out_of_stock',label: '在庫なし' },
];

const EMPTY_PRODUCT: Omit<Product, 'sku'> = {
  name: '',
  category: 'footwear',
  subCategory: '',
  price: 0,
  imageUrl: '',
  descriptionShort: '',
  tags: [],
  isFeatured: false,
  stockStatus: 'in_stock',
};

type ModalMode = 'add' | 'edit' | null;

function StatusBadge({ status }: { status: Product['stockStatus'] }) {
  const map = {
    in_stock:     'bg-green-500/15 text-green-400 border-green-500/30',
    low_stock:    'bg-orange-500/15 text-orange-400 border-orange-500/30',
    out_of_stock: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const label = { in_stock: '在庫あり', low_stock: '残りわずか', out_of_stock: '在庫なし' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export function ProductEditor() {
  const products      = useAdminStore(s => s.products);
  const addProduct    = useAdminStore(s => s.addProduct);
  const updateProduct = useAdminStore(s => s.updateProduct);
  const deleteProduct = useAdminStore(s => s.deleteProduct);
  const setProducts   = useAdminStore(s => s.setProducts);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [form, setForm] = useState<{ sku: string } & Omit<Product, 'sku'>>({
    sku: '',
    ...EMPTY_PRODUCT,
  });
  const [tagsInput, setTagsInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openAdd = () => {
    setForm({ sku: '', ...EMPTY_PRODUCT });
    setTagsInput('');
    setEditingSku(null);
    setModalMode('add');
  };

  const openEdit = (product: Product) => {
    setForm({ ...product });
    setTagsInput(product.tags.join(', '));
    setEditingSku(product.sku);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingSku(null);
    setSaved(false);
  };

  const handleField = (field: string, value: string | number | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = () => {
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const product: Product = { ...form, tags };

    if (modalMode === 'add') {
      addProduct(product);
    } else if (editingSku) {
      updateProduct(editingSku, product);
    }

    setSaved(true);
    setTimeout(() => {
      closeModal();
    }, 800);
  };

  const handleDelete = (sku: string) => {
    deleteProduct(sku);
    setDeleteConfirm(null);
  };

  // Move product up/down in list order
  const moveProduct = (sku: string, dir: 'up' | 'down') => {
    const idx = products.findIndex(p => p.sku === sku);
    if (idx === -1) return;
    const newList = [...products];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= newList.length) return;
    [newList[idx], newList[swap]] = [newList[swap], newList[idx]];
    setProducts(newList);
  };

  const isFormValid = form.sku.trim() && form.name.trim() && form.price > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">商品マスター管理</h2>
          <p className="text-sm text-slate-400">
            コンシェルジュ画面に表示するSALOMON商品を管理します。
            順番・在庫状況・表示/非表示を手動で変更できます。
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-900 text-sm font-bold
                     hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(0,200,255,0.25)] flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          商品を追加
        </button>
      </div>

      {/* Product table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {/* Table header */}
        <div className="grid gap-3 px-4 py-3 bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider"
          style={{ gridTemplateColumns: '40px 56px 1fr 100px 90px 80px 90px' }}>
          <span>順番</span>
          <span>画像</span>
          <span>商品名 / SKU</span>
          <span>カテゴリ</span>
          <span className="text-right">価格</span>
          <span className="text-center">在庫</span>
          <span className="text-center">操作</span>
        </div>

        {products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">商品が登録されていません</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {products.map((p, idx) => (
              <div
                key={p.sku}
                className="grid items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                style={{ gridTemplateColumns: '40px 56px 1fr 100px 90px 80px 90px', opacity: p.stockStatus === 'out_of_stock' ? 0.5 : 1 }}
              >
                {/* Order controls */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => moveProduct(p.sku, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-600 font-mono tabular-nums">{idx + 1}</span>
                  <button
                    onClick={() => moveProduct(p.sku, 'down')}
                    disabled={idx === products.length - 1}
                    className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/56x56/0D1529/7B8DB0?text=S'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Name + SKU */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{p.sku}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{p.descriptionShort}</p>
                </div>

                {/* Category */}
                <span className="text-xs text-slate-400">
                  {{ footwear: 'フットウェア', apparel: 'アパレル', gear: 'ギア' }[p.category]}
                </span>

                {/* Price */}
                <span className="text-sm font-bold text-cyan-400 text-right tabular-nums">
                  ¥{p.price.toLocaleString('ja-JP')}
                </span>

                {/* Stock */}
                <div className="flex justify-center">
                  <StatusBadge status={p.stockStatus} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  {/* Toggle featured */}
                  <button
                    onClick={() => updateProduct(p.sku, { isFeatured: !p.isFeatured })}
                    title={p.isFeatured ? 'おすすめ解除' : 'おすすめに設定'}
                    className={`p-1.5 rounded-lg transition-colors ${p.isFeatured ? 'text-yellow-400 bg-yellow-500/10' : 'text-slate-500 hover:text-yellow-400'}`}
                  >
                    {p.isFeatured ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(p.sku)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
        <p className="text-xs text-blue-300 leading-relaxed">
          <span className="font-bold">📝 DEMO版について：</span>
          変更はこのブラウザの localStorage に保存されます。
          本番環境ではAPIで自動取得 + 手動上書きの両方に対応予定です。
        </p>
      </div>

      {/* ── Edit / Add Modal ── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1529] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white">
                {modalMode === 'add' ? '商品を新規追加' : '商品を編集'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="admin-label">SKU <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={e => handleField('sku', e.target.value)}
                    disabled={modalMode === 'edit'}
                    placeholder="L47271400"
                    className="admin-input disabled:opacity-40"
                  />
                </div>
                {/* Price */}
                <div>
                  <label className="admin-label">価格（税込）<span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => handleField('price', Number(e.target.value))}
                    placeholder="22000"
                    min="0"
                    className="admin-input"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="admin-label">商品名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleField('name', e.target.value)}
                  placeholder="X Ultra 4 GORE-TEX"
                  className="admin-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="admin-label">カテゴリ</label>
                  <select
                    value={form.category}
                    onChange={e => handleField('category', e.target.value)}
                    className="admin-input"
                  >
                    {CATEGORY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {/* Stock */}
                <div>
                  <label className="admin-label">在庫状況</label>
                  <select
                    value={form.stockStatus}
                    onChange={e => handleField('stockStatus', e.target.value)}
                    className="admin-input"
                  >
                    {STOCK_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Short description */}
              <div>
                <label className="admin-label">短縮説明（カード表示用）</label>
                <input
                  type="text"
                  value={form.descriptionShort}
                  onChange={e => handleField('descriptionShort', e.target.value)}
                  placeholder="防水GORE-TEX採用。舗装路から登山道まで対応。"
                  maxLength={60}
                  className="admin-input"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="admin-label">画像URL</label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={e => handleField('imageUrl', e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="admin-input font-mono text-xs"
                />
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="preview"
                    className="mt-2 h-20 w-20 rounded-lg object-cover border border-white/10"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="admin-label">
                  タグ（カンマ区切り）
                  <span className="ml-1 text-slate-500 font-normal">— AI推薦・出し分けに使用</span>
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="beginner, all_weather, waterproof, trail_shoes_beginner"
                  className="admin-input font-mono text-xs"
                />
                {tagsInput && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-medium text-white">おすすめ商品として設定</p>
                  <p className="text-xs text-slate-500 mt-0.5">AIレコメンドが少ない場合に補完表示されます</p>
                </div>
                <button
                  onClick={() => handleField('isFeatured', !form.isFeatured)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.isFeatured ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.isFeatured ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  saved
                    ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                    : isFormValid
                    ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.25)]'
                    : 'bg-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                {saved ? '保存しました ✓' : modalMode === 'add' ? '商品を追加' : '変更を保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1529] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">商品を削除しますか？</h3>
            <p className="text-sm text-slate-400 mb-6">
              <span className="text-white font-medium">{products.find(p => p.sku === deleteConfirm)?.name}</span>
              <br />を削除します。この操作は元に戻せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-bold transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
