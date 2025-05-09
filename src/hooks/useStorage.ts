import {
  ICookieTableDataSource,
  ICookie,
  TCookieConfig,
  LIST_KEY,
} from "../type";

// 增加协议头
function addProtocol(uri: string) {
  return uri.startsWith("http") ? uri : `http://${uri}`;
}

// 移除协议头
function removeProtocol(uri: string) {
  return uri.startsWith("http")
    ? uri.replace("http://", "").replace("https://", "")
    : uri;
}

const useStorage = () => {
  async function updateStorage(list: ICookieTableDataSource[]) {
    await chrome.storage.local.set({ [LIST_KEY]: list });
  }

  async function getStorage(key = LIST_KEY) {
    return await chrome.storage.local.get(key);
  }

  async function updateCookie(config: TCookieConfig) {
    try {
      let success: any = true;
      // 批量更新cookie
      if (config.cookies) {
        for (const cookie of config.cookies) {
          const cookieCache = await chrome.cookies.get({
            url: addProtocol(config.from || "url"),
            name: cookie.name,
          });
          success = cookieCache ? await setCookie(cookieCache, config) : false;
          if (!success) break;
        }
      }

      return success;
    } catch (error) {
      console.error("error: ", error);
      return false;
    }
  }

  function setCookie(cookie: ICookie, config: TCookieConfig) {
    return chrome.cookies.set({
      url: addProtocol(config.to || "url"),
      domain: removeProtocol(config.to || "url"),
      name: cookie.name,
      path: "/",
      value: cookie.value,
    });
  }

  return {
    updateStorage,
    getStorage,
    updateCookie,
  };
};

export default useStorage;
