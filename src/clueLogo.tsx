import type { CluePalette } from './cinemaProgram';

type ClueLogoProps = {
  symbol: string;
  palette: CluePalette;
  isCollected?: boolean;
};

export function ClueLogo({ symbol, palette, isCollected = true }: ClueLogoProps) {
  const sketch =
    symbol === 'cat-orbit' ? <CatOrbitSketch /> :
    symbol === 'europe-lens' ? <EuropeLensSketch /> :
    null;

  return (
    <span
      className={`clue-logo clue-logo--${symbol} clue-logo--${palette} ${isCollected ? 'collected' : ''}`}
    >
      {sketch ?? <span />}
    </span>
  );
}

function EuropeLensSketch() {
  return (
    <svg className="europe-lens-sketch" viewBox="0 0 100 100" aria-hidden="true">
      <image
        className="europe-lens-sketch__map"
        href="/media/image.png?v=2"
        x="8"
        y="8"
        width="84"
        height="84"
        preserveAspectRatio="xMidYMid meet"
      />
      <g className="europe-lens-sketch__lens">
        <animateTransform
          attributeName="transform"
          type="translate"
          dur="5.4s"
          repeatCount="indefinite"
          values="46,34; 58,28; 66,40; 58,52; 48,64; 38,56; 52,44; 60,36; 46,34"
          keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
        />
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            dur="5.4s"
            repeatCount="indefinite"
            values="-18;-6;12;22;8;-10;-20;-12;-18"
            keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
          />
          <circle cx="0" cy="0" r="9" />
          <line x1="6" y1="6" x2="13" y2="13" />
        </g>
      </g>
    </svg>
  );
}

function CatOrbitSketch() {
  return (
    <svg className="cat-orbit-sketch" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="cat-orbit-sketch__circle" cx="50" cy="50" r="34" />
      <circle className="cat-orbit-sketch__circle cat-orbit-sketch__circle--draft" cx="50" cy="50" r="38" />
      <g className="cat-orbit-sketch__cat">
        <ellipse cx="50" cy="18" rx="10" ry="7" />
        <circle cx="39" cy="15" r="6" />
        <path d="M35 11 L37 4 L41 11" />
        <path d="M42 11 L46 5 L47 14" />
        <path d="M58 18 C68 13 70 25 62 27" />
        <path d="M44 20 L42 27" />
        <path d="M53 21 L55 28" />
        <circle cx="37.5" cy="15" r="1" />
        <circle cx="41.5" cy="15" r="1" />
      </g>
    </svg>
  );
}
