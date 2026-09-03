import type { EventLifecycle } from '../backend/types.ts';

export const isTerminalEvent = (status: EventLifecycle): boolean => status === 'ended' || status === 'archived' || status === 'cancelled';

export function allowedEventTransitions(status: EventLifecycle): EventLifecycle[] {
  if (status === 'ended') return ['ended', 'archived', 'cancelled'];
  if (status === 'archived' || status === 'cancelled') return [status];
  return ['planning', 'active', 'ended', 'archived', 'cancelled'];
}
