import type { HttpHeaders } from '@ts-overflow/node-framework/types';


export interface Adapter<TContext> {
  readonly _context: TContext;
  readonly ifaceName: string;

  headers(): HttpHeaders;
  send(status?: number): Promise<number>;
  sendToWeb(status?: number): Promise<number>;
}
