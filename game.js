"use strict";
const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
const START_NG = "https://start.ng";
const fallback = { body: "male", primaryColor: "#a55eea", secondaryColor: "#0c6e5a", skinColor: "#8d5524", hairColor: "#17120f", hair: "short", hat: "none", accessory: "none" };
let style = { ...fallback }, state = "ready", lane = 1, visualX = 240;
let objects = [], sparks = [], elapsed = 0, coins = 0, score = 0, spawn = 0, last = 0, best = 0;
try { best = Number(localStorage.getItem("zedu-dash-best")) || 0; } catch { /* Storage is optional. */ }
$("best").textContent = String(best).padStart(4, "0");
$("signin").href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has("startng_session")) history.replaceState(null, "", location.pathname + location.search);
let framePromise;
function connectFrame() {
  return framePromise ??= new Promise((resolve) => {
    const frame = document.createElement("iframe");
    const timer = setTimeout(() => resolve(null), 5000);
    frame.hidden = true; frame.src = `${START_NG}/connect`;
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.onerror = () => { clearTimeout(timer); resolve(null); };
    document.body.append(frame);
  });
}
async function askStartNg(message, replyType) {
  const frame = await connectFrame();
  if (!frame) return null;
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const done = (reply) => { clearTimeout(timer); removeEventListener("message", receive); resolve(reply); };
    const timer = setTimeout(() => done(null), 5000);
    function receive(event) {
      if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
      if (event.data?.type === replyType && event.data.requestId === requestId) done(event.data);
    }
    addEventListener("message", receive);
    frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}
