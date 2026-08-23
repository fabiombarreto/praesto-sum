// Dev-only playground (PRD AC-20): every design token and the primitives
// that exist today, in one page, mounted from src/app/main.tsx only when
// `import.meta.env.DEV && location.pathname === "/design"`, through a
// dynamic import, so this module never reaches the production bundle.
// A5 phase 2 adds the "Tela Hoje" section: a row in every state (open,
// overdue, done, missed, editing), a toast with and without an action, the
// banner, the empty state, the skeleton and the capture deck — every state
// registered here still never reaches the production bundle either.

import type { ReactNode } from "react";
import { useReducer, useRef, useState } from "react";
import type { TaskDto } from "../../shared/api";
import { currentDraft, INITIAL_TASK_SHEET_STATE, reduceTaskSheet } from "../../shared/task-sheet";
import { CaptureDeck } from "./CaptureDeck";
import { EmptyState } from "./EmptyState";
import { TaskRow } from "./TaskRow";
import { TaskSheet } from "./TaskSheet";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Chip, ChipGroup } from "./ui/Chip";
import { cn } from "./ui/cn";
import { CompleteControl } from "./ui/CompleteControl";
import { ConfirmView } from "./ui/ConfirmView";
import { Sheet } from "./ui/Sheet";
import { Skeleton } from "./ui/Skeleton";
import { Toast } from "./ui/Toast";

/** The fixture dates `test/format.test.ts` pins, so the rendered phrases are known. */
const PLAYGROUND_TODAY = "2026-08-21";

function playgroundTask(
  task: Pick<TaskDto, "id" | "title" | "status"> & Partial<TaskDto>,
): TaskDto {
  return {
    description: null,
    deadline: null,
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 0,
    ...task,
  };
}

const PLAYGROUND_TASKS: TaskDto[] = [
  playgroundTask({
    id: "row-open",
    title: "Pagar aluguel",
    status: "open",
    deadline: "2026-08-21",
    priority: "high",
  }),
  playgroundTask({
    id: "row-overdue",
    title: "Renovar o passaporte antes da viagem de outubro",
    status: "open",
    deadline: "2026-08-18",
  }),
  playgroundTask({
    id: "row-done",
    title: "Levar o carro para revisão",
    status: "done",
    completedAt: 1755000000,
  }),
  playgroundTask({ id: "row-missed", title: "Ligar para o dentista", status: "missed" }),
  playgroundTask({ id: "row-editing", title: "Escrever o relatório mensal", status: "open" }),
];

/** Every colour-role token src/app/tokens.css declares (guidelines §3.5). */
const COLOR_TOKENS = [
  "--color-bg",
  "--color-surface-1",
  "--color-surface-2",
  "--color-surface-3",
  "--color-line",
  "--color-line-strong",
  "--color-ink",
  "--color-muted",
  "--color-faint",
  "--color-accent",
  "--color-accent-deep",
  "--color-on-accent",
  "--color-live",
];

/** The 4 px spacing scale actually declared in tokens.css (1–4, 6, 8 — no 5/7 rung). */
const SPACE_TOKENS = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8"];

const RADIUS_CLASSES = ["rounded-card", "rounded-control", "rounded-pill"];

const SHADOW_CLASSES = [
  "shadow-row",
  "shadow-deck",
  "shadow-control",
  "shadow-control-pressed",
  "shadow-field",
  "shadow-glow-live",
  "shadow-halo-done",
];

const DURATIONS = [
  { label: "short", value: "var(--duration-short)" },
  { label: "medium", value: "var(--duration-medium)" },
  { label: "long", value: "var(--duration-long)" },
];

