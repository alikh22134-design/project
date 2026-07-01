import type { AiTurn, ChatLine } from './characterAi';
import {
  getDemoGuess,
  getGameState,
  getSmartQuestion,
  hasNextQuestion,
} from './demoAkinatorBrain';

const MIN_ANSWERS_BEFORE_GUESS = 7;

export function getDemoTurn(
  history: ChatLine[],
  shouldGuess: boolean,
): AiTurn {
  const answers = getAnswers(history);
  const canGuess = answers.length >= MIN_ANSWERS_BEFORE_GUESS;

  if ((shouldGuess && canGuess) || !hasNextQuestion(answers)) {
    return canGuess
      ? { kind: 'guess', text: getDemoGuess(answers) }
      : { kind: 'question', text: getFallbackQuestion(answers) };
  }

  return { kind: 'question', text: getNextQuestionText(answers) };
}

function getAnswers(history: ChatLine[]) {
  return history
    .filter((line) => line.author === 'player')
    .map((line) => line.text.toLowerCase());
}

function getNextQuestionText(answers: string[]) {
  if (!answers[0]) return 'Это реальный человек, не выдуманный?';

  const { answeredKeys, facts } = getGameState(answers);
  const nextQuestion = getSmartQuestion(facts, answeredKeys);

  return nextQuestion?.[1] ?? getFallbackQuestion(answers);
}

function getFallbackQuestion(answers: string[]) {
  const fallbackQuestions = [
    'Он мужчина?',
    'Его знают во всём мире?',
    'Он стал известен в последние 15 лет?',
    'Он часто появляется в интернете?',
    'Он связан с выступлениями на сцене или в медиа?',
    'Он больше популярен среди молодёжи?',
  ];

  return fallbackQuestions[answers.length % fallbackQuestions.length];
}
