export const INSERT_CHUNK = 2000;

export function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

export const json = (value: unknown) => JSON.stringify(value);
