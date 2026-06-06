import "reflect-metadata";
import { MetadataProxyController } from "./metadata.proxy.controller";
import { AuthController } from "../auth/auth.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

function limitFor(target: any, key: string, name = "default"): unknown {
  return Reflect.getMetadata(THROTTLER_LIMIT + name, target.prototype[key]);
}
function ttlFor(target: any, key: string, name = "default"): unknown {
  return Reflect.getMetadata(THROTTLER_TTL + name, target.prototype[key]);
}

describe("sensitive endpoint rate limiting", () => {
  it("applies a strict named throttle to sensitive action proof issuance", () => {
    expect(limitFor(MetadataProxyController, "issueSensitiveActionProof")).toBe(
      10,
    );
    expect(ttlFor(MetadataProxyController, "issueSensitiveActionProof")).toBe(
      60000,
    );
  });

  it("applies a strict named throttle to login initiation", () => {
    expect(limitFor(AuthController, "login")).toBe(20);
    expect(ttlFor(AuthController, "login")).toBe(60000);
  });
});
