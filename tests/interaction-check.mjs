/**
 * 视图交互回归测试：平移 / 缩放 / 吸色取色。
 * 曾经 mainView 和 canvas 各绑了一套 mousedown + wheel，canvas 是 mainView 的子元素，
 * 事件冒泡后两套都执行 —— 平移位移被加两次（速度翻倍）、滚轮缩放系数叠加。
 * 这里用 DOM stub 派发事件，断言偏移量与缩放系数只变化一次。
 * 用法: node tests/interaction-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

const W = 200, H = 200;
const pixels = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
    pixels[i * 4] = 255; pixels[i * 4 + 1] = 255; pixels[i * 4 + 2] = 255;
    pixels[i * 4 + 3] = (i % W) < 20 ? 0 : 255;   // 左侧一条透明，保证检测不到纯色也能跑
}

// ---------- 可派发事件的 DOM stub ----------
function makeTarget(extra = {}) {
    const map = Object.create(null);
    return Object.assign(extra, {
        addEventListener(type, fn) { (map[type] || (map[type] = [])).push(fn); },
        removeEventListener(type, fn) {
            if (map[type]) map[type] = map[type].filter(f => f !== fn);
        },
        dispatch(type, ev = {}) { (map[type] || []).slice().forEach(fn => fn(ev)); },
        listenerCount(type) { return (map[type] || []).length; },
    });
}

const noopCtx = new Proxy({
    globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineJoin: '',
    getImageData(x, y, w, h) {
        if (w === W && h === H && x === 0 && y === 0) return { width: W, height: H, data: pixels };
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
}, { get: (t, p) => (p in t ? t[p] : (typeof p === 'string' ? () => {} : undefined)) });

const els = new Map();
function makeEl(id) {
    return makeTarget({
        id, innerText: '', innerHTML: '', value: '', checked: false, disabled: false,
        style: {}, classList: { add() {}, remove() {}, contains: () => false },
        width: 0, height: 0, clientWidth: 900, clientHeight: 700,
        appendChild() {}, removeChild() {}, click() {},
        getContext: () => noopCtx,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
    });
}
const special = { precision: '20', commonThreshold: '50', expansion: '0' };

const documentStub = makeTarget({
    getElementById(id) {
        if (!els.has(id)) {
            const el = makeEl(id);
            if (special[id] !== undefined) el.value = special[id];
            els.set(id, el);
        }
        return els.get(id);
    },
    createElement: (tag) => makeEl(tag),
    querySelectorAll: () => [],
    body: { appendChild() {}, removeChild() {} },
    documentElement: { setAttribute() {} },
});

const sandbox = makeTarget({
    console, performance, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0),
    Math, JSON, Map, Set, Uint8Array, Uint8ClampedArray, Array, Object, String, Number,
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    ImageData: class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } },
    document: documentStub,
    Image: class {
        constructor() { this.width = W; this.height = H; }
        set src(v) { setTimeout(() => this.onload && this.onload(), 0); }
    },
});
sandbox.window = sandbox;

vm.createContext(sandbox);
const app = vm.runInContext(
    src + '\n;({ ' +
    'get offsetX(){return offsetX;}, set offsetX(v){offsetX=v;}, ' +
    'get offsetY(){return offsetY;}, set offsetY(v){offsetY=v;}, ' +
    'get scale(){return scale;}, set scale(v){scale=v;}, ' +
    'get keyColor(){return keyColor;}, set keyColor(v){keyColor=v;}, ' +
    'loadImage, resetView, syncKeyColorUI })',
    sandbox
);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (m) => console.log('✅ ' + m);
const fail = (m) => { console.log('❌ ' + m); failures++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

(async () => {
    app.loadImage('data:image/png;base64,stub', 't.png');
    await sleep(100);

    const mainView = documentStub.getElementById('mainView');
    const win = sandbox;

    // ---- 1. 平移：位移只能被加一次 ----
    app.offsetX = 0; app.offsetY = 0;
    mainView.dispatch('mousedown', { button: 0, clientX: 100, clientY: 100 });
    win.dispatch('mousemove', { clientX: 200, clientY: 150 });
    win.dispatch('mouseup', { button: 0, clientX: 200, clientY: 150 });
    const dx = app.offsetX, dy = app.offsetY;
    console.log(`拖动 (100,100)->(200,150)：offset = (${dx}, ${dy})`);
    near(dx, 100) && near(dy, 50) ? ok('平移位移正确（+100, +50），没有被加倍')
        : fail(`平移位移应为 (100, 50)，实际 (${dx}, ${dy})`);

    // ---- 2. 缩放：只应用一次系数 ----
    app.scale = 1; app.offsetX = 0; app.offsetY = 0;
    mainView.dispatch('wheel', { deltaY: -100, clientX: 400, clientY: 300, preventDefault() {} });
    console.log(`滚轮放大一次：scale = ${app.scale}`);
    near(app.scale, 1.1, 1e-9) ? ok('缩放只应用一次系数（×1.1）')
        : fail(`缩放应为 1.1，实际 ${app.scale}（若约 1.21 说明两套监听叠加了）`);

    // ---- 3. 吸色模式：拖动仍然平移，不误触取色 ----
    documentStub.getElementById('colorPickerMode').checked = true;
    app.keyColor = null;
    app.offsetX = 0; app.offsetY = 0; app.scale = 1;
    mainView.dispatch('mousedown', { button: 0, clientX: 300, clientY: 100 });
    win.dispatch('mousemove', { clientX: 340, clientY: 100 });
    win.dispatch('mouseup', { button: 0, clientX: 340, clientY: 100 });
    const dragged = app.keyColor === null;
    dragged ? ok('吸色模式下拖动 = 平移，不会误取色') : fail('吸色模式下拖动仍然触发了取色');
    near(app.offsetX, 40) ? ok('吸色模式下平移仍生效 (+40)') : fail(`吸色模式平移失效，offsetX=${app.offsetX}`);

    // ---- 4. 吸色模式：原地点击才取色 ----
    app.keyColor = null;
    app.offsetX = 0; app.offsetY = 0; app.scale = 1;
    mainView.dispatch('mousedown', { button: 0, clientX: 100, clientY: 100 });
    win.dispatch('mouseup', { button: 0, clientX: 100, clientY: 100 });
    app.keyColor ? ok(`原地点击取色成功 (${app.keyColor})`) : fail('原地点击没有取到颜色');

    console.log(`\n${failures > 0 ? `❌ ${failures} 项失败` : '✅ 视图交互全部通过'}`);
    process.exit(failures > 0 ? 1 : 0);
})();
