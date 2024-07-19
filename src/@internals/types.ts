export type LooseAutocomplete<T extends string | number | symbol> = T | Omit<string, T>;

export type Dict<T> = {
  [key: string]: T;
}
