import type { FactKey, Facts } from './demoAkinatorTypes';

export const realQuestions: Array<[FactKey, string]> = [
  ['alive', 'Эта личность сейчас жива?'],
  ['kz', 'Есть заметная связь с Казахстаном?'],
  ['almaty', 'Этот человек или типаж связан с Алматы?'],
  ['teen', 'Это подросток или человек, популярный именно среди подростков?'],
  ['usa', 'Главная известность пришла из США?'],
  ['europe', 'Эта знаменитость из Европы?'],
  ['asia', 'Корни или карьера связаны с Азией?'],
  ['latin', 'Это имя из Латинской Америки?'],
  ['middleEast', 'Есть связь с Турцией или Ближним Востоком?'],
  ['sport', 'Главная слава пришла через спорт?'],
  ['football', 'Это футбольная звезда?'],
  ['basketball', 'Это имя из мира баскетбола?'],
  ['boxing', 'Этот человек связан с боксом?'],
  ['tennis', 'Это теннисная легенда или звезда?'],
  ['racing', 'Скорость и гонки тут важны?'],
  ['music', 'Главная сцена этого человека - музыка?'],
  ['rap', 'Это рэп или хип-хоп?'],
  ['qpop', 'Это Q-pop или современная казахстанская поп-сцена?'],
  ['kpop', 'Это K-pop феномен?'],
  ['actor', 'Его/ее знают по кино или сериалам?'],
  ['director', 'Этот человек больше создает фильмы, чем играет в них?'],
  ['award', 'У него/нее есть очень крупные награды или титулы?'],
  ['internet', 'Популярность сильно связана с интернетом?'],
  ['youtube', 'YouTube, стримы или короткие видео - важная часть славы?'],
  ['tiktok', 'TikTok или короткие видео тут очень важны?'],
  ['streamer', 'Это связано со стримами, играми или лайвами?'],
  ['model', 'Этот человек связан с модой или модельным бизнесом?'],
  ['business', 'Это бизнесмен, инвестор или основатель компании?'],
  ['crypto', 'Есть связь с криптовалютой или Web3?'],
  ['politics', 'Это политик или исторический правитель?'],
  ['science', 'Слава связана с наукой или технологиями?'],
  ['writer', 'Это писатель, поэт или мыслитель?'],
  ['dance', 'Танцы или яркие выступления - важная часть образа?'],
  ['male', 'Это мужчина?'],
  ['world', 'Это имя узнают во многих странах?'],
];

export const fictionQuestions: Array<[FactKey, string]> = [
  ['screen', 'Этот персонаж пришел из фильма, сериала или мультфильма?'],
  ['game', 'Его/ее мир начался с видеоигры?'],
  ['anime', 'Это персонаж из аниме или манги?'],
  ['book', 'Источник - книга или комикс?'],
  ['superheroUniverse', 'Это супергеройская вселенная вроде Marvel/DC?'],
  ['male', 'Персонаж мужского пола?'],
  ['hero', 'Этот персонаж скорее на стороне добра?'],
  ['magic', 'В его/ее мире важны магия, фэнтези или фантастика?'],
  ['super', 'Есть необычные силы или способности?'],
  ['animal', 'Внешне это не совсем обычный человек?'],
  ['world', 'Персонажа узнают далеко за пределами одной страны?'],
];

export function getNextQuestion(facts: Facts, answeredKeys: Set<FactKey>) {
  const questions = facts.real ? realQuestions : fictionQuestions;
  const nextQuestion = questions.find(([key]) =>
    shouldAskQuestion(key, facts, answeredKeys),
  );

  return nextQuestion ?? null;
}

export function getQuestionList(facts: Facts) {
  return facts.real ? realQuestions : fictionQuestions;
}

export function shouldAskQuestion(
  key: FactKey,
  facts: Facts,
  answeredKeys: Set<FactKey>,
) {
  if (answeredKeys.has(key)) return false;
  if (hasKnownRegion(facts) && isRegionKey(key)) return false;
  if (key === 'almaty' && facts.kz !== true) return false;
  if (key === 'football' && facts.sport !== true) return false;
  if (key === 'basketball' && facts.sport !== true) return false;
  if (key === 'boxing' && facts.sport !== true) return false;
  if (key === 'tennis' && facts.sport !== true) return false;
  if (key === 'racing' && facts.sport !== true) return false;
  if (key === 'rap' && facts.music !== true) return false;
  if (key === 'qpop' && facts.music !== true) return false;
  if (key === 'kpop' && facts.music !== true) return false;
  if (key === 'director' && facts.actor !== true) return false;
  if (key === 'crypto' && facts.business !== true) return false;
  if (key === 'youtube' && facts.internet !== true) return false;
  if (key === 'tiktok' && facts.internet !== true) return false;
  if (key === 'streamer' && facts.internet !== true) return false;
  if (key === 'award' && !hasPublicCareer(facts)) return false;
  if (key === 'superheroUniverse' && facts.book !== true && facts.screen !== true) return false;
  if (key === 'super' && !isFantasyLikely(facts)) return false;
  if (hasKnownProfession(facts) && isRootProfessionKey(key)) return false;

  return true;
}

function isRegionKey(key: FactKey) {
  return ['kz', 'usa', 'europe', 'asia', 'latin', 'middleEast'].includes(key);
}

function hasKnownRegion(facts: Facts) {
  return Boolean(
    facts.kz ||
      facts.usa ||
      facts.europe ||
      facts.asia ||
      facts.latin ||
      facts.middleEast,
  );
}

function isFantasyLikely(facts: Facts) {
  return Boolean(
    facts.magic ||
      facts.book ||
      facts.screen ||
      facts.anime ||
      facts.superheroUniverse,
  );
}

function hasPublicCareer(facts: Facts) {
  return Boolean(facts.sport || facts.music || facts.actor || facts.director);
}

function hasKnownProfession(facts: Facts) {
  return professionKeys.some((key) => facts[key] === true);
}

function isRootProfessionKey(key: FactKey) {
  return professionKeys.includes(key);
}

const professionKeys: FactKey[] = [
  'sport',
  'music',
  'actor',
  'internet',
  'model',
  'business',
  'politics',
  'science',
  'writer',
];
