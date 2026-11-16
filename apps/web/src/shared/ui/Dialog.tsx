import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useState, type ReactNode } from 'react';

const layouts = {
  md: 'left-1/2 top-1/2 max-h-[calc(100vh-2rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg',
  lg: 'left-1/2 top-1/2 max-h-[calc(100vh-2rem)] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg',
  /** A panel on the right edge, full height: keeps the page visible beside it. */
  sheet: 'inset-y-0 right-0 h-full w-[min(36rem,100vw)] border-l border-slate-200',
} as const;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
  size?: keyof typeof layouts;
}

/**
 * Where focus goes back to when a dialog closes. Radix only restores focus to a
 * `Dialog.Trigger`; our dialogs open from state, so we remember what had focus when the
 * dialog appeared. If that element is gone (e.g. the row action it belonged to changed),
 * focus lands on the main content instead of the page body.
 */
function restoreFocus(target: HTMLElement | null) {
  const destination =
    target?.isConnected === true ? target : document.querySelector<HTMLElement>('main');
  destination?.focus();
}

/** Accessible modal: focus trap, Escape to close, labelled by its title and description. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: DialogProps) {
  const [returnTo] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  // Most dialogs close by being unmounted by their parent: restore focus then too.
  useEffect(
    () => () => {
      setTimeout(() => {
        if (document.activeElement === document.body || document.activeElement === null) {
          restoreFocus(returnTo);
        }
      });
    },
    [returnTo],
  );

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-slate-900/40" />
        <RadixDialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus(returnTo);
          }}
          className={`fixed overflow-y-auto bg-white p-6 shadow-xl outline-none ${layouts[size]}`}
        >
          <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
          <RadixDialog.Description className="mt-2 text-sm text-slate-600">
            {description}
          </RadixDialog.Description>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
