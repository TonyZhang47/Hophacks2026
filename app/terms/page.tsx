import { promises as fs } from "fs";
import path from "path";
import ReactMarkdown from "react-markdown";

export const metadata = { title: "Terms — RxPlain" };

export default async function TermsPage() {
  const md = await fs.readFile(path.join(process.cwd(), "TERMS.md"), "utf8");
  return (
    <article className="prose-md max-w-3xl mx-auto py-8">
      <ReactMarkdown>{md}</ReactMarkdown>
    </article>
  );
}
