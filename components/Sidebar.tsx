"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";
import type { GiftCase } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";

type SidebarProps = {
  cases: GiftCase[];
  activeId: string | null;
  credits: number | null;
  open: boolean;
  onClose: () => void;
  onNewCase: () => void;
  onSelectCase: (giftCase: GiftCase) => void;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Undated" : DATE_FORMAT.format(date);
}

function badgeNumber(id: string) {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9000;
  }
  return String(1000 + hash);
}

function NewCaseIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 11v6M9 14h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function CountUp({ value, animate }: { value: number; animate: boolean }) {
  const [shown, setShown] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const from = previous.current;
    if (!animate || from === value) {
      previous.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 550);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previous.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, value]);

  return <>{shown}</>;
}

export function Sidebar({
  cases,
  activeId,
  credits,
  open,
  onClose,
  onNewCase,
  onSelectCase,
}: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { isLoaded, user } = useUser();
  const { openSignIn, openSignUp } = useClerk();
  const reduceMotion = useReducedMotion();

  const suspectCount = cases.reduce(
    (total, giftCase) => total + (giftCase.products?.length ?? 0),
    0,
  );
  const clueCount = cases.reduce(
    (total, giftCase) => total + (giftCase.clues?.length ?? 0),
    0,
  );

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  return (
    <>
      {open && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close case history"
          onClick={onClose}
        />
      )}

      <aside
        id="case-history"
        className="sidebar"
        data-open={open}
        aria-label="Gift case history"
      >
        <div className="sidebar-head">
          <div className="masthead">
            <span className="masthead-kicker">Case archive</span>
            <span className="brand">The Gift Case</span>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close case history"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="archive-stats" aria-label="Archive totals">
          <div className="stat">
            <strong>
              <CountUp value={cases.length} animate={!reduceMotion} />
            </strong>
            <span>Cases</span>
          </div>
          <div className="stat">
            <strong>
              <CountUp value={suspectCount} animate={!reduceMotion} />
            </strong>
            <span>Suspects</span>
          </div>
          <div className="stat">
            <strong>
              <CountUp value={clueCount} animate={!reduceMotion} />
            </strong>
            <span>Clues</span>
          </div>
        </div>

        <button type="button" className="new-case" onClick={onNewCase}>
          <NewCaseIcon />
          Open new case
        </button>

        <div className="side-section">
          <span>Case files</span>
          <span className="side-count" aria-hidden="true">
            {String(cases.length).padStart(2, "0")}
          </span>
        </div>

        <nav className="side-scroll" aria-label="Case files">
          <ul className="case-list">
            {cases.map((giftCase, index) => {
              const active = giftCase.id === activeId;
              const caseSuspects = giftCase.products?.length ?? 0;
              const caseClues = giftCase.clues?.length ?? 0;
              const topSuspect = giftCase.products?.[0];

              return (
                <li
                  key={giftCase.id}
                  style={{ "--i": index } as CSSProperties}
                >
                  <button
                    type="button"
                    className="case-item"
                    aria-current={active ? "page" : undefined}
                    title={giftCase.title}
                    onClick={() => onSelectCase(giftCase)}
                  >
                    <span className="case-tab" aria-hidden="true">
                      Case {String(cases.length - index).padStart(3, "0")}
                    </span>
                    <span className="case-row">
                      <span
                        className="case-polaroid"
                        style={{ background: topSuspect?.tint ?? "#9a7a4f" }}
                        aria-hidden="true"
                      >
                        {topSuspect?.emoji ?? "🗂️"}
                      </span>
                      <span className="case-info">
                        <span className="case-title">{giftCase.title}</span>
                        <span className="case-meta">
                          {caseSuspects} suspect{caseSuspects === 1 ? "" : "s"}{" "}
                          · {caseClues} clue{caseClues === 1 ? "" : "s"} ·{" "}
                          {shortDate(giftCase.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="side-wallet">
          <div>
            <span className="wallet-label">Case credits</span>
            <strong className="wallet-value">
              {credits === null ? "—" : credits}
            </strong>
          </div>
          <Link href="/credits" className="wallet-buy">
            Buy cases
          </Link>
        </div>

        <div className="user">
          {isLoaded && user ? (
            <>
              <span className="badge-photo">
                <UserButton />
              </span>
              <div className="user-meta">
                <span className="user-role">Detective</span>
                <div className="user-name">
                  {user.fullName ?? user.username ?? "Detective"}
                </div>
                <div className="user-links">
                  <span>Badge #{badgeNumber(user.id)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="badge-photo">
                <span className="avatar" aria-hidden="true">
                  G
                </span>
              </span>
              <div className="user-meta">
                <span className="user-role">Guest</span>
                <div className="user-name">Guest detective</div>
                <div className="user-links">
                  <button
                    type="button"
                    className="user-link accent"
                    disabled={!isLoaded}
                    onClick={() => openSignIn()}
                  >
                    Sign in
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="user-link"
                    disabled={!isLoaded}
                    onClick={() => openSignUp()}
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
