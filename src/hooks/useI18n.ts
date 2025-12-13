import { ref } from 'vue';

const locale = ref('zh_CN');
const messages = ref<Record<string, any>>({});
const loadedLocales = new Set<string>();

export const SUPPORTED_LOCALES = [
  { label: '简体中文', value: 'zh_CN' },
  { label: '繁體中文', value: 'zh_TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' }
];

export default function useI18n() {

  const loadLocaleMessages = async (lang: string) => {
    if (loadedLocales.has(lang)) return;

    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      const response = await fetch(url);
      const data = await response.json();
      messages.value[lang] = data;
      loadedLocales.add(lang);
    } catch (e) {
      console.error(`Failed to load locale: ${lang}`, e);
    }
  };

  const setLocale = async (lang: string) => {
    const supported = SUPPORTED_LOCALES.find(l => l.value === lang);
    if (!supported) return;

    await loadLocaleMessages(lang);
    locale.value = lang;

    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ 'app_locale': lang });
    }
  };

  const t = (key: string, substitutions?: string | string[]) => {
    const currentLang = locale.value;
    const langMessages = messages.value[currentLang];

    if (langMessages && langMessages[key]) {
      const item = langMessages[key];
      let msg = item.message;
      const placeholders = item.placeholders;

      if (placeholders) {
        for (const [phKey, phVal] of Object.entries(placeholders)) {
          const placeholderToken = `$${phKey.toUpperCase()}$`;
          // Escape $ for regex
          const escapedToken = placeholderToken.replace(/\$/g, '\\$');
          msg = msg.replace(new RegExp(escapedToken, 'g'), (phVal as any).content);
        }
      }

      if (substitutions) {
        const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
        // Use a single pass replacement to avoid recursive replacement issues
        // Match $1, $2, etc.
        msg = msg.replace(/\$(\d+)/g, (match: string, number: string) => {
          const index = parseInt(number, 10) - 1;
          if (index >= 0 && index < subs.length) {
            return subs[index];
          }
          return match;
        });
      }
      return msg;
    }

    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }

    return key;
  };

  const init = async () => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    // 1. 获取本地存储的 locale
    const data = await chrome.storage.local.get('app_locale');
    let targetLocale = data.app_locale;

    // 2. 如果没有，获取浏览器的 locale
    if (!targetLocale) {
      const uiLang = chrome.i18n.getUILanguage();
      targetLocale = uiLang.replace('-', '_');

      if (targetLocale.startsWith('en')) targetLocale = 'en';
      else if (targetLocale.startsWith('ja')) targetLocale = 'ja';
      else if (targetLocale === 'zh') targetLocale = 'zh_CN';

      // Check if supported
      if (!SUPPORTED_LOCALES.find(l => l.value === targetLocale)) {
        targetLocale = 'zh_CN';
      }
    }

    await setLocale(targetLocale);
  };

  return {
    locale,
    setLocale,
    t,
    init,
    SUPPORTED_LOCALES
  };
}
