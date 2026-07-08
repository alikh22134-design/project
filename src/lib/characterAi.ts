export type AiTurn = {
  kind: 'question' | 'guess' | 'chat';
  text: string;
};

export type ChatLine = {
  author: 'ai' | 'player' | 'mistake';
  text: string;
  image?: AiImage;
};

export type AiImage = {
  data: string;
  mimeType: string;
  name: string;
};

export type AssistantMode = 'fast' | 'slow' | 'smart' | 'simple';

const assistantModeLabels: Record<AssistantMode, string> = {
  fast: 'быстрый',
  slow: 'медленный и подробный',
  smart: 'умный и глубокий',
  simple: 'простой, не слишком умный',
};

const guesserSystem = `
You are an Akinator-style game host.
The player has imagined a real person, celebrity, historical person, athlete,
blogger, musician, actor, politician, or fictional character.

The player can either answer the game or just chat with you.
If the latest player message is not a game answer, answer normally like a helpful assistant.
Ask game questions in Russian.
Do not repeat questions.
After enough answers, or when confident, guess.

Hard rules:
- Keep every game question very short: one simple sentence, no explanations.
- Keep CHAT answers very brief: one short sentence.
- Never make a guess that contradicts the chat history.
- If the player said the character is a girl/woman/female, never guess a male person.
- If the player said the character is a boy/man/male, never guess a female person.
- If the player confirmed a country, region, sport, profession, or fictional universe, respect it.
- If the history points to Argentina + football + male, Lionel Messi is a very strong candidate.
- Do not guess local Kazakhstan/Almaty/NIS people unless the player clearly confirmed Kazakhstan, Almaty, or a local teen context.
- If you are not sure, ask another useful question instead of guessing.
- Before every GUESS, silently check: gender, real/fictional, country, domain, era. If any important fact conflicts, do not guess.

Bad example:
History says female/girl, but GUESS: Kobe Bryant. This is forbidden.

Return exactly one line:
CHAT: your normal conversational answer
or
QUESTION: your question
or
GUESS: character name
`;

const localKnowledge = `
Use broad clues first: real or fictional, alive, country, profession, gender,
era, sport/music/cinema/internet/politics/games/anime/books.
If answers point to Kazakhstan or Almaty, ask about music, sport, internet,
politics, rap, Q-pop, TikTok, YouTube, or streams.
Never use Kazakhstan/Almaty guesses when answers point to another country.
`;

const freeformGuesserSystem = `
You are an Akinator-style guesser.
The player describes a real person, celebrity, historical person, athlete,
blogger, musician, actor, politician, or fictional character in free text.
Always answer in Russian.

Your job:
- Use every player message as a clue.
- This mode is not yes/no only. The player may write normal clues like "он футболист из Аргентины".
- Guess when there is enough signal.
- If the clues are too vague, ask one short useful question.
- Never make a guess that contradicts the clues.
- Do not treat normal chat as a clue; answer it normally.

Return exactly one line:
GUESS: character name
or
QUESTION: your question
or
CHAT: your normal answer
`;

const secretCharacterSystem = `
You are running a reverse Akinator-style game in Russian.
You have one secret character. The player asks questions to find it.

Hard rules:
- Never reveal the secret character unless the player directly guesses the name.
- Answer naturally in Russian, but briefly: 1-2 short sentences.
- You may answer more than yes/no when the question needs it.
- If the player guessed the exact character, answer: "Да, это [name]."
- If answering directly would reveal the name, give a careful indirect answer.
- Do not write long explanations, lists, or extra hints.
`;

const assistantSystem = `
You are Amethyst AI, a very capable, careful AI assistant for a Russian-speaking user.
Always answer in Russian unless the user asks for another language.

Your style:
- Be friendly, clear, and confident.
- Think through the task before answering, but do not show long hidden reasoning.
- If the user asks something simple, answer directly.
- If the task is complex, break it into short useful steps.
- If information is missing, ask one short clarifying question or make a reasonable assumption.
- For code, give working examples and mention where to put them.
- For school/math/explanations, explain in a way a beginner can understand.
- For creative tasks, be imaginative and practical.
- Do not invent facts that require current internet knowledge.

Image and place recognition rules:
- When the user attaches an image and asks where it is, what city/place it is, or asks you to guess the location, act like a careful visual geolocation assistant.
- First identify visible clues: architecture, mountains, roads, signs, language, skyline, landmarks, landscape, weather, and any readable text.
- Give the best likely place only when the visual evidence supports it.
- If the image could show Almaty or Kazakhstan, actively consider Almaty before guessing unrelated landmarks such as cathedrals in other cities.
- Do not answer with only a landmark name unless the user asked for just a name. Include confidence and the clues you used.
- If you are unsure, say that clearly and give 2-3 possible options instead of pretending to know.
- Never claim exact GPS coordinates or a precise address from a photo unless they are visibly shown in the image.

Goal: be as useful as a smart personal helper inside this app.
`;

