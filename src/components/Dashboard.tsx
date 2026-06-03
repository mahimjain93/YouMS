import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  loadState,
  saveState,
  saveUrgeEntry,
  xpForLevel,
  localDateStr,
  todayStr,
  yesterdayStr,
  type AppState,
  type Task,
} from "@/lib/storage";
import { UrgeOverlay } from "./UrgeOverlay";
import { UrgeLog } from "./UrgeLog";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { WorkCyclePanel } from "./WorkCyclePanel";


const XP_VALUES = [10, 25, 50];

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

  useEffect(() => saveState(state), [state]);

  const activeTasks = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);
  const doneTodayTitles = useMemo(
    () => new Set(state.tasks.filter((t) => t.done && t.completedAt && localDateStr(new Date(t.completedAt)) === todayStr()).map((t) => t.title)),
    [state.tasks],
  );
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
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: true, completedAt: Date.now() } : t)),
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

  const logQuickTask = useCallback((title: string, xp: number) => {
    setState((s) => {
      const today = todayStr();
      let streak = s.streak;
      if (s.lastCompletionDate !== today) {
        streak = s.lastCompletionDate === yesterdayStr() ? s.streak + 1 : 1;
      }
      const newXp = s.xp + xp;
      let level = s.level;
      let xpRem = newXp;
      while (xpRem >= xpForLevel(level)) {
        xpRem -= xpForLevel(level);
        level += 1;
      }
      const t: Task = {
        id: crypto.randomUUID(),
        title,
        xp,
        done: true,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };
      setFloaters((f) => [...f, { id: Date.now() + Math.random(), xp }]);
      return {
        ...s,
        tasks: [t, ...s.tasks],
        xp: xpRem,
        level,
        streak,
        lastCompletionDate: today,
        totalCompleted: s.totalCompleted + 1,
      };
    });
  }, []);


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
          maskImage: "linear-gradient(180deg, black 60%, transparent 100%), repeating-linear-gradient(0deg, black 0 8px, transparent 8px 12px)",
          WebkitMaskImage: "linear-gradient(180deg, black 60%, transparent 100%), repeating-linear-gradient(0deg, black 0 8px, transparent 8px 12px)",
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
          <p className="mt-2 text-lg text-muted-foreground font-mono">
            // let's move //
          </p>
        </header>

        {/* Stats HUD */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="LEVEL" value={state.level.toString().padStart(2, "0")} color="pink" />
          <StatCard label="STREAK" value={`${state.streak}d`} color="yellow" />
          <StatCard label="DONE" value={state.totalCompleted.toString()} color="cyan" />
        </div>

        {/* Quest Board nav */}
        <div className="mb-6 flex justify-end">
          <Link
            to="/quests"
            className="font-display text-[10px] px-4 py-2 neon-border-cyan neon-text-cyan bg-card hover:bg-secondary/10 transition-colors"
          >
            [ QUEST BOARD ]
          </Link>
        </div>

        {/* Rituals — all equal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-stretch">
          <WorkCyclePanel
            state={state}
            setState={setState}
            onFloater={(xp) => setFloaters((f) => [...f, { id: Date.now() + Math.random(), xp }])}
          />
          <RitualCard
            title="Morning Protection"
            xp={25}
            sub="daily armor up"
            accent="cyan"
            onLog={logQuickTask}
            doneToday={doneTodayTitles.has("Morning Protection")}
          />
          <RitualCard
            title="Morning Smoking Delayed?"
            xp={30}
            sub="tap = YES"
            accent="yellow"
            onLog={logQuickTask}
            doneToday={doneTodayTitles.has("Morning Smoking Delayed?")}
          />
        </div>




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
                background: "linear-gradient(90deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan))",
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
          <h2 className="font-display text-xs neon-text-cyan mb-3">// MISSIONS [{activeTasks.length}]</h2>
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
                    i === selectedIdx
                      ? "neon-border"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-display text-[10px] neon-text-yellow">
                    +{t.xp}
                  </span>
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
                <li key={t.id} className="flex items-center gap-3 font-mono text-lg line-through text-muted-foreground">
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
            saveUrgeEntry(entry);
            setUrgeOpen(false);
          }}
        />
      )}
      <UrgeLog open={urgeLogOpen} onOpenChange={setUrgeLogOpen} />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
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

function RitualCard({
  title,
  xp,
  sub,
  accent,
  onLog,
  doneToday,
}: {
  title: string;
  xp: number;
  sub: string;
  accent: "pink" | "cyan" | "yellow";
  onLog: (title: string, xp: number) => void;
  doneToday?: boolean;
}) {
  const border = accent === "cyan" ? "neon-border-cyan" : "neon-border";
  const text =
    accent === "cyan"
      ? "neon-text-cyan"
      : accent === "yellow"
      ? "neon-text-yellow"
      : "neon-text-pink";
  return (
    <button
      onClick={() => !doneToday && onLog(title, xp)}
      disabled={doneToday}
      className={`group bg-card ${border} scanlines p-4 text-left h-full flex flex-col transition-all ${
        doneToday ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.99]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`font-display text-[11px] ${text} leading-snug`}>
          {title}
        </span>
        <span className="font-display text-[10px] neon-text-yellow shrink-0">
          {doneToday ? "✓ DONE" : `+${xp}XP`}
        </span>
      </div>
      <p className="font-mono text-sm text-muted-foreground">{doneToday ? "logged today" : sub}</p>
    </button>
  );
}



