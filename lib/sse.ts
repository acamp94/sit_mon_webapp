import { StreamPayload } from '@/lib/types';

type Listener = (payload: StreamPayload) => void;

const globalRef = globalThis as unknown as {
  sseListeners?: Set<Listener>;
};

const listeners = globalRef.sseListeners ?? new Set<Listener>();
globalRef.sseListeners = listeners;

export function registerListener(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcast(payload: StreamPayload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('SSE listener error', error);
    }
  });
}
