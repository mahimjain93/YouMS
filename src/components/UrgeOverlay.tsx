import { useEffect, useMemo, useRef, useState } from "react";
import type { UrgeAction, JournalEntry } from "@/lib/storage";

const AFFIRMATIONS = [
  "BREATHE. THE URGE IS A WAVE. RIDE IT.",
  "YOU ARE THE PLAYER, NOT THE GAME.",
  "5 MINUTES. JUST WAIT 5 MINUTES.",
  "FUTURE YOU IS WATCHING. MAKE THEM PROUD.",
  "DISCIPLINE > MOTIVATION.",
  "THE URGE WILL PASS. YOU WILL REMAIN.",
];

const ACTION_OPTIONS: Array<{ key: UrgeAction; label: string; hint: string }> = [
  { key: "breathing", label: "BREATHE", hint: "follow the ring above" },
  { key: "walk", label: "TAKE A WALK", hint: "5 min, even just the room" },
  { key: "water", label: "DRINK WATER", hint: "a full glass, slowly" },
  { key: "stretch", label: "STRETCH", hint: "neck, shoulders, hips" },
  { key: "cold-water", label: "COLD WATER", hint: "splash face / wrists" },
];

export function UrgeOverlay({ onClose }: { onClose: (entry: JournalEntry) => void }) {
  const [seconds, setSeconds] = useState(60);
  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)],
  );
  const [breathPhase, setBreathPhase] = useState<"in" | "hold" | "out">("in");
  const [reason, setReason] = useState("");
  const [actions, setActions] = useState<Set<UrgeAction>>(() => new Set(["breathing"]));
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const phases: Array<"in" | "hold" | "out"> = ["in", "hold", "out"];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % phases.length;
      setBreathPhase(phases[i]);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const finish = (defeated: boolean) => {
    const trimmed = reason.trim().slice(0, 1000);
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      entryType: "urge",
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      reason: trimmed || undefined,
      defeated,
      actionsUsed: Array.from(actions),
    };
    onClose(entry);
  };

  const toggleAction = (key: UrgeAction) => {
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const locked = seconds > 0;

  const charCount = useMemo(() => reason.length, [reason]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 backdrop-blur-sm scanlines crt-flicker">
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden opacity-60 pointer-events-none">
        <div
          className="absolute inset-0 grid-floor"
          style={{ animation: "scroll-grid 1.2s linear infinite" }}
        />
      </div>

      <div className="relative z-10 mx-4 my-8 w-full max-w-2xl text-center">
        <div className="mb-4 text-xs neon-text-yellow font-display">!! URGE MODE !!</div>

        <div
          className="mx-auto mb-6 flex h-36 w-36 items-center justify-center rounded-full neon-border transition-all duration-[4000ms] ease-in-out"
          style={{
            transform:
              breathPhase === "in"
                ? "scale(1.25)"
                : breathPhase === "hold"
                ? "scale(1.25)"
                : "scale(0.75)",
          }}
        >
          <div className="font-display text-xs neon-text-pink">
            {breathPhase === "in" ? "INHALE" : breathPhase === "hold" ? "HOLD" : "EXHALE"}
          </div>
        </div>

        <h2 className="mb-4 font-display text-sm leading-relaxed neon-text-pink md:text-lg">
          {affirmation}
        </h2>

        {/* Coping actions */}
        <div className="mb-4 text-left">
          <div className="font-display text-[10px] neon-text-cyan mb-2">// TRY ONE (or more)</div>
          <div className="flex flex-wrap gap-2">
            {ACTION_OPTIONS.map((a) => {
              const active = actions.has(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => toggleAction(a.key)}
                  className={`font-display text-[10px] px-3 py-2 transition-colors ${
                    active
                      ? "neon-border bg-primary/15 neon-text-pink"
                      : "border border-border text-muted-foreground hover:border-primary/50"
                  }`}
                  title={a.hint}
                >
                  {active ? "✓ " : ""}
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Journal */}
        <div className="mb-4 text-left">
          <label className="font-display text-[10px] neon-text-cyan mb-2 block">
            // WHAT TRIGGERED THIS? (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            placeholder="name it. no judgment."
            rows={3}
            className="w-full bg-input border border-border px-3 py-2 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:neon-border-cyan resize-none"
          />
          <div className="mt-1 text-right text-[10px] font-mono text-muted-foreground">
            {charCount}/1000
          </div>
        </div>

        {locked ? (
          <p className="mb-4 text-base text-muted-foreground">
            signal clears in{" "}
            <span className="neon-text-cyan font-display text-xl">{seconds}</span>s
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => finish(true)}
              className="font-display text-xs px-6 py-3 neon-border-cyan bg-transparent text-secondary hover:bg-secondary/10 transition-colors"
            >
              [ I DEFEATED IT ]
            </button>
            <button
              onClick={() => finish(false)}
              className="font-display text-xs px-6 py-3 border border-border bg-transparent text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
            >
              [ URGE WON THIS ROUND ]
            </button>
          </div>
        )}
        {!locked && (
          <p className="mt-3 text-[10px] font-mono text-muted-foreground">
            both are honest. logging it is the win.
          </p>
        )}
      </div>
    </div>
  );
}
