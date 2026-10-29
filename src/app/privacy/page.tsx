import { readFile } from "node:fs/promises";
import path from "node:path";
import { getLocale } from "next-intl/server";
import { PublicHeader } from "@/components/public-header";
import { markdownBlocks } from "@/lib/markdown";

// The privacy policy, public (also logged out), in the viewer's language: content/privacy.<locale>.md, a draft the
// coach edits.
export default async function Privacy() {
  const locale = await getLocale();
  const blocks = markdownBlocks(await readFile(path.join(process.cwd(), "content", `privacy.${locale}.md`), "utf8"));
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pt-10 pb-16 sm:px-[29px]">
        {blocks.map((block, i) =>
          block.type === "h1" ? (
            <h1 key={i} className="text-2xl font-bold tracking-tight sm:text-title">
              {block.text}
            </h1>
          ) : block.type === "h2" ? (
            <h2 key={i} className="mt-8 text-lg font-semibold">
              {block.text}
            </h2>
          ) : block.type === "ul" ? (
            <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="mt-3">
              {block.text}
            </p>
          ),
        )}
      </main>
    </div>
  );
}
