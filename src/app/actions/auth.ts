"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { SESSION_COOKIE, getTester, logEvent, testerRef } from "@/lib/data";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  let code = String(formData.get("code") ?? "")
    .toUpperCase()
    .replace(/\s/g, "");
  if (!code.startsWith("CM-")) code = `CM-${code}`;

  const snap = await testerRef(code).get();
  if (!snap.exists) return { error: "코드를 찾을 수 없어요. 다시 확인해 주세요." };

  await setSession(code);
  await logEvent(code, "login");
  redirect(snap.data()!.consentAt ? "/" : "/consent");
}

// No code needed: make a fresh tester code and sign in with it.
export async function startNew() {
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let tries = 0; tries < 5; tries++) {
    const candidate = "CM-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    try {
      await testerRef(candidate).create({
        label: "self",
        consentAt: null,
        defaultTravelMin: 30,
        createdAt: FieldValue.serverTimestamp(),
      });
      code = candidate;
      break;
    } catch {
      // Taken; try another.
    }
  }
  if (!code) throw new Error("코드 생성 실패");
  await setSession(code);
  await logEvent(code, "signup");
  redirect("/consent");
}

async function setSession(code: string) {
  (await cookies()).set(SESSION_COOKIE, code, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

export async function giveConsent() {
  const tester = await getTester();
  if (!tester) redirect("/");
  await testerRef(tester.code).update({ consentAt: FieldValue.serverTimestamp() });
  await logEvent(tester.code, "consent");
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
