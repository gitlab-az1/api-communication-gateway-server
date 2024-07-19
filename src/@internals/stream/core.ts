import { ICancellationToken } from '../cancellation';


export type ReadableStreamEventPayload<T> = T | Error | 'end';

export interface ReadableStreamEvents<T> {

	/**
	 * The 'data' event is emitted whenever the stream is
	 * relinquishing ownership of a chunk of data to a consumer.
	 *
	 * NOTE: PLEASE UNDERSTAND THAT ADDING A DATA LISTENER CAN
	 * TURN THE STREAM INTO FLOWING MODE. IT IS THEREFOR THE
	 * LAST LISTENER THAT SHOULD BE ADDED AND NOT THE FIRST
	 *
	 * Use `listenStream` as a helper method to listen to
	 * stream events in the right order.
	 */
	on(event: 'data', callback: (data: T) => void): void;

	/**
	 * Emitted when any error occurs.
	 */
	on(event: 'error', callback: (err: Error) => void): void;

	/**
	 * The 'end' event is emitted when there is no more data
	 * to be consumed from the stream. The 'end' event will
	 * not be emitted unless the data is completely consumed.
	 */
	on(event: 'end', callback: () => void): void;
}

export interface IStreamListener<T> {

	/**
	 * The 'data' event is emitted whenever the stream is
	 * relinquishing ownership of a chunk of data to a consumer.
	 */
	onData(data: T): void;

	/**
	 * Emitted when any error occurs.
	 */
	onError(err: Error): void;

	/**
	 * The 'end' event is emitted when there is no more data
	 * to be consumed from the stream. The 'end' event will
	 * not be emitted unless the data is completely consumed.
	 */
	onEnd(): void;
}


export function listenStream<T>(stream: ReadableStreamEvents<T>, listener: IStreamListener<T>, token?: ICancellationToken): void {
  stream.on('error', error => {
    if(!token?.isCancellationRequested) {
      listener.onError(error);
    }
  });

  stream.on('end', () => {
    if(!token?.isCancellationRequested) {
      listener.onEnd();
    }
  });

  // Adding the `data` listener will turn the stream
  // into flowing mode. As such it is important to
  // add this listener last (DO NOT CHANGE!)
  stream.on('data', data => {
    if(!token?.isCancellationRequested) {
      listener.onData(data);
    }
  });
}
