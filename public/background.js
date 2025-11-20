// 延迟初始化，避免阻塞启动
chrome.runtime.onStartup.addListener(() => {
  setTimeout(addCookiesChangeEvent, 1000);
});

chrome.runtime.onInstalled.addListener(() => {
  setTimeout(addCookiesChangeEvent, 1000);
});

let isOpenSyncCache = true;
let domainListCache = null;

function addCookiesChangeEvent() {
  // 预缓存配置
  chrome.storage.local.get(["isOpenSync", "domainList"]).then((result) => {
    isOpenSyncCache = result.isOpenSync ?? true;
    domainListCache = result.domainList;
  });

  chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    if (!isOpenSyncCache) return;
    if (!domainListCache) return;

    const targetDomain = Object.values(domainListCache).find((item) =>
      equalDomain(item.from, cookie.domain)
    );

    if (!targetDomain?.cookies) return;

    const cookiesArray = Object.values(targetDomain.cookies);
    const targetCookie = cookiesArray.find((item) => item.name === cookie.name);

    if (targetCookie) {
      removed
        ? removeCookie(cookie, targetCookie)
        : setCookie(cookie, targetCookie);
    }
  });

  // 定期更新缓存
  setInterval(() => {
    chrome.storage.local.get(["isOpenSync", "domainList"]).then((result) => {
      isOpenSyncCache = result.isOpenSync ?? true;
      domainListCache = result.domainList;
    });
  }, 30000);
}

function setCookie(cookie, config) {
  const url = config.to || "url";
  return chrome.cookies.set({
    url: url.startsWith("http") ? url : `http://${url}`,
    domain: url.startsWith("http")
      ? url.replace("http://", "").replace("https://", "")
      : url,
    name: cookie.name,
    path: "/",
    value: cookie.value,
  });
}

function removeCookie(cookie, config) {
  const url = config.to || "url";
  chrome.cookies.remove({
    url: url.startsWith("http") ? url : `http://${url}`,
    name: cookie.name,
  });
}

function equalDomain(domain1, domain2) {
  const normalize = (uri) => (uri.startsWith("http") ? uri : `http://${uri}`);
  return normalize(domain1) === normalize(domain2);
}
