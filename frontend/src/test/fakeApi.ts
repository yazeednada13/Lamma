// TEST-ONLY in-memory stand-in for the Lamma API (MSW). It follows the real contracts in
// docs/architecture/API-DESIGN.md §11, including the antiforgery rule and ProblemDetails errors.
// It is never bundled into the app: only test files import it.
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:3000/api/v1";

interface FakeUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  failures: number;
}

interface FakeBusiness {
  id: string;
  name: string;
  businessType: string;
  defaultLowStockThreshold: number;
  channels: Record<string, boolean>;
  methods: Record<string, boolean>;
}

export const BUSINESS_TYPES = [
  ["clothing", "ملابس وأزياء"], ["shoes_bags", "أحذية وشنط"], ["perfume", "عطور"], ["beauty", "تجميل وعناية"],
  ["accessories", "إكسسوارات ومجوهرات"], ["gifts", "هدايا وبوكسات"], ["home_food", "أكل وحلويات بيتية"], ["handmade", "شغل يدوي"],
  ["electronics", "إلكترونيات"], ["kids", "أطفال وألعاب"], ["home_decor", "ديكور ومنزل"], ["books", "كتب وقرطاسية"], ["other", "أخرى"],
].map(([code, labelAr]) => ({ code: code!, labelAr: labelAr! }));

const CHANNELS = ["instagram", "whatsapp", "facebook", "other"];
const METHODS = ["cash", "cliq", "bank_transfer", "cod", "zain_cash", "orange_money"];

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  csrf: string | null;
}

class FakeLamma {
  users = new Map<string, FakeUser>();
  businesses = new Map<string, FakeBusiness>();
  session: string | null = null;
  trialDaysRemaining = 30;
  requests: RecordedRequest[] = [];
  resetRequests: string[] = [];
  private nextId = 1;

  reset() {
    this.users.clear();
    this.businesses.clear();
    this.session = null;
    this.trialDaysRemaining = 30;
    this.requests = [];
    this.resetRequests = [];
  }

  csrfFor(): string {
    return `xsrf-${this.session ?? "anonymous"}`;
  }

  addUser(email: string, password = "lamma2026", fullName = "ريم الخطيب"): FakeUser {
    const user = { id: `u${this.nextId++}`, fullName, email, password, failures: 0 };
    this.users.set(email, user);
    return user;
  }

  addBusiness(email: string, name = "بوتيك ريم", businessType = "clothing"): FakeBusiness {
    const business: FakeBusiness = {
      id: `b${this.nextId++}`,
      name,
      businessType,
      defaultLowStockThreshold: 5,
      channels: { instagram: true, whatsapp: true, facebook: false, other: false },
      methods: { cash: true, cliq: true, bank_transfer: true, cod: true, zain_cash: false, orange_money: false },
    };
    this.businesses.set(email, business);
    return business;
  }

  /** Signed-in owner with a business. */
  signInOnboarded(email = "reem@example.com"): FakeUser {
    const user = this.users.get(email) ?? this.addUser(email);
    if (!this.businesses.has(email)) {
      this.addBusiness(email);
    }

    this.session = email;
    return user;
  }

  account(email: string) {
    const user = this.users.get(email)!;
    const business = this.businesses.get(email);
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isOnboarded: Boolean(business),
      business: business
        ? { id: business.id, name: business.name, businessType: business.businessType, trialEndsAt: "2026-12-10T09:00:00Z", trialDaysRemaining: this.trialDaysRemaining, plan: "trial" }
        : null,
    };
  }
}

export const fake = new FakeLamma();

function problem(status: number, code: string, detail: string, errors?: Record<string, string[]>) {
  return HttpResponse.json({ type: `https://lamma.app/errors/${code}`, title: "x", status, detail, code, traceId: "test", ...(errors ? { errors } : {}) }, { status, headers: { "Content-Type": "application/problem+json" } });
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "لازم تسجّل دخول.");

async function guard(request: Request): Promise<{ body: Record<string, unknown>; error?: Response }> {
  const url = new URL(request.url);
  const csrf = request.headers.get("X-XSRF-TOKEN");
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    const text = await request.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }

  fake.requests.push({ method: request.method, path: url.pathname.replace("/api/v1", ""), body, csrf });
  if (request.method !== "GET" && csrf !== fake.csrfFor()) {
    return { body, error: problem(400, "security.csrf", "انتهت صلاحية الجلسة الأمنية للصفحة.") };
  }

  return { body };
}

function json(data: JsonBodyType, status = 200) {
  return HttpResponse.json(data, { status });
}

function settings(business: FakeBusiness) {
  return {
    business: { name: business.name, businessType: business.businessType, defaultLowStockThreshold: business.defaultLowStockThreshold, currency: "JOD" },
    channels: { channels: CHANNELS.map((channel) => ({ channel, isEnabled: business.channels[channel] ?? false })) },
    methods: { methods: METHODS.map((method) => ({ method, isEnabled: business.methods[method] ?? false })) },
  };
}

