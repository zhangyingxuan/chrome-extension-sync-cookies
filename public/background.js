addCookiesChangeEvent();

function addCookiesChangeEvent() {
  console.log("start addCookiesChangeEvent");
  chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    // 判断是否开启同步
    const openSyncObj = await chrome.storage.local.get("isOpenSync");
    const isOpenSync = openSyncObj.isOpenSync;

    if (!isOpenSync) return;

    const storage = await chrome.storage.local.get(["domainList"]);

    if (Object.keys(storage).length === 0) return;
    const domainList = Object.values(storage["domainList"]);

    // 需要更新的域名
    const targetDomain = domainList.find((item) => {
      // 域名匹配
      return equalDomain(item.from, cookie.domain);
    });

    if (!targetDomain || !targetDomain.cookies) return;

    // 需要更新的 cookie
    targetDomain.cookies = Object.keys(targetDomain.cookies).map(
      (key) => targetDomain.cookies[key]
    );
    const targetCookie = targetDomain.cookies.find((item) => {
      return item.name === cookie.name;
    });

    if (targetCookie) {
      if (removed) {
        removeCookie(cookie, targetCookie);
      } else {
        setCookie(cookie, targetCookie);
      }
    }
  });
}

function setCookie(cookie, config) {
  return chrome.cookies.set({
    url: addProtocol(config.to || "url"),
    domain: removeProtocol(config.to || "url"),
    name: cookie.name,
    path: "/",
    value: cookie.value,
  });
}

function removeCookie(cookie, config) {
  chrome.cookies.remove({
    url: addProtocol(config.to || "url"),
    name: cookie.name,
  });
}

// 增加协议头
function addProtocol(uri) {
  return uri.startsWith("http") ? uri : `http://${uri}`;
}

// 移除协议头
function removeProtocol(uri) {
  return uri.startsWith("http")
    ? uri.replace("http://", "").replace("https://", "")
    : uri;
}

function equalDomain(domain1, domain2) {
  return addProtocol(domain1) === addProtocol(domain2);
}
