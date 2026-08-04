import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import CountdownTimer from "./CountdownTimer";

const NOW_SECONDS = 1_785_801_600; // 2026-08-04T00:00:00Z

describe("CountdownTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows days, hours, minutes and seconds until the deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SECONDS * 1000));

    // +100_000s = 1d 3h 46m 40s
    render(<CountdownTimer deadlineTimestamp={NOW_SECONDS + 100_000} />);
    expect(screen.getByText("1d 3h 46m 40s")).toBeInTheDocument();
  });

  it("updates every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SECONDS * 1000));

    render(<CountdownTimer deadlineTimestamp={NOW_SECONDS + 5} />);
    expect(screen.getByText("0d 0h 0m 5s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("0d 0h 0m 4s")).toBeInTheDocument();
  });

  it("shows 'Campaign ended' once the deadline has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SECONDS * 1000));

    render(<CountdownTimer deadlineTimestamp={NOW_SECONDS - 10} />);
    expect(screen.getByText("Campaign ended")).toBeInTheDocument();
  });
});
