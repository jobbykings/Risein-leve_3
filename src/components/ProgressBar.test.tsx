import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgressBar from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders current and target amounts with a percentage", () => {
    render(<ProgressBar current={2_500} target={10_000} />);
    expect(screen.getByText(/2,500 \/ 10,000 XLM/)).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("caps the percentage at 100 when current exceeds target", () => {
    render(<ProgressBar current={15_000} target={10_000} />);
    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveStyle({ width: "100%" });
  });

  it("shows 0% when target is zero (avoids division by zero)", () => {
    render(<ProgressBar current={0} target={0} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveStyle({ width: "0%" });
  });
});
