import { test } from "node:test";
import assert from "node:assert/strict";

const { toCSV } = (await import(new URL("./csv.ts", import.meta.url).href)) as typeof import("./csv");

test("CSV neutralizes spreadsheet formulas in imported CRM text", () => {
  for (const value of ["=1+1", "+123", "-123", "@name", "\tname", "\rname", "  =1", "  \tname", "\nname", "＝1"]) {
    const csv = toCSV([{ contact: value }]);
    const expected = /[\t\r\n]/.test(value) ? `"'${value}"` : `'${value}`;
    assert.equal(csv, `contact\n${expected}`);
  }
});

test("CSV preserves numerical values and escapes delimiters", () => {
  assert.equal(toCSV([{ amount: -12, name: 'A,"B"' }]), 'amount,name\n-12,"A,""B"""');
});

test("CSV detects markers after invisible prefixes without rewriting the original text", () => {
  for (const prefix of ["\u0001", "\u0085", "\u200B", "\u200E", "\u2060", "\uFEFF", "\u00A0", "\u034F", "\u202F", "\u007F", " \u200B\u0001"]) {
    for (const marker of ["=", "+", "-", "@", "\uFE62", "\uFE63", "\uFE6B"]) {
      const original = prefix + marker + "123";
      assert.equal(toCSV([{ contact: original }]), `contact\n'${original}`);
    }
  }
});
