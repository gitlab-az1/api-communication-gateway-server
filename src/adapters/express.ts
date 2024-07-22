import { Readable, Writable } from 'stream';
import { CookieOptions, type Request, type Response } from 'express';
import type { CommonHttpHeaders, HttpHeaders } from '@ts-overflow/node-framework/types/http';

import type { Adapter } from './abstract';
import { assertString, version } from '../@internals/util';
import type { LooseAutocomplete } from '../@internals/types';
import { AbstractTransporter, EncryptedTransporter } from '../transporter';


export interface AbstractContext {
  readonly request: Request;
  readonly response: Response;
}


const DEFAULT_HEADERS = Object.freeze<HttpHeaders>({
  'Content-Type': 'application/octet-stream',
  'X-Transporter-Version': version(),
});


export class ExpressAdapter implements Adapter<AbstractContext> {
  readonly #req: Request;
  readonly #res: Response;
  readonly #transporter: AbstractTransporter | EncryptedTransporter;

  #h: HttpHeaders = {};

  public constructor(
    _request: Request,
    _response: Response,
    _transporter: AbstractTransporter | EncryptedTransporter // eslint-disable-line comma-dangle
  ) {
    this.#req = _request;
    this.#res = _response;
    this.#transporter = _transporter;
  }

  public get ifaceName(): 'express' {
    return 'express' as const;
  }

  public get _context(): AbstractContext {
    return {
      request: this.#req,
      response: this.#res,
    };
  }

  public setHeader<K extends keyof CommonHttpHeaders>(name: LooseAutocomplete<K>, value: string | string): void {
    assertString(name);
    this.#h[name] = value;
  }

  public removeHeader<K extends keyof CommonHttpHeaders>(name: LooseAutocomplete<K>): void {
    assertString(name);
    delete this.#h[name];
  }

  public headers(): HttpHeaders {
    return { ...this.#h };
  }

  public setCookie(name: string, value: string, options?: CookieOptions): void {
    this.#res.cookie(name, value, options!);
  }

  public removeCookie(name: string, options?: CookieOptions): void {
    this.#res.clearCookie(name, options!);
  }

  public sendToWeb(statusCode?: number): Promise<number> {
    let chunksCount = 0;

    return new Promise(resolve => {
      Readable.toWeb((this.#transporter instanceof EncryptedTransporter ?
        this.#transporter.transporter :
        this.#transporter).readableStream)
        .pipeTo(new WritableStream({
          write: (chunk: Buffer) => {
            chunksCount++;
            this.#res.write(chunk);
          },

          close: () => {
            this.#res.end();
            resolve(chunksCount);
          },
        }));

      this.#res.writeHead(statusCode || 200, this.#headers());
    });
  }

  public send(statusCode?: number): Promise<number> {
    let chunksCount = 0;

    return new Promise((resolve, reject) => {
      const stream = (this.#transporter instanceof EncryptedTransporter ?
        this.#transporter.transporter :
        this.#transporter).readableStream;

      stream.on('error', reject);

      const w = new Writable({
        write: (chunk: Buffer) => {
          chunksCount++;
          this.#res.write(chunk);
        },
      });

      w.on('error', reject);
      w.on('close', () => {
        this.#res.end();
        resolve(chunksCount);
      });

      stream.pipe(w);
      this.#res.writeHead(statusCode || 200, this.#headers());
    });
  }

  #headers(): HttpHeaders {
    const o = Object.assign({}, DEFAULT_HEADERS, { 
      // 'X-Secure-Package-Integrity': '*buffer[] {0}',
      'X-Signed-Content-Integrity': this.#transporter instanceof EncryptedTransporter ? this.#transporter.signature : undefined,
      'X-Secure-Package-Algorithm': this.#transporter instanceof EncryptedTransporter ? this.#transporter.algorithm : undefined,
      'Content-Length': (this.#transporter instanceof EncryptedTransporter ? this.#transporter.transporter : this.#transporter).byteSize.toString(),
    } satisfies HttpHeaders, this.#h);

    for(const prop in o) {
      if(typeof o[prop] !== 'string' || !o[prop]) {
        delete o[prop];
      }
    }

    return o;
  }
}

export default ExpressAdapter;
