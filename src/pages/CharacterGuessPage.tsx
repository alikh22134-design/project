import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import FailedGuessResult from '../components/FailedGuessResult';
import GuessResult from '../components/GuessResult';
import MessageList from '../components/MessageList';
import {
  askAssistantAi,
  askCharacterAi,
  askSecretCharacterAi,
  AssistantMode,
  ChatLine,
} from '../lib/characterAi';
import '../styles/characterGuess.css';

const firstMessage: ChatLine = {
  author: 'ai',
  text: 'Загадай кого-то в голове: реального человека или выдуманного персонажа. Я сам выберу, с какого вопроса начать.',
};

const firstFreeformMessage: ChatLine = {
  author: 'ai',
  text: 'Я загадал персонажа. Задавай любые вопросы, а я буду отвечать коротко и не раскрою имя сразу.',
};

const firstAssistantMessage: ChatLine = {
  author: 'ai',
  text: 'Напиши вопрос или прикрепи фото места. Я могу помочь с учёбой, кодом, идеями и аккуратно угадывать локации по снимку.',
};

const fireflyIndexes = Array.from({ length: 34 }, (_, index) => index);
type GameMode = 'assistant' | 'guesser';
type GuesserMode = 'questions' | 'freeform';

const guestGameLimit = 2;
const guestGamesUsedKey = 'guestGuessGamesUsedTest3';
const registrationPromptSkippedKey = 'registrationPromptSkipped';
const assistantModes: Array<{ id: AssistantMode; label: string }> = [
  { id: 'fast', label: 'Быстро' },
  { id: 'slow', label: 'Медленно' },
  { id: 'smart', label: 'Умный' },
  { id: 'simple', label: 'Простой' },
];
const guesserModes: Array<{ id: GuesserMode; label: string }> = [
  { id: 'questions', label: 'ИИ спрашивает' },
  { id: 'freeform', label: 'Ты спрашиваешь' },
];

type CharacterGuessPageProps = {
  isGuest?: boolean;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
};

