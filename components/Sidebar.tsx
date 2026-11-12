"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";
import type { GiftCase } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";

type SidebarProps = {
  cases: GiftCase[];
  activeId: string | null;
  credits: number | null;
  pendingTitle: string | null;
  open: boolean;
  onClose: () => void;
  onNewCase: () => void;
  onSelectCase: (giftCase: GiftCase) => void;
};

type CaseGroup = {
  id: "today" | "week" | "earlier";
  label: string;
  items: { giftCase: GiftCase; index: number }[];
};

type Handoff = {
  id: number;
  d: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

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

function groupCases(cases: GiftCase[]): CaseGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const groups: CaseGroup[] = [
    { id: "today", label: "Today", items: [] },
    { id: "week", label: "This week", items: [] },
    { id: "earlier", label: "Earlier", items: [] },
  ];

  cases.forEach((giftCase, index) => {
    const created = new Date(giftCase.createdAt);
    const bucket = Number.isNaN(created.getTime())
      ? 2
      : created >= startOfToday
        ? 0
        : created >= startOfWeek
          ? 1
          : 2;
    groups[bucket].items.push({ giftCase, index });
  });

  return groups.filter((group) => group.items.length > 0);
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

function CaseFile({
  giftCase,
  index,
  total,
  active,
  onSelect,
}: {
  giftCase: GiftCase;
  index: number;
  total: number;
  active: boolean;
  onSelect: (giftCase: GiftCase) => void;
}) {
  const caseSuspects = giftCase.products?.length ?? 0;
  const caseClues = giftCase.clues?.length ?? 0;
  const topSuspect = giftCase.products?.[0];

  return (
    <li style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        className="case-item"
        aria-current={active ? "page" : undefined}
        title={giftCase.title}
        onClick={() => onSelect(giftCase)}
      >
        <span className="case-tab" aria-hidden="true">
          Case {String(total - index).padStart(3, "0")}
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
              {caseSuspects} suspect{caseSuspects === 1 ? "" : "s"} ·{" "}
              {caseClues} clue{caseClues === 1 ? "" : "s"} ·{" "}
              {shortDate(giftCase.createdAt)}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

function PendingFile({ title }: { title: string }) {
  return (
    <div className="case-item case-pending" role="status">
      <span className="case-tab" aria-hidden="true">
        Working
      </span>
      <span className="case-row">
        <span
          className="case-polaroid case-polaroid-pending"
          aria-hidden="true"
        >
          🔎
        </span>
        <span className="case-info">
          <span className="case-title">{title}</span>
          <span className="case-meta">
            <span className="pending-dot" aria-hidden="true" />
            Gathering evidence…
          </span>
        </span>
      </span>
    </div>
  );
}

export function Sidebar({
  cases,
  activeId,
  credits,
  pendingTitle,
  open,
  onClose,
  onNewCase,
  onSelectCase,
}: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handoffId = useRef(0);
  const { isLoaded, user } = useUser();
  const { openSignIn, openSignUp } = useClerk();
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  const suspectCount = cases.reduce(
    (total, giftCase) => total + (giftCase.products?.length ?? 0),
    0,
  );
  const clueCount = cases.reduce(
    (total, giftCase) => total + (giftCase.clues?.length ?? 0),
    0,
  );
  const groups = mounted ? groupCases(cases) : null;

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    return () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, []);

  const handleSelect = (giftCase: GiftCase) => {
    onSelectCase(giftCase);
    if (
      open ||
      reduceMotion ||
      window.matchMedia("(max-width: 900px)").matches
    ) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const source = document.querySelector<HTMLElement>(
          '#case-history .case-item[aria-current="page"]',
        );
        const target = document.querySelector<HTMLElement>("[data-product]");
        if (!source || !target) return;

        const from = source.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        if (!to.width) return;

        const ax = from.right - 6;
        const ay = from.top + from.height / 2;
        const bx = to.left + to.width / 2;
        const by = to.top + 6;
        const sag = 40 + Math.abs(bx - ax) * 0.08;

        setHandoff({
          id: ++handoffId.current,
          d: `M${ax},${ay} Q${(ax + bx) / 2},${Math.max(ay, by) + sag} ${bx},${by}`,
          ax,
          ay,
          bx,
          by,
        });
        if (handoffTimer.current) clearTimeout(handoffTimer.current);
        handoffTimer.current = setTimeout(() => setHandoff(null), 1400);
      });
    });
  };

  const renderCase = (giftCase: GiftCase, index: number) => (
    <CaseFile
      key={giftCase.id}
      giftCase={giftCase}
      index={index}
      total={cases.length}
      active={giftCase.id === activeId}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      {handoff &&
        createPortal(
          <svg key={handoff.id} className="handoff" aria-hidden="true">
            <path d={handoff.d} pathLength={1} />
            <circle cx={handoff.ax} cy={handoff.ay} r={4} />
            <circle cx={handoff.bx} cy={handoff.by} r={5} />
          </svg>,
          document.body,
        )}

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

        <nav className="side-scroll" aria-label="Case files">
          {pendingTitle && <PendingFile title={pendingTitle} />}

          {groups ? (
            groups.map((group) => (
              <div className="case-group" key={group.id}>
                <h2 className="case-group-label">{group.label}</h2>
                <ul className="case-list">
                  {group.items.map(({ giftCase, index }) =>
                    renderCase(giftCase, index),
                  )}
                </ul>
              </div>
            ))
          ) : (
            <ul className="case-list">{cases.map(renderCase)}</ul>
          )}
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
