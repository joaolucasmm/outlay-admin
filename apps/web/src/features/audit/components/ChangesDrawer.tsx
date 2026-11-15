import type { AuditEvent } from 'contracts';
import { useId, useState } from 'react';
import { formatDateTime } from '../../../shared/lib/dates';
import { diffJson } from '../../../shared/lib/jsonDiff';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Dialog, DialogClose } from '../../../shared/ui/Dialog';
import { actionLabel, ROLE_OF_ACTOR } from '../labels';
import { presentChanges, type PresentContext } from '../presentChange';

const KIND: Record<'added' | 'removed' | 'changed', { label: string; tone: BadgeTone }> = {
  added: { label: 'Added', tone: 'success' },
  removed: { label: 'Removed', tone: 'warning' },
  changed: { label: 'Changed', tone: 'info' },
};

interface ChangesDrawerProps {
  event: AuditEvent;
  context: PresentContext;
  onClose: () => void;
}

/** Before → after of one audit event, field by field, with the raw JSON on demand. */
export function ChangesDrawer({ event, context, onClose }: ChangesDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);
  const rawId = useId();
  const changes = presentChanges(diffJson(event.before, event.after), context);

  return (
    <Dialog
      open
      size="sheet"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={actionLabel(event.action)}
      description={
        <>
          <time dateTime={event.at}>{formatDateTime(event.at)}</time> · by{' '}
          {ROLE_OF_ACTOR[event.actor.role]} <code className="text-xs">({event.actor.id})</code>
        </>
      }
    >
      <div className="space-y-5">
        {changes.length === 0 ? (
          <p className="text-sm text-slate-600">No field-level changes were recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Changed fields</caption>
            <thead className="text-left text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Field
                </th>
                <th scope="col" className="py-2 pr-3">
                  Before
                </th>
                <th scope="col" className="py-2">
                  After
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {changes.map((change) => (
                <tr key={change.key} className="align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    <span className="block">{change.label}</span>
                    <Badge tone={KIND[change.kind].tone}>{KIND[change.kind].label}</Badge>
                  </th>
                  <td className="py-2 pr-3 text-slate-500 line-through decoration-slate-300">
                    {change.kind === 'added' ? '—' : change.before}
                  </td>
                  <td className="py-2 font-medium">
                    {change.kind === 'removed' ? '—' : change.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div>
          <Button
            size="sm"
            aria-expanded={showRaw}
            aria-controls={rawId}
            onClick={() => {
              setShowRaw((value) => !value);
            }}
          >
            {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
          </Button>
          {showRaw && (
            <div id={rawId} className="mt-3 grid gap-3">
              {(['before', 'after'] as const).map((side) => (
                <figure key={side}>
                  <figcaption className="text-xs font-semibold uppercase text-slate-600">
                    {side}
                  </figcaption>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(event[side] ?? null, null, 2)}
                  </pre>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </div>
      </div>
    </Dialog>
  );
}