export default function CharacterGuessPage({ isGuest = false, onOpenAuth }: CharacterGuessPageProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('guesser');
  const [selectedGuesserMode, setSelectedGuesserMode] = useState<GuesserMode>('questions');
  const [activeMode, setActiveMode] = useState<GameMode | null>(null);
  const [guestGamesUsed, setGuestGamesUsed] = useState(() => {
    const savedCount = Number(localStorage.getItem(guestGamesUsedKey) || '0');
    return Number.isFinite(savedCount) ? savedCount : 0;
  });
  const [guestLimitMessage, setGuestLimitMessage] = useState('');
  const [registrationPromptSkipped, setRegistrationPromptSkipped] = useState(() => {
    return localStorage.getItem(registrationPromptSkippedKey) === 'true';
  });
  const [messages, setMessages] = useState<ChatLine[]>([firstMessage]);
  const [guess, setGuess] = useState('');
  const [answerCount, setAnswerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [guesserInput, setGuesserInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<ChatLine[]>([
    firstAssistantMessage,
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantImage, setAssistantImage] = useState<ChatLine['image'] | null>(null);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('smart');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [freeformMessages, setFreeformMessages] = useState<ChatLine[]>([
    firstFreeformMessage,
  ]);
  const [secretCharacter, setSecretCharacter] = useState(() => getRandomSecretCharacter());
  const [freeformInput, setFreeformInput] = useState('');
  const [freeformGuess, setFreeformGuess] = useState('');
  const [freeformLoading, setFreeformLoading] = useState(false);
  const [freeformFinished, setFreeformFinished] = useState(false);
  const [freeformFailed, setFreeformFailed] = useState(false);
  const [freeformError, setFreeformError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const openingQuestionRequestedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [
    messages,
    guess,
    finished,
    failed,
    loading,
    assistantMessages,
    assistantLoading,
    freeformMessages,
    freeformLoading,
    freeformGuess,
    assistantError,
    error,
    guestLimitMessage,
  ]);

  useEffect(() => {
    if (
      activeMode === 'guesser' &&
      selectedGuesserMode === 'questions' &&
      messages.length === 1 &&
      messages[0]?.text === firstMessage.text &&
      !openingQuestionRequestedRef.current
    ) {
      openingQuestionRequestedRef.current = true;
      void loadOpeningQuestion();
    }
  }, [activeMode, messages.length, selectedGuesserMode]);

  async function loadOpeningQuestion() {
    setLoading(true);
    setError('');
    try {
      const turn = await askCharacterAi(
        [{ author: 'player', text: 'Я загадал персонажа. Начинай игру и сам придумай первый вопрос.' }],
        false,
      );
      setMessages([
        firstMessage,
        { author: 'ai', text: turn.kind === 'guess' ? `Моя первая догадка: ${turn.text}` : shortenGuesserText(turn.text) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI сейчас не отвечает.');
    } finally {
      setLoading(false);
    }
  }

  async function sendAnswer(answer: string) {
    const nextMessages: ChatLine[] = [
      ...messages,
      { author: 'player', text: answer },
    ];
    setMessages(nextMessages);

    if (shouldUseAssistantInGuesser(answer)) {
      await loadGuesserChat(nextMessages);
      return;
    }

    await loadAiTurn(nextMessages, answerCount + 1);
  }

  async function loadGuesserChat(history: ChatLine[]) {
    setLoading(true);
    setError('');
    try {
      const answer = await askAssistantAi(history, 'fast');
      setMessages([...history, { author: 'ai', text: shortenGuesserText(answer) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI сейчас не отвечает.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAiTurn(history: ChatLine[], nextAnswerCount: number) {
    setLoading(true);
    setError('');
    try {
      const turn = await askCharacterAi(history, nextAnswerCount >= 10);
      if (turn.kind === 'guess') {
        setAnswerCount(nextAnswerCount);
        setGuess(turn.text);
      } else if (turn.kind === 'chat') {
        setMessages([...history, { author: 'ai', text: shortenGuesserText(turn.text) }]);
      } else if (hasQuestionAlreadyShown(turn.text, history)) {
        const retryHistory: ChatLine[] = [
          ...history,
          {
            author: 'mistake',
            text: `Ты повторил вопрос "${turn.text}". Придумай новый полезный вопрос сам, без локальных заготовок.`,
          },
        ];
        const retryTurn = await askCharacterAi(retryHistory, nextAnswerCount >= 8);

        if (retryTurn.kind === 'guess') {
          setAnswerCount(nextAnswerCount);
          setGuess(retryTurn.text);
        } else if (retryTurn.kind === 'chat') {
          setMessages([...history, { author: 'ai', text: shortenGuesserText(retryTurn.text) }]);
        } else {
          setAnswerCount(nextAnswerCount);
          setMessages([...history, { author: 'ai', text: shortenGuesserText(retryTurn.text) }]);
        }
      } else {
        setAnswerCount(nextAnswerCount);
        setMessages([...history, { author: 'ai', text: shortenGuesserText(turn.text) }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI сейчас не отвечает.');
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    openingQuestionRequestedRef.current = false;
    setMessages([firstMessage]);
    setGuess('');
    setAnswerCount(0);
    setLoading(false);
    setError('');
    setFinished(false);
    setFailed(false);
    setGuesserInput('');
  }

  function useGuestGame() {
    if (!isGuest) return true;

    const nextCount = guestGamesUsed + 1;
    localStorage.setItem(guestGamesUsedKey, String(nextCount));
    setGuestGamesUsed(nextCount);
    setGuestLimitMessage(
      nextCount >= guestGameLimit && !registrationPromptSkipped
        ? 'Понравилась игра? Можно создать аккаунт, но это не обязательно.'
        : '',
    );

    return true;
  }

  function skipRegistrationPrompt() {
    localStorage.setItem(registrationPromptSkippedKey, 'true');
    setRegistrationPromptSkipped(true);
    setGuestLimitMessage('');
  }

  function restartWithGuestLimit() {
    if (!useGuestGame()) return;

    if (selectedGuesserMode === 'freeform') {
      resetFreeformGuesser();
      return;
    }

    restart();
  }

  function resetAssistant() {
    setAssistantMessages([firstAssistantMessage]);
    setAssistantInput('');
    setAssistantImage(null);
    setAssistantLoading(false);
    setAssistantError('');
  }

  function resetFreeformGuesser() {
    setSecretCharacter(getRandomSecretCharacter());
    setFreeformMessages([firstFreeformMessage]);
    setFreeformInput('');
    setFreeformGuess('');
    setFreeformLoading(false);
    setFreeformFinished(false);
    setFreeformFailed(false);
    setFreeformError('');
  }

  function startSelectedMode() {
    if (!useGuestGame()) return;

    restart();
    resetAssistant();
    resetFreeformGuesser();
    setActiveMode(selectedMode);
  }

  function goHome() {
    restart();
    resetAssistant();
    resetFreeformGuesser();
    setActiveMode(null);
  }

  async function sendFreeformClue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = freeformInput.trim();
    if (!cleanQuestion || freeformLoading || freeformGuess) return;

    const nextMessages: ChatLine[] = [
      ...freeformMessages,
      { author: 'player', text: cleanQuestion },
    ];
    setFreeformInput('');
    setFreeformMessages(nextMessages);
    setFreeformLoading(true);
    setFreeformError('');

    try {
      const answer = await askSecretCharacterAi(secretCharacter, nextMessages);
      setFreeformMessages([...nextMessages, { author: 'ai', text: answer }]);

      if (isCorrectSecretGuess(answer, secretCharacter)) {
        setFreeformGuess(secretCharacter);
        setFreeformFinished(true);
      }
    } catch (err) {
      setFreeformError(err instanceof Error ? err.message : 'AI сейчас не отвечает.');
    } finally {
      setFreeformLoading(false);
    }
  }

  async function sendAssistantMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = assistantInput.trim();
    if ((!cleanMessage && !assistantImage) || assistantLoading) return;

    const nextMessages: ChatLine[] = [
      ...assistantMessages,
      {
        author: 'player',
        text: cleanMessage || 'Посмотри это фото.',
        image: assistantImage ?? undefined,
      },
    ];
    setAssistantInput('');
    setAssistantImage(null);
    setAssistantMessages(nextMessages);
    setAssistantLoading(true);
    setAssistantError('');

    try {
      const answer = await askAssistantAi(nextMessages, assistantMode);
      setAssistantMessages([...nextMessages, { author: 'ai', text: answer }]);
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : 'Amethyst AI сейчас не отвечает.');
    } finally {
      setAssistantLoading(false);
    }
  }

  async function sendGuesserAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAnswer = guesserInput.trim();
    if (!cleanAnswer || loading || guess) return;

    setGuesserInput('');
    await sendAnswer(cleanAnswer);
  }

  async function chooseAssistantImage(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAssistantError('Можно прикреплять только фото.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAssistantError('Фото слишком большое. Выбери картинку до 4 МБ.');
      return;
    }

    const data = await readFileAsDataUrl(file);
    setAssistantImage({ data, mimeType: file.type, name: file.name });
    setAssistantError('');
  }

  function failGame() {
    if (loading || finished || failed) return;
    setFailed(true);
  }

  function finishGame() {
    if (finished || failed) return;
    setFinished(true);
  }

  function hasQuestionAlreadyShown(question: string, history: ChatLine[]) {
    const normalizedQuestion = normalizeText(question);

    return history.some((line) => {
      return line.author === 'ai' && normalizeText(line.text) === normalizedQuestion;
    });
  }

  function normalizeText(text: string) {
    return text.toLowerCase().replace(/[?!.,"'«»]/g, '').trim();
  }

  function shouldUseAssistantInGuesser(text: string) {
    const normalized = normalizeText(text);
    const compact = normalized.replace(/\s+/g, ' ');

    if (!compact) return true;
    if (text.includes('?')) return true;

    const gameAnswers = [
      'да',
      'нет',
      'не знаю',
      'незнаю',
      'точно да',
      'точно нет',
      'скорее да',
      'скорее нет',
      'похоже да',
      'похоже на да',
      'похоже нет',
      'похоже на нет',
      'может быть',
      'может быть да',
      'может быть нет',
      'не уверен',
      'не уверена',
      'мимо',
      'скорее мимо',
    ];

    if (gameAnswers.includes(compact)) return false;
    if (/^(да|нет|скорее|точно|похоже|может|не знаю|не уверен|не уверена)\b/.test(compact)) {
      return false;
    }

    if (/^(он|она|они|это|персонаж|человек|герой|героиня)\b/.test(compact)) {
      return false;
    }

    return true;
  }

  if (!activeMode) {
    return (
      <GameShell>
        <section className="start-panel" aria-label="Выбор режима">
          <h1>Выбери режим</h1>
          <div className="mode-select" role="group" aria-label="Режим игры">
            <button
              className={`mode-button${selectedMode === 'assistant' ? ' is-selected' : ''}`}
              onClick={() => setSelectedMode('assistant')}
              type="button"
            >
              ИИ помощник
            </button>
            <button
              className={`mode-button${selectedMode === 'guesser' ? ' is-selected' : ''}`}
              onClick={() => setSelectedMode('guesser')}
              type="button"
            >
              ИИ угадыватель
            </button>
          </div>
          <button className="play-button" onClick={startSelectedMode} type="button">
            Начать
          </button>
          {isGuest && onOpenAuth && (
            <button className="auth-link" onClick={() => onOpenAuth('signup')} type="button">
              Создать аккаунт
            </button>
          )}
          {guestLimitMessage && (
            <div className="guest-limit guest-limit--blocked">
              <span>{guestLimitMessage}</span>
              <button onClick={skipRegistrationPrompt} type="button">
                Продолжить без аккаунта
              </button>
            </div>
          )}
        </section>
      </GameShell>
    );
  }

  if (activeMode === 'assistant') {
    return (
      <GameShell>
        <section className="game-card">
          <button className="home-button" onClick={goHome} type="button">
            Главная
          </button>
          <header className="game-header">
            <p>AI Helper</p>
            <h1>Amethyst AI</h1>
          </header>

          <MessageList loading={assistantLoading} messages={assistantMessages} />
          <div className="assistant-mode-switch" role="group" aria-label="Скорость и ум ИИ">
            {assistantModes.map((mode) => (
              <button
                className={assistantMode === mode.id ? 'is-selected' : ''}
                disabled={assistantLoading}
                key={mode.id}
                onClick={() => setAssistantMode(mode.id)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <form className="assistant-form" onSubmit={sendAssistantMessage}>
            {assistantImage && (
              <div className="assistant-image-preview">
                <img src={assistantImage.data} alt={assistantImage.name} />
                <span>{assistantImage.name}</span>
                <button onClick={() => setAssistantImage(null)} type="button">
                  Убрать
                </button>
              </div>
            )}
            <input
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder={assistantImage ? 'Например: где это место?' : 'Напиши вопрос или прикрепи фото...'}
              type="text"
              value={assistantInput}
            />
            <label className="assistant-file-button">
              Фото
              <input
                accept="image/*"
                disabled={assistantLoading}
                onChange={(event) => {
                  void chooseAssistantImage(event.target.files?.[0]);
                  event.target.value = '';
                }}
                type="file"
              />
            </label>
            <button disabled={assistantLoading} type="submit">
              Отправить
            </button>
          </form>
          {assistantError && <p className="message">{assistantError}</p>}
          <div ref={bottomRef} />
        </section>
      </GameShell>
    );
  }

  if (selectedGuesserMode === 'freeform') {
    return (
      <GameShell>
        <section className="game-card">
          <button className="home-button" onClick={goHome} type="button">
            Главная
          </button>
          <header className="game-header">
            <p>AI Game</p>
            <h1>Mind Oracle</h1>
          </header>
          <div className="assistant-mode-switch" role="group" aria-label="Режим Mind Oracle">
            {guesserModes.map((mode) => (
              <button
                className={selectedGuesserMode === mode.id ? 'is-selected' : ''}
                disabled={freeformLoading}
                key={mode.id}
                onClick={() => {
                  setSelectedGuesserMode(mode.id);
                  restart();
                  resetFreeformGuesser();
                }}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>

          <MessageList loading={freeformLoading} messages={freeformMessages} />

          {freeformFinished ? (
            <div className="finish-card finish-card--success">
              <div>
                <p className="finish-title">Угадано.</p>
                <p>ИИ загадал нового персонажа для следующей игры.</p>
              </div>
              <button onClick={restartWithGuestLimit} type="button">
                Играть снова
              </button>
            </div>
          ) : freeformFailed ? (
            <FailedGuessResult guess={freeformGuess} onRestart={restartWithGuestLimit} />
          ) : freeformGuess ? (
            <GuessResult
              disabled={freeformLoading}
              guess={freeformGuess}
              onCorrect={() => setFreeformFinished(true)}
              onWrong={() => setFreeformFailed(true)}
            />
          ) : (
            <form className="guesser-form" onSubmit={sendFreeformClue}>
              <input
                disabled={freeformLoading}
                onChange={(event) => setFreeformInput(event.target.value)}
                placeholder="Спроси: чем он известен? он из фильма? где живёт?"
                type="text"
                value={freeformInput}
              />
              <button disabled={freeformLoading || !freeformInput.trim()} type="submit">
                Спросить
              </button>
            </form>
          )}

          <button className="bottom-restart" onClick={restartWithGuestLimit} type="button">
            Заново
          </button>
          {freeformError && <p className="message">{freeformError}</p>}
          <div ref={bottomRef} />
        </section>
      </GameShell>
    );
  }

  return (
    <GameShell>
      <section className="game-card">
        <button className="home-button" onClick={goHome} type="button">
          Главная
        </button>
        <header className="game-header">
          <p>AI Game</p>
          <h1>Mind Oracle</h1>
        </header>
        <div className="assistant-mode-switch" role="group" aria-label="Режим Mind Oracle">
          {guesserModes.map((mode) => (
            <button
              className={selectedGuesserMode === mode.id ? 'is-selected' : ''}
              disabled={loading}
              key={mode.id}
              onClick={() => {
                setSelectedGuesserMode(mode.id);
                restart();
                resetFreeformGuesser();
              }}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
        {guestLimitMessage && (
          <div className="guest-limit guest-limit--blocked">
            <span>{guestLimitMessage}</span>
            <button onClick={skipRegistrationPrompt} type="button">
              Продолжить без аккаунта
            </button>
          </div>
        )}

        {finished ? (
          <div className="finish-card finish-card--success">
            <div>
              <p className="finish-title">Мысль поймана.</p>
              <p>Mind Oracle прочитал твой выбор. Загадай нового персонажа, если хочешь реванш.</p>
            </div>
            <button onClick={restartWithGuestLimit} type="button">
              Играть снова
            </button>
          </div>
        ) : failed ? (
          <FailedGuessResult guess={guess} onRestart={restartWithGuestLimit} />
        ) : (
          <>
            <MessageList loading={loading} messages={messages} />

            {guess ? (
              <GuessResult
                disabled={loading}
                guess={guess}
                onCorrect={finishGame}
                onWrong={failGame}
              />
            ) : (
              <form className="guesser-form" onSubmit={sendGuesserAnswer}>
                <input
                  disabled={loading}
                  onChange={(event) => setGuesserInput(event.target.value)}
                  placeholder="Напиши ответ: да, нет, не знаю..."
                  type="text"
                  value={guesserInput}
                />
                <button disabled={loading || !guesserInput.trim()} type="submit">
                  Ответить
                </button>
              </form>
            )}

            <button className="bottom-restart" onClick={restartWithGuestLimit} type="button">
              Заново
            </button>
          </>
        )}
        {error && <p className="message">{error}</p>}
        <div ref={bottomRef} />
      </section>
    </GameShell>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(new Error('Не получилось прочитать фото.')));
    reader.readAsDataURL(file);
  });
}

function getRandomSecretCharacter() {
  const characters = [
    'Лионель Месси',
    'Криштиану Роналду',
    'Гарри Поттер',
    'Человек-паук',
    'Тони Старк',
    'Наруто Узумаки',
    'Шрек',
    'Эльза',
    'Микки Маус',
    'Бэтмен',
    'Супермен',
    'Джеки Чан',
    'Майкл Джексон',
    'Тейлор Свифт',
    'Абай Кунанбаев',
    'Альберт Эйнштейн',
  ];

  return characters[Math.floor(Math.random() * characters.length)];
}

function isCorrectSecretGuess(answer: string, secretCharacter: string) {
  return normalizeSecretText(answer).startsWith(`да это ${normalizeSecretText(secretCharacter)}`);
}

function normalizeSecretText(text: string) {
  return text.toLowerCase().replace(/[?!.,"'«»]/g, '').trim();
}

function shortenGuesserText(text: string) {
  const cleanText = text.trim().replace(/\s+/g, ' ');
  if (cleanText.length <= 90) return cleanText;

  const firstSentence = cleanText.match(/^[^?!.]+[?!.]/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= 90) return firstSentence;

  return `${cleanText.slice(0, 87).trim()}...`;
}

function GameShell({ children }: { children: ReactNode }) {
  return (
    <main className="game-page">
      <div className="starfield" aria-hidden="true">
        {fireflyIndexes.map((index) => (
          <span key={index} />
        ))}
      </div>
      {children}
    </main>
  );
}
