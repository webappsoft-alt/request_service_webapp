import { permanentRedirect } from "next/navigation";

/** The for-pros-v1 preview is now the live pro landing page; keep old review links working. */
export default function ProLandingV1Page() {
  permanentRedirect("/for-pros");
}
