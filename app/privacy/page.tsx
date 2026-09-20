import { promises as fs } from "fs";
import path from "path";
import { LegalMarkdown } from "@/components/layout/LegalMarkdown";

export const metadata = { title: "Privacy Policy — RxPlain" };

export default async function PrivacyPage() {
  const md = await fs.readFile(path.join(process.cwd(), "PRIVACY.md"), "utf8");
  return (
    <article className="prose-md max-w-3xl mx-auto py-8">
      <LegalMarkdown>{md}</LegalMarkdown>
    </article>
  );
}
