type GuessResultProps = {
  guess: string;
  disabled: boolean;
  onCorrect: () => void;
  onWrong: () => void;
};

export default function GuessResult({
  guess,
  disabled,
  onCorrect,
  onWrong,
}: GuessResultProps) {
  return (
    <div className="guess-card">
      <p>Моя догадка:</p>
      <strong>{guess}</strong>
      {!disabled && (
        <div className="guess-actions">
          <button onClick={onCorrect} type="button">
            Верно
          </button>
          <button className="ghost" onClick={onWrong} type="button">
            Не угадал
          </button>
        </div>
      )}
    </div>
  );
}
