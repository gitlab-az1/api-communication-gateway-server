import { Dict } from './types';

export const enum ERROR_CODE {
  DONE = 0,
  ERR_STREAM_BUFFER_OVERFLOW = 1000,
  ERR_END_OF_STREAM = 1001,
  ERR_STREAM_BUFFER_UNDERFLOW = 1002,
  ERR_STREAM_INVALID_CHUNK = 1003,
  ERR_UNSUPPORTED_OPERATION = 1004,
}


export function stringToErrno(code: keyof typeof ERROR_CODE): number {
  switch(code) {
    case 'DONE':
      return ERROR_CODE.DONE;
    default:
      return -1;
  }
}

export function errorCodeToString(code: number): string {
  switch(code) {
    case ERROR_CODE.DONE:
      return 'DONE';
    default:
      return 'Unknown error';
  }
}

export class Stacktrace {
  public static create(): Stacktrace {
    return new Stacktrace(new Error().stack ?? '');
  }

  private constructor(readonly value: string) { }

  public print(): void {
    console.warn(this.value.split('\n').slice(2).join('\n'));
  }

  public toString(): string {
    return this.value;
  }
}


export class Exception extends Error {
  public override readonly name: string = 'Exception' as const;
  public readonly stackTrace: Stacktrace;
  public readonly code: number;
  public readonly context?: Dict<any>;

  public constructor(message: string, code: keyof typeof ERROR_CODE | number, contextObject?: Dict<unknown>) {
    super(message);

    Error.captureStackTrace(this);
    this.stackTrace = Stacktrace.create();

    this.context = contextObject;
    this.code = typeof code === 'number' ? -Math.abs(code) : -stringToErrno(code);

    if(Math.abs(this.code) === 0) {
      this.code = 0;
    }
  }
}
