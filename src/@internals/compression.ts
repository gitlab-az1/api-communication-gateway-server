import * as zlib from 'node:zlib';

import { Exception } from './errors';


enum COMPRESSION_ALGORITHM {
  PLAIN = 0xA,
  GZIP = 0xF,
  DEFLATE = 0x10,
}


export function compress(algorithm: COMPRESSION_ALGORITHM | Lowercase<keyof typeof COMPRESSION_ALGORITHM>, payload: Buffer, level?: number): Promise<Buffer> {
  if(!Buffer.isBuffer(payload)) {
    throw new Exception(`Cannot compress a non-buffer imput 'typeof ${typeof payload}'`, 'ERR_INVALID_ARGUMENT');
  }

  if(typeof algorithm === 'string') {
    algorithm = COMPRESSION_ALGORITHM[algorithm.toUpperCase() as keyof typeof COMPRESSION_ALGORITHM];
  }

  switch(algorithm) {
    case COMPRESSION_ALGORITHM.PLAIN: {
      const output = Buffer.alloc(1 + payload.byteLength);
      output.writeUint8(COMPRESSION_ALGORITHM.PLAIN, 0);

      for(let i = 0; i < payload.length; i++) {
        output[i + 1] = payload[i];
      }

      payload = null!;
      return Promise.resolve(output);
    } break;
    case COMPRESSION_ALGORITHM.DEFLATE:
      return new Promise<Buffer>((resolve, reject) => {
        zlib.deflate(payload, { level }, (e, b) => {
          // eslint-disable-next-line no-extra-boolean-cast
          if(!!e) return void reject(e);
          payload = null!;

          const output = Buffer.alloc(1 + b.byteLength);
          output.writeUint8(COMPRESSION_ALGORITHM.DEFLATE, 0);

          for(let i = 0; i < b.length; i++) {
            output[i + 1] = b[i];
          }

          b = null!;
          resolve(output);
        });
      });
    case COMPRESSION_ALGORITHM.GZIP:
      return new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(payload, { level }, (e, b) => {
          // eslint-disable-next-line no-extra-boolean-cast
          if(!!e) return void reject(e);
          payload = null!;

          const output = Buffer.alloc(1 + b.byteLength);
          output.writeUint8(COMPRESSION_ALGORITHM.GZIP, 0);

          for(let i = 0; i < b.length; i++) {
            output[i + 1] = b[i];
          }

          b = null!;
          resolve(output);
        });
      });
    default:
      throw new Exception(`Cannot determinate the compression algorithm requested for "${algorithm}"`, 'ERR_INVALID_COMPRESSION_ALGORITHM');
  }
}


export function decompress(payload: Buffer): Promise<Buffer> {
  if(!Buffer.isBuffer(payload)) {
    throw new Exception(`Cannot decompress a non-buffer imput 'typeof ${typeof payload}'`, 'ERR_INVALID_ARGUMENT');
  }

  switch(payload.readUint8(0)) {
    case COMPRESSION_ALGORITHM.PLAIN: {
      const t = payload.subarray(1);
      payload = null!;

      return Promise.resolve(t);
    } break;
    case COMPRESSION_ALGORITHM.DEFLATE:
      return new Promise<Buffer>((resolve, reject) => {
        zlib.inflate(payload.subarray(1), (e, b) => {
          // eslint-disable-next-line no-extra-boolean-cast
          if(!!e) return void reject(e);
          payload = null!;

          resolve(b);
        });
      });
    case COMPRESSION_ALGORITHM.GZIP:
      return new Promise<Buffer>((resolve, reject) => {
        zlib.gunzip(payload.subarray(1), (e, b) => {
          // eslint-disable-next-line no-extra-boolean-cast
          if(!!e) return void reject(e);
          payload = null!;

          resolve(b);
        });
      });
    default:
      throw new Exception(`Unknown compression algorithm: 0x${payload.readUint8(0).toString(16)}`, 'ERR_INVALID_COMPRESSION_ALGORITHM');
  }
}


export function isCompressedBuffer(input: Uint8Array): boolean {
  if(!Buffer.isBuffer(input)) {
    input = Buffer.from(input);
  }

  return input.length > 1 && ([
    COMPRESSION_ALGORITHM.DEFLATE,
    COMPRESSION_ALGORITHM.GZIP,
    COMPRESSION_ALGORITHM.PLAIN,
  ].includes((<Buffer>input).readUint8(0)));
}


export function compressionAlgorithms(): readonly [string, number][] {
  return Object.freeze([
    [ 'plain', COMPRESSION_ALGORITHM.PLAIN ],
    [ 'gzip', COMPRESSION_ALGORITHM.GZIP ],
    [ 'deflate', COMPRESSION_ALGORITHM.DEFLATE ],
  ] as const);
}
