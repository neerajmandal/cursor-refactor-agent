export const BOARD_VIEWS = ["research", "plan", "implement"] as const;

export type BoardView = (typeof BOARD_VIEWS)[number];

export function boardViewFromParam(
  value: string | string[] | null | undefined,
): BoardView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BOARD_VIEWS.includes(candidate as BoardView)
    ? (candidate as BoardView)
    : "research";
}

export function boardViewHref(currentUrl: string, view: BoardView): string {
  const url = new URL(currentUrl);
  url.searchParams.delete("view");
  if (view === "research") {
    url.searchParams.delete("phase");
  } else {
    url.searchParams.set("phase", view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
