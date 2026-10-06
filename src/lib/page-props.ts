/** Explicit App Router props, available before Next generates .next route types. */
export type RoutePageProps<Params extends Record<string, string | string[]>> = {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
