import { Readable } from 'stream';
import { CookieOptions, type Request, type Response } from 'express';
import type { CommonHttpHeaders, HttpHeaders } from '@ts-overflow/node-framework/types/http';

import type { Adapter } from './abstract';
import { assertString } from '../@internals/util';
import { AbstractTransporter } from '../transporter';
import type { LooseAutocomplete } from '../@internals/types';


export interface AbstractContext {
  readonly request: Request;
  readonly response: Response;
}


export class ExpressAdapter implements Adapter<AbstractContext> {
  // @ts-expect-error The private property 'request' is never used.
  readonly #req: Request;
  readonly #res: Response;
  readonly #transporter: AbstractTransporter;

  #h: HttpHeaders = {};

  public constructor(
    _request: Request,
    _response: Response,
    _transporter: AbstractTransporter // eslint-disable-line comma-dangle
  ) {
    this.#req = _request;
    this.#res = _response;
    this.#transporter = _transporter;
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

  public send(statusCode?: number): Promise<number> {
    let chunks = 0;

    return new Promise(resolve => {
      Readable.toWeb(this.#transporter.readableStream)
        .pipeTo(new WritableStream({
          write: (chunk: Buffer) => {
            chunks++;
            this.#res.write(chunk);
          },

          close: () => {
            this.#res.end();
            resolve(chunks);
          },
        }));

      this.#res.writeHead(statusCode ?? 200, this.#headers());
    });
  }

  #headers(): HttpHeaders {
    return this.#h;
  }
}

export default ExpressAdapter;
