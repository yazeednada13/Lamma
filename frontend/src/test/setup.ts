import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetCsrfToken } from "@/services/api/apiClient";
import { fake, server } from "./fakeApi";

// findBy*/waitFor default to 1s; full-app renders in parallel test files can take longer under CPU load.
configure({ asyncUtilTimeout: 3000 });

// jsdom gaps used by the UI.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}

Element.prototype.scrollIntoView ??= function scrollIntoView() {};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  fake.reset();
  resetCsrfToken();
  window.localStorage.clear();
});
afterAll(() => server.close());