function withBusiness(handler: (business: FakeBusiness, body: Record<string, unknown>) => Response) {
  return async ({ request }: { request: Request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    if (!fake.session) return unauthenticated();
    const business = fake.businesses.get(fake.session);
    if (!business) return problem(403, "business.not_onboarded", "لازم تكمّل تهيئة مشروعك أول.");
    return handler(business, body);
  };
}

export const handlers = [
  http.get(`${BASE}/auth/antiforgery`, () => json({ token: fake.csrfFor() })),

  http.post(`${BASE}/auth/signup`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    const email = String(body.email);
    if (fake.users.has(email)) return problem(409, "auth.email_taken", "هاد الإيميل مسجّل من قبل. جرّب تسجّل دخول.");
    if (String(body.password).length < 8) return problem(422, "validation.failed", "x", { password: ["كلمة السر لازم تكون 8 أحرف على الأقل."] });
    fake.addUser(email, String(body.password), String(body.fullName));
    fake.session = email;
    return json(fake.account(email), 201);
  }),

  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    const user = fake.users.get(String(body.email));
    if (user && user.failures >= 5) return problem(423, "auth.locked_out", "انقفل حسابك مؤقتًا بعد كذا محاولة دخول غلط.");
    if (!user || user.password !== body.password) {
      if (user) user.failures++;
      return problem(401, "auth.invalid_credentials", "الإيميل أو كلمة السر غلط.");
    }
    fake.session = user.email;
    return json(fake.account(user.email));
  }),

  http.post(`${BASE}/auth/logout`, async ({ request }) => {
    const { error } = await guard(request);
    if (error) return error;
    fake.session = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/auth/forgot-password`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    fake.resetRequests.push(String(body.email));
    return new HttpResponse(null, { status: 202 });
  }),

  http.post(`${BASE}/auth/reset-password`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    if (body.token !== "valid-token") return problem(422, "auth.invalid_token", "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابط جديد.", { token: ["رابط الاستعادة غير صالح."] });
    const user = fake.users.get(String(body.email));
    if (user) user.password = String(body.newPassword);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/account`, () => (fake.session ? json(fake.account(fake.session)) : unauthenticated())),

  http.put(`${BASE}/account`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    if (!fake.session) return unauthenticated();
    fake.users.get(fake.session)!.fullName = String(body.fullName);
    return json(fake.account(fake.session));
  }),

  http.post(`${BASE}/account/change-password`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    if (!fake.session) return unauthenticated();
    const user = fake.users.get(fake.session)!;
    if (user.password !== body.currentPassword) return problem(422, "auth.wrong_password", "x", { currentPassword: ["كلمة السر الحالية غلط."] });
    user.password = String(body.newPassword);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/onboarding/business-types`, () => (fake.session ? json(BUSINESS_TYPES) : unauthenticated())),

  http.post(`${BASE}/onboarding`, async ({ request }) => {
    const { body, error } = await guard(request);
    if (error) return error;
    if (!fake.session) return unauthenticated();
    if (fake.businesses.has(fake.session)) return problem(409, "onboarding.already_completed", "مشروعك جاهز من قبل.");
    const business = fake.addBusiness(fake.session, String(body.businessName), String(body.businessType));
    business.channels = Object.fromEntries(CHANNELS.map((c) => [c, (body.salesChannels as string[]).includes(c)]));
    return json(fake.account(fake.session), 201);
  }),

  http.get(`${BASE}/settings/business`, withBusiness((b) => json(settings(b).business))),
  http.put(
    `${BASE}/settings/business`,
    withBusiness((b, body) => {
      const threshold = Number(body.defaultLowStockThreshold);
      if (threshold > 1000) return problem(422, "validation.failed", "x", { defaultLowStockThreshold: ["حد «قرب يخلص» لازم يكون بين 0 و 1000."] });
      b.name = String(body.name);
      b.businessType = String(body.businessType);
      b.defaultLowStockThreshold = threshold;
      return json(settings(b).business);
    }),
  ),
  http.get(`${BASE}/settings/sales-channels`, withBusiness((b) => json(settings(b).channels))),
  http.put(
    `${BASE}/settings/sales-channels`,
    withBusiness((b, body) => {
      const list = body.channels as { channel: string; isEnabled: boolean }[];
      if (!list.some((c) => c.isEnabled)) return problem(422, "settings.channel_required", "لازم تفعّل قناة بيع وحدة على الأقل.");
      b.channels = Object.fromEntries(list.map((c) => [c.channel, c.isEnabled]));
      return json(settings(b).channels);
    }),
  ),
  http.get(`${BASE}/settings/payment-methods`, withBusiness((b) => json(settings(b).methods))),
  http.put(
    `${BASE}/settings/payment-methods`,
    withBusiness((b, body) => {
      const list = body.methods as { method: string; isEnabled: boolean }[];
      if (!list.some((m) => m.isEnabled)) return problem(422, "settings.payment_method_required", "لازم تفعّل طريقة دفع وحدة على الأقل.");
      b.methods = Object.fromEntries(list.map((m) => [m.method, m.isEnabled]));
      return json(settings(b).methods);
    }),
  ),
];

export const server = setupServer(...handlers);