const placeRecognitionPrompt = `
The latest user message includes an image. If the user wants location/place recognition,
use this response style in Russian:
1. Start with the most likely answer and confidence: high / medium / low.
2. Mention 2-5 visual clues from the image.
3. If uncertain, list likely alternatives and what would help confirm them.
Be especially careful with Kazakhstan and Almaty: mountains near the city, Soviet/modern
apartment blocks, Kazakh/Russian signage, wide avenues, and local landmarks can indicate Almaty.
Do not confuse a city photo with "a cathedral" unless a cathedral is actually the main visible subject.
`;

export async function askCharacterAi(
  history: ChatLine[],
  shouldGuess: boolean,
): Promise<AiTurn> {
  if (!hasSupabaseKeys()) {
    throw new Error('Для ИИ угадывателя нужны ключи Supabase и Gemini.');
  }

  const prompt = [
    shouldGuess
      ? 'Make the best guess from the player answers, but only if it does not contradict any answer. If there is a conflict or uncertainty, return QUESTION instead.'
      : 'Ask the next most useful question to narrow the options. Prefer questions about gender, country, real/fictional, profession, and domain.',
    '',
    'If the latest player message is a greeting, question, request, joke, or normal conversation instead of a game answer, return CHAT and answer it helpfully in Russian.',
    'Keep every QUESTION and CHAT very short: one simple sentence. Do not write explanations inside the game.',
    'Do not treat CHAT messages as clues about the imagined character.',
    'Only return QUESTION or GUESS when the latest player message is actually an answer/clue for the guessing game.',
    '',
    'Important: treat every player answer as a constraint. Do not ignore gender or country.',
    'If the player answer says yes to female/girl/woman, male guesses are forbidden.',
    'If the player answer says yes to Argentina and sport/football, check Lionel Messi before other guesses.',
    '',
    'Questions that must not be repeated:',
    ...getAskedQuestions(history),
    '',
    localKnowledge,
    '',
    'History:',
    ...history.map(formatHistoryLine),
  ].join('\n');

  try {
    const firstTurn = await requestAiTurn(prompt, guesserSystem);
    if (firstTurn.kind === 'guess' && guessContradictsHistory(firstTurn.text, history)) {
      return requestAiTurn(
        `${prompt}\n\nYour guess "${firstTurn.text}" contradicts the history. Do not guess. Ask one more useful question in Russian.`,
        guesserSystem,
      );
    }

    if (
      firstTurn.kind !== 'question' ||
      !hasQuestionBeenAsked(firstTurn.text, history)
    ) {
      return firstTurn;
    }

    return requestAiTurn(
      `${prompt}\n\nYou repeated this question: "${firstTurn.text}". Ask a different question.`,
      guesserSystem,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `ИИ угадыватель сейчас не отвечает: ${error.message}`
        : 'ИИ угадыватель сейчас не отвечает.',
    );
  }
}

export async function askFreeformGuesserAi(history: ChatLine[]): Promise<AiTurn> {
  if (!hasSupabaseKeys()) {
    return getLocalFreeformGuess(history);
  }

  const clueCount = history.filter((line) => line.author === 'player').length;
  const prompt = [
    clueCount >= 2
      ? 'Try to make the best guess from the clues. If still too uncertain, ask one narrowing question.'
      : 'The player is giving free-form clues. Guess if obvious; otherwise ask one narrowing question.',
    '',
    'Important: the player is not limited to yes/no answers in this mode.',
    'Respect gender, country, profession, fictional/real status, era, and domain.',
    '',
    'History:',
    ...history.map(formatHistoryLine),
  ].join('\n');

  try {
    return requestAiTurn(prompt, freeformGuesserSystem);
  } catch {
    return getLocalFreeformGuess(history);
  }
}

