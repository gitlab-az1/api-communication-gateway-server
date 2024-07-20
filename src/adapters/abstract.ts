// @ts-expect-error The generic 'TContext' is nver used
export interface Adapter<TContext> { }


export abstract class AbstractAdapter<T> implements Adapter<T> { }

export default AbstractAdapter;
