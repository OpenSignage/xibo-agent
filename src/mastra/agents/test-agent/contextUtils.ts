/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Extract threadId and resourceId from runtimeContext/context safely.
 * Normalizes several possible locations and header names used across environments.
 */
export function extractContextIds(args: { runtimeContext?: any; context?: any }) {
  const rt = args.runtimeContext ?? {};

  // Support both plain-object and Map-like runtimeContext (with get())
  const safeGet = (obj: any, key: string) => {
    if (!obj) return undefined;
    try {
      if (typeof obj.get === 'function') return obj.get(key);
    } catch {}
    return obj?.[key];
  };

  const session = safeGet(rt, 'session') ?? rt.session ?? {};
  const mem = safeGet(rt, 'memory') ?? rt.memory ?? {};
  const req = safeGet(rt, 'request') ?? rt.request ?? {};
  const rawHeaders = (safeGet(req, 'headers') ?? req.headers ?? {}) as Record<string, any>;
  const headers = Object.fromEntries(
    Object.entries(rawHeaders).map(([k, v]) => [String(k).toLowerCase(), v])
  ) as Record<string, any>;

  const threadId =
    // Memory-scoped values
    (mem && (mem.thread ?? safeGet(mem, 'thread'))) ??
    // Session-backed values
    (session && (
      safeGet(session, 'thread')?.id ??
      safeGet(session, 'threadId') ??
      safeGet(session, 'conversation')?.id ??
      session?.thread?.id ?? session?.threadId ?? session?.conversation?.id
    )) ??
    // Top-level context fallbacks
    safeGet(rt, 'thread')?.id ?? safeGet(rt, 'threadId') ?? safeGet(rt, 'conversation')?.id ??
    rt?.thread?.id ?? rt?.threadId ?? rt?.conversation?.id ??
    // Headers supplied by server / playground
    headers['x-mastra-thread-id'] ?? headers['x-thread-id'] ??
    // Explicit invocation context
    args.context?.threadId ?? args.context?.thread?.id ??
    // Context memory (some playgrounds pass memory via context)
    args.context?.memory?.thread;

  const resourceId =
    // Memory-scoped values
    (mem && (mem.resource ?? safeGet(mem, 'resource'))) ??
    // Session-backed values
    (session && (
      safeGet(session, 'resource')?.id ??
      safeGet(session, 'resourceId') ??
      session?.resource?.id ?? session?.resourceId
    )) ??
    // Top-level context fallbacks
    safeGet(rt, 'resource')?.id ?? safeGet(rt, 'resourceId') ??
    rt?.resource?.id ?? rt?.resourceId ??
    // Headers supplied by server / playground
    headers['x-mastra-resource-id'] ?? headers['x-resource-id'] ??
    // Explicit invocation context
    args.context?.resourceId ?? args.context?.resource?.id ??
    // Context memory (some playgrounds pass memory via context)
    args.context?.memory?.resource;

  return {
    threadId: threadId ? String(threadId) : undefined,
    resourceId: resourceId ? String(resourceId) : undefined,
  } as const;
}


