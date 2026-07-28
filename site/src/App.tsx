import { useEffect, useMemo, useState } from "react";
import { buildQuestionList, type Question } from "./questions";
import { buildFiles, sanitizeSlug, type Answers } from "./templates";
import { FilePanel } from "./FilePanel";
import { Handoff } from "./Handoff";
import { Intro } from "./Intro";
import "./index.css";

type Phase = "intro" | "interview" | "handoff";

const store = {
  get(): { phase: Phase; qi: number; answers: Answers } | null {
    try {
      const raw = localStorage.getItem("lak-draft");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(v: { phase: Phase; qi: number; answers: Answers }) {
    try {
      localStorage.setItem("lak-draft", JSON.stringify(v));
    } catch {
      /* private mode, session continues in memory */
    }
  },
  clear() {
    try {
      localStorage.removeItem("lak-draft");
    } catch {
      /* ignore */
    }
  },
};

const TEACHING: Record<string, string> = {
  name: "There it is. Your first file. Everything you share becomes readable text like this.",
  room1: "home.md just got a map: which file to read for which job. It's why your AI won't get lost.",
  boundaries: "These rules ride along in every session. Your AI asks first, every time.",
  dump: "Your brain dump lands in today's daily log. Your AI organizes it from there. You never have to open a file.",
};

function BrandMark() {
  return (
    <a className="brand" href="https://nicosullivan.com" target="_blank" rel="noreferrer" aria-label="Nico Sullivan — nicosullivan.com">
      <span className="brand-mark" aria-hidden="true" />
    </a>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

export default function App() {
  const saved = useMemo(() => store.get(), []);
  const questions = useMemo(() => buildQuestionList(), []);
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "intro");
  const [qi, setQi] = useState(() => {
    const stored = saved?.qi ?? 0;
    return stored >= questions.length ? questions.length - 1 : Math.max(0, stored);
  });
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {});
  const [draft, setDraft] = useState("");
  const [multi, setMulti] = useState<string[]>([
    "Sending messages or email on my behalf",
    "Spending any money",
    "Deleting files or notes",
    "Posting anything publicly",
  ]);
  const [toneSel, setToneSel] = useState<string[]>([]);
  const [teach, setTeach] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = mq.matches;
      setDark(isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    store.set({ phase, qi, answers });
  }, [phase, qi, answers]);

  const q: Question | undefined = questions[qi];
  const previewFiles = useMemo(() => buildFiles(answers, "preview"), [answers]);
  const downloadFiles = useMemo(() => buildFiles(answers, "download"), [answers]);
  const name = typeof answers.name === "string" ? answers.name.trim() : "";
  const folderName = `${sanitizeSlug(name)}-os`;
  const workspaceTitle = name ? `${name}'s workspace` : folderName;
  const panelVisible = phase === "handoff" || (phase === "interview" && previewFiles.length > 0);

  const progress = phase === "intro" ? 6 : phase === "handoff" ? 100 : 12 + Math.round((qi / questions.length) * 88);

  function submit(value: string | string[]) {
    if (!q) return;
    setAnswers({ ...answers, [q.id]: value });
    setDraft("");
    const lesson = TEACHING[q.id];
    if (lesson && (typeof value === "string" ? value : value.length)) {
      setTeach(lesson);
      setTimeout(() => setTeach(null), 5200);
    }
    if (qi + 1 >= questions.length) setPhase("handoff");
    else setQi(qi + 1);
  }

  function startOver() {
    store.clear();
    setAnswers({});
    setQi(0);
    setPhase("intro");
  }

  return (
    <div className="app">
      <BrandMark />

      {phase !== "intro" && (
        <header className="topbar">
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </header>
      )}

      {phase === "intro" && <Intro dark={dark} onDone={() => setPhase("interview")} />}

      {phase === "interview" && q && (
        <main className={`stage${panelVisible ? " with-panel" : ""}`}>
          <section className="card interview" key={qi}>
            <p className="qcount">
              {qi + 1} / {questions.length}
            </p>
            <h2 className="qprompt">{q.prompt}</h2>
            {q.hint && <p className="qhint">{q.hint}</p>}

            {(q.kind === "text" || q.kind === "dump") && (
              <textarea
                className={q.kind === "dump" ? "field dumpbox" : "field"}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 20000))}
                placeholder={q.kind === "dump" ? "Everything on your mind…" : "Type here…"}
                rows={q.kind === "dump" ? 7 : 3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (q.kind === "dump") {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      submit(draft.trim());
                    }
                    return;
                  }
                  if (!e.shiftKey) {
                    e.preventDefault();
                    submit(draft.trim());
                  }
                }}
              />
            )}

            {q.kind === "chips" && (
              <div className="chips" role="radiogroup" aria-label={q.prompt}>
                {q.chips!.map((c) => (
                  <button key={c.value} role="radio" aria-checked={false} className="chip" onClick={() => submit(c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {q.kind === "chips-multi" && (
              <>
                <p className="qhint">The obvious ones are already checked.</p>
                <div className="checklist" role="group" aria-label={q.prompt}>
                  {q.chips!.map((c) => {
                    const on = multi.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        aria-pressed={on}
                        className={`check-row${on ? " checked" : ""}`}
                        onClick={() => setMulti(on ? multi.filter((v) => v !== c.value) : [...multi, c.value])}
                      >
                        <span className="check-box" aria-hidden="true">
                          {on && <CheckIcon />}
                        </span>
                        <span className="check-label">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  className="field"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  placeholder="Anything else it should always ask about first?"
                />
              </>
            )}

            {q.kind === "tone" && (
              <>
                <div className="chips" role="group" aria-label={q.prompt}>
                  {q.chips!.map((c) => {
                    const on = toneSel.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        aria-pressed={on}
                        className={`chip${on ? " selected" : ""}`}
                        onClick={() => setToneSel(on ? toneSel.filter((v) => v !== c.value) : [...toneSel, c.value])}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  className="field"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 300))}
                  placeholder="Or say it in your own words"
                />
              </>
            )}

            <div className="qactions">
              <button className="btn-skip" onClick={() => submit(q.kind === "chips-multi" || q.kind === "tone" ? [] : "")}>
                Skip
              </button>
              {q.kind !== "chips" && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (q.kind === "chips-multi") {
                      if (draft.trim()) setAnswers((a) => ({ ...a, "boundaries-extra": draft.trim() }));
                      submit(multi);
                    } else if (q.kind === "tone") {
                      const own = draft.trim();
                      submit(own ? [...toneSel, own] : toneSel);
                    } else submit(draft.trim());
                  }}
                >
                  Next
                </button>
              )}
            </div>

            {teach && (
              <div className="teach" role="status">
                {teach}
              </div>
            )}
          </section>

          {panelVisible && <FilePanel files={previewFiles} title={workspaceTitle} activeIds={q ? [q.id] : []} showEducation={qi <= 2} />}
        </main>
      )}

      {phase === "handoff" && (
        <main className="stage with-panel">
          <Handoff files={downloadFiles} folderName={folderName} />
          <FilePanel files={downloadFiles} title={workspaceTitle} activeIds={[]} showEducation={false} />
        </main>
      )}

      {phase !== "intro" && (
      <footer className="foot">
        <span className="foot-right">
          <a href="https://github.com/victoryofthepeople/light-agent-kit" target="_blank" rel="noreferrer">
            Open source
          </a>
          <button className="linklike" onClick={startOver}>
            Start over
          </button>
        </span>
      </footer>
      )}
    </div>
  );
}
