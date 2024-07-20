export type LooseAutocomplete<T extends string | number | symbol> = T | Omit<string, T>;

export type Dict<T> = {
  [key: string]: T;
}


export const enum PrimitiveDataType {
  String = 0xF,
  Integer = 0x10,
  Float = 0x11,
  Boolean = 0x12,
  Null = 0x13,
  Undefined = 0x14,
  Object = 0x15,
  Symbol = 0x16,
  Bigint = 0x17,
  Function = 0x18,
  Array = 0x19,
}
