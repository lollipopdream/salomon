/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string | undefined;
  readonly VITE_WEATHER_API_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
