import { candidates } from './demoCandidates';
import { getQuestionList, shouldAskQuestion } from './demoQuestions';
import type { FactKey, Facts } from './demoAkinatorTypes';

export function getDemoGuess(answers: string[]) {
  const facts = getGameState(answers).facts;
  const scored = getScoredCandidates(facts);
  const bestScore = scored[0]?.score ?? 0;
  const top = scored.filter((candidate) => candidate.score === bestScore);
  return top[getAnswerHash(answers) % top.length]?.name ?? 'Человек-паук';
}

export function hasNextQuestion(answers: string[]) {
  if (!answers[0]) return true;
  const { answeredKeys, facts } = getGameState(answers);
  return Boolean(getSmartQuestion(facts, answeredKeys));
}

export function getSmartQuestion(facts: Facts, answeredKeys: Set<FactKey>) {
  const pool = getScoredCandidates(facts).slice(0, 18);
  const questions = getQuestionList(facts).filter(([key]) =>
    shouldAskQuestion(key, facts, answeredKeys),
  );

  const ranked = questions
    .map((question) => ({
      question,
      score: getQuestionScore(question[0], pool),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.question ?? null;
}

export function getGameState(answers: string[]) {
  const facts: Facts = { real: isPositiveAnswer(answers[0] ?? '') };
  const answeredKeys = new Set<FactKey>();

  answers.slice(1).forEach((answer) => {
    const question = getSmartQuestion(facts, answeredKeys);
    if (!question) return;

    const [key] = question;
    answeredKeys.add(key);
    if (isPositiveAnswer(answer)) facts[key] = true;
    if (isNegativeAnswer(answer)) facts[key] = false;
  });

  return { answeredKeys, facts };
}

function getScoredCandidates(facts: Facts) {
  const pool = getCandidatePool(facts);
  return pool
    .map((candidate) => ({
      name: candidate.name,
      facts: candidate.facts,
      score: getScore(candidate.facts, facts),
    }))
    .sort((a, b) => b.score - a.score);
}

function getCandidatePool(facts: Facts) {
  const possibleCandidates = candidates.filter((candidate) =>
    matchesHardFacts(candidate.facts, facts),
  );
  if (possibleCandidates.length > 0) return possibleCandidates;

  const strictCandidates = candidates.filter((candidate) =>
    matchesStrictPositiveFacts(candidate.facts, facts),
  );

  return strictCandidates.length > 0 ? strictCandidates : candidates;
}

function getQuestionScore(key: FactKey, pool: Array<{ facts: Facts }>) {
  const yesCount = pool.filter((candidate) => candidate.facts[key] === true).length;
  const noCount = pool.filter((candidate) => candidate.facts[key] === false).length;
  return Math.min(yesCount, noCount) * 3 + yesCount + noCount;
}

function matchesHardFacts(candidateFacts: Facts, playerFacts: Facts) {
  return hardFacts.every((key) => {
    const playerValue = playerFacts[key];
    const candidateValue = candidateFacts[key];

    if (playerValue === true && strictPositiveFacts.includes(key)) {
      return candidateValue === true;
    }
    return (
      playerValue === undefined ||
      candidateValue === undefined ||
      playerValue === candidateValue
    );
  });
}

function matchesStrictPositiveFacts(candidateFacts: Facts, playerFacts: Facts) {
  return strictPositiveFacts.every((key) =>
    playerFacts[key] !== true || candidateFacts[key] === true,
  );
}

function isPositiveAnswer(answer: string) { return positiveAnswers.includes(answer); }

function isNegativeAnswer(answer: string) { return negativeAnswers.includes(answer); }

function getScore(candidateFacts: Facts, playerFacts: Facts) {
  return Object.entries(playerFacts).reduce((score, [key, value]) => {
    const factKey = key as FactKey;
    const candidateValue = candidateFacts[factKey];
    if (candidateValue === undefined) return score - 2;
    return candidateValue === value ? score + getFactWeight(factKey) : score - 6;
  }, 0);
}

function getFactWeight(key: FactKey) {
  if (regionFacts.includes(key)) return 6;
  return detailFacts.includes(key) ? 5 : professionFacts.includes(key) ? 4 : 3;
}

function getAnswerHash(answers: string[]) {
  return answers.join('|').split('').reduce((sum, letter) => {
    return sum + letter.charCodeAt(0);
  }, 0);
}

const hardFacts: FactKey[] = [
  'real', 'alive', 'kz', 'almaty', 'teen', 'usa', 'europe', 'asia', 'latin', 'middleEast',
  'football', 'basketball', 'boxing', 'tennis', 'racing', 'game', 'anime',
  'sport', 'music', 'actor', 'internet', 'business', 'politics', 'science',
  'writer', 'model', 'director', 'tiktok', 'streamer',
];
const professionFacts: FactKey[] = [
  'sport', 'music', 'actor', 'internet', 'business', 'politics', 'science',
  'writer', 'model', 'director',
];

const strictPositiveFacts: FactKey[] = [
  ...hardFacts,
  'rap', 'qpop', 'kpop', 'crypto', 'youtube', 'award', 'screen', 'book',
  'superheroUniverse', 'magic', 'super', 'animal',
];

const regionFacts: FactKey[] = ['real', 'alive', 'kz', 'almaty', 'usa', 'europe', 'asia', 'latin'];
const detailFacts: FactKey[] = [
  'teen', 'football', 'basketball', 'boxing', 'tennis', 'youtube', 'tiktok',
  'streamer', 'qpop',
];

const positiveAnswers = [
  'точно да',
  'скорее да',
  'может быть да',
  'да',
  'да, точно',
  'похоже на да',
];

const negativeAnswers = [
  'может быть нет',
  'скорее нет',
  'точно нет',
  'нет',
  'скорее мимо',
];
