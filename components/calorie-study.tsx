"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleCheck, LogOut } from "lucide-react";
import Image from "next/image";
import type { Assistant, CalorieStudyView, Condition, MealView } from "@/lib/calorie-config";

export function CalorieStudy({ condition, route }: { condition: Condition; route: string }) {
  const [study, setStudy] = useState<CalorieStudyView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [instructionsRead, setInstructionsRead] = useState(false);
  const lock = useRef(false);
  const request = useCallback(async (body?: object): Promise<CalorieStudyView> => {
    const response = await fetch(`/api/study/${route}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign(`/login?condition=${route}`);
      throw new Error("Please sign in.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Study could not be loaded.");
    return result;
  }, [route]);
  useEffect(() => { request().then(setStudy).catch(e => setError(e.message)); }, [request]);
  async function act(body: object) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await request(body);
      setStudy(result);
      return result;
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="study-shell">
    <header className="study-header calorie-header">
      <span className="study-brand"><span className="brand-mark"><Image src="/food.png" alt="" width={25} height={25}/></span>Calorie Lens</span>
      <div className="participant-menu"><span><small>Participant</small>{study?.participantId ?? "…"}</span>
        <button aria-label="Sign out" disabled={busy} onClick={async () => {
          const res = await fetch("/api/auth/logout", { method: "POST" });
          if (res.ok) window.location.assign(`/login?condition=${route}`);
          else setError("Sign out failed. Please try again.");
        }}><LogOut size={18}/></button></div>
    </header>
    <div className="study-content calorie-content">
      {error && <div role="alert" className="form-error">{error} <button type="button" onClick={() => window.location.reload()}>Reload study</button></div>}
      {!study ? <p role="status">Loading your study…</p> : study.complete ? <StudyComplete participantId={study.participantId}/> : !study.attentionPassed ? <>
        <StudyInstructions condition={condition} total={study.total}/>
        {!instructionsRead ? <>
          <PracticeTrial condition={condition}/>
          <div className="start-panel"><div><span>Ready to begin?</span><h2>Continue to a quick attention check, then your meals.</h2></div><button className="primary-button" onClick={() => setInstructionsRead(true)}>Continue to attention check</button></div>
        </> : <AttentionCheck busy={busy} onAnswer={async answer => {
          const result = await act({ action: "attention", answer });
          return result ? result.attentionPassed : null;
        }}/>}
      </> : study.current ? <MealTrial key={study.current.id} meal={study.current} total={study.total} condition={condition} busy={busy} onAction={act}/> : <p>Unable to load your next meal. Please reload the study.</p>}
    </div>
  </main>;
}
export function StudyInstructions({ condition, total }: { condition: Condition; total: number }) {
  return <section className="instructions-page calorie-instructions" aria-labelledby="instruction-title">
    <span className="section-kicker">Before you begin · {total} meals</span>
    <h1 id="instruction-title">Estimate the calories in each meal</h1>
    <p>You will be shown several images of meals. For each meal, estimate the total number of calories contained in the meal.</p>
    {condition === "ai" && <p>You may choose to consult an AI assistant. The assistant will provide an estimated calorie total and a breakdown of the ingredients it believes are present. The AI may be incorrect, so use the information however you think is appropriate.</p>}
    <p>{condition === "ai" ? "Enter your final estimate" : "Enter your best estimate in calories"} and rate how confident you are in your answer.</p>
    <p>{condition === "ai" ? "Please do not use external resources." : "Please make your best estimate without using external resources."}</p>
    <div className="instruction-steps calorie-steps">
      <div><span>01</span><p><strong>Look at the whole meal</strong>Estimate the total calories for everything shown in the image.</p></div>
      <div><span>02</span><p><strong>{condition === "ai" ? "Use the assistant if you choose" : "Enter your best estimate"}</strong>{condition === "ai" ? "Select Consult AI Assistant to reveal its estimate. You can revise your answer before submitting, or continue without consulting." : "Type a non-negative number in the calories field. There is no time limit."}</p></div>
      <div><span>03</span><p><strong>Rate your confidence and submit</strong>Choose 1 (not at all confident) to 5 (very confident). You can edit your answer until you submit; submitted answers cannot be changed.</p></div>
    </div>
    <p>Work at your own pace. After all {total} meals, you will see a confirmation that your responses have been saved.</p>
  </section>;
}

const practiceMeal: MealView = {
  id: "practice", trialId: "practice", dishId: "practice", image: "/practice-meal.svg",
  position: 1, startedAt: null, consultedAt: null, initialEstimate: null
};
const practiceAssistant: Assistant = {
  total: 620,
  ingredients: [{ name: "Chicken", grams: 120, kcal: 200 }, { name: "Rice", grams: 180, kcal: 235 },
    { name: "Vegetables", grams: 100, kcal: 45 }, { name: "Oil or dressing", grams: 16, kcal: 140 }]
};

function PracticeTrial({ condition }: { condition: Condition }) {
  const [meal, setMeal] = useState<MealView>(practiceMeal);
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <section className="practice-section" aria-labelledby="practice-title">
    <div className="section-heading"><div><span className="section-kicker">Get familiar with the interface</span><h2 id="practice-title">Try a practice meal</h2></div></div>
    <p>This optional example uses an illustration, rather than a study meal. Try entering an estimate and selecting confidence{condition === "ai" ? ", and explore the AI panel if you wish" : ""}. Practice answers are not saved or counted toward your study meals.</p>
    {condition === "ai" && <p>The practice assistant uses made-up values to demonstrate the panel. They are not a correct answer or a guide for estimating other meals.</p>}
    {submitted ? <div className="calorie-card" role="status"><h3>Practice complete</h3><p>That is how you submit a meal estimate. Your practice answer was not recorded. The study will not show a correct answer after submission.</p><button className="secondary-button" onClick={() => { setMeal(practiceMeal); setSubmitted(false); setAttempt(n => n + 1); }}>Try practice again</button></div> :
      <MealTrial key={attempt} meal={meal} total={1} condition={condition} busy={false} practice onAction={async body => {
        const action = body as { action: string; estimate?: number | null };
        if (action.action === "start") setMeal(current => ({ ...current, startedAt: current.startedAt ?? new Date().toISOString() }));
        if (action.action === "consult") setMeal(current => current.assistant ? current : {
          ...current, assistant: practiceAssistant, consultedAt: new Date().toISOString(), initialEstimate: action.estimate ?? null
        });
        if (action.action === "submit") setSubmitted(true);
        return undefined;
      }}/>
    }
  </section>;
}
export function AttentionCheck({ busy, onAnswer }: { busy: boolean; onAnswer: (answer: string) => Promise<boolean | null> }) {
  const [answer, setAnswer] = useState("");
  const [failed, setFailed] = useState(false);
  return <form className="calorie-card auth-form" onSubmit={async e => {
    e.preventDefault(); const passed = await onAnswer(answer);
    if (passed === false) { setFailed(true); setAnswer(""); }
  }}><fieldset disabled={busy}><legend>In this study, what are you estimating?</legend>
    {["Protein", "Price", "Calories", "Cooking time"].map(option => <label className="attention-option" key={option}><input type="radio" name="attention" value={option} checked={answer === option} onChange={() => setAnswer(option)} required/>{option}</label>)}
  </fieldset>{failed && <p role="alert" className="form-error">Please review the instructions above: you are estimating total calories. Then try again.</p>}
    <button className="primary-button" disabled={busy || !answer}>{busy ? "Saving…" : "Check answer and begin"}</button>
  </form>;
}
function parseEstimate(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
}
export function MealTrial({ meal, total, condition, busy, onAction, practice = false }: {
  meal: MealView; total: number; condition: Condition; busy: boolean;
  practice?: boolean;
  onAction: (body: object) => Promise<CalorieStudyView | undefined>;
}) {
  const [estimate, setEstimate] = useState(meal.initialEstimate?.toString() ?? "");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  async function start() {
    setLoaded(true);
    if (!meal.startedAt) await onAction({ action: "start", responseId: meal.id });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseEstimate(estimate);
    if (value === null || !confidence || !loaded || !meal.startedAt || busy) return;
    await onAction({ action: "submit", responseId: meal.id, estimate: value, confidence });
  }
  return <section aria-labelledby="meal-title">
    <div className="task-topline"><div><span className="section-kicker">{practice ? "Interface preview · not recorded" : "Your task"}</span>{practice ? <h3 id="meal-title">Practice meal</h3> : <h1 id="meal-title">Meal {meal.position} of {total}</h1>}</div>{!practice && <span>{meal.position - 1} completed</span>}</div>
    {!practice && <progress className="meal-progress" value={meal.position - 1} max={total} aria-label="Study progress"/>}
    <div className="label-workspace meal-workspace">
      <div className="meal-photo">
        {/* Native image keeps image-ready timing explicit and avoids deferred loading. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={meal.image} alt={practice ? "Illustrated practice meal with chicken, rice, and vegetables" : `Meal to estimate, trial ${meal.position}`} onLoad={() => void start()} onError={() => setImageFailed(true)}/>
        {imageFailed && <p role="alert">The meal image could not load. Please reload before answering.</p>}
      </div>
      <form className="label-fieldset auth-form" onSubmit={submit}>
        <label htmlFor="calories">How many calories do you estimate are in this meal?</label>
        <div><input id="calories" type="number" inputMode="decimal" min="0" step="any" required value={estimate} onChange={e => setEstimate(e.target.value)} disabled={busy || !loaded || imageFailed}/><span> calories</span></div>
        {condition === "ai" && <>
          <button type="button" className="secondary-button consult-button" disabled={busy || !loaded || !meal.startedAt || imageFailed} onClick={() => void onAction({ action: "consult", responseId: meal.id, estimate: parseEstimate(estimate) })}>{meal.assistant ? "AI Assistant consulted" : "Consult AI Assistant"}</button>
          {meal.assistant && <AIAssistantPanel assistant={meal.assistant}/>}
        </>}
        <ConfidenceRating value={confidence} onChange={setConfidence} disabled={busy || !loaded || imageFailed}/>
        {loaded && !meal.startedAt && <button type="button" disabled={busy} onClick={() => void start()}>Retry starting trial</button>}
        <button className="primary-button" disabled={busy || !loaded || !meal.startedAt || imageFailed || parseEstimate(estimate) === null || confidence === null}>{busy ? "Saving…" : practice ? "Submit practice estimate" : meal.position === total ? "Submit final estimate" : "Submit and next meal"}</button>
      </form>
    </div>
  </section>;
}
export function AIAssistantPanel({ assistant }: { assistant: Assistant }) {
  return <aside className="assistant-panel" aria-label="AI Assistant" aria-live="polite"><h2>AI Assistant</h2><p><strong>Estimated total: {assistant.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} calories</strong></p><h3>Estimated ingredients</h3><ul>{assistant.ingredients.map((ingredient, index) => <li key={index}>{ingredient.name} — {ingredient.kcal.toLocaleString()} cal{ingredient.grams != null ? ` (${ingredient.grams} g)` : ""}</li>)}</ul><p>The AI may be incorrect.</p></aside>;
}
export function ConfidenceRating({ value, onChange, disabled }: { value: number | null; onChange: (value: number) => void; disabled: boolean }) {
  return <fieldset className="confidence-field" disabled={disabled}><legend>How confident are you in your calorie estimate?</legend><div className="confidence-options">{[1,2,3,4,5].map(n => <label key={n} className={value === n ? "selected" : ""}><input type="radio" name="confidence" value={n} checked={value === n} onChange={() => onChange(n)} required/><span>{n}</span></label>)}</div><div className="confidence-anchors"><span>1 — Not at all confident</span><span>5 — Very confident</span></div></fieldset>;
}
export function StudyComplete({ participantId }: { participantId: string }) {
  return <section className="completion-page completion-hero"><div className="complete-icon"><CircleCheck size={40}/></div><span className="section-kicker">Study complete</span><h1>Thank you for participating.</h1><p>Your estimates have been saved. You may now close this page.</p><p>Participant: {participantId}</p></section>;
}
