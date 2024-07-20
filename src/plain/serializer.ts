import { Exception } from '../@internals/errors';
import { jsonSafeParser, jsonSafeStringify } from '../@internals/json';
import { __$typeof, primitiveDataTypeValues } from '../@internals/util';


export function serialize(input: any): Buffer {
  const s = jsonSafeStringify(input);

  if(s.isLeft()) {
    throw s.value;
  }

  let t: Buffer = Buffer.from(s.value);
  const o = Buffer.alloc(2 + t.byteLength);

  o.writeUint8(__$typeof(input), 0);
  o.writeUint8(0x0, 1);

  for(let i = 0; i < t.length; i++) {
    o[i + 2] = t[i];
  }

  t = null!;
  return o;
}


export function parse<T = any>(input: Uint8Array): readonly [number, T] {
  if(input.length < 3) {
    throw new Exception('The given input length is less than the necessary to a plain-package buffer', 'ERR_OUT_OF_RANGE');
  }

  let candidate = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const byteZero = candidate.readUint8(0);

  if(!primitiveDataTypeValues.includes(byteZero)) {
    throw new Exception('Cannot determinate the data type of the package', 'ERR_INVALID_ARGUMENT');
  }

  if(candidate.readUint8(1) !== 0x0) {
    throw new Exception('Malformed plain-package buffer', 'ERR_INVALID_ARGUMENT');
  }

  const parsed = jsonSafeParser<T>(candidate.subarray(2).toString());
  candidate = null!;

  if(parsed.isLeft()) {
    throw parsed.value;
  }

  return Object.freeze([ byteZero, parsed.value ] as const);
}
