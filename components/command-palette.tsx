"use client";

import {
  ArrowRight,
  CornerDownLeft,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TierBadge } from "@/components/badges";
import { researchHref, startResearch } from "@/lib/client";
import { appKey, closest } from "@/lib/match";
import type { CatalogEntry, GuideSummary, NoOAuthAnswer } from "@/lib/types";

type Item =
  | { kind: "guide"; key: string; guide: GuideSummary }
  | { kind: "no-oauth"; key: string; answer: NoOAuthAnswer }
  | { kind: "catalog"; key: string; entry: CatalogEntry }
  | { kind: "research"; key: string; query: string };

type Library = { guides: GuideSummary[]; noOAuth: NoOAuthAnswer[]; catalog: CatalogEntry[] };

const matches = (q: string, ...fields: (string | null)[]) =>
  fields.some((f) => f?.toLowerCase().includes(q));

/** Substring matches, or failing that the one entry a typo is closest to ("pintrest" → Pinterest). */
function search<T extends { name: string; slug: string; domain: string | null }>(q: string, items: T[]): T[] {
  if (!q) return items;
  const hits = items.filter((i) => matches(q, i.name, i.domain, i.slug));
  if (hits.length) return hits;
  const near = closest(q, items, (i) => [appKey(i.name), i.slug.replace(/-/g, ""), i.domain ? appKey(i.domain) : ""]);
  return near ? [near.item] : [];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setPending(null);
    setError(null);
    returnFocus.current?.focus();
  }, []);

  // ⌘K / Ctrl+K anywhere; "/" when not typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing =
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        show();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show, hide]);

  // Fetch the index on every open so live-generated guides appear.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;
    fetch("/api/guides")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Library) => {
        if (!cancelled) {
          setLibrary(data);
          setLoadError(false);
        }
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
    };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const guides = search(q, library?.guides ?? []).map<Item>((guide) => ({ kind: "guide", key: `g-${guide.slug}`, guide }));
    // Only on a search: they're answers, not guides to browse.
    const none = q ? search(q, library?.noOAuth ?? []).map<Item>((answer) => ({ kind: "no-oauth", key: `n-${answer.slug}`, answer })) : [];
    const catalog = search(q, library?.catalog ?? [])
      .slice(0, q ? 6 : 4)
      .map<Item>((entry) => ({
        kind: "catalog",
        key: `c-${entry.slug}`,
        entry,
      }));
    const exact = [...guides, ...none, ...catalog].some((i) =>
      i.kind === "guide"
        ? i.guide.name.toLowerCase() === q || i.guide.slug === q
        : i.kind === "no-oauth"
          ? i.answer.name.toLowerCase() === q || i.answer.slug === q
          : i.kind === "catalog" && i.entry.name.toLowerCase() === q,
    );
    const research: Item[] =
      q && !exact
        ? [{ kind: "research", key: "research", query: query.trim() }]
        : [];
    return [
      { label: "Guides", items: guides },
      { label: "No OAuth", items: none },
      { label: "Queued for research", items: catalog },
      { label: "Research", items: research },
    ].filter((g) => g.items.length > 0);
  }, [library, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function select(item: Item | undefined) {
    if (!item || pending) return;
    if (item.kind === "guide" || item.kind === "no-oauth") {
      router.push(`/apps/${item.kind === "guide" ? item.guide.slug : item.answer.slug}`);
      hide();
      return;
    }
    const q = item.kind === "catalog" ? item.entry.name : item.query;
    setPending(item.key);
    setError(null);
    try {
      router.push(researchHref(await startResearch(q), q));
      hide();
    } catch (err) {
      setPending(null);
      setError(
        err instanceof Error
          ? err.message
          : "Research couldn’t start. Try again.",
      );
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void select(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      hide();
    } else if (e.key === "Tab") {
      e.preventDefault(); // keep focus inside the dialog
    }
  }

  let index = -1;

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="group flex h-10 min-w-10 items-center gap-2.5 rounded-md border border-rule bg-paper-2 px-2.5 text-sm text-muted transition-colors duration-[var(--dur-micro)] hover:border-rule-2 sm:w-64 sm:px-3"
        aria-label="Search guides"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search size={16} aria-hidden="true" className="shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search apps…</span>
        <span
          className="hidden items-center gap-0.5 sm:flex"
          aria-hidden="true"
        >
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>

      {/* Portal: the sticky header's backdrop-filter would otherwise contain this fixed overlay. */}
      {open &&
        createPortal(
          <div className="cmdk">
            <div className="cmdk__backdrop" onClick={hide} aria-hidden="true" />
            <div
              className="cmdk__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Search guides"
            >
              <div className="flex items-center gap-3 border-b border-rule px-4">
                <Search
                  size={18}
                  className="shrink-0 text-muted"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                    setError(null);
                  }}
                  onKeyDown={onInputKey}
                  placeholder="Search guides, or type any app to research it"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus-visible:outline-none"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="cmdk-list"
                  aria-activedescendant={
                    flat[active] ? `cmdk-${flat[active].key}` : undefined
                  }
                  aria-autocomplete="list"
                />
                <button
                  type="button"
                  onClick={hide}
                  className="kbd h-6 cursor-pointer px-1.5"
                  aria-label="Close search"
                >
                  esc
                </button>
              </div>

              <div
                ref={listRef}
                id="cmdk-list"
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto p-2"
              >
                {!library && !loadError && (
                  <div className="grid gap-2 p-2" aria-label="Loading">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-9" />
                    ))}
                  </div>
                )}
                {loadError && (
                  <p className="p-3 text-sm text-ink-2">
                    The guide index didn’t load. Close search and open it again,
                    or type an app name and press Enter to research it.
                  </p>
                )}
                {library && flat.length === 0 && (
                  <p className="p-3 text-sm text-muted">
                    Type an app name or website to research it.
                  </p>
                )}
                {groups.map((group) => (
                  <div
                    key={group.label}
                    role="group"
                    aria-label={group.label}
                    className="mb-1"
                  >
                    <p className="label-mono px-3 pt-3 pb-1.5">{group.label}</p>
                    {group.items.map((item) => {
                      index += 1;
                      const i = index;
                      const isActive = i === active;
                      return (
                        <div
                          key={item.key}
                          id={`cmdk-${item.key}`}
                          role="option"
                          aria-selected={isActive}
                          data-index={i}
                          onMouseMove={() => setActive(i)}
                          onClick={() => void select(item)}
                          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${isActive ? "bg-accent-wash" : ""}`}
                        >
                          <PaletteRow
                            item={item}
                            pending={pending === item.key}
                          />
                          {isActive && (
                            <CornerDownLeft
                              size={14}
                              className="shrink-0 text-muted"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="border-t border-rule bg-danger-wash px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              ) : (
                <div className="hidden items-center gap-4 border-t border-rule px-4 py-2.5 text-xs text-muted sm:flex">
                  <span className="flex items-center gap-1">
                    <kbd className="kbd">↑</kbd>
                    <kbd className="kbd">↓</kbd> move
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="kbd">↵</kbd> open
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="kbd">esc</kbd> close
                  </span>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function PaletteRow({ item, pending }: { item: Item; pending: boolean }) {
  if (item.kind === "guide") {
    const g = item.guide;
    return (
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{g.name}</span>
          {g.domain && (
            <span className="block truncate font-mono text-xs text-muted">
              {g.domain}
            </span>
          )}
        </span>
        <TierBadge tier={g.tier} />
      </span>
    );
  }
  if (item.kind === "no-oauth") {
    const a = item.answer;
    return (
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{a.name}</span>
          <span className="block truncate text-xs text-muted">{a.alternative ? `Try ${a.alternative}` : (a.domain ?? "No OAuth for third-party apps")}</span>
        </span>
        <span className="label-mono shrink-0 !text-warn">No OAuth</span>
      </span>
    );
  }
  const name =
    item.kind === "catalog" ? item.entry.name : `Research “${item.query}”`;
  const sub =
    item.kind === "catalog"
      ? item.entry.domain
      : "An agent writes a new guide while you watch";
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent-strong">
        {pending ? (
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
        ) : item.kind === "research" ? (
          <Sparkles size={14} aria-hidden="true" />
        ) : (
          <ArrowRight size={14} aria-hidden="true" />
        )}
        {pending ? "Starting" : "Research"}
      </span>
    </span>
  );
}
