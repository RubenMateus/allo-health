import { View } from "react-native";
import { render, screen } from "nativewind/test";

import tailwindConfig from "@/tailwind.config";
import {
  colorClassName,
  radii,
  spacing,
  themes,
  typography,
  type ColorScheme,
} from "@/theme/tokens";
import { themeVariables } from "@/theme/variables";

// Compiles tailwind.config.ts the way the iOS and Android builds do, then
// checks each token class resolves to the value in theme/tokens.ts.
async function nativeStyle(className: string, scheme: ColorScheme = "dark") {
  await render(
    <View style={themeVariables[scheme]}>
      <View testID="subject" className={className} />
    </View>,
    { config: tailwindConfig },
  );
  return screen.getByTestId("subject").props.style;
}

const kebab = (name: string) =>
  name.replace(/[A-Z]+/g, (letters) => `-${letters.toLowerCase()}`);

describe.each(["dark", "light"] as const)("%s colors", (scheme) => {
  const colors = themes[scheme].colors;

  test.each(Object.keys(colors) as (keyof typeof colors)[])(
    "bg-%s",
    async (token) => {
      const style = await nativeStyle(`bg-${colorClassName(token)}`, scheme);
      expect(style).toEqual({ backgroundColor: colors[token] });
    },
  );
});

test.each(Object.entries(typography))("type-%s", async (name, style) => {
  expect(await nativeStyle(`type-${kebab(name)}`)).toEqual({
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight,
  });
});

test("a size utility overrides the type style's size", async () => {
  expect(await nativeStyle("type-badge text-[11px]")).toMatchObject({
    fontFamily: typography.badge.fontFamily,
    fontSize: 11,
  });
});

test.each(Object.entries(spacing))("p-%s", async (name, value) => {
  expect(await nativeStyle(`p-${kebab(name)}`)).toEqual({ padding: value });
});

test.each(Object.entries(radii))("rounded-%s", async (name, value) => {
  const className = name === "DEFAULT" ? "rounded" : `rounded-${name}`;
  expect(await nativeStyle(className)).toEqual({ borderRadius: value });
});

test("the numeric scale is in pixels", async () => {
  expect(await nativeStyle("w-11 gap-0.5")).toEqual({
    width: 44,
    rowGap: 2,
    columnGap: 2,
  });
});

test("tabular-nums", async () => {
  expect(await nativeStyle("tabular-nums")).toEqual({
    fontVariant: "tabular-nums",
  });
});
