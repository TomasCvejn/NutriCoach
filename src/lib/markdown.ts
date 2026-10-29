// The few Markdown blocks the privacy pages use: "# " and "## " headings, "- " list items, paragraphs (blank-line separated).
export type Block = { type: "h1" | "h2" | "p"; text: string } | { type: "ul"; items: string[] };

export function markdownBlocks(source: string): Block[] {
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((chunk): Block => {
      const lines = chunk.split("\n").map((line) => line.trim());
      if (lines[0].startsWith("## ")) return { type: "h2", text: lines[0].slice(3) };
      if (lines[0].startsWith("# ")) return { type: "h1", text: lines[0].slice(2) };
      if (lines.every((line) => line.startsWith("- "))) return { type: "ul", items: lines.map((line) => line.slice(2)) };
      return { type: "p", text: lines.join(" ") };
    });
}
