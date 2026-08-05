import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { TaskDto } from "../shared/api";
import { classifyRequestFailure } from "../shared/request-failure";
import type { ShareTarget } from "../shared/share-target";
import {
  ApiError,
  completeTask,
  createTask,
  deleteTask,
  getToken,
  listTasks,
  reopenTask,
  setToken,
} from "./api";

/**
 * Phase 1 walking skeleton: capture a Task, see it, complete it.
 *
 * It exists to prove the whole stack end to end (PWA → Worker → D1) and to be
 * the surface the remaining Phase 1 requirements grow into — recurrence
 * (FR-009), misses (FR-011/FR-012), reminders (FR-041/FR-044), search (FR-040).
 * Styling is deliberately minimal; the design pass is its own slice.
 */
export function App({ initialShare }: { initialShare: ShareTarget | null }) {
  const [authorized, setAuthorized] = useState<boolean>(getToken() !== null);

  if (!authorized) {
    return <TokenGate onAuthorized={() => setAuthorized(true)} />;
  }
  return <TaskBoard onUnauthorized={() => setAuthorized(false)} initialShare={initialShare} />;
}

function TokenGate({ onAuthorized }: { onAuthorized: () => void }) {
  const [value, setValue] = useState("");

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Praesto Sum</h1>
      <p style={styles.muted}>Paste the API token for this device.</p>
      <form
        style={styles.row}
        onSubmit={(event) => {
          event.preventDefault();
          const token = value.trim();
          if (!token) return;
          setToken(token);
          onAuthorized();
        }}
      >
        <input
          style={styles.input}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="API token"
          aria-label="API token"
        />
        <button style={styles.button} type="submit">
          Save
        </button>
      </form>
    </main>
  );
}

function TaskBoard({
  onUnauthorized,
  initialShare,
}: {
  onUnauthorized: () => void;
  initialShare: ShareTarget | null;
}) {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialShare?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleFailure = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setError(classifyRequestFailure(cause).message);
    },
    [onUnauthorized],
  );

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      setError(null);
    } catch (cause) {
      handleFailure(cause);
    }
  }, [handleFailure]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (cause) {
      handleFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  const open = tasks?.filter((task) => task.status === "open") ?? [];
  const closed = tasks?.filter((task) => task.status !== "open") ?? [];

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Praesto Sum</h1>

      <form
        style={styles.row}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = title.trim();
          if (!trimmed || busy) return;
          void run(async () => {
            await createTask({ title: trimmed });
            // Phase 4 (install-and-quick-capture) invariant, locked in
            // explicitly: `setTitle("")` is deliberately sequenced AFTER the
            // awaited `createTask(...)` call above, never before or
            // unconditionally. A thrown failure — network-unreachable or
            // HTTP-level, both now surfaced via `classifyRequestFailure` in
            // `handleFailure` — exits this callback before this line runs,
            // so on any failed save the owner's typed text is not lost; it
            // remains exactly as typed in the input's `value={title}`
            // binding (PRD AC-4).
            setTitle("");
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
          });
        }}
      >
        <input
          style={styles.input}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setJustSaved(false);
          }}
          placeholder="What needs doing?"
          aria-label="Task title"
          // Phase 3 (install-and-quick-capture) decision: `autoFocus` stays
          // unconditional across devices, not gated by device/pointer type.
          // The PRD's Open Question 1 raises this ("may be unwelcome on
          // desktop, where it raises the on-screen keyboard on touch
          // laptops") but explicitly defers it — "to be validated in real
          // use rather than decided now" — and no device/pointer-type
          // detection exists anywhere in this codebase today. Revisit with
          // a `matchMedia("(any-pointer: coarse)")` check if real use on
          // the owner's Windows PC surfaces friction.
          autoFocus
        />
        <button style={styles.button} type="submit" disabled={busy}>
          Add
        </button>
      </form>

      {justSaved && <p style={styles.muted}>Saved</p>}
      {error !== null && <p style={styles.error}>{error}</p>}
      {tasks === null && error === null && <p style={styles.muted}>Loading…</p>}

      <ul style={styles.list}>
        {open.map((task) => (
          <li key={task.id} style={styles.item}>
            <button
              style={styles.link}
              type="button"
              disabled={busy}
              onClick={() => void run(() => completeTask(task.id))}
            >
              ○
            </button>
            <span style={styles.grow}>{task.title}</span>
            <button
              style={styles.link}
              type="button"
              disabled={busy}
              onClick={() => void run(() => deleteTask(task.id))}
              aria-label={`Delete ${task.title}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {closed.length > 0 && (
        <>
          <h2 style={styles.subtitle}>Closed</h2>
          <ul style={styles.list}>
            {closed.map((task) => (
              <li key={task.id} style={styles.item}>
                <button
                  style={styles.link}
                  type="button"
                  disabled={busy || task.status === "missed"}
                  onClick={() => void run(() => reopenTask(task.id))}
                >
                  {task.status === "done" ? "●" : "!"}
                </button>
                <span style={{ ...styles.grow, ...styles.closedText }}>{task.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tasks !== null && tasks.length === 0 && (
        <p style={styles.muted}>Nothing here yet. Add the first one above.</p>
      )}
    </main>
  );
}

const styles = {
  page: {
    fontFamily: "system-ui, sans-serif",
    maxWidth: "34rem",
    margin: "0 auto",
    padding: "1.5rem 1rem 4rem",
  },
  title: { fontSize: "1.5rem", margin: "0 0 1rem" },
  subtitle: { fontSize: "0.9rem", textTransform: "uppercase", opacity: 0.6, marginTop: "2rem" },
  muted: { opacity: 0.6 },
  error: { color: "#b00020" },
  row: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  input: { flex: 1, padding: "0.6rem", fontSize: "1rem" },
  button: { padding: "0.6rem 1rem", fontSize: "1rem", cursor: "pointer" },
  list: { listStyle: "none", padding: 0, margin: 0 },
  item: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" },
  grow: { flex: 1 },
  closedText: { opacity: 0.5, textDecoration: "line-through" },
  link: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1.1rem",
    padding: 0,
    lineHeight: 1,
  },
} as const satisfies Record<string, CSSProperties>;
