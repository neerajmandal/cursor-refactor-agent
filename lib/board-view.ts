export const BOARD_VIEWS = ["architecture", "evidence", "cursor"] as const;

export type BoardView = (typeof BOARD_VIEWS)[number];

export function boardViewFromParam(
  value: string | string[] | null | undefined,
): BoardView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BOARD_VIEWS.includes(candidate as BoardView)
    ? (candidate as BoardView)
    : "architecture";
}

export function boardViewHref(currentUrl: string, view: BoardView): string {
  const url = new URL(currentUrl);
  if (view === "architecture") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
