import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

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

/** Accessible modal: focus trap, Escape to close, labelled by its title and description. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-slate-900/40" />
        <RadixDialog.Content
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
