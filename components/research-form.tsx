"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { researchHref, startResearch } from "@/lib/client";

export function ResearchForm({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState(defaultValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError("Enter an app name or website.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      router.push(researchHref(await startResearch(q), q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research couldn’t start. Try again.");
      setPending(false);
    }
  }

  return (
    <form id="research" onSubmit={onSubmit} noValidate className="grid gap-3">
      <label htmlFor={`${id}-q`} className="text-sm font-medium">
        App name or website
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-q`}
          name="query"
          className="input"
          placeholder="e.g. calendly.com"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          disabled={pending}
        />
        <button type="submit" className="btn btn-primary min-h-11 sm:w-auto" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
              Starting
            </>
          ) : (
            <>
              Research app
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      <p id={`${id}-help`} className="min-h-5 text-sm" role={error ? "alert" : undefined}>
        {error ? (
          <span className="form-error">{error}</span>
        ) : (
          <span className="opacity-80">Takes 1–3 minutes. You watch it work.</span>
        )}
      </p>
    </form>
  );
}
