import { randomBytes } from "node:crypto";
export type CaptureSession = {
  readToken: string;
  writeToken: string;
  expires: number;
  image?: string;
  uploaded: boolean;
};
const root = globalThis as typeof globalThis & {
  rxplainCaptures?: Map<string, CaptureSession>;
};
export const sessions = (root.rxplainCaptures ??= new Map());
export function cleanSessions() {
  for (const [key, s] of sessions)
    if (s.expires < Date.now()) sessions.delete(key);
}
export function createSession() {
  cleanSessions();
  if (sessions.size >= 50) throw new Error("capacity");
  const s: CaptureSession = {
    readToken: randomBytes(24).toString("hex"),
    writeToken: randomBytes(24).toString("hex"),
    expires: Date.now() + 10 * 60_000,
    uploaded: false,
  };
  sessions.set(s.readToken, s);
  setTimeout(() => sessions.delete(s.readToken), 10 * 60_000).unref();
  return s;
}
export function findSession(token: string, write = false) {
  cleanSessions();
  if (!/^[a-f0-9]{48}$/.test(token)) return undefined;
  return write
    ? [...sessions.values()].find((s) => s.writeToken === token)
    : sessions.get(token);
}
