import { getDemoTurn } from './demoAkinator';

export type AiTurn = {
  kind: 'question' | 'guess';
  text: string;
};

export type ChatLine = {
  author: 'ai' | 'player' | 'mistake';
  text: string;
};

const system = `
Ты ведущий игры в стиле Akinator.
Игрок загадал реального человека, знаменитость, историческую личность,
спортсмена, блогера, музыканта, актёра, политика или вымышленного персонажа.
Твоя задача — самому думать и сужать круг вариантов по всему миру:
США, Европа, Казахстан, Корея, Япония, Турция, Индия, Россия, Латинская Америка,
Ближний Восток, Африка и другие страны.

Задавай только вопросы, на которые можно ответить "да, точно", "похоже на да", "точно нет", "скорее мимо" или "не уверен".
Играй умно:
первым делом выясняй: это реальный человек или выдуманный персонаж.
Если это реальный человек, спрашивай про жив/умер, страну, профессию и сферу известности.
Если это выдуманный персонаж, спрашивай про фильм, игру, книгу, аниме, героя/злодея и мир персонажа.
Дальше выясняй большие признаки: жив ли сейчас, страна/регион,
сфера известности, пол, эпоха, спорт/музыка/кино/интернет/политика/игры/аниме/книги.
Потом уточняй детали: команда, жанр, франшиза, язык, национальность, профессия,
поколение, узнаваемый образ, достижения.
Не спрашивай про суперспособности, пока не понятно, что это вымышленный герой,
комиксы, аниме, фэнтези или фантастика.
Не повторяй вопросы и не задавай случайные вопросы.
Если ответ "не знаю", выбирай другой широкий признак.
Пиши коротко, уверенно и дружелюбно на русском.

После 12-16 ответов попробуй угадать. Если уверен раньше, тоже угадывай.
Если пора угадывать, верни строку в формате: GUESS: имя персонажа.
Иначе верни строку в формате: QUESTION: твой вопрос.
Не добавляй ничего кроме одной строки.
`;

const localKnowledge = `
Локальная база для Казахстана и Алматы:
- Кнопки ответов: "Точно да", "Скорее да", "Может быть да", "Не знаю", "Может быть нет", "Скорее нет", "Точно нет". Первые три считай положительным сигналом, середину нейтральной, последние три отрицательным сигналом.
- Казахстанские знаменитости: Димаш Кудайберген, Геннадий Головкин, Иманбек, Скриптонит, Jah Khalib, Moldanazar, Ninety One, Dequine, Ирина Кайратовна, Sadraddin, Кайрат Нуртас, Роза Рымбаева, Шавкат Рахмонов, Елена Рыбакина, Ольга Рыпакова, Илья Ильин, Али Окапов, Касым-Жомарт Токаев, Абай Кунанбаев.
- Если ответы указывают на Казахстан, быстрее уточняй: Алматы? музыка/спорт/интернет/политика? рэп/Q-pop/TikTok/YouTube/стримы?
- Если игрок загадал алматинского подростка, не выдумывай имя реального несовершеннолетнего. Угадывай безопасный типаж: "алматинский тиктокер-подросток", "подросток из NIS Алматы", "подросток из РФМШ Алматы", "алматинский геймер-стример", "алматинская TikTok-блогерша", "алматинский рэпер-подросток", "алматинский танцор из TikTok".
- Играй как Akinator: выбирай вопрос, который лучше всего делит оставшиеся варианты. Не спрашивай слишком общие вопросы, если уже понятно, что это Казахстан/Алматы.
- Если после 6-10 ответов уже виден сильный кандидат, угадывай раньше.
`;

export async function askCharacterAi(
  history: ChatLine[],
  shouldGuess: boolean,
): Promise<AiTurn> {
  if (!hasSupabaseKeys()) {
    return getDemoTurn(history, shouldGuess);
  }

  const prompt = [
    shouldGuess
      ? 'Сделай лучшую догадку по ответам игрока. Учитывай знаменитостей и персонажей из разных стран.'
      : 'Задай следующий самый полезный вопрос, который сильнее всего сузит варианты.',
    '',
    'Уже заданные вопросы, которые нельзя повторять:',
    localKnowledge,
    '',
    ...getAskedQuestions(history),
    '',
    'История:',
    ...history.map(formatHistoryLine),
  ].join('\n');

  try {
    const firstTurn = await requestAiTurn(prompt);
    if (
      firstTurn.kind !== 'question' ||
      !hasQuestionBeenAsked(firstTurn.text, history)
    ) {
      return firstTurn;
    }

    return requestAiTurn(
      `${prompt}\n\nТы повторил вопрос "${firstTurn.text}". Задай другой вопрос, которого ещё не было.`,
    );
  } catch {
    return getDemoTurn(history, shouldGuess);
  }
}

async function requestAiTurn(prompt: string) {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke<{ text: string }>(
    'ai',
    { body: { prompt, system } },
  );

  if (error) throw new Error(error.message);

  return parseAiTurn(data?.text ?? '');
}

function parseAiTurn(text: string): AiTurn {
  const cleanText = text.trim();

  if (cleanText.toUpperCase().startsWith('GUESS:')) {
    return { kind: 'guess', text: cleanText.slice(6).trim() };
  }

  if (cleanText.toUpperCase().startsWith('QUESTION:')) {
    return { kind: 'question', text: cleanText.slice(9).trim() };
  }

  return {
    kind: cleanText.includes('?') ? 'question' : 'guess',
    text: cleanText || 'Этот персонаж из фильма или сериала?',
  };
}

function hasSupabaseKeys() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}

function hasQuestionBeenAsked(question: string, history: ChatLine[]) {
  const normalizedQuestion = normalizeText(question);

  return history.some((line) => {
    return (
      line.author === 'ai' &&
      line.text.includes('?') &&
      normalizeText(line.text) === normalizedQuestion
    );
  });
}

function getAskedQuestions(history: ChatLine[]) {
  const questions = history
    .filter((line) => line.author === 'ai' && line.text.includes('?'))
    .map((line) => `- ${line.text}`);

  return questions.length > 0 ? questions : ['- пока нет'];
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[?!.,"'«»]/g, '').trim();
}

function formatHistoryLine(line: ChatLine) {
  if (line.author === 'mistake') return `ai mistake: ${line.text}`;
  return `${line.author}: ${line.text}`;
}
