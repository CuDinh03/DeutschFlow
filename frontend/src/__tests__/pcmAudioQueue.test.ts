import { describe, it, expect } from "vitest";
import { decodePcm16Base64, PcmAudioQueue } from "@/lib/pcmAudioQueue";

/** Build a base64 string from raw byte values. */
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

describe("decodePcm16Base64", () => {
  it("decodes little-endian signed 16-bit samples into Float32 [-1, 1)", () => {
    // 0x0000 = 0, 0x7FFF = 32767, 0x8000 = -32768, 0x4000 = 16384  (little-endian byte pairs)
    const out = decodePcm16Base64(b64([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x00, 0x40]));
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(32767 / 32768, 6);
    expect(out[2]).toBe(-1); // -32768 / 32768
    expect(out[3]).toBeCloseTo(0.5, 6); // 16384 / 32768
  });

  it("returns an empty array for empty input", () => {
    expect(decodePcm16Base64("")).toHaveLength(0);
  });

  it("ignores a trailing odd byte (samples are 2 bytes each)", () => {
    const out = decodePcm16Base64(b64([0x00, 0x40, 0x7f]));
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(0.5, 6);
  });
});

describe("PcmAudioQueue without Web Audio (SSR / unsupported)", () => {
  it("degrades gracefully — enqueue/stop/dispose never throw when AudioContext is absent", () => {
    // jsdom provides no AudioContext → the queue must be a safe no-op.
    const queue = new PcmAudioQueue();
    expect(() => {
      queue.resume();
      queue.enqueue({ index: 0, text: "Hallo.", pcmBase64: b64([0x00, 0x40]) });
      queue.stop();
      queue.dispose();
    }).not.toThrow();
  });

  it("ignores frames with no pcm data", () => {
    const queue = new PcmAudioQueue();
    expect(() => queue.enqueue({ index: 0, text: "", pcmBase64: "" })).not.toThrow();
  });
});
