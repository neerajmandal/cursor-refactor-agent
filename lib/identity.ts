const COLORS = ["#c45c26", "#2f6f4e", "#3d5a80", "#8b3a62", "#4a6fa5", "#7a4e1d"];
const NAME_KEY = "cural:name";
const ID_KEY = "cural:user-id";
const COLOR_KEY = "cural:color";

export type Identity = {
  id: string;
  name: string;
  color: string;
};

function randomId(): string {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export function readIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const name = window.localStorage.getItem(NAME_KEY)?.trim();
  if (!name) return null;
  let id = window.localStorage.getItem(ID_KEY);
  let color = window.localStorage.getItem(COLOR_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(ID_KEY, id);
  }
  if (!color) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];
    window.localStorage.setItem(COLOR_KEY, color);
  }
  return { id, name, color };
}

export function writeIdentity(name: string): Identity {
  const existing = readIdentity();
  const trimmed = name.trim();
  const id = existing?.id ?? randomId();
  const color =
    existing?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];
  window.localStorage.setItem(NAME_KEY, trimmed);
  window.localStorage.setItem(ID_KEY, id);
  window.localStorage.setItem(COLOR_KEY, color);
  return { id, name: trimmed, color };
}

export function setupStorageKey(boardId: string): string {
  return `cural:setup:${boardId}`;
}
