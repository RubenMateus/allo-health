import { isValidBirthYear } from "./birthYear";

const now = new Date("2026-11-18T12:00:00");

describe("isValidBirthYear", () => {
  it("accepts adult years", () => {
    expect(isValidBirthYear("1990", now)).toBe(true);
    expect(isValidBirthYear("2013", now)).toBe(true);
    expect(isValidBirthYear("1926", now)).toBe(true);
  });

  it("rejects anyone under 13 or over 100", () => {
    expect(isValidBirthYear("2014", now)).toBe(false);
    expect(isValidBirthYear("1925", now)).toBe(false);
  });

  it("rejects partial input", () => {
    expect(isValidBirthYear("199", now)).toBe(false);
    expect(isValidBirthYear("", now)).toBe(false);
  });
});
