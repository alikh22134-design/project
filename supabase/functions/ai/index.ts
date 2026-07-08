// AI-функция на бесплатном ключе Google Gemini.
// Вызов с фронта: supabase.functions.invoke('ai', { body: { prompt, system } })
//
// Запуск (один раз):
//   1) Возьми бесплатный ключ: https://aistudio.google.com/apikey
//   2) Положи его в секрет:  npm run ai:secret -- GEMINI_API_KEY=твой_ключ
//   3) Задеплой функцию:     npm run ai:deploy
//
// Модель можно поменять (gemini-2.0-flash — быстрая и бесплатная).

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODELS_BY_MODE: Record<string, string[]> = {
  fast: ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'],
  slow: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'],
  smart: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'],
  simple: ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'],
};
const DEFAULT_MODELS = MODELS_BY_MODE.smart;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Нет GEMINI_API_KEY. Поставь секрет: npm run ai:secret -- GEMINI_API_KEY=...');
    }
    const { prompt, system, images = [], mode = 'smart' } = await req.json();
    if (!prompt) throw new Error('Нужно поле prompt');

    const text = await generateText(prompt, system, images, mode);

    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

type AiImage = {
  data: string;
  mimeType: string;
  name?: string;
};

async function generateText(prompt: string, system?: string, images: AiImage[] = [], mode = 'smart') {
  const errors: string[] = [];
  const models = MODELS_BY_MODE[mode] ?? DEFAULT_MODELS;
  const parts = [
    { text: prompt },
    ...images.slice(0, 4).map((image) => ({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data.replace(/^data:[^;]+;base64,/, ''),
      },
    })),
  ];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents: [{ parts }],
            generationConfig: getGenerationConfig(mode),
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error?.message ?? `Gemini request failed with status ${res.status}`);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      return text;
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All Gemini models failed. ${errors.join(' | ')}`);
}

function getGenerationConfig(mode: string) {
  if (mode === 'fast') {
    return { temperature: 0.45, maxOutputTokens: 700 };
  }

  if (mode === 'slow') {
    return { temperature: 0.55, maxOutputTokens: 1800 };
  }

  if (mode === 'simple') {
    return { temperature: 0.35, maxOutputTokens: 650 };
  }

  return { temperature: 0.7, maxOutputTokens: 1400 };
}
