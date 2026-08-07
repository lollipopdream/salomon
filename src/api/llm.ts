import type { WeatherData, Route, Difficulty, AdviceResponse } from '../types';

const HARDCODED_FALLBACK: AdviceResponse = {
  advice_text:
    '現在アドバイスを準備中です。スタッフにお気軽にお声がけください。高尾山の最新情報をご案内します。',
  advice_short: 'アドバイス準備中。スタッフにお声がけください。',
  safety_flags: [],
  recommended_gear: [],
  mood: 'good',
};

const LEVEL_LABEL: Record<Difficulty, string> = {
  beginner: '初心者（ハイキング経験1年未満、体力普通）',
  intermediate: '中級者（ハイキング経験3年程度、体力あり）',
  advanced: '上級者（登山・トレイルラン経験豊富、体力高い）',
};

function buildSystemPrompt(): string {
  return `あなたは「山守（やまもり）」、サロモン高尾店のAIマウンテンコンシェルジュです。

【キャラクター】
- 高尾山・奥高尾エリアを知り尽くしたベテランガイド
- SALOMONのトレイルランニング・ハイキングシューズの専門家
- 安全を最優先にしながら、山の魅力を伝えることが使命

【口調・トーン】
- 丁寧でありながら、親しみやすく温かい
- 過度な敬語は避ける（「〜ですね」「〜しましょう」のような自然な語尾）
- 山への愛情と好奇心を感じさせる表現を使う
- 絶対に脅かすような表現は使わない（「危険です」→「注意が必要です」）

【出力フォーマット（JSONのみ）】
必ず以下のJSON形式で返答してください。それ以外のテキストは一切出力しないこと。
{
  "advice_text": "メインアドバイス（150〜250文字）",
  "advice_short": "短縮版アドバイス（80文字以内）",
  "safety_flags": ["フラグ名の配列（該当なければ空配列）"],
  "recommended_gear": ["ギアスラッグの配列"],
  "mood": "good | caution | warning"
}

利用可能なgear slugs: trail_shoes_beginner, trail_shoes_intermediate, trail_shoes_advanced, waterproof_shoes, rain_jacket, rain_pants, windshell, hat, trekking_poles, energy_gel, headlamp, gloves`;
}

function buildUserPrompt(
  weather: WeatherData,
  route: Route,
  userLevel: Difficulty
): string {
  return `現在の状況を教えます。この情報をもとにアドバイスを生成してください。

【現在の天気】
- 天気: ${weather.weather}
- 気温: ${weather.temp_c}℃
- 降水確率: ${weather.rainProbability}%
- UV指数: ${weather.uvIndex}
- 風速: ${weather.windSpeed}m/s
- 視界: ${weather.visibility}km

【選択ルート】
- ルート名: ${route.name}
- 難易度: ${route.difficulty}
- 距離: ${route.distanceKm}km
- 標高差: ${route.elevationM}m
- 目安所要時間: ${route.durationMin}分
- ルートの特徴: ${route.features.join('、')}

【来店者プロフィール】
- レベル: ${LEVEL_LABEL[userLevel]}

上記の情報に基づいてアドバイスを生成してください。`.trim();
}

export async function getAIAdvice(
  weather: WeatherData,
  route: Route,
  userLevel: Difficulty
): Promise<AdviceResponse> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

  if (!apiKey) {
    console.warn('VITE_OPENAI_API_KEY not set — using fallback advice');
    return buildFallbackAdvice(weather, route, userLevel);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(weather, route, userLevel) },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenAI API error ${response.status} — using fallback`);
      return buildFallbackAdvice(weather, route, userLevel);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as AdviceResponse;
    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('AI advice failed, using fallback:', err);
    return buildFallbackAdvice(weather, route, userLevel);
  }
}

/** Rule-based fallback when OpenAI is unavailable */
function buildFallbackAdvice(
  weather: WeatherData,
  route: Route,
  userLevel: Difficulty
): AdviceResponse {
  const safety_flags: string[] = [];
  const recommended_gear: string[] = [];

  if (weather.uvIndex >= 6) safety_flags.push('high_uv');
  if (weather.temp_c >= 27) safety_flags.push('heat_caution');
  if (weather.temp_c >= 33) safety_flags.push('heavy_heat');
  if (weather.rainProbability >= 60) safety_flags.push('rain_gear_required');
  if (weather.rainProbability >= 40) safety_flags.push('slippery_trail');
  if (weather.windSpeed >= 7) safety_flags.push('strong_wind');
  if (route.distanceKm >= 15) safety_flags.push('long_distance_caution');

  recommended_gear.push(`trail_shoes_${userLevel}`);
  if (weather.rainProbability >= 60) recommended_gear.push('rain_jacket', 'waterproof_shoes');
  if (weather.windSpeed >= 7) recommended_gear.push('windshell');
  if (weather.uvIndex >= 6) recommended_gear.push('hat');
  if (route.distanceKm >= 10) recommended_gear.push('trekking_poles', 'energy_gel');
  if (route.durationMin >= 300) recommended_gear.push('headlamp');

  const mood =
    weather.rainProbability >= 90
      ? 'warning'
      : weather.rainProbability >= 40 || weather.windSpeed >= 7
      ? 'caution'
      : 'good';

  const weatherDesc =
    weather.weatherCode === 'sunny'
      ? `晴れて気温${weather.temp_c}℃`
      : weather.weatherCode === 'rainy'
      ? `雨模様で気温${weather.temp_c}℃`
      : `曇りで気温${weather.temp_c}℃`;

  const advice_text = `今日の高尾山は${weatherDesc}です。${route.name}は${route.distanceKm}kmのコース。${
    safety_flags.includes('rain_gear_required')
      ? '雨具は必ず持参してください。'
      : safety_flags.includes('high_uv')
      ? '紫外線が強いので帽子と日焼け止めをお忘れなく。'
      : 'コンディションを確認しながら楽しく歩きましょう。'
  }水分補給はこまめに行い、無理のないペースで楽しんでください。`;

  return {
    advice_text,
    advice_short: `${weatherDesc}。${route.name}を楽しんで。`,
    safety_flags,
    recommended_gear,
    mood,
  };
}

export { HARDCODED_FALLBACK };
