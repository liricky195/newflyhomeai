// @vitest-environment jsdom
/**
 * 8A — Toast component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Toast, ToastProvider, useToast } from "@/components/shared/Toast";

// Each test that needs fake timers calls vi.useFakeTimers() and vi.useRealTimers() locally

describe("Toast (8A)", () => {
  it("renders the message text", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Test message" type="success" onDismiss={onDismiss} />);
    expect(screen.getByText("Test message")).toBeTruthy();
  });

  it("success type: has green left border class", () => {
    const { container } = render(
      <Toast message="ok" type="success" onDismiss={vi.fn()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/border-l-green-500/);
  });

  it("error type: has red left border class", () => {
    const { container } = render(
      <Toast message="err" type="error" onDismiss={vi.fn()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/border-l-red-500/);
  });

  it("info type: has blue left border class", () => {
    const { container } = render(
      <Toast message="info" type="info" onDismiss={vi.fn()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/border-l-blue-500/);
  });

  it("error type: role='alert'", () => {
    render(<Toast message="err" type="error" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("success type: role='status'", () => {
    render(<Toast message="ok" type="success" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("info type: role='status'", () => {
    render(<Toast message="info" type="info" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("close button has aria-label='Dismiss notification'", () => {
    render(<Toast message="msg" type="info" onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /dismiss notification/i })).toBeTruthy();
  });

  it("close button click calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(<Toast message="msg" type="info" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after 4000ms", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast message="msg" type="info" onDismiss={onDismiss} />);

      act(() => vi.advanceTimersByTime(3999));
      expect(onDismiss).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));
      expect(onDismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not auto-dismiss before 4000ms", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast message="msg" type="success" onDismiss={onDismiss} />);
      act(() => vi.advanceTimersByTime(3500));
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── ToastProvider + useToast ─────────────────────────────────────────────────

function ToastConsumer({ type = "info" }: { type?: "success" | "error" | "info" }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast("Hello from provider", type)}>
      Show Toast
    </button>
  );
}

describe("ToastProvider (8A)", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );
    expect(screen.getByText("Content")).toBeTruthy();
  });

  it("showToast displays a toast message", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Hello from provider")).toBeTruthy();
  });

  it("toast auto-dismisses after 4000ms", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );
      fireEvent.click(screen.getByText("Show Toast"));
      expect(screen.getByText("Hello from provider")).toBeTruthy();

      act(() => vi.advanceTimersByTime(4001));
      expect(screen.queryByText("Hello from provider")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("error toast uses role='alert'", () => {
    render(
      <ToastProvider>
        <ToastConsumer type="error" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Show Toast"));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("success toast uses role='status'", () => {
    render(
      <ToastProvider>
        <ToastConsumer type="success" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Show Toast"));
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
