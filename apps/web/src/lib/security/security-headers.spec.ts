import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security/security-headers";

function headerValue(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe("securityHeaders", () => {
  it("enforces HSTS with a long max-age, subdomains, and preload", () => {
    const hsts = headerValue("Strict-Transport-Security");
    expect(hsts).toBeDefined();
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("keeps clickjacking and sniffing protections", () => {
    expect(headerValue("X-Frame-Options")).toBe("DENY");
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
  });

  it("ships a content security policy that blocks framing and objects", () => {
    const csp = headerValue("Content-Security-Policy");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
