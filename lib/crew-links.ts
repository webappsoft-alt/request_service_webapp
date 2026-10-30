/** Team / Contractors pages with their "add" form open (`?add=1`), linked from crew pickers. */
export const ADD_TECHNICIAN_HREF = "/pro/dashboard/team?add=1";
export const ADD_CONTRACTOR_HREF = "/pro/dashboard/contractors?add=1";

/** True when the page was opened to add someone (`?add=1`); the param is removed from the URL. */
export function takeAddParam() {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("add") !== "1") return false;
  url.searchParams.delete("add");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return true;
}
