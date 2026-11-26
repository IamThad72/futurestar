import { describe, expect, it } from "vitest";
import { originPermitted, parseOrigin } from "../server/utils/cors";

const allowed = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
  "https://localhost",
  "https://app.example.com",
];

describe("exact CORS origins", () => {
  it("parses scheme, host, and the default port", () => {
    expect(parseOrigin("http://localhost")).toEqual({ scheme: "http", host: "localhost", port: "80" });
    expect(parseOrigin("https://app.example.com")).toEqual({ scheme: "https", host: "app.example.com", port: "443" });
    expect(parseOrigin("http://localhost:3000")).toEqual({ scheme: "http", host: "localhost", port: "3000" });
    expect(parseOrigin("capacitor://localhost")).toEqual({ scheme: "capacitor", host: "localhost", port: "" });
  });

  it("rejects values that are not a bare origin", () => {
    expect(parseOrigin("http://localhost/admin")).toBeNull();
    expect(parseOrigin("http://user:pass@localhost")).toBeNull();
    expect(parseOrigin("not a url")).toBeNull();
  });

  it("allows an exact scheme, host, and port", () => {
    expect(originPermitted("https://app.example.com", allowed)).toBe(true);
    expect(originPermitted("http://localhost", allowed)).toBe(true);
    expect(originPermitted("http://localhost:80", allowed)).toBe(true);
    expect(originPermitted("http://localhost:3000", allowed)).toBe(true);
    expect(originPermitted("capacitor://localhost", allowed)).toBe(true);
    expect(originPermitted("HTTP://LocalHost", allowed)).toBe(true);
  });

  it("does not treat a longer host or another port as a prefix", () => {
    expect(originPermitted("http://localhost.evil.com", allowed)).toBe(false);
    expect(originPermitted("https://localhost.evil.com", allowed)).toBe(false);
    expect(originPermitted("http://localhost.evil.com:3000", allowed)).toBe(false);
    expect(originPermitted("capacitor://localhost.evil.com", allowed)).toBe(false);
    expect(originPermitted("http://localhost:4000", allowed)).toBe(false);
    expect(originPermitted("http://127.0.0.1", allowed)).toBe(false);
    expect(originPermitted("https://app.example.com.evil.com", allowed)).toBe(false);
    expect(originPermitted("http://app.example.com", allowed)).toBe(false);
  });

  it("rejects a missing origin and allows a star entry", () => {
    expect(originPermitted(undefined, allowed)).toBe(false);
    expect(originPermitted(null, allowed)).toBe(false);
    expect(originPermitted("https://anywhere.example", ["*"])).toBe(true);
    expect(originPermitted(undefined, ["*"])).toBe(false);
  });
});
