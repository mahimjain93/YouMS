import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadJournalSorted, type JournalEntry } from "@/lib/storage";

function fmtDate(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DayJournal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const entries = useMemo<JournalEntry[]>(() => (open ? loadJournalSorted() : []), [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of entries) {
      const k = fmtDate(e.startedAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const defeatedCount = entries.filter((e) => e.defeated).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card neon-border">
        <DialogHeader>
          <DialogTitle className="font-display text-sm neon-text-pink">
            // DAY JOURNAL
          </DialogTitle>
        </DialogHeader>

        {entries.length === 0 ? (
          <div className="py-12 text-center font-mono text-muted-foreground">
            [ no urges logged yet ]
            <br />
            <span className="text-sm">every wave you ride gets recorded here.</span>
          </div>
        ) : (
          <>
            <div className="mb-4 font-mono text-sm text-muted-foreground">
              <span className="neon-text-cyan font-display">{defeatedCount}</span> defeated /{" "}
              <span className="neon-text-yellow font-display">{entries.length}</span> total
            </div>
            <div className="space-y-5">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <div className="font-display text-[10px] neon-text-cyan mb-2">{date}</div>
                  <ul className="space-y-2">
                    {items.map((e) => (
                      <li
                        key={e.id}
                        className={`bg-input border p-3 ${
                          e.defeated ? "border-secondary/40" : "border-destructive/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              {fmtTime(e.startedAt)}
                            </span>
                            {(e.entryType ?? "urge") === "urge" ? (
                              <span
                                className="font-display text-[9px] px-1.5 py-0.5 border"
                                style={{ color: "#ff2d78", borderColor: "#ff2d78" }}
                              >
                                URGE
                              </span>
                            ) : (
                              <span
                                className="font-display text-[9px] px-1.5 py-0.5 border"
                                style={{ color: "#00f5ff", borderColor: "#00f5ff" }}
                              >
                                CYCLE
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-display text-[10px] ${
                              e.defeated ? "neon-text-cyan" : "text-destructive"
                            }`}
                          >
                            {e.defeated ? "✓ DEFEATED" : "✗ URGE WON"}
                          </span>
                        </div>
                        {e.reason && (
                          <p className="font-mono text-base text-foreground mb-1 whitespace-pre-wrap">
                            "{e.reason}"
                          </p>
                        )}
                        {(e.actionsUsed?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {e.actionsUsed!.map((a) => (
                              <span
                                key={a}
                                className="font-display text-[9px] px-2 py-0.5 border border-border text-muted-foreground"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
