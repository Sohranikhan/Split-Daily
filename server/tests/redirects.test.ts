import { describe, expect, it } from "vitest";
import { ENV } from "../src/config/env";
import { isAllowedReturnTo, withParams } from "../src/utils/redirects";

describe("login redirect allow-list", () => {
  it("accepts configured web origins and the app scheme", () => {
    ENV.webOrigins = ["https://app.example.com"];
    ENV.appSchemes = ["ledgerly"];
    expect(isAllowedReturnTo("https://app.example.com/oauth/callback")).toBe(true);
    expect(isAllowedReturnTo("ledgerly://oauth/callback")).toBe(true);
  });

  it("rejects unknown origins, schemes and junk", () => {
    expect(isAllowedReturnTo("https://evil.example.net/oauth/callback")).toBe(false);
    expect(isAllowedReturnTo("https://app.example.com.evil.net/x")).toBe(false);
    expect(isAllowedReturnTo("javascript:alert(1)")).toBe(false);
    expect(isAllowedReturnTo("otherapp://cb")).toBe(false);
    expect(isAllowedReturnTo(undefined)).toBe(false);
  });

  it("only allows Expo Go when enabled", () => {
    ENV.allowExpoGo = false;
    expect(isAllowedReturnTo("exp://192.168.1.5:8081/--/oauth/callback")).toBe(false);
    ENV.allowExpoGo = true;
    expect(isAllowedReturnTo("exp://192.168.1.5:8081/--/oauth/callback")).toBe(true);
  });

  it("appends params to web and deep-link URLs", () => {
    expect(withParams("ledgerly://oauth/callback", { ticket: "abc" })).toBe("ledgerly://oauth/callback?ticket=abc");
    expect(withParams("https://app.example.com/oauth/callback?x=1", { error: "access_denied" })).toBe("https://app.example.com/oauth/callback?x=1&error=access_denied");
  });
});
