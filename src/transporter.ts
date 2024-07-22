import math from 'next-math';
import { Readable } from 'stream';

import { Exception } from './@internals/errors';
import { ChunkStream } from './@internals/stream';
import AES from './@internals/crypto/symmetric/aes';
import { MAX_CHUNK_SIZE } from './@internals/constants';
import { hashObject, sha512 } from './@internals/crypto/hash';
import { SymmetricKey } from './@internals/crypto/symmetric/key';
import { type SymmetricEncryptionAlgorithm } from './@internals/crypto/symmetric';


export interface AbstractTransporter {
  readonly readableStream: Readable;
  readonly byteSize: number;

  chunks(): readonly Buffer[];
  return(): Buffer;
}


export class Transporter extends ChunkStream implements AbstractTransporter {
  readonly #maxLength: number;
  readonly #stream: Readable;

  public constructor(
    _payload: Buffer,
    _maxBlockSize: number = MAX_CHUNK_SIZE // eslint-disable-line comma-dangle
  ) {
    super({ onListenerError: console.error });
    this.#maxLength = _maxBlockSize || MAX_CHUNK_SIZE;

    if(_payload.byteLength <= this.#maxLength) {
      super.acceptChunk(_payload);
    } else {
      let offset = 0;

      while(offset < _payload.byteLength) {
        const end = math.min(offset + this.#maxLength, _payload.byteLength);
        super.acceptChunk(_payload.subarray(offset, end));

        offset += this.#maxLength;
      }
    }

    _payload = null!;

    super.end();
    let chunks = super.chunks();
    let currentChunkIndex = 0;

    this.#stream = new Readable({
      read() {
        while(currentChunkIndex < chunks.length) {
          if(!this.push(chunks[currentChunkIndex++])) return; // Stop pushing if the internal buffer is full
        }

        chunks = null!;
        this.push(null); // Signal end of stream
      },
    });

    this.#stream.on('drain', () => {
      if(!chunks) return;

      // Resume pushing chunks when the internal buffer is drained
      while(currentChunkIndex < chunks.length) {
        if(!this.#stream.push(chunks[currentChunkIndex++])) return; // Stop pushing if the internal buffer is full
      }

      chunks = null!;
      this.#stream.push(null); // Signal end of stream if all chunks are pushed
    });
  }

  public get readableStream(): Readable {
    return this.#stream;
  }

  public get byteSize(): number {
    return super.byteLength;
  }

  public override end(): Buffer {
    if(!this.#stream.destroyed) {
      this.#stream.destroy();
    }

    if(super.writable) return super.end();
    return super.return();
  }
}


type EncryptedTransporterProps = {
  originalPayload: Buffer;
  algorithm: SymmetricEncryptionAlgorithm;
  hmacKey?: string | Uint8Array;
  password: string | Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView;
}

export class EncryptedTransporter {
  #ready: boolean = false;
  #signature: Buffer | null = null;
  #transporter: Transporter | null = null;
  #algorithmIdentifier: Buffer | null = null;

  readonly #maxLength: number;
  readonly #props: EncryptedTransporterProps;

  public constructor(
    _payload: Uint8Array,
    _password: string | Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView,
    _hmacKey?: string | Uint8Array,
    _algorithm: SymmetricEncryptionAlgorithm = 'aes-256-cbc',
    _maxBlockSize?: number // eslint-disable-line comma-dangle
  ) {
    this.#maxLength = _maxBlockSize || MAX_CHUNK_SIZE;

    this.#props = {
      originalPayload: Buffer.isBuffer(_payload) ? _payload : Buffer.from(_payload),
      algorithm: _algorithm,
      password: _password,
      hmacKey: _hmacKey,
    };
  }

  public get maxLength(): number {
    return this.#maxLength;
  }

  public get algorithm(): string {
    if(!this.#ready || !this.#algorithmIdentifier) {
      throw new Exception('Cannot get the algorithm identifier before initialize the instance', 'ERR_UNSUPPORTED_OPERATION');
    }

    return this.#algorithmIdentifier.toString('base64');
  }

  public begin(): Promise<this> {
    return this.#DoBeginTransporter();
  }

  public get transporter(): Transporter {
    if(!this.#ready || !this.#transporter) {
      throw new Exception('Cannot get a transporter before initialize the instance', 'ERR_UNSUPPORTED_OPERATION');
    }

    return this.#transporter;
  }

  public get signature(): string {
    if(!this.#ready || !this.#signature) {
      throw new Exception('Cannot get a transporter signature before initialize the instance', 'ERR_UNSUPPORTED_OPERATION');
    }

    return this.#signature.toString('base64');
  }

  async #DoBeginTransporter(): Promise<this> {
    if(this.#ready) {
      throw new Exception('Cannot begin a encrypted transporter more than once', 'ERR_UNSUPPORTED_OPERATION');
    }

    const sk = new SymmetricKey(this.#props.password, this.#props.algorithm.includes('128') ? 16 : 32, {
      algorithm: this.#props.algorithm,
      usages: ['encrypt', 'decrypt'],
    });

    const hk = this.#props.hmacKey ? (
      Buffer.isBuffer(this.#props.hmacKey) ? this.#props.hmacKey : Buffer.from(this.#props.hmacKey)
    ) : sk.last(14);

    this.#signature = await hashObject(this.#props.originalPayload, hk, 'sha512');
    
    const aes = new AES(sk, { variant: this.#props.algorithm });
    aes.update(this.#props.originalPayload);

    this.#transporter = new Transporter((await aes.encrypt()), this.#maxLength);
    this.#props.originalPayload = null!;

    this.#algorithmIdentifier = await sha512(this.#props.algorithm);

    this.#ready = true;
    return this;
  }
}


export default Transporter;
