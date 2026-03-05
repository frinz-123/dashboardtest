describe("formSubmission utils", () => {
  const originalOverrideEmails = process.env.NEXT_PUBLIC_OVERRIDE_EMAIL;

  afterEach(() => {
    jest.resetModules();

    if (typeof originalOverrideEmails === "string") {
      process.env.NEXT_PUBLIC_OVERRIDE_EMAIL = originalOverrideEmails;
      return;
    }

    delete process.env.NEXT_PUBLIC_OVERRIDE_EMAIL;
  });

  it("normalizes admin emails from env", () => {
    process.env.NEXT_PUBLIC_OVERRIDE_EMAIL =
      "Admin@One.com, second@example.com ";

    jest.isolateModules(() => {
      const {
        FORM_OVERRIDE_EMAILS,
        isFormAdminEmail,
      } = require("@/utils/formSubmission");

      expect(FORM_OVERRIDE_EMAILS).toEqual([
        "admin@one.com",
        "second@example.com",
      ]);
      expect(isFormAdminEmail(" ADMIN@ONE.COM ")).toBe(true);
      expect(isFormAdminEmail("missing@example.com")).toBe(false);
    });
  });

  it("matches the shared photo-required client codes", () => {
    jest.isolateModules(() => {
      const { isPhotoRequiredClientCode } = require("@/utils/formSubmission");

      expect(isPhotoRequiredClientCode("cley")).toBe(true);
      expect(isPhotoRequiredClientCode("wm")).toBe(true);
      expect(isPhotoRequiredClientCode("kiosk")).toBe(true);
      expect(isPhotoRequiredClientCode("eft")).toBe(false);
    });
  });

  it("parses boolean-like values consistently", () => {
    jest.isolateModules(() => {
      const { parseBooleanLike } = require("@/utils/formSubmission");

      expect(parseBooleanLike(true)).toBe(true);
      expect(parseBooleanLike("true")).toBe(true);
      expect(parseBooleanLike("Si")).toBe(true);
      expect(parseBooleanLike("0")).toBe(false);
      expect(parseBooleanLike(null)).toBe(false);
    });
  });
});
