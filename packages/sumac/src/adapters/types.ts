export type CacheAdapter = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ttl?: string }): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  incr(key: string, opts?: { ttl?: string }): Promise<number>;
};

export type SessionAdapter = {
  get<T = unknown>(sid: string): Promise<T | null>;
  set(sid: string, data: unknown, opts?: { ttl?: string }): Promise<void>;
  delete(sid: string): Promise<void>;
};

export type JobOpts = {
  retries?: number;
  backoff?: 'fixed' | 'exponential';
  delay?: string;
};

export type QueueAdapter = {
  enqueue(job: string, payload: unknown, opts?: JobOpts): Promise<void>;
  process(job: string, handler: (payload: unknown) => Promise<void>): void;
};

export type PubSubAdapter = {
  publish(event: string, payload: unknown): Promise<void>;
  subscribe(
    event: string,
    handler: (payload: unknown) => void | Promise<void>
  ): void;
};

export type SumacOpts = {
  cache?: 'memory' | CacheAdapter;
  session?: 'memory' | SessionAdapter;
  queue?: 'memory' | QueueAdapter;
  pubsub?: 'memory' | PubSubAdapter;
};
