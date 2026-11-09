"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  ListChecks,
  LoaderCircle,
  LogOut,
  Quote,
  Users,
  X
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WORKED_EXAMPLES } from "@/lib/examples";
import { EMOTIONS, type AssignmentView, type Emotion, type ParticipantView, type ResultView } from "@/lib/types";

type Tab = "task" | "results";

export function StudyApp({ initialTab = "task" }: { initialTab?: Tab }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [participant, setParticipant] = useState<ParticipantView | null>(null);
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Emotion | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  const loadStudy = useCallback(async () => {
    const [meResponse, assignmentsResponse] = await Promise.all([fetch("/api/me"), fetch("/api/assignments")]);
    if (meResponse.status === 401) {
      router.replace("/login");
      return;
    }
    if (!meResponse.ok || !assignmentsResponse.ok) {
      setError("Your study could not be loaded. Please refresh and try again.");
      setLoading(false);
      return;
    }
    setParticipant((await meResponse.json()) as ParticipantView);
    const assignmentBody = (await assignmentsResponse.json()) as { assignments: AssignmentView[] };
    setAssignments(assignmentBody.assignments);
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadStudy(); }, [loadStudy]);

  const current = useMemo(() => assignments.find((item) => !item.selectedLabel) ?? null, [assignments]);
  const completed = useMemo(() => assignments.filter((item) => item.selectedLabel), [assignments]);

  async function startTask() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/assignments/start", { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      setError("Your messages could not be prepared. Please try again.");
      setBusy(false);
      return;
    }
    await loadStudy();
    setBusy(false);
  }

  async function submitLabel() {
    if (!current || !selected) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/assignments/${current.id}/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: selected })
    }).catch(() => null);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      setError(body.error ?? "Your response was not saved. Your selection is still here—please try again.");
      setBusy(false);
      return;
    }
    setSelected(null);
    await loadStudy();
    setBusy(false);
  }

  async function loadResults(cursor?: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/results${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`).catch(() => null);
    if (!response?.ok) {
      setError("Study results could not be loaded. Please try again.");
      setBusy(false);
      return;
    }
    const body = (await response.json()) as { rows: ResultView[]; nextCursor: string | null };
    setResults((existing) => cursor ? [...existing, ...body.rows] : body.rows);
    setNextCursor(body.nextCursor);
    setResultsLoaded(true);
    setBusy(false);
  }

  useEffect(() => {
    if (tab === "results" && participant?.completedCount === 5 && !resultsLoaded) void loadResults();
  // loadResults is intentionally triggered only by view state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, participant?.completedCount, resultsLoaded]);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className="study-shell">
      <header className="study-header">
        <a className="study-brand" href="/task" aria-label="Emotion Examiner task">
          <span className="brand-mark"><Image src="/emotion-examiner-icon.png" alt="" width={23} height={23} /></span>
          <span>Emotion Examiner</span>
        </a>
        <nav className="study-nav" aria-label="Study navigation">
          <button className={tab === "task" ? "active" : ""} onClick={() => setTab("task")}><ListChecks size={17} /> Your task</button>
          <button className={tab === "results" ? "active" : ""} onClick={() => setTab("results")} disabled={(participant?.completedCount ?? 0) < 5} title={(participant?.completedCount ?? 0) < 5 ? "Complete all five labels to unlock" : undefined}><Users size={17} /> All labels</button>
        </nav>
        <div className="participant-menu">
          <span><small>Participant</small>{participant?.publicId}</span>
          <button onClick={logout} aria-label="Sign out" title="Sign out" disabled={busy}><LogOut size={18} /></button>
        </div>
      </header>

      <div className="mobile-study-nav">
        <button className={tab === "task" ? "active" : ""} onClick={() => setTab("task")}><ListChecks size={17} /> Task</button>
        <button className={tab === "results" ? "active" : ""} onClick={() => setTab("results")} disabled={(participant?.completedCount ?? 0) < 5}><Users size={17} /> All labels</button>
      </div>

      {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div>}

      {tab === "task" ? (
        <div className="study-content">
          {assignments.length === 0 ? (
            <Instructions onStart={startTask} busy={busy} />
          ) : current ? (
            <LabelingWorkspace assignment={current} completed={completed} selected={selected} onSelect={setSelected} onSubmit={submitLabel} onInstructions={() => dialogRef.current?.showModal()} busy={busy} />
          ) : (
            <Completion participantId={participant?.publicId ?? ""} completed={completed} onViewResults={() => setTab("results")} onInstructions={() => dialogRef.current?.showModal()} />
          )}
        </div>
      ) : (
        <ResultsPanel locked={(participant?.completedCount ?? 0) < 5} rows={results} busy={busy} nextCursor={nextCursor} onLoadMore={() => nextCursor && loadResults(nextCursor)} onBack={() => setTab("task")} />
      )}

      <InstructionsDialog dialogRef={dialogRef} />
    </main>
  );
}

function LoadingScreen() {
  return <main className="loading-screen"><span className="brand-mark"><Image src="/emotion-examiner-icon.png" alt="" width={24} height={24} /></span><LoaderCircle className="spin" size={26} /><p>Loading your study…</p></main>;
}

function Instructions({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <section className="instructions-page" aria-labelledby="instructions-title">
      <div className="instructions-intro">
        <span className="section-kicker">Before you begin</span>
        <h1 id="instructions-title">How to label each message</h1>
        <p>For each message, choose the one emotion that best describes what the writer is expressing. Focus on the emotion expressed by the message, not how the message makes you feel.</p>
        <div className="instruction-steps">
          <div><span>01</span><p><strong>Read the whole message</strong>Use context, tone, and emotionally meaningful words.</p></div>
          <div><span>02</span><p><strong>Choose the best fit</strong>Select one of the six emotions, even when more than one seems possible.</p></div>
          <div><span>03</span><p><strong>Confirm your answer</strong>Submitted labels cannot be changed. You will label five messages total.</p></div>
        </div>
      </div>

      <div className="examples-section" aria-labelledby="examples-title">
        <div className="section-heading"><div><span className="section-kicker">Worked examples</span><h2 id="examples-title">See the reasoning</h2></div><p>These six messages will not appear in your task.</p></div>
        <div className="examples-grid">
          {WORKED_EXAMPLES.map((example) => (
            <article className="example-card" key={example.id}>
              <div className="example-top"><Quote size={19} /><span className={`emotion-pill emotion-${example.label}`}>{example.label}</span></div>
              <blockquote>{example.text}</blockquote>
              <p><strong>Why:</strong> {example.rationale}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="start-panel">
        <div><span>Ready?</span><h2>Your five messages are selected when you begin.</h2></div>
        <button className="primary-button wide-auto" onClick={onStart} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={19} /> Preparing…</> : <>Begin labeling <ArrowRight size={19} /></>}</button>
      </div>

      <DatasetFooter />
    </section>
  );
}

function LabelingWorkspace({ assignment, completed, selected, onSelect, onSubmit, onInstructions, busy }: {
  assignment: AssignmentView;
  completed: AssignmentView[];
  selected: Emotion | null;
  onSelect: (emotion: Emotion) => void;
  onSubmit: () => void;
  onInstructions: () => void;
  busy: boolean;
}) {
  const completeCount = completed.length;
  return (
    <section className="task-page" aria-labelledby="current-message-title">
      <div className="task-topline">
        <div><span className="section-kicker">Your labeling task</span><h1 id="current-message-title">Message {assignment.position} of 5</h1></div>
        <button className="secondary-button" onClick={onInstructions}><BookOpen size={17} /> View instructions</button>
      </div>
      <div className="progress-track" aria-label={`${completeCount} of 5 messages completed`}>
        {Array.from({ length: 5 }, (_, index) => <span key={index} className={index < completeCount ? "done" : index === completeCount ? "current" : ""} />)}
      </div>

      <div className="label-workspace">
        <article className="tweet-card">
          <div className="tweet-meta"><span>Message</span><code>{assignment.tweet.id}</code></div>
          <Quote size={30} className="quote-icon" aria-hidden="true" />
          <blockquote>{assignment.tweet.text}</blockquote>
          <p>Which emotion is expressed most strongly?</p>
        </article>

        <fieldset className="label-fieldset">
          <legend>Choose one label</legend>
          <div className="label-grid">
            {EMOTIONS.map((emotion) => (
              <label key={emotion} className={`label-option emotion-${emotion} ${selected === emotion ? "selected" : ""}`}>
                <input type="radio" name="emotion" value={emotion} checked={selected === emotion} onChange={() => onSelect(emotion)} disabled={busy} />
                <span className="choice-dot" aria-hidden="true" />
                <strong>{emotion}</strong>
                {selected === emotion && <Check size={19} className="choice-check" />}
              </label>
            ))}
          </div>
          <div className="submit-row">
            <p>{selected ? <>You selected <strong>{selected}</strong>. Confirm when you’re ready.</> : "Select the best-fitting emotion to continue."}</p>
            <button className="primary-button wide-auto" onClick={onSubmit} disabled={!selected || busy}>{busy ? <><LoaderCircle className="spin" size={19} /> Saving…</> : <>Confirm & continue <ArrowRight size={19} /></>}</button>
          </div>
        </fieldset>
      </div>

      <CompletedList assignments={completed} />
    </section>
  );
}

function CompletedList({ assignments }: { assignments: AssignmentView[] }) {
  if (!assignments.length) return null;
  return (
    <section className="completed-list" aria-labelledby="completed-title">
      <div className="section-heading"><div><span className="section-kicker">Saved responses</span><h2 id="completed-title">Your completed labels</h2></div><p>{assignments.length} of 5 complete</p></div>
      <div className="own-results">
        {assignments.map((assignment) => (
          <article key={assignment.id}>
            <span className="completed-number"><Check size={15} /></span>
            <p>{assignment.tweet.text}</p>
            <span className={`emotion-pill emotion-${assignment.selectedLabel}`}>{assignment.selectedLabel}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Completion({ participantId, completed, onViewResults, onInstructions }: { participantId: string; completed: AssignmentView[]; onViewResults: () => void; onInstructions: () => void }) {
  return (
    <section className="completion-page">
      <div className="completion-hero">
        <span className="complete-icon"><CircleCheck size={38} /></span>
        <span className="section-kicker">Task complete</span>
        <h1>All 5 labels are in.<br />Thank you.</h1>
        <p>Your responses were saved under participant ID <strong>{participantId}</strong>. You cannot submit additional labels or change completed responses.</p>
        <div className="completion-actions">
          <button className="primary-button wide-auto" onClick={onViewResults}><Users size={18} /> View all labels</button>
          <button className="secondary-button" onClick={onInstructions}><BookOpen size={17} /> Review instructions</button>
        </div>
      </div>
      <CompletedList assignments={completed} />
      <DatasetFooter />
    </section>
  );
}

function ResultsPanel({ locked, rows, busy, nextCursor, onLoadMore, onBack }: { locked: boolean; rows: ResultView[]; busy: boolean; nextCursor: string | null; onLoadMore: () => void; onBack: () => void }) {
  if (locked) return <section className="results-locked"><Users size={28} /><h1>All labels unlock after your task</h1><p>Complete your five labels before viewing other participants’ responses. This helps keep your judgments independent.</p><button className="primary-button wide-auto" onClick={onBack}>Return to your task</button></section>;
  return (
    <section className="results-page" aria-labelledby="results-title">
      <div className="results-heading">
        <div><span className="section-kicker">Pseudonymous study data</span><h1 id="results-title">All completed labels</h1><p>Every row records who labeled which message and the label they chose. Usernames and ground-truth labels are not shown.</p></div>
        <div className="results-count"><strong>{rows.length}</strong><span>responses shown</span></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Participant</th><th>Tweet</th><th>Message</th><th>Label</th><th>Submitted</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.assignmentId}><td><code>{row.participantId}</code></td><td><code>{row.tweetId}</code></td><td>{row.text}</td><td><span className={`emotion-pill emotion-${row.selectedLabel}`}>{row.selectedLabel}</span></td><td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.submittedAt))}</td></tr>)}
          </tbody>
        </table>
        {!busy && rows.length === 0 && <div className="empty-results">No completed labels are available yet.</div>}
      </div>
      {nextCursor && <button className="secondary-button load-more" onClick={onLoadMore} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Loading…</> : <>Load more <ChevronRight size={17} /></>}</button>}
      <DatasetFooter />
    </section>
  );
}

function InstructionsDialog({ dialogRef }: { dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  const [activeEmotion, setActiveEmotion] = useState<Emotion>("anger");
  const example = WORKED_EXAMPLES.find((item) => item.label === activeEmotion)!;

  return (
    <dialog className="instructions-dialog" ref={dialogRef} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="dialog-card">
        <div className="dialog-heading"><div><span className="section-kicker">Quick reference</span><h2>Labeling instructions</h2></div><button onClick={() => dialogRef.current?.close()} aria-label="Close instructions"><X size={20} /></button></div>
        <ol><li>Read the entire message and consider its context and tone.</li><li>Choose the one emotion that best represents the message's expressed emotion.</li><li>Confirm carefully (submitted labels cannot be changed).</li></ol>
        <p className="dialog-example-prompt">Select an emotion to view its example:</p>
        <div className="dialog-emotion-tabs" role="tablist" aria-label="Worked examples by emotion">
          {EMOTIONS.map((emotion) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeEmotion === emotion}
              className={`dialog-emotion-tab emotion-${emotion} ${activeEmotion === emotion ? "active" : ""}`}
              key={emotion}
              onClick={() => setActiveEmotion(emotion)}
            >
              <span className="choice-dot" aria-hidden="true" />
              {emotion}
            </button>
          ))}
        </div>
        <article className="dialog-example" role="tabpanel" aria-live="polite">
          <div className="example-top"><Quote size={19} /><span className={`emotion-pill emotion-${example.label}`}>{example.label}</span></div>
          <blockquote>{example.text}</blockquote>
          <p><strong>Why:</strong> {example.rationale}</p>
        </article>
        <button className="primary-button" onClick={() => dialogRef.current?.close()}>Return to task</button>
      </div>
    </dialog>
  );
}

function DatasetFooter() {
  return <footer className="dataset-footer">Messages come from the <a href="https://huggingface.co/datasets/dair-ai/emotion" target="_blank" rel="noreferrer">DAIR.AI Emotion dataset</a>, which is intended for educational and research use.</footer>;
}
