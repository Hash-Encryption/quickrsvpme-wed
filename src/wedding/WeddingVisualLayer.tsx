import type { WeddingVisualTemplateId } from "./model";
import type { WeddingVisualSelection } from "./upload";

export function WeddingVisualLayer({
  templateId,
  visual,
}: {
  templateId: WeddingVisualTemplateId;
  visual: WeddingVisualSelection;
}) {
  if (visual.source === "uploaded-background") {
    return (
      <div className="wedding-visual-layer" aria-hidden="true">
        <img
          className={`wedding-uploaded-artwork wedding-uploaded-artwork--${visual.fitMode}`}
          src={visual.uploadedBackground.dataUrl}
          alt=""
          draggable={false}
          style={{
            objectPosition: `${visual.backgroundPosition.x * 100}% ${visual.backgroundPosition.y * 100}%`,
            transform: `scale(${visual.fitMode === "fill" ? visual.backgroundZoom : 1})`,
            transformOrigin: `${visual.backgroundPosition.x * 100}% ${visual.backgroundPosition.y * 100}%`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="wedding-visual-layer" aria-hidden="true">
      <div className="wedding-paper-texture" />
      {templateId === "soft-floral-garden" && <FloralGardenFrame />}
      {templateId === "pearl-arch" && (
        <div className="wedding-pearl-frame">
          <i />
          <i />
          <span />
        </div>
      )}
      {templateId === "midnight-gold" && (
        <div className="wedding-midnight-frame">
          <i />
          <i />
          <span />
        </div>
      )}
    </div>
  );
}

function FloralGardenFrame() {
  return (
    <svg
      className="wedding-floral-frame"
      viewBox="0 0 390 693"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="petal" cx="38%" cy="30%">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="var(--wedding-petal)" />
        </radialGradient>
        <linearGradient id="leaf" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="var(--wedding-leaf)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--wedding-leaf)" />
        </linearGradient>
        <filter id="soft-shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#5d5145" floodOpacity=".12" />
        </filter>
      </defs>
      <path className="wedding-arch" d="M35 635V168C35 94 92 37 164 37h62c72 0 129 57 129 131v467" />
      <g className="wedding-botanical wedding-botanical--top" filter="url(#soft-shadow)">
        <path className="wedding-stem" d="M-5 155C47 125 51 55 144 8M20 115C55 98 86 96 114 55M58 78C36 50 33 28 46 2" />
        <Leaf x="18" y="108" rotate="-42" />
        <Leaf x="48" y="83" rotate="28" />
        <Leaf x="74" y="63" rotate="-32" />
        <Leaf x="101" y="37" rotate="34" />
        <Leaf x="38" y="31" rotate="-18" />
        <Flower cx="22" cy="74" size="42" />
        <Flower cx="67" cy="33" size="58" />
        <Flower cx="112" cy="18" size="32" />
        <SmallFlowers x="7" y="137" />
        <SmallFlowers x="125" y="47" />
      </g>
      <g className="wedding-botanical wedding-botanical--bottom" filter="url(#soft-shadow)">
        <path className="wedding-stem" d="M395 515C345 546 341 620 239 691M378 582C334 591 304 615 284 650M343 632C360 658 365 675 360 697" />
        <Leaf x="350" y="536" rotate="35" />
        <Leaf x="327" y="573" rotate="-38" />
        <Leaf x="301" y="607" rotate="30" />
        <Leaf x="267" y="644" rotate="-35" />
        <Leaf x="351" y="658" rotate="16" />
        <Flower cx="371" cy="612" size="48" />
        <Flower cx="326" cy="657" size="62" />
        <Flower cx="270" cy="677" size="34" />
        <SmallFlowers x="354" y="548" />
        <SmallFlowers x="239" y="635" />
      </g>
    </svg>
  );
}

function Flower({ cx, cy, size }: { cx: string; cy: string; size: string }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Number(size) / 46})`}>
      {Array.from({ length: 9 }, (_, index) => (
        <ellipse key={index} rx="9" ry="20" fill="url(#petal)" transform={`rotate(${index * 40}) translate(0 -12)`} />
      ))}
      <circle r="8" fill="var(--wedding-petal-soft)" />
      <circle r="3" fill="#B99A63" />
    </g>
  );
}

function Leaf({ x, y, rotate }: { x: string; y: string; rotate: string }) {
  return <path d="M0 0C10-13 24-12 30-1C18 10 7 10 0 0Z" fill="url(#leaf)" transform={`translate(${x} ${y}) rotate(${rotate})`} />;
}

function SmallFlowers({ x, y }: { x: string; y: string }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="var(--wedding-petal-soft)" stroke="var(--wedding-petal)" strokeWidth=".8">
      <circle cx="0" cy="0" r="4" />
      <circle cx="13" cy="-8" r="5" />
      <circle cx="25" cy="2" r="3.5" />
      <path d="M0 4L-8 18M13-3L11 17M25 5L21 20" fill="none" stroke="var(--wedding-leaf)" />
    </g>
  );
}
