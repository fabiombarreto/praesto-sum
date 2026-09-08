// The small `/settings` card linking into `/settings/notifications`
// (infrastructure — no AC of its own; the behaviour it links to is
// `NotificationsCard`/`NotificationsScreen`'s). No local reducer needed —
// this card holds no async state of its own, mirroring `DataExportCard`'s
// simplicity rather than `GoogleConnectionCard`'s.

import { classifyNotificationPermissionView } from "../../shared/notification-permission";
import { Button } from "./ui/Button";

const STATUS_LABEL: Readonly<
  Record<ReturnType<typeof classifyNotificationPermissionView>, string>
> = {
  explainer: "Notificações desativadas.",
  blocked: "Notificações bloqueadas.",
  enabled: "Notificações ativas.",
};

export function NotificationsEntryCard({
  onOpenNotifications,
}: {
  onOpenNotifications: () => void;
}) {
  const view = classifyNotificationPermissionView(Notification.permission);

  return (
    <section
      aria-label="Notificações"
      className="flex flex-col gap-4 rounded-card bg-surface-1 p-4"
    >
      <p className="m-0 font-text text-t2 text-muted">{STATUS_LABEL[view]}</p>
      <Button type="button" variant="primary" onClick={onOpenNotifications}>
        Abrir
      </Button>
    </section>
  );
}
