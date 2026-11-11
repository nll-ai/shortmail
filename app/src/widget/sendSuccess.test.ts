/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  SEND_SUCCESS_MESSAGES,
  renderSendSuccess,
  sendSuccessMessage,
} from "./sendSuccess";

const FIRST =
  "Message sent to {name}! Thanks for keeping it short and sweet.";

describe("send success copy", () => {
  it("selects each of the ten lines from an injectable source", () => {
    expect([...SEND_SUCCESS_MESSAGES]).toEqual([
      "Message sent to {name}! Thanks for keeping it short and sweet.",
      "Message sent to {name}! Short notes get read, and yours will.",
      "Message sent to {name}! Thanks for respecting their inbox.",
      "Message sent to {name}! It's on its way, short and to the point.",
      "Message sent to {name}! Brief, clear, and delivered.",
      "Message sent to {name}! Nice work saying a lot in a little.",
      "Message sent to {name}! Your note is on its way.",
      "Message sent to {name}! Short messages are the kindest kind.",
      "Message sent to {name}! Thanks for getting right to the point.",
      "Message sent to {name}! Delivered, and easy to read.",
    ]);
    const seen = SEND_SUCCESS_MESSAGES.map((_, index) =>
      sendSuccessMessage("Eric Ma", () => (index + 0.5) / SEND_SUCCESS_MESSAGES.length),
    );
    expect(new Set(seen).size).toBe(10);
    expect(seen).toEqual(
      SEND_SUCCESS_MESSAGES.map((line) => line.split("{name}").join("Eric Ma")),
    );
    expect(sendSuccessMessage("Eric Ma", () => 0)).toBe(seen[0]);
    expect(sendSuccessMessage("Eric Ma", () => 1)).toBe(seen[9]);
    expect(sendSuccessMessage("Eric Ma", () => 1 - Number.EPSILON)).toBe(seen[9]);
    expect(sendSuccessMessage("Eric Ma", () => Number.NaN)).toBe(seen[0]);
  });

  it("interpolates the display name and falls back when it is missing", () => {
    expect(sendSuccessMessage("Eric Ma", () => 0)).toBe(
      "Message sent to Eric Ma! Thanks for keeping it short and sweet.",
    );
    expect(sendSuccessMessage(undefined, () => 0)).toBe(
      FIRST.split("{name}").join("them"),
    );
    expect(sendSuccessMessage(null, () => 0)).toBe(
      FIRST.split("{name}").join("them"),
    );
    expect(sendSuccessMessage("{name}", () => 0)).toBe(
      FIRST.split("{name}").join("{name}"),
    );
    expect(sendSuccessMessage("$&", () => 0)).toBe(
      "Message sent to $&! Thanks for keeping it short and sweet.",
    );
  });

  it("renders the name as text so markup is not parsed", () => {
    const name = `<img src=x onerror=alert(1)> & $&`;
    const node = renderSendSuccess(name, () => 0);
    expect(node.className).toBe("success");
    expect(node.childElementCount).toBe(0);
    expect(node.querySelector("img, script")).toBeNull();
    expect(node.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe(
      `Message sent to ${name}! Thanks for keeping it short and sweet.`,
    );
    expect(node.innerHTML).toContain("&lt;img");
    expect(node.innerHTML).toContain("&amp;");
    expect(node.innerHTML).not.toContain("<img");
    expect(node.innerHTML).not.toContain("<script");
  });
});
