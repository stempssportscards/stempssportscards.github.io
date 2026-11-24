import { describe, expect, it } from "vitest";
import { parseRoute } from "./route.ts";

describe("parseRoute", () => {
  it("maps the shelf, card, and buyer routes", () => {
    expect(parseRoute("")).toEqual({ name: "shelf" });
    expect(parseRoute("#/")).toEqual({ name: "shelf" });
    expect(parseRoute("#/add")).toEqual({ name: "add" });
    expect(parseRoute("#/needs")).toEqual({ name: "shelf", filter: "needs_details" });
    expect(parseRoute("#/prices")).toEqual({ name: "shelf", filter: "needs_prices" });
    expect(parseRoute("#/card/abc")).toEqual({ name: "card", id: "abc" });
    expect(parseRoute("#/edit/abc")).toEqual({ name: "edit", id: "abc" });
    expect(parseRoute("#/sale")).toEqual({ name: "sale" });
    expect(parseRoute("#/settings")).toEqual({ name: "settings" });
    expect(parseRoute("#/s/demo")).toEqual({ name: "public", fileId: "demo" });
    expect(parseRoute("#/s/file%20id")).toEqual({ name: "public", fileId: "file id" });
  });
});
