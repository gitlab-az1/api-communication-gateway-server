export function isIterableIterator<T>(value: any): value is IterableIterator<T> {
  return typeof value === 'object' && value !== null && typeof value[Symbol.iterator] === 'function' && typeof value.next === 'function';
}

export function isThenable<T>(obj: unknown): obj is Promise<T> {
  return !!obj && typeof obj === 'object' && typeof (<Promise<T>>obj).then === 'function';
}


export const MAX_SAFE_SMALL_INTEGER = 1 << 0x1E;
export const MIN_SAFE_SMALL_INTEGER = -(1 << 0x1E);

/**
 * The maximum value of a 8-bit unsigned integer `2^8 - 1`.
 */
export const MAX_UINT_8 = 0xFF;

/**
 * The maximum value of a 32-bit unsigned integer `2^32 - 1`.
 */
export const MAX_UINT_32 = 0xFFFFFFFF;


export function toUint8(value: number): number {
  if(value < 0) return 0;
  if(value > MAX_UINT_8) return MAX_UINT_8;

  return value | 0;
}

export function toUint32(value: number): number {
  if(value < 0) return 0;
  if(value > MAX_UINT_32) return MAX_UINT_32;

  return value | 0;
}

const kindOf = (cache => (thing: any) => {
  const str = Object.prototype.toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));


export const kindOfTest = (type: string) => {
  type = type.toLowerCase();
  return (thing: any) => kindOf(thing) === type;
};


export function isPlainObject(val: any): boolean {
  if(Array.isArray(val)) return false;
  if(kindOf(val) !== 'object' || typeof val !== 'object') return false;

  const prototype = Object.getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
}


export function assertString(value: unknown, message?: string): asserts value is string {
  if(typeof value !== 'string') {
    throw new TypeError(message || `Expected a string, got ${kindOf(value)}`);
  }
}

export function assertInstance(value: unknown, __construct: any, message?: string): asserts value is typeof __construct {
  if(!__construct) {
    throw new TypeError(`Cannot assing 'typeof ${typeof __construct}' as 'typeof new \`object\`'`);
  }

  if(!(value instanceof __construct)) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    throw new TypeError(message || `Expected 'typeof ${typeof value}' to be instance of ${(__construct as Function).name}`);
  }
}


export function strShuffle(str: string): string {
  assertString(str);

  const arr = str.split('');

  // Loop through the array
  for(let i = arr.length - 1; i > 0; i--) {
    // Generate a random index
    const j = Math.floor(Math.random() * (i + 1));

    // Swap the current element with the random element
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  // Convert the array back to a string and return it
  return arr.join('');
}


export function isString(value: unknown): value is string {
  return (
    typeof value === 'string' ||
    (value instanceof String)
  );
}


/**
 * Checks if the value is a number.
 * 
 * @param {*} value The value to be checked 
 * @returns {boolean} True if the value is a number, false otherwise
 */
export function isDigit(value: unknown): value is number {
  return (
    typeof value === 'number' ||
    (value instanceof Number)
  ) && !Number.isNaN(value);
} 

export function isBigInt(x: any): boolean {
  try {
    return BigInt(x) === x; // dont use == because 7 == 7n but 7 !== 7n
  } catch {
    return false; // conversion to BigInt failed, surely it is not a BigInt
  }
}
