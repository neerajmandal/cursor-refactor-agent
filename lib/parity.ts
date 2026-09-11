export type ObservableValue =
  | null
  | boolean
  | number
  | string
  | ObservableValue[]
  | { [key: string]: ObservableValue };

function scrubString(value: string, rules: string[]): string {
  return rules.reduce((current, rule) => {
    const [pattern, replacement = "<normalized>"] = rule.split("=>").map((part) => part.trim());
    if (!pattern) return current;
    try {
      return current.replace(new RegExp(pattern, "g"), replacement);
    } catch {
      return current.split(pattern).join(replacement);
    }
  }, value);
}

export function normalizeObservable(
  value: ObservableValue,
  rules: string[] = [],
): ObservableValue {
  if (typeof value === "string") return scrubString(value, rules);
  if (Array.isArray(value)) {
    return value.map((item) => normalizeObservable(item, rules));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !rules.includes(`omit:${key}`))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeObservable(item, rules)]),
    );
  }
  return value;
}

export function compareObservables(
  legacy: ObservableValue,
  target: ObservableValue,
  rules: string[] = [],
): {
  equal: boolean;
  legacy: ObservableValue;
  target: ObservableValue;
  difference: string;
} {
  const normalizedLegacy = normalizeObservable(legacy, rules);
  const normalizedTarget = normalizeObservable(target, rules);
  const left = JSON.stringify(normalizedLegacy);
  const right = JSON.stringify(normalizedTarget);
  return {
    equal: left === right,
    legacy: normalizedLegacy,
    target: normalizedTarget,
    difference: left === right ? "" : `Legacy ${left} did not match target ${right}`,
  };
}
