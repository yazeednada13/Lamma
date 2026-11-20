import { useRef } from "react";

/**
 * One Idempotency-Key per user action (D-112): the same request body reuses its key on retries (a double click or
 * a retry after a network error is applied once); a changed body gets a new key; `done()` clears it after success.
 */
export function useActionKey() {
  const current = useRef<{ body: string; key: string } | null>(null);
  return {
    keyFor(body: unknown): string {
      const json = JSON.stringify(body);
      if (current.current?.body !== json) {
        current.current = { body: json, key: crypto.randomUUID() };
      }

      return current.current.key;
    },
    done() {
      current.current = null;
    },
  };
}
