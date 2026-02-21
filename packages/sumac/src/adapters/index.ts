import { createMemoryCache } from './memory/cache';
import { createMemoryPubSub } from './memory/pubsub';
import { createMemoryQueue } from './memory/queue';
import { createMemorySession } from './memory/session';
import type {
  CacheAdapter,
  PubSubAdapter,
  QueueAdapter,
  SessionAdapter,
  SumacOpts
} from './types';

export const resolveCache = (cfg?: SumacOpts['cache']): CacheAdapter =>
  !cfg || cfg === 'memory' ? createMemoryCache() : cfg;

export const resolveSession = (cfg?: SumacOpts['session']): SessionAdapter =>
  !cfg || cfg === 'memory' ? createMemorySession() : cfg;

export const resolveQueue = (cfg?: SumacOpts['queue']): QueueAdapter =>
  !cfg || cfg === 'memory' ? createMemoryQueue() : cfg;

export const resolvePubSub = (cfg?: SumacOpts['pubsub']): PubSubAdapter =>
  !cfg || cfg === 'memory' ? createMemoryPubSub() : cfg;
