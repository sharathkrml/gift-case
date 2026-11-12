"use client";

import { useEffect, useRef } from "react";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";
import type { GiftCase } from "@/lib/types";

type SidebarProps = {
  cases: GiftCase[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNewCase: () => void;
  onSelectCase: (giftCase: GiftCase) => void;
};

function NewCaseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="m18.4 2.6 3 3L12 15l-4 1 1-4Z" />
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

export function Sidebar({
  cases,
  activeId,
  open,
  onClose,
  onNewCase,
  onSelectCase,
}: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { isLoaded, user } = useUser();
  const { openSignIn, openSignUp } = useClerk();

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
          <span className="brand">The Gift Case</span>
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

        <button type="button" className="new-case" onClick={onNewCase}>
          <NewCaseIcon />
          New case
        </button>

        <div className="side-section">Recent cases</div>
        <nav className="side-scroll" aria-label="Recent cases">
          <ul className="case-list">
            {cases.map((giftCase) => (
              <li key={giftCase.id}>
                <button
                  type="button"
                  className="case-item"
                  aria-current={giftCase.id === activeId ? "page" : undefined}
                  title={giftCase.title}
                  onClick={() => onSelectCase(giftCase)}
                >
                  {giftCase.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="user">
          {isLoaded && user ? (
            <>
              <UserButton />
              <div className="user-meta">
                <div className="user-name">
                  {user.fullName ?? user.username ?? "Detective"}
                </div>
                <div className="user-links">
                  <span>Signed in</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="avatar" aria-hidden="true">
                G
              </span>
              <div className="user-meta">
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
