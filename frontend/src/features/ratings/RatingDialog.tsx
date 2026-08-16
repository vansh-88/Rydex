import { useCallback, useState } from 'react';

import { listRatings, submitRating } from '@/api/endpoints/bookings';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import { InlineError } from '@/components/domain/States';
import { StarInput } from '@/components/domain/StarRating';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

interface RatingDialogProps {
  bookingId: string;
  // Only used for the heading — the backend derives who is being rated from
  // the caller, so the client never sends a target.
  rateeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

const MAX_COMMENT_LENGTH = 1000;

export function RatingDialog({
  bookingId,
  rateeName,
  open,
  onOpenChange,
  onSubmitted,
}: RatingDialogProps) {
  const { toast } = useToast();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');

  const mutation = useApiMutation(
    () =>
      submitRating(bookingId, {
        score,
        ...(comment.trim().length > 0 ? { comment: comment.trim() } : {}),
      }),
    {
      // A new rating changes the ratee's average, which appears on rides and
      // profiles across the app.
      invalidates: ['bookings', 'rides', 'ratings'],
      onSuccess: () => {
        toast('Thanks — your rating has been recorded.', 'success');
        onOpenChange(false);
        onSubmitted?.();
      },
    },
  );

  return (
    <Dialog
      open={open}
      onOpenChange={mutation.isPending ? () => undefined : onOpenChange}
      title={`Rate ${rateeName}`}
      description="Ratings can't be changed once submitted."
      footer={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Not now
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate(undefined);
            }}
          >
            Submit rating
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2">
          <StarInput value={score} onChange={setScore} disabled={mutation.isPending} />
        </div>

        <Field label="Comment" hint="Optional.">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="How was the trip?"
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
              }}
            />
          )}
        </Field>

        {mutation.error !== undefined && <InlineError error={mutation.error} />}
      </div>
    </Dialog>
  );
}

// Whether the signed-in user has already rated this booking.
//
// The backend rejects a second rating with 409 ALREADY_RATED rather than
// replaying it, and ratings are immutable — so the UI has to know beforehand
// and stop offering the action, instead of surfacing an error.
export function useHasRated(bookingId: string | undefined, myUserId: string | undefined) {
  const { data, refetch } = useApiQuery(
    bookingId !== undefined ? `ratings:${bookingId}` : null,
    useCallback(
      (signal: AbortSignal) => listRatings(bookingId ?? '', signal),
      [bookingId],
    ),
  );

  // The endpoint returns ratings the caller gave *or* received, so "have I
  // rated?" means finding one where I am the rater.
  const hasRated =
    data !== undefined && myUserId !== undefined
      ? data.items.some((rating) => rating.raterId === myUserId)
      : false;

  return { hasRated, refetch };
}
