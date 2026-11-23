export type Route =
  | { name: "shelf" }
  | { name: "add" }
  | { name: "card"; id: string }
  | { name: "edit"; id: string }
  | { name: "sale" }
  | { name: "settings" }
  | { name: "public"; fileId: string };

export function parseRoute(hash: string): Route {
  const path = (hash || "#/").replace(/^#/, "");
  const parts = path.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (parts[0] === "s" && parts[1]) return { name: "public", fileId: parts[1] };
  if (parts[0] === "add") return { name: "add" };
  if (parts[0] === "card" && parts[1]) return { name: "card", id: parts[1] };
  if (parts[0] === "edit" && parts[1]) return { name: "edit", id: parts[1] };
  if (parts[0] === "sale") return { name: "sale" };
  if (parts[0] === "settings") return { name: "settings" };
  return { name: "shelf" };
}

export function go(path: string): void {
  const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next;
}
