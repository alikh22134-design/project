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
      <p>Я заглянул в твою мысль и выбираю:</p>
      <strong>{guess}</strong>
      {!disabled && (
        <div className="guess-actions">
          <button onClick={onCorrect} type="button">
            Да, это он
          </button>
          <button className="ghost" onClick={onWrong} type="button">
            Нет, не угадал
          </button>
        </div>
      )}
    </div>
  );
}
