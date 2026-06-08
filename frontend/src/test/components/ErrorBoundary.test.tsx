/**
 * Tests for the generic <ErrorBoundary> (/src/components/ErrorBoundary.tsx).
 *
 * It must turn a render-time crash in a subtree into a recoverable fallback
 * (never a blank screen), report the error via onError, survive a throwing
 * onError, and recover via reset() once the cause is gone.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom-render");
  return <div>safe content</div>;
}

describe("ErrorBoundary", () => {
  let consoleErr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught render errors to console.error; silence it for clean output.
    consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErr.mockRestore();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <div>hello world</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("renders the fallback and reports the error when a child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError} fallback={(_reset, error) => <div>recover: {error.message}</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("recover: boom-render")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("still shows the fallback even if onError itself throws", () => {
    const onError = vi.fn(() => {
      throw new Error("logger blew up");
    });
    render(
      <ErrorBoundary onError={onError} fallback={() => <div>still recovers</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("still recovers")).toBeInTheDocument();
  });

  it("recovers via reset() once the cause is gone", async () => {
    function Harness() {
      const [throwIt, setThrowIt] = React.useState(true);
      return (
        <ErrorBoundary
          fallback={(reset) => (
            <button
              onClick={() => {
                setThrowIt(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Boom shouldThrow={throwIt} />
        </ErrorBoundary>
      );
    }
    render(<Harness />);
    expect(screen.getByText("retry")).toBeInTheDocument();
    await userEvent.click(screen.getByText("retry"));
    expect(screen.getByText("safe content")).toBeInTheDocument();
  });
});
