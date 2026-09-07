export type PageParams<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