/** Reads a token's current computed value off `:root`, printed next to each swatch. */
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="font-text text-t4 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function DesignPlayground() {
  const [checkedOpen, setCheckedOpen] = useState(false);
  const [checkedDone, setCheckedDone] = useState(true);
  const [chips, setChips] = useState<string[]>(["alta"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetState, dispatchSheet] = useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE);
  const sheetTask = PLAYGROUND_TASKS.find((task) => task.id === sheetState.taskId) ?? null;
  const [playgroundTitle, setPlaygroundTitle] = useState("");
  const playgroundCaptureRef = useRef<HTMLInputElement>(null);

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-8 bg-bg px-4 pt-8 pb-16 text-ink">
      <h1 className="font-text text-t5 font-semibold text-ink">Design — tokens e estados</h1>

      <Section title="Cores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_TOKENS.map((name) => (
            <div key={name} className="flex flex-col gap-2">
              <div
                className="h-12 rounded-control border border-line"
                style={{ background: `var(${name})` }}
                aria-hidden="true"
              />
              <div className="font-data text-t1 text-muted">
                <div>{name}</div>
                <div>{readToken(name)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipo">
        <div className="flex flex-col gap-2">
          <p className="font-text text-t1 font-normal">text-t1 · Inter 400</p>
          <p className="font-text text-t2 font-normal">text-t2 · Inter 400</p>
          <p className="font-text text-t3 font-semibold">text-t3 · Inter 600</p>
          <p className="font-text text-t4 font-semibold">text-t4 · Inter 600</p>
          <p className="font-text text-t5 font-semibold">text-t5 · Inter 600</p>
          <p className="font-display text-t4 font-extrabold">praesto</p>
          <p className="font-display text-t5 font-extrabold">4</p>
          <p className="font-data text-t2">0123456789 · 14:05 · #A1B2C3</p>
        </div>
      </Section>

      <Section title="Espaço">
        <div className="flex flex-col gap-2">
          {SPACE_TOKENS.map((name) => (
            <div key={name} className="flex items-center gap-3">
              <div className="h-3 bg-accent" style={{ width: `var(${name})` }} aria-hidden="true" />
              <span className="font-data text-t1 text-muted">
                {name} · {readToken(name)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Raios">
        <div className="flex flex-wrap gap-4">
          {RADIUS_CLASSES.map((radiusClassName) => (
            <div
              key={radiusClassName}
              className={cn(
                "flex size-16 items-center justify-center border border-line bg-surface-2 text-center font-data text-t1 text-muted",
                radiusClassName,
              )}
            >
              {radiusClassName}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevação">
        <div className="flex flex-wrap gap-6 py-2">
          {SHADOW_CLASSES.map((shadowClassName) => (
            <div
              key={shadowClassName}
              className={cn(
                "flex size-16 items-center justify-center rounded-control bg-surface-2 text-center font-data text-t1 text-muted",
                shadowClassName,
              )}
            >
              {shadowClassName}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Movimento">
        <div className="flex flex-wrap gap-4">
          {DURATIONS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              className="flex size-16 items-center justify-center rounded-control border border-line bg-surface-2 font-data text-t1 text-muted transition-transform ease-out hover:-translate-y-1 focus-visible:-translate-y-1"
              style={{ transitionDuration: value }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-data text-t1 text-muted">
          easing: --ease-standard · --ease-enter · --ease-exit
        </p>
      </Section>

      <Section title="Componentes">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="primary" disabled>
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
            <Button variant="icon" aria-label="Ícone de exemplo">
              <span aria-hidden="true">+</span>
            </Button>
            <Button variant="icon" aria-label="Ícone de exemplo desabilitado" disabled>
              <span aria-hidden="true">+</span>
            </Button>
          </div>

          <div className="flex items-center gap-6">
            <CompleteControl
              checked={checkedOpen}
              onCheckedChange={setCheckedOpen}
              label="Concluir tarefa de exemplo (aberta)"
            />
            <CompleteControl
              checked={checkedDone}
              onCheckedChange={setCheckedDone}
              label="Reabrir tarefa de exemplo (concluída)"
            />
          </div>

          <ChipGroup value={chips} onValueChange={setChips} label="Prioridade de exemplo">
            <Chip value="alta">Alta</Chip>
            <Chip value="normal">Normal</Chip>
            <Chip value="baixa">Baixa</Chip>
          </ChipGroup>

          <div className="flex items-center gap-2">
            <img src="/brand/mark-flat.svg" alt="" className="size-8" />
            <span className="font-display text-t4 font-extrabold">praesto</span>
          </div>

          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Abrir sheet de exemplo
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Sheet de exemplo">
            <p className="font-text text-t2 text-ink">
              Um corpo curto para mostrar a folha — agora um {"<dialog>"} nativo aberto com
              showModal().
            </p>
          </Sheet>
        </div>
      </Section>

      <Section title="Tela Hoje">
        <div className="flex flex-col gap-4">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {PLAYGROUND_TASKS.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={PLAYGROUND_TODAY}
                busy={false}
                editing={task.id === "row-editing"}
                onToggle={() => {}}
                onOpen={() => {}}
                onEdit={() => {}}
                onCommitTitle={() => {}}
                onCancelEdit={() => {}}
              />
            ))}
          </ul>

          <Toast
            toast={{ key: "task-done", text: "Tarefa concluída", action: { label: "Desfazer" } }}
            onAction={() => {}}
            onSecondary={() => {}}
            onDismiss={() => {}}
          />
          <Toast
            toast={{ key: "task-saved", text: "Tarefa salva" }}
            onAction={() => {}}
            onSecondary={() => {}}
            onDismiss={() => {}}
          />
          <Toast
            toast={{
              key: "task-error",
              tone: "error",
              text: "Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.",
            }}
            onAction={() => {}}
            onSecondary={() => {}}
            onDismiss={() => {}}
          />

          <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />

          <EmptyState onCapture={() => {}} />

          <Skeleton slow />

          <CaptureDeck
            value={playgroundTitle}
            onChange={setPlaygroundTitle}
            onSubmit={() => {}}
            busy={false}
            canWrite={true}
            error={null}
            autoFocus={false}
            inputRef={playgroundCaptureRef}
          />
        </div>
      </Section>

      <Section title="Sheet de tarefa">
        <div className="flex flex-col gap-4">
          <Button
            variant="secondary"
            onClick={() => dispatchSheet({ type: "open", task: PLAYGROUND_TASKS[0]! })}
          >
            Abrir sheet de tarefa
          </Button>
          <TaskSheet
            task={sheetTask}
            open={sheetState.taskId !== null}
            view={sheetState.view}
            draft={sheetTask === null ? null : currentDraft(sheetState, sheetTask)}
            busy={false}
            error={null}
            toastSlot={null}
            onDraftChange={(changes) => dispatchSheet({ type: "edit", changes })}
            onClose={() => dispatchSheet({ type: "close" })}
            onSave={() => {
              if (sheetTask !== null) dispatchSheet({ type: "saved", taskId: sheetTask.id });
            }}
            onDeleteRequest={() => dispatchSheet({ type: "request-delete" })}
            onDeleteCancel={() => dispatchSheet({ type: "cancel-delete" })}
            onDeleteConfirm={() => {
              if (sheetTask !== null) dispatchSheet({ type: "deleted", taskId: sheetTask.id });
            }}
          />
          <div className="rounded-card border border-line bg-surface-1 px-4">
            <ConfirmView
              title="Excluir esta tarefa?"
              body="Não dá para desfazer."
              cancelLabel="Cancelar"
              confirmLabel="Excluir"
              busy={false}
              error={null}
              onCancel={() => {}}
              onConfirm={() => {}}
            />
          </div>
        </div>
      </Section>

      <Section title="Foco">
        <p className="font-text text-t2 text-muted">
          Pressione Tab para navegar pelos controles acima e ver o anel de foco em duas cores.
        </p>
      </Section>
    </main>
  );
}
