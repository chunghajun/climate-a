"use client";

import { useEffect, useState } from "react";

export type BrowserEnv = "loading" | "inapp" | "ios-browser" | "unsupported" | "ok";

// Where is the page open? Push only works in a real browser, and on iPhone only from the home-screen app.
export function useBrowserEnv() {
  const [env, setEnv] = useState<BrowserEnv>("loading");
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    let next: BrowserEnv = "ok";
    if (/KAKAOTALK|Instagram|NAVER|FBAN|FBAV|Line\//i.test(ua)) next = "inapp";
    else if (isIOS && !standalone) next = "ios-browser";
    else if (!("serviceWorker" in navigator) || !("PushManager" in window)) next = "unsupported";
    // Detecting the browser has to happen after mount, so set state from the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv(next);
  }, []);
  return env;
}
