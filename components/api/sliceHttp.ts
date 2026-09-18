/**
 * Lazy axios helpers for Redux slices.
 * Do not import `@/components/api/apiFuntions` from store slices — that file
 * touches the store and creates a circular init.
 */

function http() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred load
  return require("@/components/api/apiFuntions") as typeof import("@/components/api/apiFuntions");
}

export function getData(...args: Parameters<typeof import("@/components/api/apiFuntions").getData>) {
  return http().getData(...args);
}

export function postData(...args: Parameters<typeof import("@/components/api/apiFuntions").postData>) {
  return http().postData(...args);
}

export function putData(...args: Parameters<typeof import("@/components/api/apiFuntions").putData>) {
  return http().putData(...args);
}

export function patchData(...args: Parameters<typeof import("@/components/api/apiFuntions").patchData>) {
  return http().patchData(...args);
}

export function deleteData<T = unknown>(
  endpoint: string,
  options?: Parameters<typeof import("@/components/api/apiFuntions").deleteData>[1],
): Promise<T> {
  return http().deleteData<T>(endpoint, options);
}
