import { hash, hmac } from 'cryptx-sdk/hash';

import { Exception } from '../errors';


export async function hashObject(
  object: Uint8Array | ArrayBuffer | string,
  key: Uint8Array | ArrayBuffer | string,
  algorithm: 'sha256' | 'sha512' | 'sha1' = 'sha256' // eslint-disable-line comma-dangle
): Promise<Buffer> {
  if(!['sha1', 'sha256', 'sha512'].includes(algorithm)) {
    throw new Exception(`Cannot hash object with algorithm '${algorithm}'`, 'ERR_CRYPTO_INVALID_ALGORITHM');
  }

  if(object instanceof ArrayBuffer) {
    object = new Uint8Array(object);
  }

  if(key instanceof ArrayBuffer) {
    key = new Uint8Array(key);
  }

  const obj = Buffer.from(object as Uint8Array | string);
  const k = Buffer.from(key as Uint8Array | string);

  const result = await hmac(obj, k,
    algorithm as 'sha1' | 'sha256' | 'sha512', 'bytearray');

  return Buffer.from(result);
}


export function sha256(input: Uint8Array | string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    hash(input, 'sha256', 'bytearray').then(u8 => {
      resolve(Buffer.from(u8));
      u8 = null!;
    }, reject);
  });
}

export function sha512(input: Uint8Array | string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    hash(input, 'sha512', 'bytearray').then(u8 => {
      resolve(Buffer.from(u8));
      u8 = null!;
    }, reject);
  });
}
