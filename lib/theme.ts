export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'kusanya-theme';

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function applyTheme(pref: ThemePreference) {
  const resolved =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : pref;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function setThemePreference(pref: ThemePreference) {
  if (pref === 'system') {
    window.localStorage.removeItem(KEY);
  } else {
    window.localStorage.setItem(KEY, pref);
  }
  applyTheme(pref);
}