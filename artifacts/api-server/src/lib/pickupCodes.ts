import { randomBytes } from "crypto";

const PICKUP_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PICKUP_CODE_DIGITS = "23456789";
const PICKUP_CODE_LENGTH = 4;

export function generateLabelCode(
  bytes: Uint8Array = randomBytes(PICKUP_CODE_LENGTH + 2),
): string {
  if (bytes.length < PICKUP_CODE_LENGTH + 2) {
    throw new Error("Pickup-code generation requires at least 6 random bytes.");
  }

  const characters = Array.from(
    bytes.slice(0, PICKUP_CODE_LENGTH),
    (byte) => PICKUP_CODE_CHARACTERS[byte % PICKUP_CODE_CHARACTERS.length]!,
  );

  if (!characters.some((character) => /\d/.test(character))) {
    const digitPosition = bytes[PICKUP_CODE_LENGTH]! % PICKUP_CODE_LENGTH;
    characters[digitPosition] =
      PICKUP_CODE_DIGITS[
        bytes[PICKUP_CODE_LENGTH + 1]! % PICKUP_CODE_DIGITS.length
      ]!;
  }

  return characters.join("");
}
