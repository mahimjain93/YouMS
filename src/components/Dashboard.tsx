import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadState,
  saveState,
  saveJournalEntry,
  xpForLevel,
  localDateStr,
  todayStr,
  yesterdayStr,
  FOCUS_MS,
  type AppState,
  type Task,
} from "@/lib/storage";
import { UrgeOverlay } from "./UrgeOverlay";
import { DayJournal } from "./DayJournal";
import { ShortcutsHelp } from "./ShortcutsHelp";

const XP_VALUES = [10, 25, 50];
const SWIMMING_XP = 25;
const PROTECTION_XP = 25;

type CyclePhase = "setup" | "running" | "checkin";

export function Dashboard() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [input, setInput] = useState("");
  const [xpValue, setXpValue] = useState(25);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [urgeOpen, setUrgeOpen] = useState(false);
  const [urgeLogOpen, setUrgeLogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [floaters, setFloaters] = useState<Array<{ id: number; xp: number }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ===== Work Cycle (inline) state =====
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase>("setup");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [customTask, setCustomTask] = useState("");
  const [escaped, setEscaped] = useState(false);
  const [checkedTaskIds, setCheckedTaskIds] = useState<string[]>([]);
  const [journalNote, setJournalNote] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const cycleEndedRef = useRef(false);

  useEffect(() => saveState(state), [state]);

  // tick for the timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const fireFloater = useCallback((xp: number) => {
    setFloaters((f) => [...f, { id: Date.now() + Math.random(), xp }]);
  }, []);

  const activeTasks = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);
  const completedToday = useMemo(
    () =>
      state.tasks.filter(
        (t) => t.done && t.completedAt && localDateStr(new Date(t.completedAt)) === todayStr(),
      ),
    [state.tasks],
  );

  useEffect(() => {
    if (selectedIdx >= activeTasks.length) setSelectedIdx(Math.max(0, activeTasks.length - 1));
  }, [activeTasks.length, selectedIdx]);

  const addTask = useCallback(() => {
    const title = input.trim();
    if (!title) return;
    const t: Task = {
      id: crypto.randomUUID(),
      title,
      xp: xpValue,
      done: false,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, tasks: [t, ...s.tasks] }));
    setInput("");
  }, [input, xpValue]);

  const completeTask = useCallback((id: string) => {
    setState((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task || task.done) return s;
      const today = todayStr();
      let streak = s.streak;
      if (s.lastCompletionDate !== today) {
        streak = s.lastCompletionDate === yesterdayStr() ? s.streak + 1 : 1;
      }
      const newXp = s.xp + task.xp;
      let level = s.level;
      let xpRem = newXp;
      while (xpRem >= xpForLevel(level)) {
        xpRem -= xpForLevel(level);
        level += 1;
      }
      setFloaters((f) => [...f, { id: Date.now() + Math.random(), xp: task.xp }]);
      return {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, done: true, completedAt: Date.now() } : t,
        ),
        xp: xpRem,
        level,
        streak,
        lastCompletionDate: today,
        totalCompleted: s.totalCompleted + 1,
      };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  // ===== Ritual completion (Swimming / Morning Protection) =====
  const swimmingDone = state.swimmingDoneDate === todayStr();
  const protectionDone = state.morningProtectionDoneDate === todayStr();

  const completeRitual = useCallback(
    (which: "swimming" | "protection", xp: number) => {
      setState((s) => {
        const today = todayStr();
        if (which === "swimming" && s.swimmingDoneDate === today) return s;
        if (which === "protection" && s.morningProtectionDoneDate === today) return s;
        let streak = s.streak;
        if (s.lastCompletionDate !== today) {
          streak = s.lastCompletionDate === yesterdayStr() ? s.streak + 1 : 1;
        }
        let xpRem = s.xp + xp;
        let level = s.level;
        while (xpRem >= xpForLevel(level)) {
          xpRem -= xpForLevel(level);
          level += 1;
        }
        return {
          ...s,
          xp: xpRem,
          level,
          streak,
          lastCompletionDate: today,
          totalCompleted: s.totalCompleted + 1,
          swimmingDoneDate: which === "swimming" ? today : s.swimmingDoneDate,
          morningProtectionDoneDate: which === "protection" ? today : s.morningProtectionDoneDate,
        };
      });
      fireFloater(xp);
    },
    [fireFloater],
  );

  // ===== Work Cycle timer logic =====
  const wc = state.workCycle;
  const running = wc.phase === "focus" && wc.phaseStartedAt != null;
  const paused = wc.pausedRemainingMs != null;
  const totalMs = wc.phaseDurationMs || FOCUS_MS;
  const remainingMs = useMemo(() => {
    if (wc.phase !== "focus") return totalMs;
    if (wc.pausedRemainingMs != null) return wc.pausedRemainingMs;
    if (!wc.phaseStartedAt) return totalMs;
    return Math.max(0, wc.phaseStartedAt + wc.phaseDurationMs - now);
  }, [wc, now, totalMs]);

  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const totalSeconds = Math.max(1, Math.round(totalMs / 1000));

  function setWC(patch: Partial<AppState["workCycle"]>) {
    setState((s) => ({ ...s, workCycle: { ...s.workCycle, ...patch } }));
  }

  const cardStatus = running ? (paused ? "PAUSED" : "RUNNING") : "READY";

  // detect natural timer end → check-in
  useEffect(() => {
    if (
      cyclePhase === "running" &&
      wc.phase === "focus" &&
      wc.pausedRemainingMs == null &&
      wc.phaseStartedAt != null &&
      now >= wc.phaseStartedAt + wc.phaseDurationMs &&
      !cycleEndedRef.current
    ) {
      cycleEndedRef.current = true;
      setWC({ phase: "idle", phaseStartedAt: null, pausedRemainingMs: null });
      setCyclePhase("checkin");
      setCheckedTaskIds([]);
      setCycleOpen(true);
    }
  }, [now, cyclePhase, wc]);

  const selectedTasks = useMemo(
    () => state.tasks.filter((t) => selectedTaskIds.includes(t.id)),
    [state.tasks, selectedTaskIds],
  );

  function openCycle() {
    if (running) {
      setCyclePhase("running");
    } else if (cyclePhase === "checkin") {
      // keep check-in open
    } else {
      setCyclePhase("setup");
    }
    setCycleOpen((o) => (running || cyclePhase === "checkin" ? true : !o));
  }

  function startCycle() {
    cycleEndedRef.current = false;
    setEscaped(false);
    setWC({
      phase: "focus",
      phaseStartedAt: Date.now(),
      phaseDurationMs: FOCUS_MS,
      pausedRemainingMs: null,
    });
    setCyclePhase("running");
    setCycleOpen(true);
  }

  function justStart() {
    cycleEndedRef.current = false;
    setEscaped(true);
    setSelectedTaskIds([]);
    setCustomTask("");
    setWC({
      phase: "focus",
      phaseStartedAt: Date.now(),
      phaseDurationMs: FOCUS_MS,
      pausedRemainingMs: null,
    });
    setCyclePhase("running");
    setCycleOpen(true);
  }

  function pauseCycle() {
    if (wc.phase !== "focus" || wc.pausedRemainingMs != null) return;
    setWC({ pausedRemainingMs: remainingMs });
  }
  function resumeCycle() {
    if (wc.pausedRemainingMs == null) return;
    setWC({
      phaseStartedAt: Date.now(),
      phaseDurationMs: wc.pausedRemainingMs,
      pausedRemainingMs: null,
    });
  }
  function skipCycle() {
    cycleEndedRef.current = true;
    setWC({ phase: "idle", phaseStartedAt: null, pausedRemainingMs: null });
    setCheckedTaskIds([]);
    setCyclePhase("checkin");
    setCycleOpen(true);
  }
  function resetCycle() {
    cycleEndedRef.current = false;
    setWC({
      phase: "idle",
      phaseStartedAt: null,
      phaseDurationMs: FOCUS_MS,
      pausedRemainingMs: null,
    });
    setSelectedTaskIds([]);
    setCustomTask("");
    setEscaped(false);
    setCyclePhase("setup");
  }

  function toggleSelectTask(id: string) {
    setSelectedTaskIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  function toggleCheckTask(id: string) {
    setCheckedTaskIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function confirmCheckin() {
    const today = todayStr();
    const note = journalNote.trim();
    // Titles of completed tasks (those checked in the check-in).
    const completedTitles = state.tasks
      .filter((t) => checkedTaskIds.includes(t.id))
      .map((t) => t.title);

    // 1) Persist cycle journal entry to AppState + complete checked tasks with full XP logic.
    setState((s) => {
      let next: AppState = { ...s };
      // complete checked tasks
      for (const id of checkedTaskIds) {
        const task = next.tasks.find((t) => t.id === id);
        if (!task || task.done) continue;
        let streak = next.streak;
        if (next.lastCompletionDate !== today) {
          streak = next.lastCompletionDate === yesterdayStr() ? next.streak + 1 : 1;
        }
        let xpRem = next.xp + task.xp;
        let level = next.level;
        while (xpRem >= xpForLevel(level)) {
          xpRem -= xpForLevel(level);
          level += 1;
        }
        next = {
          ...next,
          tasks: next.tasks.map((t) =>
            t.id === id ? { ...t, done: true, completedAt: Date.now() } : t,
          ),
          xp: xpRem,
          level,
          streak,
          lastCompletionDate: today,
          totalCompleted: next.totalCompleted + 1,
        };
        setFloaters((f) => [...f, { id: Date.now() + Math.random(), xp: task.xp }]);
      }
      const entry = {
        id: crypto.randomUUID(),
        date: today,
        note,
        tasksCompleted: completedTitles,
        escaped,
      };
      return { ...next, cycleJournalEntries: [...next.cycleJournalEntries, entry] };
    });

    // 2) Persist to Day Journal.
    saveJournalEntry({
      id: crypto.randomUUID(),
      entryType: "cycle",
      startedAt: Date.now(),
      endedAt: Date.now(),
      note,
      tasksCompleted: completedTitles,
    });

    // 3) Reset Work Cycle back to resting state.
    setJournalNote("");
    setCheckedTaskIds([]);
    setSelectedTaskIds([]);
    setCustomTask("");
    setEscaped(false);
    cycleEndedRef.current = false;
    setCyclePhase("setup");
    setCycleOpen(false);
  }

  const canStart = selectedTaskIds.length > 0 || customTask.trim().length > 0;

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        (e.target as HTMLElement)?.blur?.();
        return;
      }
      if (inField) return;
      if (urgeOpen) return;

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          inputRef.current?.focus();
          break;
        case "j":
          setSelectedIdx((i) => Math.min(activeTasks.length - 1, i + 1));
          break;
        case "k":
          setSelectedIdx((i) => Math.max(0, i - 1));
          break;
        case "x":
        case " ":
          if (activeTasks[selectedIdx]) {
            e.preventDefault();
            completeTask(activeTasks[selectedIdx].id);
          }
          break;
        case "d":
          if (activeTasks[selectedIdx]) deleteTask(activeTasks[selectedIdx].id);
          break;
        case "u":
          setUrgeOpen(true);
          break;
        case "?":
          setHelpOpen((h) => !h);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTasks, selectedIdx, urgeOpen, helpOpen, completeTask, deleteTask]);

  const nextLevelXp = xpForLevel(state.level);
  const progress = (state.xp / nextLevelXp) * 100;

  return (
    <div className="relative min-h-screen">
      {/* Background grid floor */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[55vh] overflow-hidden opacity-50">
        <div
          className="absolute inset-x-[-20%] top-0 h-[200%] grid-floor"
          style={{ animation: "scroll-grid 4s linear infinite" }}
        />
      </div>
      {/* Sun */}
      <div
        className="pointer-events-none fixed left-1/2 top-[12vh] -z-0 h-72 w-72 -translate-x-1/2 rounded-full opacity-80"
        style={{
          background: "var(--sun-gradient)",
          filter: "blur(2px)",
          maskImage:
            "linear-gradient(180deg, black 60%, transparent 100%), repeating-linear-gradient(0deg, black 0 8px, transparent 8px 12px)",
          WebkitMaskImage:
            "linear-gradient(180deg, black 60%, transparent 100%), repeating-linear-gradient(0deg, black 0 8px, transparent 8px 12px)",
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="font-display text-lg md:text-2xl lg:text-3xl neon-text-pink crt-flicker leading-tight">
            Welcome to Mahim Management System (MMS)
          </h1>
          <p className="mt-2 text-lg text-muted-foreground font-mono">// let's move //</p>
        </header>

        {/* Stats HUD */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="LEVEL" value={state.level.toString().padStart(2, "0")} color="pink" />
          <StatCard label="STREAK" value={`${state.streak}d`} color="yellow" />
          <StatCard label="DONE" value={state.totalCompleted.toString()} color="cyan" />
        </div>

        {/* Quest Board nav */}
        <div className="mb-6 flex justify-end">
          <a
            href="#/quests"
            className="font-display text-[10px] px-4 py-2 neon-border-cyan neon-text-cyan bg-card hover:bg-secondary/10 transition-colors"
          >
            [ QUEST BOARD ]
          </a>
        </div>

        {/* Rituals — three equal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-stretch">
          {/* Swimming */}
          <RitualTapCard
            label="Swimming"
            labelColor="#ff6b00"
            xpColor="#ffe600"
            xp={SWIMMING_XP}
            done={swimmingDone}
            border="1px solid #ff6b0044"
            boxShadow="0 0 10px #ff6b001a"
            onTap={() => completeRitual("swimming", SWIMMING_XP)}
          />
          {/* Morning Protection */}
          <RitualTapCard
            label="Morning Protection"
            labelColor="#bf5fff"
            xpColor="#ffe600"
            xp={PROTECTION_XP}
            done={protectionDone}
            border="1px solid #bf5fff44"
            boxShadow="0 0 10px #bf5fff1a"
            onTap={() => completeRitual("protection", PROTECTION_XP)}
          />
          {/* Work Cycle */}
          <button
            onClick={openCycle}
            className="bg-card scanlines p-4 transition-all hover:scale-[1.02] active:scale-[0.99]"
            style={{
              minHeight: 140,
              border: "1px solid #00f5ff44",
              boxShadow: "0 0 10px #00f5ff1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="font-display text-[11px]" style={{ color: "#00f5ff" }}>
                Work Cycle
              </span>
              <span className="font-mono" style={{ fontSize: 11, opacity: 0.5, letterSpacing: 1 }}>
                {cardStatus}
              </span>
            </div>
            {/* Ring hidden when expansion panel is open */}
            <div
              style={{
                position: "relative",
                width: 132,
                height: 132,
                flexShrink: 0,
                visibility: cycleOpen ? "hidden" : "visible",
              }}
            >
              <svg
                width={132}
                height={132}
                viewBox="0 0 132 132"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle cx={66} cy={66} r={55} fill="none" stroke="#00f5ff15" strokeWidth={8} />
                <circle
                  cx={66}
                  cy={66}
                  r={55}
                  fill="none"
                  stroke="#00f5ff"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={345.6}
                  strokeDashoffset={345.6 * (secondsLeft / totalSeconds)}
                  style={{
                    filter: "drop-shadow(0 0 6px #00f5ff)",
                    transition: "stroke-dashoffset 0.25s linear",
                  }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <span
                  className="font-display"
                  style={{ fontSize: 22, color: "#00f5ff", letterSpacing: 2, lineHeight: 1 }}
                >
                  {fmtTime(remainingMs)}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Work Cycle expansion panel (full width) */}
        {cycleOpen && (
          <div
            className="bg-card scanlines p-4 mb-6"
            style={{ border: "1px solid #00f5ff44", boxShadow: "0 0 10px #00f5ff1a" }}
          >
            {cyclePhase === "setup" && (
              <div className="flex flex-col gap-4">
                <div
                  className="font-mono"
                  style={{ fontSize: 9, color: "#00f5ff", opacity: 0.5, letterSpacing: 2 }}
                >
                  WHAT ARE YOU WORKING ON?
                </div>

                {activeTasks.length === 0 ? (
                  <p className="font-mono text-sm text-muted-foreground">
                    no active missions — use the escape hatch or type one below
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {activeTasks.map((t) => {
                      const sel = selectedTaskIds.includes(t.id);
                      return (
                        <li
                          key={t.id}
                          onClick={() => toggleSelectTask(t.id)}
                          className="flex items-center gap-3 p-2 border cursor-pointer transition-all"
                          style={{
                            borderColor: sel ? "#00f5ff" : "hsl(var(--border))",
                            color: sel ? "#00f5ff" : undefined,
                          }}
                        >
                          <span
                            className="inline-flex items-center justify-center font-display text-[10px]"
                            style={{
                              width: 18,
                              height: 18,
                              border: `1px solid ${sel ? "#00f5ff" : "hsl(var(--border))"}`,
                            }}
                          >
                            {sel ? "✓" : ""}
                          </span>
                          <span className="flex-1 font-mono text-lg">{t.title}</span>
                          <span className="font-display text-[10px] neon-text-yellow">+{t.xp}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-display text-[9px] text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <input
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  placeholder="> type a task..."
                  className="w-full bg-input border border-border px-3 py-2 font-mono text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:neon-border-cyan"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={startCycle}
                    disabled={!canStart}
                    className="font-display text-[10px] px-4 py-2 neon-border-cyan bg-transparent neon-text-cyan hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▶ START
                  </button>
                  <button
                    onClick={justStart}
                    className="font-display text-[10px] px-4 py-2 neon-border bg-transparent neon-text-pink hover:bg-primary/10"
                  >
                    ⚡ JUST START
                  </button>
                </div>

                <button
                  onClick={() => setCycleOpen(false)}
                  className="self-start font-display text-[9px] text-muted-foreground hover:neon-text-cyan"
                >
                  ▲ COLLAPSE
                </button>
              </div>
            )}

            {cyclePhase === "running" && (
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                {/* LEFT — ring with time in center */}
                <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                  <svg
                    width={120}
                    height={120}
                    viewBox="0 0 120 120"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <circle cx={60} cy={60} r={55} fill="none" stroke="#00f5ff15" strokeWidth={5} />
                    <circle
                      cx={60}
                      cy={60}
                      r={55}
                      fill="none"
                      stroke="#00f5ff"
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeDasharray={376.99}
                      strokeDashoffset={376.99 * (secondsLeft / totalSeconds)}
                      style={{
                        filter: "drop-shadow(0 0 6px #00f5ff)",
                        transition: "stroke-dashoffset 0.25s linear",
                      }}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className="font-display"
                      style={{ fontSize: 20, color: "#00f5ff", letterSpacing: 2, lineHeight: 1 }}
                    >
                      {fmtTime(remainingMs)}
                    </span>
                  </div>
                </div>

                {/* RIGHT — chips + controls + collapse */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {/* Task chips */}
                  <div className="flex flex-wrap gap-2">
                    {escaped ? (
                      <span className="font-mono text-sm px-2 py-1 border border-border text-muted-foreground">
                        free cycle
                      </span>
                    ) : (
                      <>
                        {selectedTasks.map((t) => (
                          <span
                            key={t.id}
                            className="font-mono text-sm px-2 py-1 border"
                            style={{ borderColor: "#00f5ff", color: "#00f5ff" }}
                          >
                            {t.title}
                          </span>
                        ))}
                        {customTask.trim() && (
                          <span
                            className="font-mono text-sm px-2 py-1 border"
                            style={{ borderColor: "#00f5ff", color: "#00f5ff" }}
                          >
                            {customTask.trim()}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {paused ? (
                      <button
                        onClick={resumeCycle}
                        className="font-display text-[10px] px-3 py-2 neon-border bg-transparent neon-text-pink hover:bg-primary/10"
                      >
                        ▶ RESUME
                      </button>
                    ) : (
                      <button
                        onClick={pauseCycle}
                        className="font-display text-[10px] px-3 py-2 neon-border-cyan bg-transparent neon-text-cyan hover:bg-secondary/10"
                      >
                        ❚❚ PAUSE
                      </button>
                    )}
                    <button
                      onClick={skipCycle}
                      className="font-display text-[10px] px-3 py-2 border border-border hover:border-primary/60"
                    >
                      SKIP
                    </button>
                    <button
                      onClick={resetCycle}
                      className="font-display text-[10px] px-3 py-2 border border-destructive text-destructive hover:bg-destructive/20"
                    >
                      RESET
                    </button>
                  </div>

                  <button
                    onClick={() => setCycleOpen(false)}
                    className="font-display text-[9px] text-muted-foreground hover:neon-text-cyan self-start"
                  >
                    ▲ COLLAPSE
                  </button>
                </div>
              </div>
            )}

            {cyclePhase === "checkin" && (
              <div className="flex flex-col gap-4">
                <div className="font-display" style={{ fontSize: 11, color: "#ffe600" }}>
                  HOW WAS THAT?
                </div>

                {!escaped && selectedTasks.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {selectedTasks.map((t) => {
                      const checked = checkedTaskIds.includes(t.id);
                      return (
                        <li
                          key={t.id}
                          onClick={() => toggleCheckTask(t.id)}
                          className="flex items-center gap-3 p-2 border cursor-pointer transition-all"
                          style={{
                            borderColor: checked ? "#39ff14" : "hsl(var(--border))",
                            color: checked ? "#39ff14" : undefined,
                          }}
                        >
                          <span
                            className="inline-flex items-center justify-center font-display text-[10px]"
                            style={{
                              width: 18,
                              height: 18,
                              border: `1px solid ${checked ? "#39ff14" : "hsl(var(--border))"}`,
                            }}
                          >
                            {checked ? "✓" : ""}
                          </span>
                          <span className="flex-1 font-mono text-lg">{t.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <textarea
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder="> thoughts, blockers, anything..."
                  rows={3}
                  className="w-full bg-input border border-border px-3 py-2 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:neon-border-cyan resize-none"
                />

                <button
                  onClick={confirmCheckin}
                  className="self-start font-display text-[10px] px-4 py-2 neon-border-cyan bg-transparent neon-text-cyan hover:bg-secondary/10"
                >
                  CONFIRM →
                </button>
              </div>
            )}
          </div>
        )}

        {/* XP bar */}
        <div className="mb-6 bg-card neon-border p-4 relative scanlines">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-display text-[10px] neon-text-pink">XP</span>
            <span className="font-mono text-lg text-muted-foreground">
              {state.xp} / {nextLevelXp}
            </span>
          </div>
          <div className="h-4 w-full bg-input border border-border overflow-hidden">
            <div
              className="h-full transition-all duration-500 animate-pulse-glow"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan))",
              }}
            />
          </div>
        </div>

        {/* Input */}
        <div className="mb-6 bg-card neon-border-cyan p-4 relative scanlines">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
              placeholder="> new mission..."
              className="flex-1 bg-input border border-border px-3 py-2 font-mono text-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:neon-border-cyan"
            />
            <select
              value={xpValue}
              onChange={(e) => setXpValue(Number(e.target.value))}
              className="bg-input border border-border px-2 font-display text-[10px] neon-text-yellow focus:outline-none"
            >
              {XP_VALUES.map((v) => (
                <option key={v} value={v}>
                  +{v}XP
                </option>
              ))}
            </select>
            <button
              onClick={addTask}
              className="font-display text-[10px] px-4 neon-border bg-transparent neon-text-pink hover:bg-primary/10"
            >
              ADD
            </button>
          </div>
          <p className="mt-2 text-base text-muted-foreground font-mono">
            press <kbd className="px-1 border border-border neon-text-cyan">N</kbd> to focus,{" "}
            <kbd className="px-1 border border-border neon-text-cyan">?</kbd> for shortcuts
          </p>
        </div>

        {/* Task list */}
        <div className="mb-6">
          <h2 className="font-display text-xs neon-text-cyan mb-3">
            // MISSIONS [{activeTasks.length}]
          </h2>
          {activeTasks.length === 0 ? (
            <div className="bg-card border border-border p-8 text-center text-muted-foreground font-mono text-xl">
              [ NO ACTIVE MISSIONS ]
              <br />
              <span className="text-sm">add one above to begin the grind</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {activeTasks.map((t, i) => (
                <li
                  key={t.id}
                  onClick={() => setSelectedIdx(i)}
                  className={`group flex items-center gap-3 bg-card p-3 border transition-all cursor-pointer ${
                    i === selectedIdx ? "neon-border" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-display text-[10px] neon-text-yellow">+{t.xp}</span>
                  <span className="flex-1 font-mono text-xl text-foreground">{t.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTask(t.id);
                    }}
                    className="font-display text-[9px] px-2 py-1 neon-border-cyan hover:bg-secondary/20"
                  >
                    [X]
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(t.id);
                    }}
                    className="font-display text-[9px] px-2 py-1 border border-destructive text-destructive hover:bg-destructive/20"
                  >
                    DEL
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {completedToday.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-xs neon-text-pink mb-3 opacity-60">
              // COMPLETED TODAY [{completedToday.length}]
            </h2>
            <ul className="space-y-1 opacity-60">
              {completedToday.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 font-mono text-lg line-through text-muted-foreground"
                >
                  <span className="neon-text-yellow no-underline">+{t.xp}</span>
                  <span>{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Urge button */}
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="font-display text-[9px] px-3 py-2 bg-card neon-border-cyan hover:bg-secondary/10"
            aria-label="Shortcuts"
          >
            [?]
          </button>
          <button
            onClick={() => setUrgeLogOpen(true)}
            className="font-display text-[9px] px-3 py-2 bg-card neon-border-cyan hover:bg-secondary/10"
          >
            [ LOG ]
          </button>
          <button
            onClick={() => setUrgeOpen(true)}
            className="font-display text-[10px] px-4 py-3 bg-card neon-border animate-pulse-glow hover:scale-105 transition-transform"
          >
            !! URGE [U] !!
          </button>
        </div>

        {/* XP floaters */}
        <div className="pointer-events-none fixed inset-0 z-40">
          {floaters.map((f) => (
            <div
              key={f.id}
              onAnimationEnd={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 font-display text-2xl neon-text-yellow animate-float-up"
            >
              +{f.xp} XP
            </div>
          ))}
        </div>
      </div>

      {urgeOpen && (
        <UrgeOverlay
          onClose={(entry) => {
            saveJournalEntry(entry);
            setUrgeOpen(false);
          }}
        />
      )}
      <DayJournal open={urgeLogOpen} onOpenChange={setUrgeLogOpen} />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "pink" | "cyan" | "yellow";
}) {
  const cls =
    color === "pink"
      ? "neon-border neon-text-pink"
      : color === "cyan"
        ? "neon-border-cyan neon-text-cyan"
        : "neon-border neon-text-yellow";
  return (
    <div className={`bg-card p-3 text-center relative scanlines ${cls.split(" ")[0]}`}>
      <div className="font-display text-[9px] text-muted-foreground mb-1">{label}</div>
      <div className={`font-display text-xl ${cls.split(" ")[1]}`}>{value}</div>
    </div>
  );
}

function RitualTapCard({
  label,
  labelColor,
  xpColor,
  xp,
  done,
  border,
  boxShadow,
  onTap,
}: {
  label: string;
  labelColor: string;
  xpColor: string;
  xp: number;
  done: boolean;
  border: string;
  boxShadow: string;
  onTap: () => void;
}) {
  return (
    <button
      onClick={() => !done && onTap()}
      disabled={done}
      className={`bg-card scanlines p-4 text-left flex flex-col justify-between transition-all relative ${
        done ? "cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.99]"
      }`}
      style={{ minHeight: 100, border, boxShadow, opacity: done ? 0.35 : 1 }}
    >
      {done && (
        <span
          className="absolute top-2 right-2 font-display text-[10px]"
          style={{ color: "#39ff14" }}
        >
          ✓ DONE
        </span>
      )}
      <span className="font-display text-[11px]" style={{ color: labelColor }}>
        {label}
      </span>
      <div className="flex items-end justify-between mt-2">
        <span className="font-mono" style={{ fontSize: 11, opacity: 0.5 }}>
          TAP WHEN DONE
        </span>
        <span className="font-display text-[10px]" style={{ color: xpColor }}>
          +{xp} XP
        </span>
      </div>
    </button>
  );
}
