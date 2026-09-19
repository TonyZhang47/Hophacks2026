import { networkInterfaces } from "node:os";
import { createSession, findSession, sessions } from "@/lib/captureSessions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
function authorizedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return (
      new URL(origin).host ===
      (req.headers.get("host") || new URL(req.url).host)
    );
  } catch {
    return false;
  }
}
function token(req: Request) {
  return req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
}
export async function POST(req: Request) {
  if (!authorizedOrigin(req)) return respond({ error: "Invalid origin" }, 403);
  try {
    const s = createSession();
    const url = new URL(req.url);
    url.host = req.headers.get("host") || url.host;
    let origins = [url.origin];
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      const networks = Object.entries(networkInterfaces()).sort(
        ([a], [b]) => Number(b === "en0") - Number(a === "en0"),
      );
      origins = networks.flatMap(([, addresses]) =>
        (addresses || [])
          .filter(
            (a) =>
              a.family === "IPv4" &&
              !a.internal &&
              /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address),
          )
          .map((a) => `http://${a.address}:${url.port || "3000"}`),
      );
      if (!origins.length) {
        sessions.delete(s.readToken);
        return respond(
          { error: "Connect this computer to Wi-Fi, then try again." },
          503,
        );
      }
    }
    return respond({
      readToken: s.readToken,
      writeToken: s.writeToken,
      expires: s.expires,
      origins: [...new Set(origins)],
    });
  } catch {
    return respond(
      { error: "Too many active capture links. Try again in ten minutes." },
      429,
    );
  }
}
export async function GET(req: Request) {
  const read = findSession(token(req));
  if (read)
    return respond({
      status: read.image ? "ready" : "waiting",
      image: read.image,
      expires: read.expires,
    });
  const write = findSession(token(req), true);
  if (write)
    return respond({
      status: write.uploaded ? "sent" : "waiting",
      expires: write.expires,
    });
  return respond(
    {
      error:
        "This link expired or was closed. Generate a new QR code on your computer.",
    },
    410,
  );
}
export async function PUT(req: Request) {
  if (!authorizedOrigin(req)) return respond({ error: "Invalid origin" }, 403);
  const s = findSession(token(req), true);
  if (!s)
    return respond(
      { error: "This link expired. Generate a new QR code." },
      410,
    );
  if (s.uploaded)
    return respond(
      {
        error: "A photo was already sent. Generate a new link to send another.",
      },
      409,
    );
  // Bound the stream before JSON parsing, including chunked uploads without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return respond({ error: "Photo required" }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4_000_000) {
      await reader.cancel();
      return respond(
        { error: "Photo too large. Choose a smaller image." },
        413,
      );
    }
    chunks.push(value);
  }
  let image: unknown;
  try {
    image = JSON.parse(Buffer.concat(chunks).toString()).image;
  } catch {
    return respond({ error: "Invalid photo" }, 400);
  }
  if (
    typeof image !== "string" ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)
  )
    return respond({ error: "Choose a JPEG photo." }, 400);
  const bytes = Buffer.from(image.split(",")[1], "base64");
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
    return respond({ error: "Invalid JPEG photo" }, 400);
  if (s.expires < Date.now())
    return respond({ error: "This link expired." }, 410);
  if (s.uploaded) return respond({ error: "A photo was already sent." }, 409);
  s.image = image;
  s.uploaded = true;
  return respond({ ok: true });
}
export async function DELETE(req: Request) {
  if (!authorizedOrigin(req)) return respond({ error: "Invalid origin" }, 403);
  const s = findSession(token(req));
  if (s) sessions.delete(s.readToken);
  return respond({ ok: true });
}
