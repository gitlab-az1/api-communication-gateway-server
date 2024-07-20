import { Exception } from '../errors';



export const enum TextEncodingStrategy {
  HEX = 0xFF,
  BASE_64 = 0x100,
  ASCII = 0x101,
  PEM = 0x102,
  UTF_8 = 0x103,
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Hex {
  export const strategy = TextEncodingStrategy.HEX;
  export const characters = Object.freeze(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'] as const);

  
  export function encode(data: Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
    if(
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array) &&
      !(data instanceof ArrayBuffer) &&
      !(data instanceof SharedArrayBuffer)
    ) {
      throw new Exception(`Cannot encode 'typeof ${typeof data}' to a hexademical string. Use a buffer or a typed array.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.isBuffer(data) ? 
      data : Buffer.from(data);
      
    return bytes.toString('hex');
  }

  export function decode(data: string): Uint8Array {
    if(typeof data !== 'string') {
      throw new Exception(`Cannot decode 'typeof ${typeof data}' to a buffer. Use a hexademical string.`, 'ERR_INVALID_TYPE');
    }

    if(data.length % 2 !== 0) {
      throw new Exception('Cannot decode a hexademical string with an odd length.', 'ERR_OUT_OF_BOUNDS');
    }

    const bytes = Buffer.from(data, 'hex');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Base64 {
  export const strategy = TextEncodingStrategy.BASE_64;
  export const characters = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/', '='] as const);

  export function encode(data: Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
    if(
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array) &&
      !(data instanceof ArrayBuffer) &&
      !(data instanceof SharedArrayBuffer)
    ) {
      throw new Exception(`Cannot encode 'typeof ${typeof data}' to a base64 string. Use a buffer or a typed array.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.isBuffer(data) ? 
      data : Buffer.from(data);
      
    return bytes.toString('base64');
  }

  export function decode(data: string): Uint8Array {
    if(typeof data !== 'string') {
      throw new Exception(`Cannot decode 'typeof ${typeof data}' to a buffer. Use a base64 string.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.from(data, 'base64');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ASCII {
  export const strategy = TextEncodingStrategy.ASCII;
  export const characters = Object.freeze([...Array.from({ length: 128 }, (_, i) => String.fromCharCode(i))]);

  export function encode(data: Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
    if(
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array) &&
      !(data instanceof ArrayBuffer) &&
      !(data instanceof SharedArrayBuffer)
    ) {
      throw new Exception(`Cannot encode 'typeof ${typeof data}' to an ASCII string. Use a buffer or a typed array.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.isBuffer(data) ? 
      data : Buffer.from(data);
      
    return bytes.toString('ascii');
  }

  export function decode(data: string): Uint8Array {
    if(typeof data !== 'string') {
      throw new Exception(`Cannot decode 'typeof ${typeof data}' to a buffer. Use an ASCII string.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.from(data, 'ascii');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PEM {
  export const strategy = TextEncodingStrategy.PEM;
  export const characters = [...Base64.characters, '-'] as const;

  export function encode(data: Uint8Array | ArrayBuffer | SharedArrayBuffer, name?: string): string {
    if(
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array) &&
      !(data instanceof ArrayBuffer) &&
      !(data instanceof SharedArrayBuffer)
    ) {
      throw new Exception(`Cannot encode 'typeof ${typeof data}' to a PEM string. Use a buffer or a typed array.`, 'ERR_INVALID_TYPE');
    }

    let output = '';

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!name) {
      output += `-----BEGIN ${name.toUpperCase().replace(/-/g, ' ')}-----\r\n`;
    }

    output += Base64.encode(data);

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!name) {
      output += `\r\n-----END ${name.toUpperCase().replace(/-/g, ' ')}-----`;
    }

    return output;
  }

  export function decode(data: string, name?: string, index?: number): Uint8Array {
    if(typeof data !== 'string') {
      throw new Exception(`Cannot decode 'typeof ${typeof data}' to a buffer. Use a PEM string.`, 'ERR_INVALID_TYPE');
    }

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!name) {
      name = name.replace(/-/g, ' ');
    }

    // eslint-disable-next-line no-useless-escape
    const re1 = /([A-Za-z0-9\+\/\s\=]+)/g;
    let valid: RegExpExecArray | null | false = re1.exec(data);

    if(valid?.[1].length !== data.length) {
      valid = false;
    }

    if(!valid && name) {
      const re2 = new RegExp(
        '-----\\s?BEGIN ' + name.toUpperCase() +
            '-----([A-Za-z0-9\\+\\/\\s\\=]+)-----\\s?END ' +
            name.toUpperCase() + '-----', 'g');

      valid = re2.exec(data);
    }

    if(!valid) {
      const re3 = new RegExp(
        '-----\\s?BEGIN [A-Z0-9\\s]+' +
            '-----([A-Za-z0-9\\+\\/\\s\\=]+)-----\\s?END ' +
            '[A-Z0-9\\s]+-----', 'g');

      valid = re3.exec(data);
    }

    const r = valid && valid[1 + (index || 0)];

    if(!r) {
      throw new Exception('Invalid PEM string.', 'ERR_INVALID_TYPE');
    }

    return Base64.decode(r);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Utf8 {
  export const strategy = TextEncodingStrategy.UTF_8;
  export const characters = Object.freeze([...Array.from({ length: 128 }, (_, i) => String.fromCharCode(i))]);

  export function encode(data: Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
    if(
      !Buffer.isBuffer(data) &&
      !(data instanceof Uint8Array) &&
      !(data instanceof ArrayBuffer) &&
      !(data instanceof SharedArrayBuffer)
    ) {
      throw new Exception(`Cannot encode 'typeof ${typeof data}' to a UTF-8 string. Use a buffer or a typed array.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.isBuffer(data) ? 
      data : Buffer.from(data);
      
    return bytes.toString('utf-8');
  }

  export function decode(data: string): Uint8Array {
    if(typeof data !== 'string') {
      throw new Exception(`Cannot decode 'typeof ${typeof data}' to a buffer. Use a UTF-8 string.`, 'ERR_INVALID_TYPE');
    }

    const bytes = Buffer.from(data, 'utf-8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}
