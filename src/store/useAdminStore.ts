import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRODUCTS } from '../data/products';
import type { Product } from '../types';

export interface HeroMessages {
  greeting: string;
  subtitle: string;
}

export interface AdminState {
  // Hero messages
  heroMessages: HeroMessages;
  setHeroMessages: (m: HeroMessages) => void;

  // Product overrides — full list managed by admin
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (sku: string, updates: Partial<Product>) => void;
  deleteProduct: (sku: string) => void;

  // UI state (not persisted)
  lastSavedAt: string | null;
  markSaved: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      heroMessages: {
        greeting: 'こんにちは！今日はどの山の情報が知りたいですか？',
        subtitle: '高尾山の最新情報をAIがご案内します。',
      },
      setHeroMessages: (heroMessages) =>
        set({ heroMessages, lastSavedAt: new Date().toISOString() }),

      products: PRODUCTS,
      setProducts: (products) =>
        set({ products, lastSavedAt: new Date().toISOString() }),
      addProduct: (product) =>
        set((s) => ({
          products: [...s.products, product],
          lastSavedAt: new Date().toISOString(),
        })),
      updateProduct: (sku, updates) =>
        set((s) => ({
          products: s.products.map((p) => (p.sku === sku ? { ...p, ...updates } : p)),
          lastSavedAt: new Date().toISOString(),
        })),
      deleteProduct: (sku) =>
        set((s) => ({
          products: s.products.filter((p) => p.sku !== sku),
          lastSavedAt: new Date().toISOString(),
        })),

      lastSavedAt: null,
      markSaved: () => set({ lastSavedAt: new Date().toISOString() }),
    }),
    {
      name: 'salomon-admin-store',
      // Only persist data, not functions
      partialize: (s) => ({
        heroMessages: s.heroMessages,
        products: s.products,
        lastSavedAt: s.lastSavedAt,
      }),
    }
  )
);
