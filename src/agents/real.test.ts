import { describe, expect, it } from "vitest";
import { authError } from "./real";

describe("authError", () => {
  it("keeps Composio's canned reason and never the key", () => {
    const body = '{"error":{"message":"Invalid API key format. Please provide a valid API key.","slug":"Auth_Unauthorized","status":401}}';
    expect(authError(body, "ak_secret123")).toBe("rejected the API key (Auth_Unauthorized: Invalid API key format. Please provide a valid API key.)");
    expect(authError('{"error":{"message":"bad key ak_secr…"}}', "ak_secret123")).toBe("rejected the API key");
    expect(authError("<html>", "ak_secret123")).toBe("rejected the API key");
  });
});
