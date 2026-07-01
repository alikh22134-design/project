import { useEffect, useRef, useState } from 'react';
import AiHost from '../components/AiHost';
import AnswerControls from '../components/AnswerControls';
import FailedGuessResult from '../components/FailedGuessResult';
import GuessResult from '../components/GuessResult';
import MessageList from '../components/MessageList';
import { askCharacterAi, ChatLine } from '../lib/characterAi';
import '../styles/characterGuess.css';

const firstMessage: ChatLine = {
  author: 'ai',
  text: 'Загадай кого-то в голове: реального человека или выдуманного персонажа. Начнём: это реальный человек, не выдуманный?',
};

const fireflyIndexes = Array.from({ length: 34 }, (_, index) => index);

export default function CharacterGuessPage() {
  const [messages, setMessages] = useState<ChatLine[]>([firstMessage]);
  const [guess, setGuess] = useState('');
  const [answerCount, setAnswerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hostText = getHostText(messages, guess);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, guess, finished, failed, loading]);

  async function sendAnswer(answer: string) {
    const nextAnswerCount = answerCount + 1;
    const nextMessages: ChatLine[] = [
      ...messages,
      { author: 'player', text: answer },
    ];
    setMessages(nextMessages);
    setAnswerCount(nextAnswerCount);
    await loadAiTurn(nextMessages, nextAnswerCount >= 10);
  }

  async function loadAiTurn(history: ChatLine[], shouldGuess: boolean) {
    setLoading(true);
    setError('');
    try {
      const turn = await askCharacterAi(history, shouldGuess);
      if (turn.kind === 'guess') {
        setGuess(turn.text);
      } else if (hasQuestionAlreadyShown(turn.text, history)) {
        const answersCount = history.filter((line) => line.author === 'player').length;
        if (answersCount >= 8) {
          const guessTurn = await askCharacterAi(history, true);
          setGuess(guessTurn.text);
        } else {
          setMessages([...history, { author: 'ai', text: getFallbackQuestion(answersCount) }]);
        }
      } else {
        setMessages([...history, { author: 'ai', text: turn.text }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI сейчас не отвечает.');
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setMessages([firstMessage]);
    setGuess('');
    setAnswerCount(0);
    setLoading(false);
    setError('');
    setFinished(false);
    setFailed(false);
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

  function getFallbackQuestion(answersCount: number) {
    const questions = [
      'Он мужчина?',
      'Его знают во всём мире?',
      'Он связан со спортом, музыкой, кино или интернетом?',
      'Он стал известен в последние годы?',
      'Он больше популярен среди молодёжи?',
    ];

    return questions[answersCount % questions.length];
  }

  return (
    <main className="game-page">
      <div className="fireflies" aria-hidden="true">
        {fireflyIndexes.map((index) => (
          <span key={index} />
        ))}
      </div>
      <section className="game-card">
        <header className="game-header">
          <p>AI Game</p>
          <h1>AI угадывает персонажа</h1>
        </header>

        {finished ? (
          <div className="finish-card">
            <p>Ура, я угадал! Загадай нового персонажа.</p>
            <button onClick={restart} type="button">
              Играть заново
            </button>
          </div>
        ) : failed ? (
          <FailedGuessResult guess={guess} onRestart={restart} />
        ) : (
          <>
            <AiHost thinking={loading} text={hostText} />
            <MessageList loading={loading} messages={messages} />

            {guess ? (
              <GuessResult
                disabled={loading}
                guess={guess}
                onCorrect={finishGame}
                onWrong={failGame}
              />
            ) : (
              <AnswerControls disabled={loading} onAnswer={sendAnswer} />
            )}

            <button className="bottom-restart" onClick={restart} type="button">
              Заново
            </button>
          </>
        )}
        {error && <p className="message">{error}</p>}
        <div ref={bottomRef} />
      </section>
    </main>
  );
}

function getHostText(messages: ChatLine[], guess: string) {
  if (guess) return `Я думаю, это ${guess}`;
  if (!messages.some((line) => line.author === 'player')) {
    return 'Привет, я AI-угадыватель. Можешь загадать персонажа, а я попробую угадать.';
  }

  const lastAiMessage = [...messages].reverse().find((line) => line.author === 'ai');
  return lastAiMessage?.text ?? 'Загадай персонажа, а я попробую угадать.';
}
