"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { formatPrice } from "@/lib/cases";
import type { GiftCase } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";

type CaseBoardProps = {
  caseFile: GiftCase | null;
  animate: boolean;
};

type StringPath = {
  key: string;
  productId: string;
  d: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

type RevealState = {
  notes: number;
  products: number;
  strings: boolean;
  bars: boolean;
  stamp: boolean;
};

function tilt(seed: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const unit = (Math.abs(hash) % 1000) / 1000;
  return min + unit * (max - min);
}

const DEFAULT_DETAIL =
  "Click any photo on the board to read the detective's notes on it.";

export function CaseBoard({ caseFile, animate }: CaseBoardProps) {
  const reduceMotion = useReducedMotion();
  const instant = !animate || reduceMotion;
  const [selected, setSelected] = useState<string | null>(null);
  const [paths, setPaths] = useState<StringPath[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [reveal, setReveal] = useState<RevealState>(() =>
    instant
      ? {
          notes: caseFile?.clues.length ?? 0,
          products: caseFile?.products.length ?? 0,
          strings: true,
          bars: true,
          stamp: true,
        }
      : { notes: 0, products: 0, strings: false, bars: false, stamp: false },
  );

  useEffect(() => {
    if (!caseFile) return;

    const full: RevealState = {
      notes: caseFile.clues.length,
      products: caseFile.products.length,
      strings: true,
      bars: true,
      stamp: true,
    };

    if (!animate || reduceMotion) {
      const timer = setTimeout(() => setReveal(full), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    (async () => {
      await wait(400);
      for (let i = 1; i <= caseFile.clues.length; i++) {
        if (cancelled) return;
        setReveal((prev) => ({ ...prev, notes: i }));
        await wait(260);
      }
      for (let i = 1; i <= caseFile.products.length; i++) {
        if (cancelled) return;
        setReveal((prev) => ({ ...prev, products: i }));
        await wait(220);
      }
      await wait(420);
      if (cancelled) return;
      setReveal((prev) => ({ ...prev, strings: true }));
      await wait(750);
      if (cancelled) return;
      setReveal((prev) => ({ ...prev, bars: true, stamp: true }));
    })();

    return () => {
      cancelled = true;
    };
  }, [caseFile, animate, reduceMotion]);

  useLayoutEffect(() => {
    if (!caseFile || !reveal.strings) return;
    const board = boardRef.current;
    const svg = svgRef.current;
    if (!board || !svg) return;

    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      if (cancelled) return;
      const origin = svg.getBoundingClientRect();
      const cluePoints = new Map<string, { x: number; y: number }>();
      const productPoints = new Map<string, { x: number; y: number }>();

      for (const clue of caseFile.clues) {
        const el = board.querySelector<HTMLElement>(`[data-clue="${clue.id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        cluePoints.set(clue.id, {
          x: rect.left - origin.left + rect.width / 2,
          y: rect.top - origin.top + 6,
        });
      }

      for (const product of caseFile.products) {
        const el = board.querySelector<HTMLElement>(
          `[data-product="${product.id}"]`,
        );
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        productPoints.set(product.id, {
          x: rect.left - origin.left + rect.width / 2,
          y: rect.top - origin.top + 6,
        });
      }

      const next: StringPath[] = [];
      for (const product of caseFile.products) {
        const pin = productPoints.get(product.id);
        if (!pin) continue;
        for (const clueId of product.clueIds) {
          const cluePin = cluePoints.get(clueId);
          if (!cluePin) continue;
          const sag = 30 + Math.abs(cluePin.x - pin.x) * 0.08;
          next.push({
            key: `${product.id}-${clueId}`,
            productId: product.id,
            d: `M${cluePin.x},${cluePin.y} Q${(cluePin.x + pin.x) / 2},${Math.max(cluePin.y, pin.y) + sag} ${pin.x},${pin.y}`,
            ax: cluePin.x,
            ay: cluePin.y,
            bx: pin.x,
            by: pin.y,
          });
        }
      }
      setPaths(next);
    };

    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(measure, 120);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(board);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [caseFile, reveal.strings]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const selectedProduct =
    caseFile?.products.find((product) => product.id === selected) ?? null;
  const topProduct = caseFile?.products[0] ?? null;
  const complete = Boolean(caseFile) && reveal.stamp;

  return (
    <>
      <div
        className="board"
        ref={boardRef}
        aria-busy={caseFile ? !complete : undefined}
      >
        {!caseFile ? (
          <div className="empty">
            The board is empty.
            <br />
            Open a case to start pinning evidence.
          </div>
        ) : (
          <>
            {reveal.strings && (
              <svg
                ref={svgRef}
                className={`strings${selected ? " dim" : ""}`}
                aria-hidden="true"
              >
                {paths.map((path, index) => (
                  <g key={path.key}>
                    <path
                      d={path.d}
                      pathLength={1}
                      className={[
                        selected === path.productId ? "hot" : "",
                        animate && !reduceMotion ? "draw" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        animate && !reduceMotion
                          ? { animationDelay: `${index * 70}ms` }
                          : undefined
                      }
                    />
                    <circle cx={path.ax} cy={path.ay} r={4} />
                    <circle cx={path.bx} cy={path.by} r={4} />
                  </g>
                ))}
              </svg>
            )}

            <ul className="notes" aria-label="Clues">
              {caseFile.clues.map((clue, index) => {
                const visible = index < reveal.notes;
                return (
                  <li
                    key={clue.id}
                    className={`note${visible ? " in" : ""}`}
                    data-clue={clue.id}
                    aria-hidden={!visible}
                    style={
                      {
                        "--r": `${tilt(clue.id, -5, 5)}deg`,
                      } as CSSProperties
                    }
                  >
                    {clue.text}
                  </li>
                );
              })}
            </ul>

            <ul className="prods" aria-label="Suspects">
              {caseFile.products.map((product, index) => {
                const visible = index < reveal.products;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      className={`prod${visible ? " in" : ""}${
                        selected === product.id ? " sel" : ""
                      }`}
                      data-product={product.id}
                      aria-label={`${product.name}, ${formatPrice(
                        product.priceMinor,
                        product.currency,
                      )}, suspicion ${product.suspicion} percent`}
                      aria-pressed={selected === product.id}
                      aria-hidden={!visible}
                      disabled={!visible}
                      onClick={() =>
                        setSelected((current) =>
                          current === product.id ? null : product.id,
                        )
                      }
                      style={
                        {
                          "--r": `${tilt(product.id, -3.5, 3.5)}deg`,
                        } as CSSProperties
                      }
                    >
                      <div
                        className="pic"
                        style={{ background: product.tint }}
                        aria-hidden="true"
                      >
                        <span className="pic-emoji">{product.emoji}</span>
                        {product.imageUrl && (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 900px) 45vw, 180px"
                            className="pic-img"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div className="pn">{product.name}</div>
                      <div className="pp">
                        {formatPrice(product.priceMinor, product.currency)}
                      </div>
                      <div className="bar" aria-hidden="true">
                        <i
                          style={{
                            width: reveal.bars
                              ? `${product.suspicion}%`
                              : "0%",
                          }}
                        />
                      </div>
                      {index === 0 && (
                        <span
                          className={`stamp${
                            reveal.stamp ? " in" : ""
                          }${!animate || reduceMotion ? " still" : ""}`}
                        >
                          PRIME SUSPECT
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="detail" aria-live="polite">
        {!caseFile ? (
          DEFAULT_DETAIL
        ) : selectedProduct ? (
          <>
            <strong>{selectedProduct.name}</strong> (
            {formatPrice(selectedProduct.priceMinor, selectedProduct.currency)})
            · suspicion {selectedProduct.suspicion}%
            <br />
            {selectedProduct.why}
            {selectedProduct.url && (
              <>
                <br />
                <a
                  className="lead-link"
                  href={selectedProduct.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View this lead
                </a>{" "}
                <span className="foot">(affiliate link)</span>
              </>
            )}
          </>
        ) : complete && topProduct ? (
          <>
            <strong>Case closed… almost.</strong> The {topProduct.name}{" "}
            connects to {topProduct.clueIds.length} clues. Click it, or any
            other photo, to follow the red string.
          </>
        ) : (
          "Gathering evidence…"
        )}
      </div>
    </>
  );
}
