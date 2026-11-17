import { LammaArt } from "@/assets/illustrations/lammaArt";

export type IllustrationProps =
  | { kind: "product"; template: string }
  | { kind: "gather"; play?: boolean }
  | { kind: "parcel" }
  | { kind: "route"; steps?: number }
  | { kind: "delivery"; state?: "courier" | "delivered" };

/** Brand illustration. Markup is generated from static brand SVG code (never from user input). */
export function Illustration(props: IllustrationProps) {
  let html: string;
  switch (props.kind) {
    case "product":
      html = LammaArt.product(props.template);
      break;
    case "gather":
      html = LammaArt.gather(props.play ?? true);
      break;
    case "parcel":
      html = LammaArt.parcel();
      break;
    case "route":
      html = LammaArt.route(props.steps ?? 5);
      break;
    case "delivery":
      html = LammaArt.delivery(props.state ?? "courier");
      break;
  }

  return <span className="art-host" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}
