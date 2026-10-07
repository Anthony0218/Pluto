import * as m from "motion/react-m";
import { useLanding } from "./landingContext";
import { useCaptionFlight } from "./useCaptionFlight";

/** The title and subtitle travel together, leaving their accessible text in the document. */
export default function TravelingCaption({ id, title, line }: { id: string; title: string; line: string }) {
  const flight = useCaptionFlight(id);
  const { withFlyby } = useLanding();
  return <div className="caption-origin" data-caption-source={id}>
    <div className="caption-placeholder"><h3 data-caption-heading>{title}</h3><p data-caption-line>{line}</p></div>
    {withFlyby && <m.div className="caption-traveller" aria-hidden="true" style={{ x: flight.x, y: flight.y, width: flight.width, opacity: flight.opacity }}>
      <m.h3 style={{ fontSize: flight.fontSize }}>{title}</m.h3>
      <m.p style={{ opacity: flight.lineOpacity }}>{line}</m.p>
    </m.div>}
  </div>;
}
