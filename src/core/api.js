import { API_LANGUAGE_BY_LOCALE, API_ORIGIN, API_ROOT } from './config.js';

const bundleCache = new Map();

function buildMap(items) {
  return new Map(items.map(item => [String(item.id).toUpperCase(), item]));
}

async function fetchJson(path, params) {
  const url = new URL(`${API_ROOT}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

async function loadBundle(language) {
  const cached = bundleCache.get(language);
  if (cached) return cached;
  const promise = Promise.allSettled([
    fetchJson('/cards', { lang: language }),
    fetchJson('/relics', { lang: language }),
    fetchJson('/potions', { lang: language }),
    fetchJson('/encounters', { lang: language }),
    fetchJson('/events', { lang: language }),
    fetchJson('/characters', { lang: language }),
    fetchJson('/acts', { lang: language }),
  ]).then(results => {
    const [cards, relics, potions, encounters, events, characters, acts] = results;
    const errors = [];
    if (cards.status === 'rejected') errors.push(cards.reason?.message || 'cards');
    if (relics.status === 'rejected') errors.push(relics.reason?.message || 'relics');
    if (potions.status === 'rejected') errors.push(potions.reason?.message || 'potions');
    if (encounters.status === 'rejected') errors.push(encounters.reason?.message || 'encounters');
    if (events.status === 'rejected') errors.push(events.reason?.message || 'events');
    if (characters.status === 'rejected') errors.push(characters.reason?.message || 'characters');
    if (acts.status === 'rejected') errors.push(acts.reason?.message || 'acts');
    return {
      cards: buildMap(cards.status === 'fulfilled' ? cards.value : []),
      relics: buildMap(relics.status === 'fulfilled' ? relics.value : []),
      potions: buildMap(potions.status === 'fulfilled' ? potions.value : []),
      encounters: buildMap(encounters.status === 'fulfilled' ? encounters.value : []),
      events: buildMap(events.status === 'fulfilled' ? events.value : []),
      characters: buildMap(characters.status === 'fulfilled' ? characters.value : []),
      acts: buildMap(acts.status === 'fulfilled' ? acts.value : []),
      errors,
    };
  });
  bundleCache.set(language, promise);
  return promise;
}

function imageUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}

export async function loadCodex(locale) {
  const primaryLanguage = API_LANGUAGE_BY_LOCALE[locale] || 'eng';
  const [primary, fallback] = await Promise.all([
    loadBundle(primaryLanguage),
    primaryLanguage === 'eng' ? loadBundle('eng') : loadBundle('eng'),
  ]);
  return {
    primary,
    fallback,
    warning: primary.errors.length ? primaryLanguage === 'eng' ? 'fallback' : 'english' : null,
  };
}

export function readCard(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.cards.get(key) || codex.fallback.cards.get(key) || null;
}

export function readRelic(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.relics.get(key) || codex.fallback.relics.get(key) || null;
}

export function readPotion(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.potions.get(key) || codex.fallback.potions.get(key) || null;
}

export function readEncounter(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.encounters.get(key) || codex.fallback.encounters.get(key) || null;
}

export function readEvent(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.events.get(key) || codex.fallback.events.get(key) || null;
}

export function readCharacter(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.characters.get(key) || codex.fallback.characters.get(key) || null;
}

export function readAct(codex, id) {
  const key = String(id || '').toUpperCase();
  return codex.primary.acts.get(key) || codex.fallback.acts.get(key) || null;
}

export { imageUrl };
