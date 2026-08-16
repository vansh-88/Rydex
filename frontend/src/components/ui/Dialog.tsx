import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  // Payment dialogs must not be dismissable while an order is being
  // confirmed — closing that screen loses the only thing telling the user
  // what is happening.
  dismissable?: boolean;
  className?: string;
}

// Built on the platform's own <dialog showModal()> rather than a div overlay.
// That gets focus trapping, Escape handling, the ::backdrop, background
// inertness and correct screen-reader semantics from the browser, all of
// which are easy to get subtly wrong by hand.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // showModal()/close() are imperative, so open state has to be pushed into
  // the element rather than rendered as a prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // The browser scrolls the page behind an open modal; locking it keeps
      // the backdrop still.
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }
  }, [open]);

  // Restore scrolling if the dialog unmounts while still open.
  useEffect(
    () => () => {
      document.body.style.overflow = '';
    },
    [],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      // Escape fires `cancel` before `close`; preventing it there is what
      // makes a non-dismissable dialog actually non-dismissable.
      onCancel={(event) => {
        if (dismissable) {
          onOpenChange(false);
        } else {
          event.preventDefault();
        }
      }}
      // Also fires when the platform closes the dialog by other means, so
      // React state stays in sync either way.
      onClose={() => {
        if (open) onOpenChange(false);
      }}
      // A click landing on the <dialog> itself (rather than its content
      // wrapper) is a click on the backdrop.
      onClick={(event) => {
        if (dismissable && event.target === dialogRef.current) onOpenChange(false);
      }}
      className={cn(
        'w-[calc(100vw-2rem)] max-w-lg rounded-card border border-border-subtle bg-surface p-0 text-ink shadow-lg',
        'backdrop:bg-slate-900/40',
        'max-h-[calc(100vh-4rem)] overflow-y-auto',
        // <dialog> is display:none until opened; the browser centres it, but
        // margin:auto keeps that true at small viewport sizes too.
        'm-auto',
        className,
      )}
    >
      {/* Wrapper so the backdrop-click check above can distinguish content
          clicks from backdrop clicks. */}
      <div onClick={(event) => { event.stopPropagation(); }}>
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description !== undefined && (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {dismissable && (
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                onOpenChange(false);
              }}
              className="-m-1 rounded p-1 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {children !== undefined && <div className="p-5">{children}</div>}

        {footer !== undefined && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle p-5">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
