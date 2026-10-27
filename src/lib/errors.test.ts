import { describe, expect, it } from "vitest";
import { decodeError } from "./errors";

describe("decodeError", () => {
  it("recognises common provider errors", () => {
    expect(decodeError("Error 400: redirect_uri_mismatch", "gmail").map((e) => e.id)).toEqual(["redirect_mismatch"]);
    expect(decodeError("Error 403: access_denied. App has not completed the Google verification process", "gmail")[0].id).toBe("google_not_test_user");
    expect(decodeError('{"ok":false,"error":"ratelimited"}', "slack")[0].id).toBe("slack_ratelimited");
  });

  it("scopes app-specific patterns to their app", () => {
    expect(decodeError("consent_required", "gmail")).toEqual([]);
    expect(decodeError("consent_required", "docusign")[0].id).toBe("docusign_consent_required");
  });

  it("returns nothing for unknown text", () => {
    expect(decodeError("something odd happened", "xero")).toEqual([]);
  });
});
