import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("true");
  });

  it("neutralises text a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell("\r=1")).toBe(`"'\r=1"`);
    expect(csvCell("orders(o_custkey)")).toBe("orders(o_custkey)");
  });

  it("leaves numbers numeric, negative ones included", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(1 / 3)).toBe("0.333333");
    expect(toCsv(["a", "b"], [[-1, "=x"]])).toBe("a,b\n-1,'=x\n");
  });
});
