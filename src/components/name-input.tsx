"use client";

import type { ComponentPropsWithoutRef } from "react";
import { stripNonNameCharacters } from "@/lib/name-characters";

/**
 * A name field that will not take a digit in the first place.
 *
 * It stays uncontrolled so defaultValue keeps working on the profile form, and
 * it cleans the value on input rather than on keypress so a paste is caught
 * too. The server still validates: this only saves the typist a round trip.
 */
export function NameInput(props: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      onInput={(event) => {
        const input = event.currentTarget;
        const cleaned = stripNonNameCharacters(input.value);
        if (cleaned !== input.value) {
          // Put the caret back where the typist left it. Without this, fixing a
          // typo in the middle of a name would throw the cursor to the end.
          const dropped = input.value.length - cleaned.length;
          const caret = Math.max(0, (input.selectionStart ?? cleaned.length) - dropped);
          input.value = cleaned;
          input.setSelectionRange(caret, caret);
        }
        props.onInput?.(event);
      }}
    />
  );
}
