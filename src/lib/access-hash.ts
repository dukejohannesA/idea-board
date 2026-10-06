// PBKDF2-SHA256 hashing for the private access code. Works in the browser and on the server.
// Format: pbkdf2-sha256$<iterations>$<saltBase64>$<hashBase64>

const ITERATIONS = 100_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(code: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashAccessCode(code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(code, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyAccessCode(code: string, stored: string): Promise<boolean> {
  const [algo, iter, saltB64, hashB64] = stored.trim().split("$");
  if (algo !== "pbkdf2-sha256" || !iter || !saltB64 || !hashB64) return false;
  const expected = unb64(hashB64);
  const actual = await derive(code, unb64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
