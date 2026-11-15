import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  // The service account JSON is stored base64-encoded in one env var.
  const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT!.trim(), "base64").toString("utf8");
  return initializeApp({ credential: cert(JSON.parse(json)) });
}

export function db() {
  return getFirestore(app());
}
