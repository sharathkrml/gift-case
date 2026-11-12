"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CaseBoard } from "@/components/CaseBoard";
import { Sidebar } from "@/components/Sidebar";
import { SEED_CASES, titleFromBrief } from "@/lib/cases";
import type { GiftCase } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";

const EXAMPLE_BRIEF =
  "My dad, 58, hates anything with a screen, lives for fishing, and would never admit he cares how he looks. Under $120.";

const STORAGE_KEY = "gift-case:cases:v1";
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function Home() {
  const [brief, setBrief] = useState(EXAMPLE_BRIEF);
  const [customCases, setCustomCases] = useState<GiftCase[]>([]);
  const [activeCase, setActiveCase] = useState<GiftCase | null>(null);
  const [activeAnimate, setActiveAnimate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  const storageKey = userId ? `${STORAGE_KEY}:${userId}` : null;
  const reduceMotion = useReducedMotion();
  const runId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const cases = [...customCases, ...SEED_CASES];

  useEffect(() => {
    if (!isLoaded || !storageKey) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        let raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          // One-time migration from the pre-account history key.
          raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) window.localStorage.removeItem(STORAGE_KEY);
        }
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCustomCases(parsed as GiftCase[]);
          }
        }
      } catch {
        // Ignore a corrupt history and fall back to the seeded cases.
      }
      if (!cancelled) setLoadedStorageKey(storageKey);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLoaded, storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(customCases));
    } catch {
      // Storage can be full or disabled; the current session still works.
    }
  }, [customCases, loadedStorageKey, storageKey]);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    let cancelled = false;
    fetch("/api/credits")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled || typeof data !== "object" || data === null) return;
        const value = (data as { credits?: unknown }).credits;
        if (typeof value === "number") setCredits(value);
      })
      .catch(() => {
        // Leave the balance unknown; the server still enforces it.
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const cancelRun = () => {
    runId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
    setPendingTitle(null);
  };

  const typeLog = async (lines: string[], currentRun: number) => {
    let text = "";
    for (const line of lines) {
      for (const character of line) {
        if (runId.current !== currentRun) return;
        text += character;
        setLog(text);
        if (!reduceMotion) await wait(16);
      }
      text += "\n";
      setLog(text);
      if (!reduceMotion) await wait(180);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = brief.trim();
    if (!trimmed || busy) return;

    const currentRun = ++runId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setBusy(true);
    setPendingTitle(titleFromBrief(trimmed));
    setError("");
    setOutOfCredits(false);
    setLog("Witness statement logged.\nRunning the leads through the search…\n");
    setActiveCase(null);
    setActiveAnimate(true);
    setSidebarOpen(false);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: trimmed }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const details =
          typeof payload === "object" && payload !== null && "error" in payload
            ? (payload as { error?: { code?: unknown; message?: unknown } })
                .error
            : undefined;
        if (details?.code === "no_credits") {
          setCredits(0);
          setOutOfCredits(true);
        }
        throw new Error(
          String(details?.message ?? "") ||
            "The trail went cold. Try the case again.",
        );
      }

      if (runId.current !== currentRun) return;
      const remaining = response.headers.get("x-credits-remaining");
      if (remaining !== null) setCredits(Number(remaining));
      const nextCase = payload as GiftCase;
      await wait(reduceMotion ? 0 : 300);
      if (runId.current !== currentRun) return;

      setLog("");
      const typing = typeLog(nextCase.log, currentRun);
      await wait(reduceMotion ? 0 : 500);
      if (runId.current !== currentRun) return;

      setPendingTitle(null);
      setCustomCases((previous) => [nextCase, ...previous]);
      setActiveCase(nextCase);
      setActiveAnimate(true);

      await typing;
    } catch (caught) {
      if (runId.current !== currentRun || controller.signal.aborted) return;
      setPendingTitle(null);
      setLog("");
      setError(
        caught instanceof Error
          ? caught.message
          : "The trail went cold. Try the case again.",
      );
    } finally {
      if (runId.current === currentRun) {
        setBusy(false);
        setPendingTitle(null);
      }
    }
  };

  const handleNewCase = () => {
    cancelRun();
    setActiveCase(null);
    setLog("");
    setError("");
    setOutOfCredits(false);
    setBrief("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  };

  const handleSelectCase = (giftCase: GiftCase) => {
    cancelRun();
    setActiveCase(giftCase);
    setActiveAnimate(false);
    setBrief(giftCase.brief);
    setError("");
    setOutOfCredits(false);
    setLog("Case file reopened. Evidence restored from the board.\n");
    setSidebarOpen(false);
    // The menu button is display:none on desktop; keep focus on the chosen file there.
    if (window.matchMedia("(max-width: 900px)").matches) {
      menuButtonRef.current?.focus();
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  };

  const statusMessage = busy
    ? "Opening the case. Gathering evidence."
    : activeCase
      ? `Case opened: ${activeCase.title}. ${activeCase.clues.length} clues and ${activeCase.products.length} suspects on the board.`
      : "";

  return (
    <div className="app">
      <Sidebar
        cases={cases}
        activeId={activeCase?.id ?? null}
        credits={credits}
        pendingTitle={pendingTitle}
        open={sidebarOpen}
        onClose={closeSidebar}
        onNewCase={handleNewCase}
        onSelectCase={handleSelectCase}
      />

      <main className="main">
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-btn"
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open case history"
            aria-expanded={sidebarOpen}
            aria-controls="case-history"
          >
            <MenuIcon />
          </button>
          <span className="mobile-title">The Gift Case</span>
        </div>

        <div className="main-inner">
          <h1>The Gift Case</h1>
          <p className="sub">Describe the person. The detective does the rest.</p>

          <form className="file" onSubmit={handleSubmit}>
            <label htmlFor="brief">Witness statement</label>
            <textarea
              id="brief"
              ref={textareaRef}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder={EXAMPLE_BRIEF}
              maxLength={500}
              required
            />
            <div className="row">
              <button
                type="submit"
                className="go"
                disabled={busy || !brief.trim() || credits === 0}
              >
                {busy
                  ? "Working the case…"
                  : credits === 0
                    ? "Out of credits"
                    : "Open the case"}
              </button>
              <span className="foot">
                {credits === null
                  ? "Checking credits…"
                  : `${credits} case credit${credits === 1 ? "" : "s"} left`}
                {" · "}
                <Link href="/credits">Buy cases</Link>
              </span>
            </div>
            <p className="foot credit-note">
              Live search via Channel3 and NVIDIA. Cases stay in this browser.
            </p>
          </form>

          {error && (
            <p className="error" role="alert">
              {error}
              {outOfCredits && (
                <>
                  {" "}
                  <Link href="/credits">Buy case credits</Link>
                </>
              )}
            </p>
          )}

          <div className={`log${busy ? " caret" : ""}`} aria-hidden="true">
            {log}
          </div>
          <span className="sr-only" role="status">
            {statusMessage}
          </span>

          <CaseBoard
            key={activeCase?.id ?? "empty"}
            caseFile={activeCase}
            animate={activeAnimate}
          />
        </div>
      </main>
    </div>
  );
}
