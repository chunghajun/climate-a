// Creates tester codes in Firestore and appends them to tester-codes.txt.
// Usage: node --env-file=.env.local scripts/make-codes.mjs <count> <label>
//   e.g. node --env-file=.env.local scripts/make-codes.mjs 15 tester
import { appendFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const count = Number(process.argv[2] ?? 1);
const label = process.argv[3] ?? "tester";

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT.trim(), "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// No 0/O/1/I/L so codes are easy to read aloud and type.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const randomCode = () => "CM-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const made = [];
while (made.length < count) {
  const code = randomCode();
  const ref = db.collection("testers").doc(code);
  if ((await ref.get()).exists) continue;
  await ref.set({ label, consentAt: null, defaultTravelMin: 30, createdAt: FieldValue.serverTimestamp() });
  made.push(code);
}

appendFileSync("tester-codes.txt", made.map((c) => `${c}\t${label}`).join("\n") + "\n");
console.log(`${made.length} codes (${label}) written to tester-codes.txt`);
