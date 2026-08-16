import { useState } from 'react';

import { InlineError } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Input';

interface ReviewDecisionProps {
  subject: string;
  onVerify: () => void;
  onReject: (reason: string) => void;
  isPending: boolean;
  error: unknown;
}

// Approve/reject, shared by the driver-application and vehicle queues.
//
// A rejection reason is mandatory (the backend requires 1-500 chars) and it is
// shown verbatim to the applicant, who has no other way of learning what went
// wrong — so the prompt asks for something the applicant can act on rather
// than an internal note.
export function ReviewDecision({
  subject,
  onVerify,
  onReject,
  isPending,
  error,
}: ReviewDecisionProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  function submitRejection() {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError('Explain what needs fixing — the applicant sees this.');
      return;
    }
    if (trimmed.length > 500) {
      setReasonError('Keep it under 500 characters.');
      return;
    }
    setReasonError(undefined);
    onReject(trimmed);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button loading={isPending} onClick={onVerify}>
          Approve
        </Button>
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setRejectOpen(true);
          }}
        >
          Reject
        </Button>
      </div>

      {error !== undefined && <InlineError error={error} className="mt-3" />}

      <Dialog
        open={rejectOpen}
        onOpenChange={isPending ? () => undefined : setRejectOpen}
        title={`Reject ${subject}?`}
        description="The reason you give is shown to the applicant."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setRejectOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={isPending} onClick={submitRejection}>
              Reject
            </Button>
          </>
        }
      >
        <Field
          label="Reason for rejection"
          error={reasonError}
          hint="Be specific — this is the only feedback they get."
          required
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={reasonError !== undefined}
              placeholder="The licence photo is too blurry to read the number."
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
