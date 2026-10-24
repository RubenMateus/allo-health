import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { radii, spacing, typography } from "@/theme/tokens";

const kebab = (name: string) =>
  name.replace(/[A-Z]+/g, (letters) => `-${letters.toLowerCase()}`);

// Teach tailwind-merge the app's named scales so `p-lg` and `p-sm` (or
// `type-body` and `type-caption`) are recognised as conflicting.
const twMerge = extendTailwindMerge<"typography">({
  extend: {
    theme: {
      spacing: [...Object.keys(spacing).map(kebab), "hairline"],
      borderRadius: Object.keys(radii),
      borderWidth: ["hairline"],
    },
    classGroups: {
      typography: [{ type: Object.keys(typography).map(kebab) }],
    },
  },
});

/** Joins class names; later classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
