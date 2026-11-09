/** Locale plumbing. English is the only shipped locale; add a Hebrew bundle and flip `dir` to "rtl". */
export const locales = {
  en: { lang: "en", dir: "ltr" },
  // he: { lang: "he", dir: "rtl" },
} as const;

export type LocaleKey = keyof typeof locales;
export const defaultLocale: LocaleKey = "en";
export const activeLocale = locales[defaultLocale];
