import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockIdentification } from "../lib/gemini.ts";
import type { CardInput } from "../types.ts";
import { CardForm } from "./CardForm.tsx";

describe("CardForm", () => {
  beforeEach(() => {
    vi.stubGlobal("createImageBitmap", undefined);
  });
  afterEach(() => {
    cleanup();
  });

  it("reads a sample card, edits it, and shows potential profit", async () => {
    const save = vi.fn<(input: CardInput) => Promise<void>>(async () => undefined);
    render(
      <CardForm
        initial={null}
        initialPhotoUrl={null}
        identify={async () => mockIdentification()}
        onSave={save}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Buy price"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Asking price"), { target: { value: "25" } });
    expect(screen.getByTestId("profit-line").textContent).toBe("Potential $15.00");

    const file = new File(["photo"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo library"), { target: { files: [file] } });
    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Read the card" }) as HTMLButtonElement;
      if (button.disabled) throw new Error("photo not ready");
    });
    fireEvent.click(screen.getByRole("button", { name: "Read the card" }));
    expect(await screen.findByDisplayValue("Sample Player")).toBeTruthy();
    expect(screen.getByText(/Sample read/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "Patrick Mahomes" } });
    fireEvent.click(screen.getByRole("button", { name: "For sale" }));
    fireEvent.click(screen.getByRole("button", { name: "Save card" }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeTruthy();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    const saved = save.mock.calls[0]?.[0];
    expect(saved?.player).toBe("Patrick Mahomes");
    expect(saved?.year).toBe("2024");
    expect(saved?.setName).toBe("Panini Prizm");
    expect(saved?.buyCents).toBe(1000);
    expect(saved?.askingCents).toBe(2500);
    expect(saved?.status).toBe("for_sale");
    expect(saved?.photo).toBeInstanceOf(Blob);
  });

  it("shows realized profit from sold price minus buy price", () => {
    render(
      <CardForm
        initial={null}
        initialPhotoUrl={null}
        identify={async () => mockIdentification()}
        onSave={async () => undefined}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sold" }));
    fireEvent.change(screen.getByLabelText("Buy price"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Sold price"), { target: { value: "40" } });
    expect(screen.getByTestId("profit-line").textContent).toBe("Profit $30.00");

    fireEvent.change(screen.getByLabelText("Sold price"), { target: { value: "4" } });
    expect(screen.getByTestId("profit-line").textContent).toBe("Loss $6.00");
  });

  it("points the user to Settings when the shared scanner is out of quota", async () => {
    const { RELAY_QUOTA_MESSAGE } = await import("../lib/gemini.ts");
    render(
      <CardForm
        initial={null}
        initialPhotoUrl={null}
        identify={async () => {
          throw new Error(RELAY_QUOTA_MESSAGE);
        }}
        loadPhoto={async () => new Blob(["photo"], { type: "image/jpeg" })}
        onSave={async () => undefined}
        onCancel={() => undefined}
      />,
    );
    // Existing card photo path: initial photo id is missing, so give a library photo.
    const file = new File(["photo"], "card.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photo library"), { target: { files: [file] } });
    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Read the card" }) as HTMLButtonElement;
      if (button.disabled) throw new Error("photo not ready");
    });
    fireEvent.click(screen.getByRole("button", { name: "Read the card" }));
    expect(await screen.findByText(RELAY_QUOTA_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(window.location.hash).toBe("#/settings");
  });
});