export async function askSecretCharacterAi(secretCharacter: string, history: ChatLine[]): Promise<string> {
  const lastMessage = [...history].reverse().find((line) => line.author === 'player');

  if (!hasSupabaseKeys()) {
    return getLocalSecretCharacterAnswer(secretCharacter, lastMessage?.text);
  }

  const prompt = [
    `Secret character: ${secretCharacter}`,
    '',
    'Answer the latest player question using only the secret character facts.',
    'Keep the answer short, but do not limit yourself to yes/no.',
    'Do not reveal the secret name unless the player directly guessed it.',
    '',
    'History:',
    ...history.map(formatHistoryLine),
  ].join('\n');

  try {
    const text = await requestRawAiText(prompt, secretCharacterSystem);
    return normalizeSecretCharacterAnswer(text, secretCharacter);
  } catch {
    return getLocalSecretCharacterAnswer(secretCharacter, lastMessage?.text);
  }
}

export async function askAssistantAi(history: ChatLine[], mode: AssistantMode): Promise<string> {
  const lastMessage = [...history].reverse().find((line) => line.author === 'player');

  if (!hasSupabaseKeys()) {
    return getLocalAssistantAnswer(lastMessage?.text, Boolean(lastMessage?.image));
  }

  const prompt = [
    'The user is chatting with Amethyst AI inside an app.',
    'Answer as helpfully and intelligently as possible.',
    `Current answer mode: ${assistantModeLabels[mode]}.`,
    getAssistantModeInstruction(mode),
    'Use the conversation history to understand context.',
    'If the user asks for a plan, give a practical plan.',
    'If the user asks a question, answer it directly first.',
    'If the user attached an image, analyze it and use it in your answer.',
    hasImageInLatestUserMessage(history) ? placeRecognitionPrompt : '',
    '',
    'History:',
    ...history.map(formatHistoryLine),
  ].join('\n');
  const images = history.flatMap((line) => (line.image ? [line.image] : []));

  try {
    const text = await requestRawAiText(
      prompt,
      assistantSystem,
      { images, mode },
    );

    return text.trim() || getLocalAssistantAnswer(lastMessage?.text, Boolean(lastMessage?.image));
  } catch {
    return getLocalAssistantAnswer(lastMessage?.text, Boolean(lastMessage?.image));
  }
}

async function requestAiTurn(prompt: string, system: string) {
  const text = await requestRawAiText(prompt, system);
  return parseAiTurn(text);
}

async function requestRawAiText(
  prompt: string,
  system: string,
  options: { images?: AiImage[]; mode?: AssistantMode } = {},
) {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke<{ text: string }>(
    'ai',
    { body: { prompt, system, images: options.images, mode: options.mode } },
  );

  if (error) throw new Error(error.message);

  return data?.text ?? '';
}

function parseAiTurn(text: string): AiTurn {
  const cleanText = text.trim();

  if (cleanText.toUpperCase().startsWith('GUESS:')) {
    return { kind: 'guess', text: cleanText.slice(6).trim() };
  }

  if (cleanText.toUpperCase().startsWith('CHAT:')) {
    return { kind: 'chat', text: cleanText.slice(5).trim() };
  }

  if (cleanText.toUpperCase().startsWith('QUESTION:')) {
    return { kind: 'question', text: cleanText.slice(9).trim() };
  }

  return {
    kind: cleanText.includes('?') ? 'question' : 'chat',
    text: cleanText || 'Я не получил нормальный ответ от Gemini. Попробуй отправить сообщение ещё раз.',
  };
}

function getLocalFreeformGuess(history: ChatLine[]): AiTurn {
  const facts = history
    .filter((line) => line.author === 'player')
    .map((line) => normalizeText(line.text))
    .join(' ');

  if (facts.includes('аргентина') && (facts.includes('футбол') || facts.includes('футболист'))) {
    return { kind: 'guess', text: 'Лионель Месси' };
  }

  if (facts.includes('португал') && (facts.includes('футбол') || facts.includes('футболист'))) {
    return { kind: 'guess', text: 'Криштиану Роналду' };
  }

  if (facts.includes('волшебник') && (facts.includes('шрам') || facts.includes('хогвартс'))) {
    return { kind: 'guess', text: 'Гарри Поттер' };
  }

  if (facts.includes('паук') || facts.includes('человек паук')) {
    return { kind: 'guess', text: 'Человек-паук' };
  }

  return {
    kind: 'question',
    text: 'Дай ещё одну подсказку: это реальный человек или выдуманный персонаж?',
  };
}

function getLocalSecretCharacterAnswer(secretCharacter: string, question = '') {
  const normalizedQuestion = normalizeText(question);
  const normalizedSecret = normalizeText(secretCharacter);

  if (!normalizedQuestion) return 'Спроси что-нибудь про персонажа.';
  if (normalizedQuestion.includes(normalizedSecret)) return `Да, это ${secretCharacter}.`;
  if (!question.includes('?')) return 'Я могу ответить, если ты задашь вопрос про персонажа.';

  return 'Отвечу коротко: это может быть хорошим направлением.';
}

