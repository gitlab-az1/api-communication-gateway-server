import type { Request, Response } from 'express';
import type { HttpHeaders } from '@ts-overflow/node-framework/types/http';

import { serialize } from './plain/serializer';
import { Exception } from './@internals/errors';
import ExpressAdapter from './adapters/express';
import { isPlainObject } from './@internals/util';
import Transporter, { EncryptedTransporter } from './transporter';
import { compress, compressionAlgorithms } from './@internals/compression';

export { AbstractTransporter, EncryptedTransporter, Transporter } from './transporter';
export { ExpressAdapter, AbstractContext as AbstractAdapterContext } from './adapters/express';
export { parse as parsePlainBuffer, serialize as serializePlainBuffer } from './plain/serializer';



export type DispatchPlainOptions = {
  toWeb: boolean;
  statusCode?: number;
  maxChunkSize?: number;
  compressionLevel?: number;
  compression?: 'plain' | 'gzip' | 'deflate';
  headers?: HttpHeaders;
  adapter: (
    | {
      provider: 'express';
      context: {
        request: Request,
        response: Response,
      };
    }
  );
};

export type DispatchEncryptedOptions = DispatchPlainOptions & {
  hmacKey?: string | Uint8Array;
  encryptionAlgorithm?: `aes-${'128' | '256'}-cbc`;
  password: string | Uint8Array | ArrayBuffer | SharedArrayBuffer | ArrayBufferView;
};


export async function dispatchPlain<T>(data: T, options: DispatchPlainOptions): Promise<number> {
  let buffer = Buffer.isBuffer(data) ? data : serialize(data);

  if(!!options.compression && compressionAlgorithms().map(item => item[0]).includes(options.compression) && options.compression !== 'plain') {
    buffer = await compress(options.compression, buffer, options.compressionLevel);

    options.headers ??= {};
    options.headers['X-Compressed-Buffer-Encoding-Algorithm'] = options.compression;
  }

  const t = new Transporter(buffer, options.maxChunkSize);
  buffer = null!;
  let a;

  switch(options.adapter.provider) {
    case 'express':
      a = new ExpressAdapter(options.adapter.context.request, options.adapter.context.response, t);
      break;
    default:
      throw new Exception(`Unknown adapter '${options.adapter.provider}'`, 'ERR_INVALID_ARGUMENT');
  }

  if(!!options.headers && isPlainObject(options.headers)) {
    for(const prop in options.headers) {
      if(!options.headers[prop]) continue;
      a.setHeader(prop, options.headers[prop]);
    }
  }
  
  return (await a[options.toWeb === true ? 'sendToWeb' : 'send'](options.statusCode));
}

export async function dispatchEncrypted<T>(data: T, options: DispatchEncryptedOptions): Promise<number> {
  let buffer = Buffer.isBuffer(data) ? data : serialize(data);

  if(!!options.compression && compressionAlgorithms().map(item => item[0]).includes(options.compression) && options.compression !== 'plain') {
    buffer = await compress(options.compression, buffer, options.compressionLevel);

    options.headers ??= {};
    options.headers['X-Compressed-Buffer-Encoding-Algorithm'] = options.compression;
  }

  const t = new EncryptedTransporter(buffer, options.password, options.hmacKey, options.encryptionAlgorithm, options.maxChunkSize);
  await t.begin();

  buffer = null!;
  let a;

  switch(options.adapter.provider) {
    case 'express':
      a = new ExpressAdapter(options.adapter.context.request, options.adapter.context.response, t);
      break;
    default:
      throw new Exception(`Unknown adapter '${options.adapter.provider}'`, 'ERR_INVALID_ARGUMENT');
  }

  if(!!options.headers && isPlainObject(options.headers)) {
    for(const prop in options.headers) {
      if(!options.headers[prop]) continue;
      a.setHeader(prop, options.headers[prop]);
    }
  }
  
  return (await a[options.toWeb === true ? 'sendToWeb' : 'send'](options.statusCode));
}
