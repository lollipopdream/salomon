import { create } from 'zustand';
import type {
  WeatherData,
  Route,
  Difficulty,
  ChatMessage,
  Product,
  ActiveModal,
} from '../types';

interface AppState {
  // Weather
  weather: WeatherData | null;
  weatherLoading: boolean;
  setWeather: (weather: WeatherData | null) => void;
  setWeatherLoading: (loading: boolean) => void;

  // Route Selection
  selectedRoute: Route | null;
  selectedDifficulty: Difficulty | null;
  setSelectedRoute: (route: Route | null) => void;
  setSelectedDifficulty: (difficulty: Difficulty | null) => void;

  // Chat
  messages: ChatMessage[];
  isGenerating: boolean;
  addMessage: (message: ChatMessage) => void;
  setIsGenerating: (generating: boolean) => void;
  clearMessages: () => void;

  // Products
  recommendedProducts: Product[];
  setRecommendedProducts: (products: Product[]) => void;

  // UI
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
}

export const useStore = create<AppState>((set) => ({
  // Weather
  weather: null,
  weatherLoading: false,
  setWeather: (weather) => set({ weather }),
  setWeatherLoading: (weatherLoading) => set({ weatherLoading }),

  // Route Selection
  selectedRoute: null,
  selectedDifficulty: null,
  setSelectedRoute: (selectedRoute) => set({ selectedRoute }),
  setSelectedDifficulty: (selectedDifficulty) => set({ selectedDifficulty }),

  // Chat
  messages: [],
  isGenerating: false,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  clearMessages: () => set({ messages: [] }),

  // Products
  recommendedProducts: [],
  setRecommendedProducts: (recommendedProducts) => set({ recommendedProducts }),

  // UI
  activeModal: null,
  setActiveModal: (activeModal) => set({ activeModal }),
}));
