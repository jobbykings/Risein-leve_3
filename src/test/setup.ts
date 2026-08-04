import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// globals:false — register cleanup explicitly so tests never share the DOM.
afterEach(() => {
  cleanup();
});
