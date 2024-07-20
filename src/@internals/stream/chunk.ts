import { Readable } from 'stream';
import { EventEmitter } from '@ts-overflow/async/events';
import { IDisposable } from '@ts-overflow/node-framework/disposable';

import { Exception } from '../errors';
import { listenStream } from './core';
import { assertString } from '../util';
import type { LooseAutocomplete } from '../types';
import { ICancellationToken } from '../cancellation';


export interface ChunkStreamDefaultEventsMap {
  data: Buffer;
  error: Exception;
  end: void;
}



const $chunks = Symbol('$::STREAM::CHUNK_STREAM->Chunks');
const $length = Symbol('$::STREAM::CHUNK_STREAM->TotalLength');
const $read = Symbol('$::STREAM::CHUNK_STREAM->Read');
const $finish = Symbol('$::STREAM::CHUNK_STREAM->Disposed');
const $disposed = Symbol('$::STREAM::CHUNK_STREAM->Disposed');


export class ChunkStream<TEvents extends Record<string, any> = ChunkStreamDefaultEventsMap> extends EventEmitter<TEvents> {
  private [$disposed]: boolean = false;
  private [$chunks]: Buffer[] = [];
  private [$length]: number = 0;
  private [$finish] = false;

  public get byteLength() {
    return this[$length];
  }

  public get writable(): boolean {
    return !this[$finish];
  }

  public acceptChunk(buffer: Buffer): void {
    if(this[$finish] === true) {
      const err = new Exception('Cannot accept more chunks after stream has been disposed', 'ERR_STREAM_BUFFER_OVERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw err;
    }

    this[$chunks].push(buffer);
    this[$length] += buffer.byteLength;

    this.emit('data', Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  }

  public read(byteCount: number): Buffer {
    return this[$read](byteCount, true);
  }

  public peek(byteCount: number): Buffer {
    return this[$read](byteCount, false);
  }

  public end(): Buffer {
    if(this[$finish] === true) {
      const err = new Exception('Cannot end stream more than once', 'ERR_END_OF_STREAM');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }
      
      throw err;
    }

    this[$finish] = true;
    this.emit('end', void 0);

    return Buffer.concat(this[$chunks]);
  }

  public return(): Buffer {
    if(this[$disposed] === true) {
      throw new Exception('Cannot return stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot return stream before it has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw err;
    }

    return Buffer.concat(this[$chunks]);
  }

  public chunks(): readonly Buffer[] {
    if(this[$disposed] === true) {
      throw new Exception('Cannot return stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot return chunks before stream has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw err;
    }

    return Object.freeze([ ...this[$chunks] ] as const);
  }

  public pipe(source: Readable, token?: ICancellationToken, onend?: () => void): void {
    if(this[$disposed] === true) {
      throw new Exception('Cannot pipe stream after it has been disposed', 'ERR_STREAM_BUFFER_UNDERFLOW');
    }

    if(!this[$finish]) {
      const err = new Exception('Cannot pipe stream before it has been closed', 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw err;
    }

    listenStream(source, {
      onEnd: () => void onend?.(),
      onData: chunk => {
        try {
          this.acceptChunk(_buffer(chunk));
        } catch (e) {
          this.emit('error', e);
        }
      },
      onError: err => void this.emit('error', err),
    }, token);
  }

  public on<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener: (data: TEvents[K]) => void, thisArgs?: any): IDisposable {
    assertString(event, 'Event name must be a string');
    return super.subscribe(event, listener as () => void, thisArgs);
  }

  public once<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener: (data: TEvents[K]) => void, thisArgs?: any): IDisposable {
    assertString(event, 'Event name must be a string');
    return super.subscribe(event, listener as () => void, thisArgs, { once: true });
  }

  public off<K extends keyof TEvents>(event: LooseAutocomplete<K>, listener?: (data: TEvents[K]) => void): void {
    assertString(event, 'Event name must be a string');
    super.removeListener(event, listener as (() => void) | undefined);
  }

  public removeAllListeners<K extends keyof TEvents>(event?: LooseAutocomplete<K>): void {
    if(!event) return super.removeListeners();
    super.removeListener(event as string);
  }

  public override dispose(): void {
    if(this[$disposed] === true) return;

    try {
      this.end();
      // eslint-disable-next-line no-empty
    } catch { }

    this.removeAllListeners();
    super.dispose();
    
    this[$length] = 0;
    this[$chunks] = [];
    this[$disposed] = true;
  }

  private [$read](byteCount: number, advance: boolean): Buffer {
    if(byteCount === 0) return Buffer.alloc(0);

    if(byteCount > this[$length]) {
      const err = new Exception(`Cannot read ${byteCount} bytes from stream with ${this[$length]} bytes`, 'ERR_STREAM_BUFFER_UNDERFLOW');

      try {
        this.emit('error', err);
        // eslint-disable-next-line no-empty
      } catch { }

      throw err;
    }

    let output: Buffer;

    if(this[$chunks][0].byteLength === byteCount) {
      const result = this[$chunks][0];

      if(advance === true) {
        this[$chunks].shift();
        this[$length] -= byteCount;
      }

      output = result;
    } else if(this[$chunks][0].byteLength > byteCount) {
      const result = this[$chunks][0].subarray(0, byteCount);

      if(advance === true) {
        this[$chunks][0] = this[$chunks][0].subarray(byteCount);
        this[$length] -= byteCount;
      }

      output = result;
    } else {
      const result = Buffer.alloc(byteCount);
      let offset = 0;
      let index = 0;

      while(byteCount > 0) {
        const chunk = this[$chunks][index];

        if(chunk.byteLength > byteCount) {
          const chunkPart = chunk.subarray(0, byteCount);
          result.set(chunkPart, offset);
          offset += byteCount;

          if(advance === true) {
            this[$chunks][index] = chunk.subarray(byteCount);
            this[$length] -= byteCount;
          }

          byteCount -= byteCount;
        } else {
          result.set(chunk, offset);
          offset += chunk.byteLength;

          if(advance === true) {
            this[$chunks].shift();
            this[$length] -= chunk.byteLength;
          } else {
            index++;
          }

          byteCount -= chunk.byteLength;
        }
      }

      output = result;
    }

    return output;
  }
}


const _buffer = (chunk: any): Buffer => {
  if(Buffer.isBuffer(chunk)) return chunk;
  if(typeof chunk === 'string') return Buffer.from(chunk);
  if(chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof Uint8Array) return Buffer.from(chunk);
  if(chunk instanceof Uint16Array) return Buffer.from(chunk);
  if(chunk instanceof Uint32Array) return Buffer.from(chunk);
  if(chunk instanceof Int8Array) return Buffer.from(chunk);
  if(chunk instanceof Int16Array) return Buffer.from(chunk);
  if(chunk instanceof Int32Array) return Buffer.from(chunk);
  if(chunk instanceof Float32Array) return Buffer.from(chunk);
  if(chunk instanceof Float64Array) return Buffer.from(chunk);
  if(chunk instanceof SharedArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof DataView) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if(ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  throw new Exception('Received non-buffer chunk from stream', 'ERR_STREAM_INVALID_CHUNK');
};

export default ChunkStream;