function normalizeSecretCharacterAnswer(text: string, secretCharacter: string) {
  const cleanText = text.trim().replace(/\s+/g, ' ');
  const lowerText = cleanText.toLowerCase();

  if (!cleanText) return 'Не знаю, спроси по-другому.';
  if (lowerText.includes(normalizeText(secretCharacter)) && lowerText.startsWith('да')) {
    return `Да, это ${secretCharacter}.`;
  }

  const safeText = lowerText.includes(normalizeText(secretCharacter))
    ? cleanText.replace(new RegExp(escapeRegExp(secretCharacter), 'ig'), 'этот персонаж')
    : cleanText;

  return safeText.length > 140 ? `${safeText.slice(0, 137).trim()}...` : safeText;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLocalAssistantAnswer(question = '', hasImage = false) {
  const cleanQuestion = question.trim();
  const normalizedQuestion = cleanQuestion.toLowerCase();

  if (hasImage) {
    return 'Я вижу, что ты прикрепил фото, но без подключённого Gemini API я не могу его разобрать. Когда ключ Supabase/Gemini включён, я буду угадывать место аккуратно: сначала смотреть на вывески, горы, архитектуру и другие признаки, потом давать вариант с уверенностью.';
  }

  if (!cleanQuestion) {
    return 'Привет! Напиши вопрос, и я помогу.';
  }

  if (/^(привет|салам|здравствуй|здравствуйте|hello|hi|hey)[!. ]*$/i.test(cleanQuestion)) {
    return 'Привет! Я Amethyst AI. Можешь спросить меня о чём угодно: учёба, код, идеи, текст, объяснения или планы.';
  }

  if (normalizedQuestion.includes('как дела')) {
    return 'У меня всё отлично, а у тебя как дела? Я готов помогать. Что хочешь сделать?';
  }

  if (normalizedQuestion.includes('кто ты')) {
    return 'Я Amethyst AI, помощник внутри этой игры. Могу отвечать на вопросы, помогать с идеями, объяснять темы и подсказывать по коду.';
  }

  if (
    normalizedQuestion.includes('айкью') ||
    normalizedQuestion.includes('iq')
  ) {
    return 'У меня нет обычного человеческого IQ, потому что я не человек и не прохожу тесты как люди. Но я могу быстро объяснять, придумывать идеи, помогать с кодом, текстами, учёбой и отвечать на разные вопросы.';
  }

  if (
    normalizedQuestion.includes('что ты умеешь') ||
    normalizedQuestion.includes('что умеешь')
  ) {
    return 'Я могу помогать с вопросами, учёбой, текстами, идеями, кодом и объяснениями. Просто напиши задачу обычными словами.';
  }

  return 'Я пока отвечаю коротко, но можешь спросить что угодно. Лучше напиши вопрос чуть конкретнее, и я постараюсь помочь.';
}

function getAssistantModeInstruction(mode: AssistantMode) {
  if (mode === 'fast') {
    return 'Be brief and fast: answer in 2-5 short sentences unless the user clearly needs more.';
  }

  if (mode === 'slow') {
    return 'Be careful and detailed: explain step by step, check assumptions, and give a fuller answer.';
  }

  if (mode === 'smart') {
    return 'Use your strongest reasoning: be precise, structured, and mention important caveats.';
  }

  return 'Answer very simply: use easy words, short sentences, and avoid complex reasoning unless asked.';
}

function hasSupabaseKeys() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}

function hasImageInLatestUserMessage(history: ChatLine[]) {
  return Boolean([...history].reverse().find((line) => line.author === 'player')?.image);
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

function guessContradictsHistory(guess: string, history: ChatLine[]) {
  const normalizedGuess = normalizeText(guess);
  const facts = history.map((line) => normalizeText(line.text)).join(' ');

  const femaleWasConfirmed =
    facts.includes('девочка') ||
    facts.includes('женщина') ||
    facts.includes('female') ||
    facts.includes('girl');

  const knownMaleGuesses = [
    'коби брайант',
    'kobe bryant',
    'лионель месси',
    'lionel messi',
    'криштиану роналду',
    'cristiano ronaldo',
  ];

  if (femaleWasConfirmed && knownMaleGuesses.some((name) => normalizedGuess.includes(name))) {
    return true;
  }

  return false;
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
  const imageText = line.image ? ` [attached image: ${line.image.name}, ${line.image.mimeType}]` : '';
  if (line.author === 'mistake') return `ai mistake: ${line.text}`;
  return `${line.author}: ${line.text}${imageText}`;
}
