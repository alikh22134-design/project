import { FormEvent, useState } from 'react';
import '../styles/failedGuess.css';

type FailedGuessResultProps = {
  guess: string;
  onRestart: () => void;
};

export default function FailedGuessResult({
  guess,
  onRestart,
}: FailedGuessResultProps) {
  const [realAnswer, setRealAnswer] = useState('');
  const [reaction, setReaction] = useState('');

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAnswer = realAnswer.trim();
    if (!cleanAnswer) return;

    setReaction(getReaction(guess, cleanAnswer));
  }

  return (
    <div className="finish-card finish-card--failed">
      <div className="failed-content">
        <p className="finish-title">Хм, мысль ускользнула.</p>
        <p>Я выбрал: <strong>{guess}</strong>. Но, кажется, это был не он.</p>

        {!reaction ? (
          <form className="reveal-form" onSubmit={submitAnswer}>
            <label htmlFor="real-answer">Кого ты загадал?</label>
            <div className="reveal-row">
              <input
                id="real-answer"
                onChange={(event) => setRealAnswer(event.target.value)}
                placeholder="Например: Гарри Поттер"
                type="text"
                value={realAnswer}
              />
              <button type="submit">Показать</button>
            </div>
          </form>
        ) : (
          <p className="ai-reaction">{reaction}</p>
        )}
      </div>

      <button onClick={onRestart} type="button">
        Играть снова
      </button>
    </div>
  );
}

function getReaction(guess: string, realAnswer: string) {
  const normalizedGuess = normalizeText(guess);
  const normalizedAnswer = normalizeText(realAnswer);

  if (normalizedGuess === normalizedAnswer) {
    return 'Подожди, получается я всё-таки попал в цель. Засчитываю победу Mind Oracle.';
  }

  if (isCloseGuess(normalizedGuess, normalizedAnswer)) {
    return `Я был рядом, но не дожал. Запомню этот след: это был ${realAnswer}.`;
  }

  return `Красивый выбор: ${realAnswer}. В следующий раз я задам вопросы хитрее.`;
}

function isCloseGuess(guess: string, answer: string) {
  return guess.includes(answer) || answer.includes(guess);
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[?!.,"'«»]/g, '').trim();
}
