type Props = {
  x: number;
  y: number;
  radius: number;
  angle: number;
  mapAspectRatio: number;
};

export default function AttackAimOverlay({
  x,
  y,
  radius,
  angle,
  mapAspectRatio,
}: Props) {
  const viewHeight =
    100 *
    mapAspectRatio;

  const centerY =
    y *
    mapAspectRatio;

  return (
    <svg
      className="
        pointer-events-none
        absolute
        inset-0
        z-[80]
        h-full
        w-full
        overflow-visible
      "
      viewBox={`0 0 100 ${viewHeight}`}
      preserveAspectRatio="none"
    >
      <g
        transform={`
          translate(${x} ${centerY})
          rotate(${angle})
        `}
      >
        <line
          x1="2"
          y1="0"
          x2={
            radius
          }
          y2="0"
          stroke="#111827"
          strokeWidth="2.3"
          vectorEffect="non-scaling-stroke"
        />

        <line
          x1="2"
          y1="0"
          x2={
            radius
          }
          y2="0"
          stroke="#e5e7eb"
          strokeWidth="1.15"
          vectorEffect="non-scaling-stroke"
        />

        <polygon
          points={`${radius},0 ${radius - 2.6},-1.7 ${radius - 2.6},1.7`}
          fill="#f8fafc"
          stroke="#111827"
          strokeWidth="0.65"
          vectorEffect="non-scaling-stroke"
        />

        <circle
          cx="0"
          cy="0"
          r="1.5"
          fill="#d1d5db"
          stroke="#111827"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
