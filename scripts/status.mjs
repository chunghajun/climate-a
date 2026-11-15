import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT.trim(), "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const c = (await db.collection("system").doc("cron").get()).data();
console.log("cron:", c ? `${c.lastRun.toDate().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} testers=${c.testers} due=${c.due} sent=${c.sent}` : "아직 실행 기록 없음");
console.log("now:", new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}));
const ts = await db.collection("testers").get();
for (const t of ts.docs) { if (!t.data().consentAt) continue; const [e,p,s] = await Promise.all(["events","places","subscriptions"].map(x=>t.ref.collection(x).get())); console.log(t.data().label, "events", e.size, "places", p.size, "subs", s.size); }
