"use client";

import { useFormStatus } from "react-dom";
import { btnPrimary } from "./ui";

export default function SubmitButton({ children, className = btnPrimary }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "잠시만요…" : children}
    </button>
  );
}
