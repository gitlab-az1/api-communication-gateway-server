import { Exception } from '../../errors';


export type KeyFormat = 'armored.pem';
export type KeyType = 'cert' | 'public' | 'private' | 'symmetric' | 'other';
export type KeyUsage = 'decrypt' | 'derive-bits' | 'derive-key' | 'encrypt' | 'sign' | 'unwrap-key' | 'verify' | 'wrap-key';


export type SymmetricKeyOptions = {
  usages?: KeyUsage[];
  algorithm?: string;
  ivLength?: number;
  authTagLength?: number;
  inputEncoding?: BufferEncoding;
}


const $key = Symbol('$::CRYPTO::SYMMETRIC_KEY->Buffer');
const $options = Symbol('$::CRYPTO::SYMMETRIC_KEY->Options');
const $keyLength = Symbol('$::CRYPTO::SYMMETRIC_KEY->Length');

export class SymmetricKey {
  private readonly [$key]: Buffer;
  private readonly [$keyLength]: number;
  private readonly [$options]: SymmetricKeyOptions;
  
  public constructor(
    key: Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView | string,
    keyLength: number,
    options?: SymmetricKeyOptions // eslint-disable-line comma-dangle
  ) {
    options ??= {};

    if(!!options?.algorithm && !options.ivLength) {
      if(options.algorithm.startsWith('aes-')) {
        options.ivLength = 16;
      } else if(options.algorithm.startsWith('chacha20')) {
        options.ivLength = 12;
      }
    }

    const keyEncoding = options?.inputEncoding;
    this[$options] = Object.assign({}, options);

    if(
      Buffer.isBuffer(key) ||
      key instanceof Uint8Array ||
      ArrayBuffer.isView(key)
    ) {
      this[$key] = Buffer.from(key.buffer, key.byteOffset, key.byteLength);
      key = null!;
    } else if(typeof key === 'string') {
      this[$key] = (
        !!keyEncoding && Buffer.isEncoding(keyEncoding) ?
          Buffer.from(key, keyEncoding) :
          Buffer.from(key)
      );
    } else if(
      key instanceof ArrayBuffer ||
      key instanceof SharedArrayBuffer
    ) {
      this[$key] = Buffer.from(key);
      key = null!;
    } else {
      throw new Exception(`Cannot create a symmetric key from the provided key 'typeof ${typeof key}'`, 'ERR_INVALID_TYPE');
    }

    if(this[$key].byteLength < keyLength) {
      throw new Exception(`The provided key is too short, expected ${keyLength} bytes, got ${this[$key].byteLength} bytes`, 'ERR_INVALID_ARGUMENT');
    }

    this[$keyLength] = keyLength;
  }

  public get length(): number {
    return this[$keyLength];
  }

  public get usages(): KeyUsage[] {
    if(!this[$options].usages) {
      this[$options].usages = [];
    }

    return [...this[$options].usages];
  }

  public get algorithm(): string {
    return ` ${this[$options].algorithm} `.slice(1, -1);
  }

  public get ivLength(): number {
    return this[$options].ivLength ?? (this.algorithm.includes('128') ? 16 : 32);
  }

  public last(offset: number): Buffer {
    if(this[$key].length - offset < 0) {
      throw new Exception(`Cannot pick an sub-buffer at offset: ${this[$key].length - offset}`, 'ERR_INVALID_ARGUMENT');
    }

    return this[$key].subarray(this[$key].length - offset);
  }

  public getKey(): Buffer {
    return this[$key].subarray(0, this[$keyLength]);
  }

  public iv(): Buffer | null {
    if(this[$keyLength] === this[$key].byteLength) return null;
    if(this[$keyLength] + this.ivLength > this[$key].byteLength) return null;

    return this[$key].subarray(this[$keyLength], this[$keyLength] + this.ivLength);
  }

  public authTag(): Buffer | null {
    if(this[$keyLength] === this[$key].byteLength) return null;

    const o = this[$options].authTagLength ?? (this.algorithm.includes('128') ? 16 : 32);
    if(this[$keyLength] + this.ivLength + o > this[$key].byteLength) return null;

    return this[$key].subarray(this[$keyLength] + (this[$options].ivLength ?? (this.algorithm.includes('128') ? 16 : 32)),
      this[$keyLength] + (this[$options].ivLength ?? (this.algorithm.includes('128') ? 16 : 32)) + o);
  }

  public valueOf(): Buffer {
    return this[$key].subarray(0, this[$keyLength]);
  }
}

export default SymmetricKey;
