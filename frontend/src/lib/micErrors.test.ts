import { describe, it, expect } from "vitest";
import { classifyMicError, isMicErrorRetryable } from "./micErrors";

/** Build a DOMException with a given name, as getUserMedia would reject with. */
function domEx(name: string): DOMException {
  return new DOMException("test", name);
}

/** Build a tagged Error like voiceRecorder raises pre-getUserMedia. */
function tagged(name: string): Error {
  const e = new Error("test");
  e.name = name;
  return e;
}

describe("classifyMicError", () => {
  it("maps NotAllowedError to a retryable 'denied'", () => {
    const info = classifyMicError(domEx("NotAllowedError"));
    expect(info.kind).toBe("denied");
    expect(info.messageKey).toBe("microphoneDenied");
    expect(info.retryable).toBe(true);
  });

  it("maps the legacy PermissionDeniedError alias to 'denied'", () => {
    expect(classifyMicError(domEx("PermissionDeniedError")).kind).toBe("denied");
  });

  it("maps SecurityError to 'denied'", () => {
    expect(classifyMicError(domEx("SecurityError")).kind).toBe("denied");
  });

  it("maps NotFoundError to 'no-device'", () => {
    const info = classifyMicError(domEx("NotFoundError"));
    expect(info.kind).toBe("no-device");
    expect(info.messageKey).toBe("micNoDevice");
    expect(info.retryable).toBe(true);
  });

  it("maps NotReadableError (mic in use) to 'busy'", () => {
    const info = classifyMicError(domEx("NotReadableError"));
    expect(info.kind).toBe("busy");
    expect(info.messageKey).toBe("micBusy");
  });

  it("maps AbortError to 'busy'", () => {
    expect(classifyMicError(domEx("AbortError")).kind).toBe("busy");
  });

  it("maps the tagged insecure-context error to a non-retryable 'insecure'", () => {
    const info = classifyMicError(tagged("MicInsecureContextError"));
    expect(info.kind).toBe("insecure");
    expect(info.messageKey).toBe("micInsecure");
    expect(info.retryable).toBe(false);
  });

  it("maps the tagged unsupported error to a non-retryable 'unsupported'", () => {
    const info = classifyMicError(tagged("MicUnsupportedError"));
    expect(info.kind).toBe("unsupported");
    expect(info.messageKey).toBe("micUnsupported");
    expect(info.retryable).toBe(false);
  });

  it("falls back to a retryable 'unknown' for unrecognised errors", () => {
    expect(classifyMicError(domEx("WeirdError")).kind).toBe("unknown");
    expect(classifyMicError(new Error("plain")).kind).toBe("unknown");
    expect(classifyMicError("string error").kind).toBe("unknown");
    expect(classifyMicError(null).messageKey).toBe("micUnknownError");
  });
});

describe("isMicErrorRetryable", () => {
  it("treats denied / no-device / busy / unknown as retryable", () => {
    expect(isMicErrorRetryable("denied")).toBe(true);
    expect(isMicErrorRetryable("no-device")).toBe(true);
    expect(isMicErrorRetryable("busy")).toBe(true);
    expect(isMicErrorRetryable("unknown")).toBe(true);
  });

  it("treats insecure / unsupported as non-retryable", () => {
    expect(isMicErrorRetryable("insecure")).toBe(false);
    expect(isMicErrorRetryable("unsupported")).toBe(false);
  });
});
