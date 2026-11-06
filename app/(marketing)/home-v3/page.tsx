import { permanentRedirect } from "next/navigation";

/** The home-v3 concept is now the live home page; keep old review links working. */
export default function HomeV3Page() {
  permanentRedirect("/");
}
