/**
 * 导出链路回归测试：用最小 DOM stub 在 Node 里加载真实的 script.js，
 * 走完整流程 loadImage -> startMeshGeneration -> exportModel，检查导出的 OBJ。
 * 用法: node tests/export-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

// ---------- 测试图：200x200 白色实心块，中间挖一个透明圆 ----------
const W = 200, H = 200;
const pixels = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const inside = (x - 100) ** 2 + (y - 100) ** 2 < 45 ** 2;
        pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
        pixels[i + 3] = inside ? 0 : 255;
    }
}
const srcImageData = { width: W, height: H, data: pixels };

// ---------- DOM stub ----------
class ImageDataStub {
    constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
}

const noopCtx = new Proxy({
    canvas: null, globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineJoin: '',
    drawImage() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, fillRect() {},
    getImageData(x, y, w, h) {
        if (w === W && h === H && x === 0 && y === 0) return srcImageData;
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    putImageData() {},
}, { get: (t, p) => (p in t ? t[p] : (typeof p === 'string' ? () => {} : undefined)) });

function makeCanvas() {
    return {
        width: 0, height: 0, style: {}, getContext: () => noopCtx,
        classList: stubClassList(), addEventListener() {}, removeEventListener() {},
    };
}
function stubClassList() {
    const set = new Set();
    return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), contains: c => set.has(c) };
}

const elementCache = new Map();
function makeEl(id) {
    const el = {
        id, innerText: '', innerHTML: '', value: '', checked: false, disabled: false,
        style: {}, classList: stubClassList(), width: 0, height: 0,
        clientWidth: 900, clientHeight: 700,
        addEventListener() {}, removeEventListener() {},
        appendChild() {}, removeChild() {}, click() {}, focus() {},
        getContext: () => noopCtx,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
    };
    return el;
}
const specialValues = { precision: '20', commonThreshold: '50', expansion: '0' };

const documentStub = {
    getElementById(id) {
        if (!elementCache.has(id)) {
            const el = id === 'canvas' || id === 'mainView' ? makeCanvas() : makeEl(id);
            if (id === 'mainView') { el.clientWidth = 900; el.clientHeight = 700; }
            if (specialValues[id] !== undefined) el.value = specialValues[id];
            elementCache.set(id, el);
        }
        return elementCache.get(id);
    },
    createElement(tag) { return tag === 'canvas' ? makeCanvas() : makeEl(tag); },
    querySelectorAll: () => [],
    addEventListener() {},
    body: { appendChild() {}, removeChild() {} },
    documentElement: { setAttribute() {} },
};

const captured = { blobs: [] };
class BlobStub {
    constructor(parts, opts) { this.parts = parts; this.opts = opts; captured.blobs.push(String(parts[0])); }
}

const sandbox = {
    console,
    performance,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0),
    Math, JSON, Map, Set, Uint8Array, Uint8ClampedArray, Int32Array, Float64Array, Array, Object, String, Number,
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    Blob: BlobStub,
    ImageData: ImageDataStub,
    document: documentStub,
    Image: class {
        constructor() { this.width = W; this.height = H; }
        set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); }
        get src() { return this._src; }
    },
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
const exported = vm.runInContext(
    src + '\n;({ get processedMeshes(){return processedMeshes;}, exportModel, startMeshGeneration, loadImage, get appMode(){return appMode;} })',
    sandbox
);

// ---------- 跑流程 ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    exported.loadImage('data:image/png;base64,stub', 'test-ring.png');
    await sleep(100);

    exported.startMeshGeneration();
    for (let i = 0; i < 200 && exported.processedMeshes.length === 0; i++) await sleep(20);
    await sleep(100);

    const meshes = exported.processedMeshes;
    let failures = 0;
    const fail = (msg) => { console.log('❌ ' + msg); failures++; };
    const ok = (msg) => console.log('✅ ' + msg);

    if (meshes.length === 0) { fail('没有生成任何网格'); process.exit(1); }

    let holes = 0, tris = 0, verts = 0;
    for (const m of meshes) {
        verts += m.vertices.length;
        tris += m.indices.length / 3;
        holes += Math.max(0, (m.rings || [m.vertices.length]).length - 1);
    }
    console.log(`网格 ${meshes.length} 个 / 顶点 ${verts} / 三角 ${tris} / 孔洞 ${holes}`);
    holes === 1 ? ok('识别出 1 个孔洞（中间透明圆）') : fail(`孔洞数应为 1，实际 ${holes}`);

    // 顶点索引必须在范围内
    let badIndex = 0;
    for (const m of meshes) {
        const n = m.vertices.length;
        for (const i of m.indices) if (!(i >= 0 && i < n)) badIndex++;
    }
    badIndex === 0 ? ok('三角索引全部在顶点范围内') : fail(`${badIndex} 个越界索引`);

    // ---- 导出 OBJ ----
    captured.blobs.length = 0;
    exported.exportModel();
    const obj = captured.blobs[0];
    if (!obj) { fail('exportModel 没有产出内容'); process.exit(1); }

    const vs = [];
    const fs = [];
    let vtCount = 0, badRef = 0, dupFace = 0, outOfRange = 0;
    for (const raw of obj.split('\n')) {
        const t = raw.trim();
        if (t.startsWith('v ')) {
            const p = t.slice(2).split(/\s+/).map(Number);
            vs.push(p);
        } else if (t.startsWith('vt ')) vtCount++;
        else if (t.startsWith('f ')) {
            const ids = t.slice(2).split(/\s+/).map(s => parseInt(s.split('/')[0], 10));
            if (ids.length !== 3 || ids.some(n => !Number.isFinite(n))) { badRef++; continue; }
            if (new Set(ids).size !== 3) dupFace++;
            if (ids.some(n => n < 1 || n > vs.length)) outOfRange++;
            fs.push(ids);
        }
    }
    const vCount = vs.length;
    const fCount = fs.length;

    // 法线朝向：z 必须恒为 0 的平面上，绕序决定了法线是 +Z 还是 -Z。
    // 混向 = 破面；整体朝 -Z = 在开启背面剔除的软件里整个模型看不见。
    let normalPos = 0, normalNeg = 0;
    for (const [a, b, c] of fs) {
        const A = vs[a - 1], B = vs[b - 1], C = vs[c - 1];
        const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        if (nz > 1e-12) normalPos++;
        else if (nz < -1e-12) normalNeg++;
    }
    console.log(`法线朝向: +Z ${normalPos} 面 / -Z ${normalNeg} 面`);
    if (normalPos > 0 && normalNeg > 0) fail(`绕序混向（${normalPos} 正 / ${normalNeg} 反）—— 背面剔除下就是破面`);
    else if (normalNeg > 0 && normalPos === 0) fail('所有面法线朝 -Z（整体背面朝外），多数引擎下模型不可见');
    else ok(`绕序一致，法线统一朝 +Z（${normalPos} 面）`);
    console.log(`OBJ: ${obj.length} 字节 / v ${vCount} / vt ${vtCount} / f ${fCount}`);
    vCount === verts ? ok(`顶点数 ${vCount} 与网格一致`) : fail(`OBJ 顶点 ${vCount} != 网格顶点 ${verts}`);
    vtCount === verts ? ok('UV 数量与顶点一致') : fail(`UV ${vtCount} != 顶点 ${verts}`);
    fCount === tris ? ok(`面数 ${fCount} 与网格一致`) : fail(`OBJ 面 ${fCount} != 网格三角 ${tris}`);
    badRef === 0 ? ok('面定义格式正确（三个有效索引）') : fail(`${badRef} 个坏面`);
    dupFace === 0 ? ok('无退化面（三索引互不重复）') : fail(`${dupFace} 个重复索引的退化面`);
    outOfRange === 0 ? ok('面索引全部在 [1, vCount] 内') : fail(`${outOfRange} 个越界面索引`);

    console.log(`\n${failures > 0 ? `❌ ${failures} 项失败` : '✅ 导出链路全部通过'}`);
    process.exit(failures > 0 ? 1 : 0);
})();
