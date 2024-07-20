import * as crypto from 'node:crypto';

import { SymmetricKey } from './key';
import { Exception } from '../../errors';
import { ChunkStream } from '../../stream';
import { Base64, Hex, PEM, Utf8 } from '../characters';


export const supportedVariants = Object.freeze(['aes-128-cbc', 'aes-128-gcm', 'aes-256-cbc', 'aes-256-gcm'] as const);
export type Variants = (typeof supportedVariants)[number];

export const enum Algorithm {
  AES_128_CBC = 0x01,
  AES_128_GCM = 0x02,
  AES_256_CBC = 0x03,
  AES_256_GCM = 0x04,
}

type AESOptions = {
  iv?: Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView | string;
  variant?: Variants;
  name?: string;
};

export type CipherEncoding = 'pem' | 'hex' | 'base64' | 'binary' | 'utf8' | 'buffer';


export const enum EncryptionAlgorithm {
  AES = 0xFF,
  CHACHA20_POLY1305 = 0x100,
  AES_CHACHA20 = 0x101,
  PGP = 0x102,
  AES_PGP = 0x103,
  AES_CHACHA20_PGP = 0x104,
}

const DEFAULT_OPTIONS: Partial<AESOptions> = {
  variant: 'aes-256-cbc',
  name: 'AES',
};


export class AES extends ChunkStream {
  private readonly _key: SymmetricKey;
  private readonly _o: AESOptions;

  public constructor(
    key: Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView | string | SymmetricKey,
    options?: AESOptions // eslint-disable-line comma-dangle
  ) {
    super({ onListenerError: console.error });
    this._o = Object.assign({}, DEFAULT_OPTIONS, options);

    if(key instanceof SymmetricKey) {
      if(!key.usages.includes('encrypt') || !key.usages.includes('decrypt')) {
        throw new Exception('Symmetric key does not support encryption/decryption operations', 'ERR_UNSUPPORTED_OPERATION');
      }

      this._key = key;
    } else {
      this._key = new SymmetricKey(key,
        this._o.variant?.includes('128') ? 16 : 32,
        { algorithm: this._o.variant, usages: ['encrypt', 'decrypt'] } // eslint-disable-line comma-dangle
      );
    }

    if(!!this._key.algorithm && this._key.algorithm !== this._o.variant && !!this._o.variant) {
      throw new Exception('Symmetric key algorithm does not match the provided variant', 'ERR_INVALID_ALGORITHM');
    }

    if(this._o.variant?.includes('gcm') && this._key.authTag() === null) {
      throw new Exception('Cannot create AES-GCM cipher without an authentication tag', 'ERR_INVALID_AUTH_TAG');
    }
  }

