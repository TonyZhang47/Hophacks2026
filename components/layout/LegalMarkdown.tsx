import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Map repo markdown files to app routes so in-page links actually navigate. */
function legalHref(url: string): string {
  const href = url.trim();
  const file = href.split("/").pop() ?? href;
  if (file === "PRIVACY.md") return "/privacy";
  if (file === "TERMS.md") return "/terms";
  return href;
}

function allowLegalUrl(url: string): string {
  const href = legalHref(url);
  if (href.startsWith("/") || href.startsWith("#")) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return "";
}

export function LegalMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={allowLegalUrl}
      components={{
        a({ href, children: label, node: _node, ...props }) {
          const to = href ? legalHref(href) : undefined;
          if (to?.startsWith("/")) {
            return (
              <Link href={to} {...props}>
                {label}
              </Link>
            );
          }
          return (
            <a href={to} {...props}>
              {label}
            </a>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
