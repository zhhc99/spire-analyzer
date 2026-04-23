export const API_ROOT = 'https://spire-codex.com/api';
export const API_ORIGIN = 'https://spire-codex.com';
export const SUPPORTED_LOCALES = ['zh', 'en'];
export const API_LANGUAGE_BY_LOCALE = {
  zh: 'zhs',
  en: 'eng',
};

export const CHARACTER_ID_TO_SLUG = {
  IRONCLAD: 'ironclad',
  SILENT: 'silent',
  DEFECT: 'defect',
  NECROBINDER: 'necrobinder',
  REGENT: 'regent',
};

export const CHARACTER_THEME = {
  ironclad: '#ffb4a4',
  silent: '#c2d4a2',
  defect: '#8dd0ea',
  necrobinder: '#d0bcff',
  regent: '#ffba58',
};

export const COMBAT_ROOM_TYPES = new Set(['monster', 'elite', 'boss']);