async function refreshPlayer() {
  const reply = await askStartNg({ type: "startng:whoami" }, "startng:user");
  const player = reply?.user ?? reply?.guest;
  if (!player) return;
  style = { ...fallback, ...player.style };
  for (const key of ["primaryColor", "secondaryColor", "skinColor", "hairColor"]) {
    if (!/^#[0-9a-f]{6}$/i.test(style[key])) style[key] = fallback[key];
  }
  $("player-name").textContent = player.name || "Guest";
  $("account").textContent = player.account ? `@${player.account}` : "Playing as the start.ng guest";
  $("signin").hidden = !!reply.user;
  if (typeof player.face === "string" && player.face.startsWith("data:image/png;base64,")) {
    const image = new Image(); image.src = player.face; image.alt = "Your start.ng character";
    $("portrait").replaceChildren(image);
  }
}
refreshPlayer();
addEventListener("focus", refreshPlayer);
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "running") pause(); else if (!document.hidden) refreshPlayer(); });
function move(direction) { if (state === "running") lane = Math.max(0, Math.min(2, lane + direction)); }
function start() {
  lane = 1; visualX = 240; objects = []; sparks = []; elapsed = 0; score = 0; coins = 0; spawn = 0.7;
  state = "running"; $("score").textContent = "0000"; $("overlay").hidden = true; $("pause").disabled = false; $("status").textContent = "KEEP MOVING";
}
function pause() {
  if (state !== "running" && state !== "paused") return;
  if (state === "paused") { state = "running"; $("overlay").hidden = true; return; }
  state = "paused"; showOverlay("TAKE A BREATHER", "Run paused.", "Your next move can wait.", "RESUME ↗");
}
function showOverlay(label, title, copy, button) {
  $("overlay-label").textContent = label; $("overlay-title").textContent = title;
  $("overlay-copy").textContent = copy; $("play").textContent = button; $("overlay").hidden = false;
}
function end() {
  state = "over"; const record = score > best; best = Math.max(score, best);
  try { localStorage.setItem("zedu-dash-best", String(best)); } catch { /* Private browsing can disable storage. */ }
  $("best").textContent = String(best).padStart(4, "0"); $("pause").disabled = true; $("status").textContent = "RUN COMPLETE";
  showOverlay(record ? "NEW PERSONAL BEST" : "THAT WAS A GOOD RUN", `${score} points.`, `${coins} coins collected · ${Math.floor(elapsed)} seconds survived`, "GO AGAIN ↗");
  $("result").textContent = "Personal best saved on this device. Ready for another?";
}
$("play").onclick = () => state === "paused" ? pause() : start();
$("pause").onclick = pause;
$("left").onclick = () => move(-1); $("right").onclick = () => move(1);
addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") move(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") move(1);
  if (event.key.toLowerCase() === "p" || event.key === "Escape") pause();
  if (event.key === " " && event.target === document.body) { if (state === "running" || state === "paused") pause(); else start(); }
});
let touchX = 0;
canvas.addEventListener("pointerdown", (e) => { touchX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointerup", (e) => { const delta = e.clientX - touchX; if (Math.abs(delta) > 18) move(Math.sign(delta)); else move(e.offsetX < canvas.clientWidth / 2 ? -1 : 1); });
function rect(x, y, w, h, color, radius = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function character(x, y) {
  const s = style, step = state === "running" ? Math.sin(elapsed * 19) * 5 : 0;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#0005"; ctx.beginPath(); ctx.ellipse(0, 33, 25, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (s.accessory === "backpack") rect(-24, -9, 48, 30, "#d6a44b", 7);
  rect(-16, 13, 12, 23 + step, s.secondaryColor, 3); rect(4, 13, 12, 23 - step, s.secondaryColor, 3);
  rect(-18, 32 + step, 16, 7, "#ecebd5", 3); rect(3, 32 - step, 16, 7, "#ecebd5", 3);
  rect(-24, -8 - step, 9, 26, s.skinColor, 4); rect(15, -8 + step, 9, 26, s.skinColor, 4);
  rect(-17, -12, 34, 31, s.primaryColor, 6);
  if (s.body === "female") { ctx.fillStyle = s.secondaryColor; ctx.beginPath(); ctx.moveTo(-15, 12); ctx.lineTo(15, 12); ctx.lineTo(22, 24); ctx.lineTo(-22, 24); ctx.fill(); }
  circle(0, -26, 17, s.skinColor);
  if (s.hair !== "bald") {
    rect(-17, -43, 34, s.hair === "afro" ? 20 : 10, s.hairColor, 7);
    if (s.hair === "afro") { circle(-11, -39, 11, s.hairColor); circle(10, -39, 11, s.hairColor); }
    if (["braids", "dreads"].includes(s.hair)) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) rect(side * (16 + i * 3) - 2, -35, 4, 28 + i * 3, s.hairColor, 2);
    if (s.hair === "bun") circle(0, -49, 9, s.hairColor);
    if (s.hair === "ponytail") rect(13, -41, 10, 32, s.hairColor, 5);
  }
  circle(-6, -26, 2, "#172018"); circle(6, -26, 2, "#172018");
  if (s.accessory === "glasses") { ctx.strokeStyle = "#161c16"; ctx.lineWidth = 2; ctx.strokeRect(-12, -31, 10, 8); ctx.strokeRect(2, -31, 10, 8); }
  if (s.accessory === "earrings") { circle(-17, -22, 3, "#ffda6b"); circle(17, -22, 3, "#ffda6b"); }
  if (s.accessory === "beard") rect(-10, -19, 20, 9, s.hairColor, 5);
  if (s.accessory === "scarf") rect(-18, -14, 36, 7, "#ffd36b", 3);
  if (s.hat === "cap") { rect(-19, -47, 38, 12, s.secondaryColor, 5); rect(-20, -37, 47, 5, s.secondaryColor, 2); }
  if (s.hat === "beanie") { rect(-19, -49, 38, 16, s.primaryColor, 9); circle(0, -51, 5, s.primaryColor); }
  if (s.hat === "tophat") { rect(-14, -62, 28, 25, "#292d39", 3); rect(-22, -39, 44, 5, "#292d39", 2); }
  if (s.hat === "crown") { ctx.fillStyle = "#ffd36b"; ctx.beginPath(); ctx.moveTo(-19, -36); ctx.lineTo(-21, -53); ctx.lineTo(-9, -45); ctx.lineTo(0, -58); ctx.lineTo(9, -45); ctx.lineTo(21, -53); ctx.lineTo(19, -36); ctx.fill(); }
  ctx.restore();
}
function tick(time) {
  const dt = Math.min((time - (last || time)) / 1000, 0.04); last = time;
  if (state === "running") {
    elapsed += dt; score = Math.floor(elapsed * 10) + coins * 25;
    $("score").textContent = String(score).padStart(4, "0");
    spawn -= dt;
    if (spawn <= 0) {
      const blocked = Math.floor(Math.random() * 3);
      objects.push({ lane: blocked, y: -55, kind: "block" });
      objects.push({ lane: (blocked + 1 + Math.floor(Math.random() * 2)) % 3, y: -55, kind: "coin" });
      spawn = Math.max(0.66, 1.15 - elapsed * 0.006);
    }
    visualX += (100 + lane * 140 - visualX) * Math.min(1, dt * 22);
    for (const object of objects) {
      object.y += Math.min(470, 210 + elapsed * 4) * dt;
      if (!object.hit && Math.abs(visualX - (100 + object.lane * 140)) < (object.kind === "coin" ? 35 : 44) && Math.abs(object.y - 492) < 31) {
        object.hit = true;
        if (object.kind === "block") { end(); break; }
        coins++; for (let i = 0; i < 8; i++) sparks.push({ x: visualX, y: 492, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 160, life: 0.5 });
      }
    }
    objects = objects.filter((o) => o.y < 660 && !(o.hit && o.kind === "coin"));
  }
  rect(0, 0, 480, 600, "#18261c");
  for (let i = 0; i < 3; i++) rect(38 + i * 140, 0, 124, 600, i % 2 ? "#223121" : "#203020");
  for (const x of [30, 450]) rect(x, 0, 2, 600, "#a1c565");
  for (const x of [170, 310]) for (let y = -80; y < 640; y += 80) rect(x, y + (elapsed * 210 % 80), 1, 36, "#67844b");
  for (const o of objects) {
    const x = 100 + o.lane * 140;
    if (o.kind === "coin") { circle(x, o.y, 15, "#8c6c30"); circle(x, o.y - 3, 15, "#ffd36b"); circle(x, o.y - 3, 10, "#eeb74b"); rect(x - 2, o.y - 10, 4, 14, "#fff0b4", 1); }
    else { rect(x - 29, o.y - 23, 58, 53, "#874735", 6); rect(x - 29, o.y - 27, 58, 45, "#f78562", 6); rect(x - 23, o.y - 15, 46, 7, "#ffcc9f", 2); rect(x - 23, o.y + 1, 46, 7, "#ac513b", 2); }
  }
  character(visualX, 492);
  if (state === "running") for (const p of sparks) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; circle(p.x, p.y, 3, "#ffd36b"); }
  sparks = sparks.filter((p) => p.life > 0);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
