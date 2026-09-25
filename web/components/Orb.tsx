"use client";

type Props = {
  size?: number;
  /** 0..1 loudness of the agent's voice, drives the pulse */
  level?: number;
  active?: boolean;
  rings?: boolean;
};

export default function Orb({ size = 150, level = 0, active = false, rings = true }: Props) {
  const scale = 1 + Math.min(level, 1) * 0.08;
  const ring1 = size * 1.24;
  const ring2 = size * 1.7;
  return (
    <div className="relative grid place-items-center" style={{ width: rings ? ring2 : size, height: rings ? ring2 : size }}>
      {rings && (
        <>
          <span
            className="ring-breathe absolute rounded-full border border-g400/25"
            style={{ width: ring2, height: ring2 }}
          />
          <span
            className="absolute rounded-full border-[3px] border-g400/55 transition-transform duration-150"
            style={{ width: ring1, height: ring1, transform: `scale(${1 + Math.min(level, 1) * 0.05})` }}
          />
        </>
      )}
      <div
        className="orb relative overflow-hidden rounded-full transition-transform duration-100"
        style={{ width: size, height: size, transform: `scale(${scale})` }}
      >
        <div className={`orb-sparkles absolute inset-0 ${active ? "fast" : ""}`} />
        <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
      </div>
    </div>
  );
}
