import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError, errorMessage } from "@/services/api/apiClient";

/**
 * Puts server field errors (camelCase keys) onto matching form fields.
 * Returns a form-level message when the error is not tied to a known field, otherwise null.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  if (!(error instanceof ApiError)) {
    return errorMessage(error);
  }

  let matched = false;
  for (const field of fields) {
    const message = error.fieldError(field);
    if (message) {
      setError(field, { type: "server", message });
      matched = true;
    }
  }

  return matched ? null : error.message;
}
