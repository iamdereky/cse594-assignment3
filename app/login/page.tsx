"use client";

import Image from "next/image";
import { ArrowRight, LoaderCircle, UserRoundPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function destination() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next === "/study/ai" || next === "/study/no-ai" ? next : "/study/no-ai";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me").then((response) => {
      if (response.ok) router.replace(destination());
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username") })
    }).catch(() => null);

    if (!response) {
      setError("The service could not be reached. Please try again.");
      setBusy(false);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    router.replace(destination());
    router.refresh();
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="auth-shell">
      <section className="auth-context" aria-labelledby="study-title">
        <span className="wordmark" aria-label="Calorie Lens">
          <span className="wordmark-mark"><Image src="/emotion-examiner-icon.png" alt="" width={25} height={25} priority /></span>
          <span>Calorie Lens</span>
        </span>

        <div className="context-copy">
          <span className="eyebrow">Meal estimation study</span>
          <h1 id="study-title">Estimate each meal’s calories</h1>
          <p>
            You’ll view images of meals and estimate their total calories.
            Your responses help us understand how people estimate meal calories.
          </p>
        </div>

        <div className="study-facts" aria-label="Study details">
          <div><strong>Meals</strong><span>Calorie estimates</span></div>
          <div><strong>1–5</strong><span>Confidence</span></div>
          <div><strong>You</strong><span>Set the pace</span></div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Participant access">
        <div className="auth-card">
          <div className="mode-tabs" role="tablist" aria-label="Account access">
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")} role="tab" aria-selected={mode === "register"}>Create account</button>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")} role="tab" aria-selected={mode === "login"}>Sign in</button>
          </div>

          <div className="auth-heading">
            <span className="icon-tile"><UserRoundPlus size={22} /></span>
            <div>
              <h2>{mode === "login" ? "Continue your task" : "Choose a username"}</h2>
              <p>{mode === "login" ? "Enter the private username you chose earlier." : "Use one unique username for this study."}</p>
            </div>
          </div>

          <form onSubmit={submit} className="auth-form">
            <label>
              Username
              <input name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" placeholder="your_username" required disabled={busy} />
              {mode === "register" && <small>3–24 letters, numbers, or underscores</small>}
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? <><LoaderCircle className="spin" size={19} /> Working…</> : <>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={19} /></>}
            </button>
          </form>

          <div className="auth-note">
            <strong>{mode === "login" ? "Use the same username." : "Keep your username private."}</strong>
            <span>{mode === "login" ? "This reconnects you to your assigned meals and saved responses." : "Save it in case you need to return. The researcher uses your random participant ID."}</span>
          </div>
        </div>
        <p className="privacy-line">Your username is private. Your responses are saved under a random participant ID.</p>
      </section>
    </main>
  );
}
