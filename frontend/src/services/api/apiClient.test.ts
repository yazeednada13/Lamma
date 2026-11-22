import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { fake, server } from "@/test/fakeApi";
import { api, ApiError, resetCsrfToken, setUnauthorizedHandler } from "./apiClient";

const BASE = "http://localhost:3000/api/v1";

describe("apiClient", () => {
  it("fetches the antiforgery token once and sends it on unsafe requests", async () => {
    fake.addUser("a@b.co");
    await api.post("/auth/login", { email: "a@b.co", password: "lamma2026", rememberMe: false });
    resetCsrfToken();
    await api.put("/account", { fullName: "x" });
    await api.put("/account", { fullName: "y" });

    const puts = fake.requests.filter((r) => r.method === "PUT");
    expect(puts.map((r) => r.csrf)).toEqual(["xsrf-a@b.co", "xsrf-a@b.co"]);
  });


  it("retries once with a fresh token when the server reports security.csrf", async () => {
    fake.addUser("a@b.co");
    await api.post("/auth/login", { email: "a@b.co", password: "lamma2026", rememberMe: false });
    // The cached token is the anonymous one; the session changed, so the first PUT is rejected and retried.
    const account = await api.put<{ fullName: string }>("/account", { fullName: "بعد" });

    expect(account.fullName).toBe("بعد");
    expect(fake.requests.filter((r) => r.method === "PUT").map((r) => r.csrf)).toEqual(["xsrf-anonymous", "xsrf-a@b.co"]);
  });


  it("turns ProblemDetails into a typed ApiError with field errors", async () => {
    fake.invitations.set("tok", { email: "a@b.co", fullName: "x", state: "valid" });
    const error = await api.post("/auth/register", { token: "tok", password: "lamma2026", confirmPassword: "other2026" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe("validation.failed");
    expect(apiError.fieldError("confirmPassword")).toContain("مطابق");
  });


  it("reports network failures as status 0 with an Arabic message", async () => {
    server.use(http.get(`${BASE}/account`, () => HttpResponse.error()));
    const error = (await api.get("/account").catch((e: unknown) => e)) as ApiError;

    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/\p{Script=Arabic}/u);
  });


  it("calls the unauthorized handler only for an expired session, not for wrong credentials", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    try {
      await api.post("/auth/login", { email: "nobody@x.co", password: "x", rememberMe: false }).catch(() => undefined);
      expect(handler).not.toHaveBeenCalled();

      await api.get("/account").catch(() => undefined);
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      setUnauthorizedHandler(null);
    }
  });


  it("treats 202 and 204 as empty success", async () => {
    await expect(api.post("/auth/forgot-password", { email: "a@b.co" })).resolves.toBeUndefined();
  });
});