  public update(data: string, encoding: CipherEncoding): this;
  public update(data: Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView): this;
  public update(data: Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView | string, encoding?: CipherEncoding): this {
    if(!this.writable) {
      throw new Exception('Cannot update cipher because it\'s stream is no longer writable', 'ERR_STREAM_DISPOSED');
    }

    if(ArrayBuffer.isView(data) || Buffer.isBuffer(data) || data instanceof Uint8Array) {
      super.acceptChunk(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    } else if(
      (data instanceof SharedArrayBuffer) ||
      (data instanceof ArrayBuffer)
    ) {
      const u8 = new Uint8Array(data);
      super.acceptChunk(Buffer.from(u8));
    } else if(typeof data === 'string') {
      if(!encoding || !isCipherEncoding(encoding)) {
        throw new Exception(`Cannot update cipher with invalid encoding '${encoding}'`, 'ERR_INVALID_ARGUMENT');
      }

      switch(encoding) {
        case 'hex':
          super.acceptChunk(Buffer.from(Hex.decode(data)));
          break;
        case 'base64':
          super.acceptChunk(Buffer.from(Base64.decode(data)));
          break;
        case 'binary':
          super.acceptChunk(Buffer.from(data, 'binary'));
          break;
        case 'utf8':
          super.acceptChunk(Buffer.from(Utf8.decode(data)));
          break;
        case 'pem':
          super.acceptChunk(Buffer.from(PEM.decode(data)));
          break;
        default:
          throw new Exception(`Cannot update cipher with unsupported encoding '${encoding}'`, 'ERR_INVALID_ARGUMENT');
      }
    } else {
      throw new Exception(`Cannot encrypt data 'typeof ${typeof data}'`, 'ERR_INVALID_TYPE');
    }

    return this;
  }

  public encrypt(): Promise<Buffer>;
  public encrypt(encoding: CipherEncoding): Promise<string>;
  public encrypt(encoding?: CipherEncoding): Promise<Buffer | string> {
    if(!this.writable) {
      throw new Exception('Cannot finalize cipher because it\'s stream is no longer writable', 'ERR_STREAM_DISPOSED');
    }

    const iv = this._key.iv();

    if(!iv || iv.byteLength < 16) {
      throw new Exception(`Cannot encrypt data with invalid IV length ${iv?.byteLength || 0}`, 'ERR_INVALID_IV_LENGTH');
    }

    const cipher = crypto.createCipheriv(this._o.variant!, this._key.valueOf(), iv);

    if(this._o.variant?.includes('gcm')) {
      const tag = this._key.authTag();

      if(!tag || tag.byteLength < 16) {
        throw new Exception(`Cannot encrypt data with invalid authentication tag length ${tag?.byteLength || 0}`, 'ERR_INVALID_AUTH_TAG');
      }

      (<any>cipher).setAuthTag(tag);
    }

    const output = Buffer.concat([cipher.update(this.end()), cipher.final()]);
    cipher.destroy();
    
    if(!encoding) return Promise.resolve(output);

    switch(encoding) {
      case 'hex':
        return Promise.resolve(Hex.encode(output));
      case 'base64':
        return Promise.resolve(Base64.encode(output));
      case 'binary':
        return Promise.resolve(output.toString('binary'));
      case 'utf8':
        return Promise.resolve(Utf8.encode(output));
      case 'pem':
        return Promise.resolve(PEM.encode(output, this._o.name));
      default:
        return Promise.resolve(output.toString(encoding as never));
    }
  }

  public decrypt(): Promise<Buffer>;
  public decrypt(encoding: CipherEncoding): Promise<string>;
  public decrypt(encoding?: CipherEncoding): Promise<Buffer | string> {
    if(!this.writable) {
      throw new Exception('Cannot finalize cipher because it\'s stream is no longer writable', 'ERR_STREAM_DISPOSED');
    }

    const iv = this._key.iv();

    if(!iv || iv.byteLength < 16) {
      throw new Exception(`Cannot decrypt data with invalid IV length ${iv?.byteLength || 0}`, 'ERR_INVALID_IV_LENGTH');
    }

    const cipher = crypto.createDecipheriv(this._o.variant!, this._key.valueOf(), iv);

    if(this._o.variant?.includes('gcm')) {
      const tag = this._key.authTag();

      if(!tag || tag.byteLength < 16) {
        throw new Exception(`Cannot decrypt data with invalid authentication tag length ${tag?.byteLength || 0}`, 'ERR_INVALID_AUTH_TAG');
      }

      (<any>cipher).setAuthTag(tag);
    }

    const output = Buffer.concat([cipher.update(this.end()), cipher.final()]);
    cipher.destroy();

    if(!encoding) return Promise.resolve(output);

    switch(encoding) {
      case 'hex':
        return Promise.resolve(Hex.encode(output));
      case 'base64':
        return Promise.resolve(Base64.encode(output));
      case 'binary':
        return Promise.resolve(output.toString('binary'));
      case 'utf8':
        return Promise.resolve(Utf8.encode(output));
      case 'pem':
        return Promise.resolve(PEM.encode(output, this._o.name));
      default:
        return Promise.resolve(output.toString(encoding as never));
    }
  }
}


export function isCipherEncoding(value: unknown): value is CipherEncoding {
  if(typeof value !== 'string') return false;
  return ['pem', 'hex', 'base64', 'binary', 'utf8', 'buffer'].includes(value);
}


export default AES;
