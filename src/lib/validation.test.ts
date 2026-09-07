import { describe, expect, it } from "vitest";
import { isPersonName, normalizePhilippineMobile, tidyName } from "./validation";

describe("isPersonName", () => {
  it("accepts the punctuation real names carry", () => {
    for (const name of [
      "Ana Reyes",
      "Ma. Anna G. Louie",
      "Dela Cruz-Santos",
      "O'Brien",
      "Peña",
      "Jose Ángel",
    ]) {
      expect(isPersonName(name), name).toBe(true);
    }
  });

  it("rejects anything with a digit", () => {
    for (const name of ["Ana2", "2Chainz", "Court 1", "Ana Reyes 3", "0917123456"]) {
      expect(isPersonName(name), name).toBe(false);
    }
  });

  it("rejects empty, single-letter and punctuation-only input", () => {
    for (const name of ["", " ", "A", "  A  ", ".", "-'.", "A."]) {
      expect(isPersonName(name), JSON.stringify(name)).toBe(false);
    }
  });

  it("ignores surrounding whitespace", () => {
    expect(isPersonName("  Ana Reyes  ")).toBe(true);
  });
});

describe("tidyName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(tidyName("  Ana   Reyes ")).toBe("Ana Reyes");
  });
});

describe("normalizePhilippineMobile", () => {
  it("keeps a local 11-digit number as it is", () => {
    expect(normalizePhilippineMobile("09171234567")).toBe("09171234567");
  });

  it("converts the +63 and 63 forms to the local one", () => {
    expect(normalizePhilippineMobile("+639171234567")).toBe("09171234567");
    expect(normalizePhilippineMobile("639171234567")).toBe("09171234567");
  });

  it("accepts the spacing and dashes people type", () => {
    expect(normalizePhilippineMobile("0917 123 4567")).toBe("09171234567");
    expect(normalizePhilippineMobile("+63 917 123 4567")).toBe("09171234567");
    expect(normalizePhilippineMobile("0917-123-4567")).toBe("09171234567");
    expect(normalizePhilippineMobile("(0917) 123 4567")).toBe("09171234567");
  });

  it("rejects the wrong length", () => {
    expect(normalizePhilippineMobile("0917123456")).toBeNull();
    expect(normalizePhilippineMobile("091712345678")).toBeNull();
    expect(normalizePhilippineMobile("+6391712345")).toBeNull();
  });

  it("rejects numbers that do not start 09", () => {
    expect(normalizePhilippineMobile("08171234567")).toBeNull();
    expect(normalizePhilippineMobile("12345678901")).toBeNull();
    // A Manila landline, not a mobile.
    expect(normalizePhilippineMobile("+63288123456")).toBeNull();
  });

  it("rejects anything that is not digits", () => {
    expect(normalizePhilippineMobile("0917abc4567")).toBeNull();
    expect(normalizePhilippineMobile("")).toBeNull();
    expect(normalizePhilippineMobile("not a number")).toBeNull();
  });
});
