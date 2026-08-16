import { ArrowRight, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PlaceInput, type PlaceValue } from '@/components/domain/PlaceInput';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Input';
import { todayInKolkata } from '@/lib/kolkataDate';
import { cn } from '@/lib/cn';

import type { SearchCriteria } from './searchParams';

interface SearchFormProps {
  initial?: SearchCriteria | null;
  onSubmit: (criteria: SearchCriteria) => void;
  // The results page reuses this as a single compact row above the list.
  compact?: boolean;
}

export function SearchForm({ initial, onSubmit, compact = false }: SearchFormProps) {
  const [from, setFrom] = useState<PlaceValue | null>(initial?.from ?? null);
  const [to, setTo] = useState<PlaceValue | null>(initial?.to ?? null);
  const [date, setDate] = useState(initial?.date ?? todayInKolkata());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    // A typed string with no selection has no coordinates, and coordinates are
    // the only thing the search endpoint accepts.
    if (from === null) nextErrors.from = 'Pick a place from the list';
    if (to === null) nextErrors.to = 'Pick a place from the list';
    if (date.length === 0) nextErrors.date = 'Choose a date';

    if (Object.keys(nextErrors).length > 0 || from === null || to === null) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit({ from, to, date, sort: initial?.sort ?? 'DEPARTURE_TIME' });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'grid gap-3',
        compact
          ? 'sm:grid-cols-2 lg:grid-cols-[1fr_1fr_170px_auto] lg:items-end'
          : 'sm:grid-cols-2 lg:grid-cols-[1fr_1fr_170px]',
      )}
    >
      <Field label="Leaving from" error={errors.from} required>
        {({ id, describedBy }) => (
          <PlaceInput
            id={id}
            aria-describedby={describedBy}
            invalid={errors.from !== undefined}
            value={from}
            onChange={setFrom}
            placeholder="Connaught Place, Delhi"
          />
        )}
      </Field>

      <Field label="Going to" error={errors.to} required>
        {({ id, describedBy }) => (
          <PlaceInput
            id={id}
            aria-describedby={describedBy}
            invalid={errors.to !== undefined}
            value={to}
            onChange={setTo}
            placeholder="Jaipur, Rajasthan"
          />
        )}
      </Field>

      <Field label="Date" error={errors.date} required>
        {({ id, describedBy }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            invalid={errors.date !== undefined}
            type="date"
            // Search matches a single calendar day and rides must depart in
            // the future, so past dates can only ever return nothing.
            min={todayInKolkata()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
        )}
      </Field>

      <div className={compact ? '' : 'lg:col-span-3'}>
        <Button type="submit" size="lg" className={compact ? '' : 'w-full sm:w-auto'}>
          <Search className="size-4" aria-hidden />
          Search
          {!compact && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
