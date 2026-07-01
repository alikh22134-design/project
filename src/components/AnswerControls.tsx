import { useState } from 'react';

type AnswerControlsProps = {
  disabled: boolean;
  onAnswer: (answer: string) => void;
};

const answers = [
  { value: 'Точно да' },
  { value: 'Скорее да' },
  { value: 'Может быть да' },
  { value: 'Не знаю' },
  { value: 'Может быть нет' },
  { value: 'Скорее нет' },
  { value: 'Точно нет' },
];

export default function AnswerControls({
  disabled,
  onAnswer,
}: AnswerControlsProps) {
  const [selectedAnswer, setSelectedAnswer] = useState('');

  function chooseAnswer(answer: string) {
    setSelectedAnswer(answer);
    onAnswer(answer);
  }

  return (
    <div className="answer-controls">
      {answers.map((answer) => (
        <button
          aria-label={answer.value}
          className={selectedAnswer === answer.value ? 'is-selected' : ''}
          disabled={disabled}
          key={answer.value}
          onClick={() => chooseAnswer(answer.value)}
          type="button"
        />
      ))}
    </div>
  );
}
