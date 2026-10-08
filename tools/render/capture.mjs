// Render a scene from tools/render/index.html to a transparent PNG with headless Chrome.
//   python3 -m http.server 8765        (from the repository root, in another terminal)
//   node tools/render/capture.mjs guardian 2800 3600 out.png
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [scene = "guardian", w = "1400", h = "1800", out = `${scene}.png`, base = "http://127.0.0.1:8765"] = process.argv.slice(2);
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9400 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "parxyz-render-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 100 && !targets.length; i++) {
  try { targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page"); } catch {}
  await sleep(150);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: `${base}/tools/render/index.html?scene=${scene}&w=${w}&h=${h}` });
const t0 = Date.now();
let ready = false;
while (!ready && Date.now() - t0 < 240000) {
  await sleep(500);
  if (logs.some((l) => /Error/.test(l))) break;
  const r = await send("Runtime.evaluate", { expression: "window.__ready === true", returnByValue: true });
  ready = r.result?.result?.value === true;
}
if (!ready) { console.error("Timed out", logs.join("\n")); chrome.kill(); process.exit(1); }
const r = await send("Runtime.evaluate", { expression: "document.querySelector('canvas').toDataURL('image/png')", returnByValue: true });
writeFileSync(out, Buffer.from(r.result.result.value.split(",")[1], "base64"));
console.log(`saved ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`, logs.length ? "\n" + logs.join("\n") : "");
ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
