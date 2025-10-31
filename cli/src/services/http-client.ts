type FetchFn = (input: any, init?: any) => Promise<any>;

let cachedFetch: FetchFn | undefined;

export async function getFetch(): Promise<FetchFn> {
  const globalFetch = (globalThis as any).fetch as FetchFn | undefined;
  if (globalFetch) {
    return globalFetch.bind(globalThis);
  }
  if (!cachedFetch) {
    const module = await import("node-fetch");
    cachedFetch = ((module as any).default ?? module) as FetchFn;
  }
  return cachedFetch;
}
