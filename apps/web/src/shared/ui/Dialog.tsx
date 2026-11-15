import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
}

/** Accessible modal: focus trap, Escape to close, labelled by its title and description. */
export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-slate-900/40" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl outline-none">
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
