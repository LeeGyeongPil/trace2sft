import { en } from './en.js';
import { ko } from './ko.js';

export type Lang = 'en' | 'ko';
export type MessageKey = keyof typeof en;

export const messages: Record<Lang, Record<string, string>> = { en, ko };

/** Pick the language: --lang flag, then TRACE2SFT_LANG, then LC_ALL / LC_MESSAGES / LANG. Not Korean means English. */
export function resolveLang(flag: string | undefined, env: Record<string, string | undefined>): Lang {
  if (flag === 'en' || flag === 'ko') return flag;
  for (const key of ['TRACE2SFT_LANG', 'LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const v = env[key];
    if (v !== undefined && v !== '') return v.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }
  return 'en';
}

/** Look up a message and fill `{name}` placeholders. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const template = messages[lang][key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
