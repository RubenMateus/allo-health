const APP_NAME = "Allo Health";

/** "Allo Health 1.2.0 (abc1234)", dropping whatever is missing. */
export function formatVersionLabel(
  version?: string | null,
  commit?: unknown,
): string {
  let label = version ? `${APP_NAME} ${version}` : APP_NAME;
  if (typeof commit === "string" && commit.length > 0) {
    label += ` (${commit})`;
  }
  return label;
}
