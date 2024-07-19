import type { Request, Response } from 'express';

import type { Adapter } from './abstract';


export interface AbstractContext {
  readonly request: Request;
  readonly response: Response;
}


export class ExpressAdapter implements Adapter<AbstractContext> {}

export default ExpressAdapter;
