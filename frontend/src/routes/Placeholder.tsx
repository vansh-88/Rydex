import { Construction } from 'lucide-react';

import { EmptyState } from '@/components/domain/States';

// Temporary stand-in so the shell's navigation is fully walkable while later
// phases are still being built. Every one of these is replaced by a real
// screen; none of them ships.
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <EmptyState
      icon={Construction}
      title={title}
      description={`This screen is built in ${phase}.`}
    />
  );
}
