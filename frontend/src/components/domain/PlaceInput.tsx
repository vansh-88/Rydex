import { Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { autocompletePlaces } from '@/api/endpoints/rides';
import type { PlaceSuggestion } from '@/api/types';
import { cn } from '@/lib/cn';

// Ride search and ride creation both take coordinates and never free text, so
// this is the only thing that turns what a user types into a usable location.
// A selection is therefore not optional — typing a place name without picking
// a suggestion leaves the form with nothing to submit.
export interface PlaceValue {
  label: string;
  latitude: number;
  longitude: number;
}

interface PlaceInputProps {
  id?: string;
  value: PlaceValue | null;
  onChange: (value: PlaceValue | null) => void;
  placeholder?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
}

// The backend enforces a 2-character minimum; matching it here avoids a
// round trip that can only fail.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function PlaceInput({
  id,
  value,
  onChange,
  placeholder,
  invalid = false,
  'aria-describedby': describedBy,
}: PlaceInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;

  const [query, setQuery] = useState(value?.label ?? '');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the current query text came from picking a suggestion, so
  // selecting a place does not immediately fire a search for its own name.
  const skipNextFetch = useRef(false);

  // Keep the visible text in sync when the value is set from outside — e.g.
  // search params restored from the URL on a page load.
  useEffect(() => {
    if (value !== null) {
      skipNextFetch.current = true;
      setQuery(value.label);
    }
  }, [value]);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    // Debounced: autocomplete fires on almost every keystroke and each call
    // spends real Geoapify quota behind the backend proxy.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await autocompletePlaces(query.trim(), controller.signal);
          if (controller.signal.aborted) return;
          setSuggestions(result.items);
          setOpen(result.items.length > 0);
          setActiveIndex(-1);
        } catch {
          // A failed lookup should not block typing — the field simply shows
          // no suggestions rather than an error the user cannot act on.
          if (!controller.signal.aborted) setSuggestions([]);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  function select(suggestion: PlaceSuggestion) {
    skipNextFetch.current = true;
    setQuery(suggestion.formattedAddress);
    setOpen(false);
    setActiveIndex(-1);
    onChange({
      label: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter': {
        const active = suggestions[activeIndex];
        if (active !== undefined) {
          // Only swallow Enter when a suggestion is highlighted, so the key
          // still submits the surrounding form otherwise.
          event.preventDefault();
          select(active);
        }
        break;
      }
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  }

  function clear() {
    skipNextFetch.current = true;
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onChange(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${String(activeIndex)}` : undefined
          }
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Editing the text invalidates the previously chosen coordinates —
            // the label and the location must never disagree.
            if (value !== null) onChange(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          className={cn(
            'h-10 w-full rounded-lg border bg-surface pl-9 pr-9 text-sm text-ink',
            'placeholder:text-ink-faint transition-colors focus:border-accent-700 focus:outline-none',
            invalid ? 'border-red-500' : 'border-border-strong',
          )}
        />

        {loading ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint"
            aria-hidden
          />
        ) : (
          query.length > 0 && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-option-${String(index)}`}
              role="option"
              aria-selected={index === activeIndex}
              // pointerdown, not click: the input's blur would otherwise close
              // the list before the click landed.
              onPointerDown={(event) => {
                event.preventDefault();
                select(suggestion);
              }}
              onMouseEnter={() => {
                setActiveIndex(index);
              }}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                index === activeIndex ? 'bg-accent-50' : 'bg-transparent',
              )}
            >
              <p className="font-medium text-ink">{suggestion.name}</p>
              <p className="truncate text-xs text-ink-muted">{suggestion.formattedAddress}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
