export default function useI18n() {
  const t = (key: string, substitutions?: string | string[]) => {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }
    // Fallback for development environment or if key not found
    return key;
  };

  return {
    t
  };
}
