import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadState,
  saveState,
  xpForLevel,
  localDateStr,
  todayStr,
  yesterdayStr,
  type AppState,
  type Task,
  type Category,
} from "@/lib/storage";

const XP_VALUES = [10, 25, 50];

type CategoryConfig = {
  id: Category;
  label: string;
  accent: string;
};

const CATEGORIES: CategoryConfig[] = [
  { id: "JH", label: "Job Hunting", accent: "#ff2d78" },
  { id: "SeB", label: "Soft.e Bytes", accent: "#00f5ff" },
  { id: "MJ_SOCIAL", label: "MJ Social", accent: "#bf5fff" },
  { id: "MJ_PERSONAL", label: "MJ Personal", accent: "#ffe600" },
  { id: "SAFAI", label: "Safai", accent: "#39ff14" },
  { id: "HEALTH", label: "Health", accent: "#ff6b00" },
];

export function QuestList() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);
  const [input, setInput] = useState("");
  const [xpValue, setXpValue] = useState(25);
  const [floaters, setFloaters] = useState<Array<{ id: number; xp: number }>>([]);

  useEffect(() => saveState(state), [state]);

  const activeTasks = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);
  const completedToday = useMemo(
    () =>
      state.tasks.filter(
        (t) => t.done && t.completedAt && localDateStr(new Date(t.completedAt)) === todayStr(),
      ),
    [state.tasks],
  );

  const getActiveCategoryTasks = useCallback(
    (cat: Category) => activeTasks.filter((t) => (t.category ?? "UNCATEGORIZED") === cat),
    [activeTasks],
  );

  const getCompletedTodayCategoryTasks = useCallback(
    (cat: Category) => completedToday.filter((t) => (t.category ?? "UNCATEGORIZED") === cat),
    [completedToday],
  );

  const addTask = useCallback(() => {
    if (!expandedCategory) return;
    const title = input.trim();
    if (!title) return;
    const t: Task = {
      id: crypto.randomUUID(),
      title,
      xp: xpValue,
      done: false,
      createdAt: Date.now(),
      category: expandedCategory,
    };
    setState((s) => ({ ...s, tasks: [t, ...s.tasks] }));
    setInput("");
  }, [input, xpValue, expandedCategory]);

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

  const toggleCategory = (cat: Category) => {
    setExpandedCategory((prev) => (prev === cat ? null : cat));
    setInput("");
  };

  return (
    <div className="relative min-h-screen">
      {/* Background grid floor */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[55vh] overflow-hidden opacity-50">
        <div
          className="absolute inset-x-[-20%] top-0 h-[200%] grid-floor"
          style={{ animation: "scroll-grid 4s linear infinite" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-8 md:py-12">
        {/* Back button */}
        <div className="mb-6">
          <a href="#/" className="font-display text-[10px] neon-text-cyan hover:neon-text-pink transition-colors">
            [ ← DASHBOARD ]
          </a>
        </div>

        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="font-display text-lg md:text-2xl lg:text-3xl neon-text-pink crt-flicker leading-tight">
            // QUEST BOARD
          </h1>
        </header>

        {/* Category grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const isExpanded = expandedCategory === cat.id;
            const catTasks = getActiveCategoryTasks(cat.id);
            const completedTodayCat = getCompletedTodayCategoryTasks(cat.id);

            return (
              <div key={cat.id} className={isExpanded ? "col-span-2 md:col-span-3" : ""}>
                {/* Tile header */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full bg-card p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] scanlines"
                  style={{
                    boxShadow: `0 0 12px ${cat.accent}`,
                    border: `1px solid ${cat.accent}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-display text-[11px] leading-snug"
                      style={{ color: cat.accent, textShadow: `0 0 8px ${cat.accent}` }}
                    >
                      {cat.label}
                    </span>
                    <span className="font-display text-[10px] text-muted-foreground">
                      [{catTasks.length}]
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-muted-foreground">
                    {isExpanded ? "▲ collapse" : "▼ expand"}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div
                    className="bg-card p-4 mt-[-1px] scanlines"
                    style={{
                      boxShadow: `0 0 12px ${cat.accent}`,
                      border: `1px solid ${cat.accent}`,
                      borderTop: "none",
                    }}
                  >
                    {/* Add task input */}
                    <div className="flex gap-2 mb-4">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addTask();
                        }}
                        placeholder="> new quest..."
                        className="flex-1 bg-input border border-border px-3 py-2 font-mono text-xl text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                        className="font-display text-[10px] px-4 bg-transparent hover:bg-primary/10 transition-colors"
                        style={{
                          border: `1px solid ${cat.accent}`,
                          color: cat.accent,
                          textShadow: `0 0 8px ${cat.accent}`,
                        }}
                      >
                        ADD
                      </button>
                    </div>

                    {/* Active tasks */}
                    <h3
                      className="font-display text-[10px] mb-2"
                      style={{ color: cat.accent, textShadow: `0 0 6px ${cat.accent}` }}
                    >
                      // ACTIVE [{catTasks.length}]
                    </h3>
                    {catTasks.length === 0 ? (
                      <div className="bg-card border border-border p-6 text-center text-muted-foreground font-mono text-lg mb-4">
                        [ NO QUESTS IN THIS SECTOR ]
                      </div>
                    ) : (
                      <ul className="space-y-2 mb-4">
                        {catTasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center gap-3 bg-card p-3 border border-border"
                          >
                            <span className="font-display text-[10px] neon-text-yellow">
                              +{t.xp}
                            </span>
                            <span className="flex-1 font-mono text-xl text-foreground">
                              {t.title}
                            </span>
                            <button
                              onClick={() => completeTask(t.id)}
                              className="font-display text-[9px] px-2 py-1 neon-border-cyan hover:bg-secondary/20"
                            >
                              [X]
                            </button>
                            <button
                              onClick={() => deleteTask(t.id)}
                              className="font-display text-[9px] px-2 py-1 border border-destructive text-destructive hover:bg-destructive/20"
                            >
                              DEL
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Completed today */}
                    {completedTodayCat.length > 0 && (
                      <>
                        <h3
                          className="font-display text-[10px] mb-2 opacity-60"
                          style={{ color: cat.accent }}
                        >
                          // COMPLETED TODAY [{completedTodayCat.length}]
                        </h3>
                        <ul className="space-y-1 opacity-60">
                          {completedTodayCat.map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center gap-3 font-mono text-lg line-through text-muted-foreground"
                            >
                              <span className="neon-text-yellow no-underline">+{t.xp}</span>
                              <span>{t.title}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  );
}
