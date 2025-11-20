import { ICookieTableDataSource, ICookie, TCookieConfig, LIST_KEY } from "../type";

const addProtocol = (uri: string) => uri.startsWith("http") ? uri : `http://${uri}`;
const removeProtocol = (uri: string) => uri.startsWith("http") ? uri.replace("http://", "").replace("https://", "") : uri;

const useStorage = () => ({
  updateStorage: (list: ICookieTableDataSource[]) => chrome.storage.local.set({ [LIST_KEY]: list }),
  getStorage: (key = LIST_KEY) => chrome.storage.local.get(key),
  updateStorageObj: (obj: any) => chrome.storage.local.set(obj),

  async updateCookie(config: TCookieConfig) {
    try {
      if (!config.cookies) return true;

      // 并行处理所有cookie操作，提高效率
      const promises = config.cookies.map(async (cookie) => {
        const cookieCache = await chrome.cookies.get({
          url: addProtocol(config.from || "url"),
          name: cookie.name,
        });
        if (!cookieCache) return false;

        return chrome.cookies.set({
          url: addProtocol(config.to || "url"),
          domain: removeProtocol(config.to || "url"),
          name: cookie.name,
          path: "/",
          value: cookie.value,
        });
      });

      const results = await Promise.all(promises);
      return results.every(result => result !== false);
    } catch (error) {
      console.error("error: ", error);
      return false;
    }
  }
});

export default useStorage;
