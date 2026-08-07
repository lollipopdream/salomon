import type { WeatherData, WeatherCode } from '../types';

// High uao mountain summit coordinates
const LAT = 35.6252;
const LON = 139.2437;

// Open-Meteo WMO weather code → internal WeatherCode mapping
function mapWmoToWeatherCode(wmo: number): WeatherCode {
  if (wmo === 0 || wmo === 1) return 'sunny';
  if (wmo === 2 || wmo === 3) return 'partly_cloudy';
  if (wmo >= 45 && wmo <= 48) return 'cloudy'; // fog
  if (wmo >= 51 && wmo <= 67) return 'rainy';
  if (wmo >= 71 && wmo <= 77) return 'snowy';
  if (wmo >= 80 && wmo <= 82) return 'rainy';
  if (wmo >= 85 && wmo <= 86) return 'snowy';
  if (wmo >= 95) return 'rainy';
  return 'cloudy';
}

function mapWmoToLabel(wmo: number): string {
  if (wmo === 0) return '快晴';
  if (wmo === 1) return '晴れ';
  if (wmo === 2) return '晴れ時々曇り';
  if (wmo === 3) return '曇り';
  if (wmo >= 45 && wmo <= 48) return '霧';
  if (wmo >= 51 && wmo <= 55) return '霧雨';
  if (wmo >= 61 && wmo <= 65) return '雨';
  if (wmo >= 66 && wmo <= 67) return '凍雨';
  if (wmo >= 71 && wmo <= 77) return '雪';
  if (wmo >= 80 && wmo <= 82) return 'にわか雨';
  if (wmo >= 85 && wmo <= 86) return 'にわか雪';
  if (wmo >= 95) return '雷雨';
  return '曇り';
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weathercode: number;
    windspeed_10m: number;
    apparent_temperature: number;
  };
  hourly: {
    precipitation_probability: number[];
    uv_index: number[];
    visibility: number[];
  };
}

export async function fetchWeather(): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(LAT));
  url.searchParams.set('longitude', String(LON));
  url.searchParams.set(
    'current',
    'temperature_2m,weathercode,windspeed_10m,apparent_temperature'
  );
  url.searchParams.set(
    'hourly',
    'precipitation_probability,uv_index,visibility'
  );
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Asia/Tokyo');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  const current = data.current;

  // Take the first available hourly value for probability / UV / visibility
  const rainProbability = data.hourly.precipitation_probability?.[0] ?? 0;
  const uvIndex = data.hourly.uv_index?.[0] ?? 0;
  const visibilityM = data.hourly.visibility?.[0] ?? 10000;

  return {
    temp_c: Math.round(current.temperature_2m),
    weather: mapWmoToLabel(current.weathercode),
    weatherCode: mapWmoToWeatherCode(current.weathercode),
    windSpeed: Math.round(current.windspeed_10m * 10) / 10,
    rainProbability,
    uvIndex: Math.round(uvIndex),
    visibility: Math.round(visibilityM / 1000),
    updatedAt: new Date().toISOString(),
  };
}
