// ─── Weather ─────────────────────────────────────────────────────────────────

export type WeatherCode =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rainy'
  | 'snowy';

export interface WeatherData {
  temp_c: number;
  weather: string;
  weatherCode: WeatherCode;
  windSpeed: number;   // m/s
  rainProbability: number; // 0–100
  uvIndex: number;
  visibility: number;  // km
  updatedAt: string;   // ISO string
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Route {
  id: string;
  name: string;
  difficulty: Difficulty;
  distanceKm: number;
  elevationM: number;
  durationMin: number;
  features: string[];
  description: string;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export type ProductCategory = 'footwear' | 'apparel' | 'gear';

export interface Product {
  sku: string;
  name: string;
  category: ProductCategory;
  subCategory: string;
  price: number;
  imageUrl: string;
  descriptionShort: string;
  tags: string[];
  isFeatured: boolean;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  // Filled in by AI recommendation
  reason?: string;
}

// ─── AI / LLM ─────────────────────────────────────────────────────────────────

export type Mood = 'good' | 'caution' | 'warning';

export interface AdviceResponse {
  advice_text: string;
  advice_short: string;
  safety_flags: string[];
  recommended_gear: string[];
  mood: Mood;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'ai' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  advice?: AdviceResponse;
  products?: Product[];
  timestamp: Date;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ActiveModal = 'qr' | 'equipment' | 'staff' | null;
