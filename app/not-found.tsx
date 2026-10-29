import Link from "next/link";
import { ResearchForm } from "@/components/research-form";

export default function NotFound() {
  return (
    <div className="page pt-14">
      <div className="max-w-[40rem]">
        <h1 className="text-2xl">There’s no guide here</h1>
        <p className="mt-3">
          Nobody has researched this app yet. Research it now, or{" "}
          <Link href="/#library" className="link">
            browse the library
          </Link>
          .
        </p>
        <div className="mt-8">
          <ResearchForm />
        </div>
      </div>
    </div>
  );
}
