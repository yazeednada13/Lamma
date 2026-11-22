import { describe, expect, it } from "vitest";
import { jordanMobile, maskEmail, readUtm, signupSchema } from "./signupDomain";

describe("public sign-up rules (D-160)", () => {
  it("accepts Jordanian mobiles in every common form, like the server", () => {
    expect(jordanMobile("0791234567")).toBe("+962791234567");
    expect(jordanMobile("079 123 4567")).toBe("+962791234567");
    expect(jordanMobile("+962 78-123-4567")).toBe("+962781234567");
    expect(jordanMobile("00962771234567")).toBe("+962771234567");
    expect(jordanMobile("٠٧٩١٢٣٤٥٦٧")).toBe("+962791234567");
    expect(jordanMobile("771234567")).toBe("+962771234567");
    expect(jordanMobile("0612345678")).toBeNull(); // landline
    expect(jordanMobile("0751234567")).toBeNull();
    expect(jordanMobile("+971501234567")).toBeNull();
  });

  it("validates the form with Arabic messages", () => {
    const bad = signupSchema.safeParse({ fullName: " ", email: "x", phone: "123", storeName: "", website: "" });
    expect(bad.success).toBe(false);
    const messages = bad.success ? [] : bad.error.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(["الاسم مطلوب.", "اكتب رقم موبايل أردني، مثلًا 0791234567."]));
    expect(signupSchema.safeParse({ fullName: "ريم", email: "r@x.co", phone: "0791234567", storeName: "", website: "" }).success).toBe(true);
  });

  it("reads the UTM source of the Instagram bio link", () => {
    expect(readUtm("?utm_source=ig&utm_medium=social&utm_content=link_in_bio")).toEqual({ utmSource: "ig", utmMedium: "social", utmCampaign: null });
    expect(readUtm("")).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });

  it("masks the email on the success screen", () => {
    expect(maskEmail("reem@gmail.com")).toBe("r***@gmail.com");
    expect(maskEmail("ab@x.jo")).toBe("a**@x.jo");
  });
});
