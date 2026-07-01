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
        <p>О нет, я не угадал. Я думал, что это {guess}.</p>

        {!reaction ? (
          <form className="reveal-form" onSubmit={submitAnswer}>
            <label htmlFor="real-answer">Кто это был?</label>
            <div className="reveal-row">
              <input
                id="real-answer"
                onChange={(event) => setRealAnswer(event.target.value)}
                placeholder="Например: Джастин Бибер"
                type="text"
                value={realAnswer}
              />
              <button type="submit">Сказать</button>
            </div>
          </form>
        ) : (
          <p className="ai-reaction">{reaction}</p>
        )}
      </div>

      <button onClick={onRestart} type="button">
        Играть заново
      </button>
    </div>
  );
}

function getReaction(guess: string, realAnswer: string) {
  const normalizedGuess = normalizeText(guess);
  const normalizedAnswer = normalizeText(realAnswer);

  if (normalizedGuess === normalizedAnswer) {
    return 'Подожди, получается я всё-таки угадал. Значит засчитываю победу себе.';
  }

  if (isCloseGuess(normalizedGuess, normalizedAnswer)) {
    return `Я был рядом, но не дожал. Запомню: это был ${realAnswer}.`;
  }

  return `Я не догадался. Хороший персонаж: ${realAnswer}. В следующий раз буду умнее спрашивать.`;
}

function isCloseGuess(guess: string, answer: string) {
  return guess.includes(answer) || answer.includes(guess);
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[?!.,"'«»]/g, '').trim();
}
