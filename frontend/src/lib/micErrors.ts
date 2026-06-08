/**
 * micErrors.ts — classify microphone capture failures into actionable
 * categories with stable i18n keys.
 *
 * `getUserMedia` rejects with a DOMException whose `name` distinguishes the
 * cause. Mapping each cause to a precise message (and whether retrying can
 * help) lets the UI guide the user instead of always claiming "permission
 * denied" — which is wrong when the real problem is a missing device, a mic
 * held by another app, or an insecure (non-HTTPS) context.
 *
 * `voiceRecorder` raises two tagged `Error`s *before* reaching getUserMedia
 * for the cases the browser can't report through a DOMException:
 *   - `MicInsecureContextError` — page is not a secure context
 *   - `MicUnsupportedError`     — browser lacks getUserMedia / MediaRecorder
 */

export type MicErrorKind =
  | "denied" // user or browser policy blocked permission
  | "no-device" // no microphone hardware present
  | "busy" // mic held by another app, or a hardware/OS fault
  | "insecure" // page not served over HTTPS (mediaDevices hidden)
  | "unsupported" // browser cannot capture audio at all
  | "unknown"; // anything we can't attribute

export interface MicErrorInfo {
  kind: MicErrorKind;
  /** i18n key under the `speaking` namespace */
  messageKey: string;
  /** whether offering a "retry" affordance is meaningful */
  retryable: boolean;
}

const KIND_TO_KEY: Record<MicErrorKind, string> = {
  denied: "microphoneDenied",
  "no-device": "micNoDevice",
  busy: "micBusy",
  insecure: "micInsecure",
  unsupported: "micUnsupported",
  unknown: "micUnknownError",
};

// Retry only helps where the user can change something and try again.
// Insecure context / unsupported browser cannot be fixed from this page.
const RETRYABLE: Record<MicErrorKind, boolean> = {
  denied: true,
  "no-device": true,
  busy: true,
  insecure: false,
  unsupported: false,
  unknown: true,
};

export function isMicErrorRetryable(kind: MicErrorKind): boolean {
  return RETRYABLE[kind];
}

function errorName(err: unknown): string {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name;
  }
  if (typeof err === "object" && err !== null && "name" in err) {
    return String((err as { name: unknown }).name);
  }
  return "";
}

function kindFromName(name: string): MicErrorKind {
  switch (name) {
    // Tagged errors raised by voiceRecorder before getUserMedia runs.
    case "MicUnsupportedError":
      return "unsupported";
    case "MicInsecureContextError":
      return "insecure";

    // Permission blocked — user dismissed the prompt or a policy denies it.
    case "NotAllowedError":
    case "PermissionDeniedError": // legacy Chrome alias
    case "SecurityError":
      return "denied";

    // No capture device available.
    case "NotFoundError":
    case "DevicesNotFoundError": // legacy alias
      return "no-device";

    // Device exists but can't be opened (in use, or hardware/OS error).
    case "NotReadableError":
    case "TrackStartError": // legacy alias
    case "AbortError":
      return "busy";

    default:
      return "unknown";
  }
}

/**
 * Classify a microphone capture failure into an actionable category.
 * Always returns a usable result — unrecognised errors fall back to "unknown".
 */
export function classifyMicError(err: unknown): MicErrorInfo {
  const kind = kindFromName(errorName(err));
  return {
    kind,
    messageKey: KIND_TO_KEY[kind],
    retryable: RETRYABLE[kind],
  };
}
