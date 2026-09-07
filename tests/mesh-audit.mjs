/**
 * 网格算法审计脚本 —— 回归测试「导出 OBJ 破面」问题。
 * 用法: node tests/mesh-audit.mjs
 *
 * 直接复用 script.js 里的纯算法部分（DOM 访问之前），
 * 对合成图形跑完整管线: threshold -> findPolygons -> RDP -> clean -> earcut -> Delaunay 翻转
 * 然后检查: 孔洞识别 / 轮廓自交 / 三角化覆盖率 / 重叠 / 退化三角形
 *
 * 覆盖率是破面最灵敏的指标：正确三角化时 Σ|三角形面积| 必须等于多边形净面积 (=1.0)。
 * < 1 表示有面缺失，> 1 表示有面重叠。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const cut = src.indexOf('const canvas = document.getElementById');
if (cut < 0) throw new Error('找不到 DOM 分界点，script.js 结构变了');
const algo = src.slice(0, cut);
const { earcut, simplifyPoints, cleanContour, optimizeMeshTopology, ImageProcessor, buildPolygonMesh, polygonNetArea } =
    new Function(algo + '\nreturn {earcut, simplifyPoints, cleanContour, optimizeMeshTopology, ImageProcessor, buildPolygonMesh, polygonNetArea};')();

// ---------- 合成测试图形 ----------
function makeGrid(w, h, fn) {
    const grid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grid[y * w + x] = fn(x, y) ? 1 : 0;
    return { grid, width: w, height: h };
}

// holes: 期望的孔洞数量
const shapes = {
    disc: { holes: 0, make: () => makeGrid(200, 200, (x, y) => (x - 100) ** 2 + (y - 100) ** 2 < 80 ** 2) },
    ring: {
        holes: 1, make: () => makeGrid(200, 200, (x, y) => {
            const d2 = (x - 100) ** 2 + (y - 100) ** 2;
            return d2 < 80 ** 2 && d2 > 45 ** 2;
        })
    },
    multiHole: {
        holes: 3, make: () => makeGrid(200, 200, (x, y) => {
            const d2 = (x - 100) ** 2 + (y - 100) ** 2;
            if (d2 >= 80 ** 2) return false;
            if (d2 < 30 ** 2) return false;
            if ((x - 60) ** 2 + (y - 60) ** 2 < 15 ** 2) return false;
            if ((x - 140) ** 2 + (y - 140) ** 2 < 15 ** 2) return false;
            return true;
        })
    },
    star: {
        holes: 0, make: () => {
            const cx = 100, cy = 100, R = 85, r = 35;
            return makeGrid(200, 200, (x, y) => {
                const dx = x - cx, dy = y - cy;
                const d = Math.hypot(dx, dy);
                if (d > R) return false;
                const a = Math.atan2(dy, dx) + Math.PI / 2;
                const seg = Math.PI * 2 / 5;
                const mid = Math.floor(((a + seg / 2) % (Math.PI * 2)) / seg) * seg;
                const off = Math.abs(((a - mid + Math.PI * 2) % seg) - seg / 2);
                return d <= Math.min(R, r / Math.cos(Math.PI / 5 - off));
            });
        }
    },
    thinArms: {
        holes: 0, make: () => makeGrid(200, 200, (x, y) => {
            if (Math.abs(x - 100) < 4 && y > 20 && y < 180) return true;
            if (Math.abs(y - 100) < 4 && x > 20 && x < 180) return true;
            return false;
        })
    },
    hairLine: { holes: 0, make: () => makeGrid(200, 200, (x, y) => y === 100 && x > 40 && x < 160) },
    twoBoxes: {
        holes: 0, make: () => makeGrid(200, 200, (x, y) =>
            (x > 20 && x < 80 && y > 20 && y < 80) || (x > 120 && x < 180 && y > 120 && y < 180))
    },
    comb: {
        holes: 0, make: () => makeGrid(200, 200, (x, y) => {
            if (y >= 40 && y < 70 && x > 20 && x < 180) return true;
            if (y >= 70 && y < 160 && x > 20 && x < 180 && (x - 20) % 24 < 12) return true;
            return false;
        })
    },
    cShape: {
        holes: 0, make: () => makeGrid(200, 200, (x, y) => {
            const inOuter = x > 30 && x < 170 && y > 30 && y < 170;
            const inInner = x > 80 && x < 170 && y > 70 && y < 130;
            return inOuter && !inInner;
        })
    },
    // 带孔的方块，孔壁很薄 —— 考验孔与外轮廓是否粘连
    thinWallRing: {
        holes: 1, make: () => makeGrid(200, 200, (x, y) => {
            if (x < 30 || x > 170 || y < 30 || y > 170) return false;
            return x < 38 || x > 162 || y < 38 || y > 162;
        })
    },
    // 大图压力场景：1000x1000，多形状 + 孔洞 + 细长结构 + 锯齿边缘
    bigScene: {
        holes: 3, make: () => makeGrid(1000, 1000, (x, y) => {
            // 大圆盘带两个孔
            const d2 = (x - 300) ** 2 + (y - 300) ** 2;
            if (d2 < 240 ** 2) {
                if (d2 < 90 ** 2) return false;
                if ((x - 300) ** 2 + (y - 170) ** 2 < 45 ** 2) return false;
                return true;
            }
            // 锯齿条带
            if (y > 600 && y < 620 + ((x % 40 < 20) ? 120 : 0) && x > 100 && x < 900) return true;
            // 带孔的方块
            if (x > 620 && x < 900 && y > 620 && y < 900) {
                if (x > 700 && x < 820 && y > 700 && y < 820) return false;
                return true;
            }
            // 细长对角线
            if (Math.abs((x - 100) - (y - 100)) < 5 && x > 100 && x < 500) return true;
            return false;
        })
    },
};

// ---------- 几何检查工具 ----------
function orient(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}
function segIntersect(p1, p2, p3, p4) {
    const d1 = orient(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
    const d2 = orient(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
    const d3 = orient(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    const d4 = orient(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function countSelfIntersections(pts) {
    const n = pts.length;
    if (n < 4) return 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
        const a1 = pts[i], a2 = pts[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
            if (segIntersect(a1, a2, pts[j], pts[(j + 1) % n])) c++;
        }
    }
    return c;
}
function signedArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
}
// 期望孔洞数 = 与图框不连通的背景连通域个数（4-连通，与 findPolygons 的洪泛口径一致）
function expectedHoleCount(grid, w, h) {
    const label = new Uint8Array(w * h);
    const floodFrom = (starts) => {
        const st = starts.slice();
        while (st.length) {
            const i = st.pop();
            const x = i % w, y = (i / w) | 0;
            const visit = (nx, ny) => {
                const k = ny * w + nx;
                if (grid[k] === 0 && label[k] === 0) { label[k] = 1; st.push(k); }
            };
            if (x > 0) visit(x - 1, y);
            if (x < w - 1) visit(x + 1, y);
            if (y > 0) visit(x, y - 1);
            if (y < h - 1) visit(x, y + 1);
        }
    };

    const starts = [];
    const add = (x, y) => {
        const i = y * w + x;
        if (grid[i] === 0 && label[i] === 0) { label[i] = 1; starts.push(i); }
    };
    for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
    for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
    floodFrom(starts);

    let holes = 0;
    for (let i = 0; i < w * h; i++) {
        if (grid[i] !== 0 || label[i] !== 0) continue;
        holes++;
        label[i] = 1;
        floodFrom([i]);
    }
    return holes;
}

function ringPerimeter(ring) {
    let p = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        p += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return p;
}

// ---------- 管线复现 (与 processContoursAsync 一致) ----------
function runPipeline(binary, tolerance) {
    const polygons = ImageProcessor.findPolygons(binary);
    const meshes = [];
    const report = {
        polys: polygons.length,
        holes: polygons.reduce((s, p) => s + p.holes.length, 0),
        kept: 0, selfInt: 0, degenerate: 0, coverage: [],
        topLengths: polygons.map(p => p.outer.length).sort((a, b) => b - a).slice(0, 6),
    };

    for (const poly of polygons) {
        let perimeter = ringPerimeter(poly.outer);
        for (const h of poly.holes) perimeter += ringPerimeter(h);
        if (!(perimeter > 20 && poly.outer.length > 5)) continue;

        let safeTol = tolerance;
        if (poly.outer.length > 3000 && safeTol < 1.0) safeTol = 1.0;
        if (poly.outer.length > 10000 && safeTol < 3.0) safeTol = 3.0;

        // 走与 processContoursAsync 完全相同的构建路径（含覆盖率校验重试）
        const built = buildPolygonMesh(poly.outer, poly.holes, safeTol);
        if (!built) continue;
        const vertices = built.vertices;
        const rings = built.rings;
        const holes = [];
        {
            let start = rings[0];
            for (let r = 1; r < rings.length; r++) {
                holes.push(vertices.slice(start, start + rings[r]));
                start += rings[r];
            }
        }
        report.kept++;
        report.selfInt += countSelfIntersections(vertices.slice(0, rings[0]));
        for (const h of holes) report.selfInt += countSelfIntersections(h);

        const rawIndices = built.indices;
        const optIndices = optimizeMeshTopology(vertices, rawIndices.slice(), 6);

        const stat = (inds) => {
            let triSum = 0, triAbs = 0, degen = 0;
            for (let i = 0; i < inds.length; i += 3) {
                const a = vertices[inds[i]], b = vertices[inds[i + 1]], c = vertices[inds[i + 2]];
                if (!a || !b || !c) { degen++; continue; }
                const ar = orient(a.x, a.y, b.x, b.y, c.x, c.y) / 2;
                if (Math.abs(ar) < 1e-9) { degen++; continue; }
                triSum += ar; triAbs += Math.abs(ar);
            }
            return { triSum, triAbs, degen };
        };
        const before = stat(rawIndices);
        const after = stat(optIndices);

        // 期望净面积 = |外轮廓| - Σ|孔|
        const expected = polygonNetArea(vertices, rings);

        report.degenerate += after.degen;
        report.coverage.push({
            outerPts: poly.outer.length,
            simplifiedPts: vertices.length,
            holes: holes.length,
            tris: optIndices.length / 3,
            expected: Math.round(expected),
            earcutRatio: expected > 0 ? +(before.triAbs / expected).toFixed(4) : 0,
            optRatio: expected > 0 ? +(after.triAbs / expected).toFixed(4) : 0,
            overlap: after.triAbs > 0 ? +((after.triAbs - Math.abs(after.triSum)) / after.triAbs).toFixed(4) : 0,
        });
        meshes.push({ vertices, indices: optIndices });
    }
    return { report, meshes };
}

// ---------- 主流程 ----------
// precision 滑块 1 / 20 / 60 / 200 -> px；可用 IM2M_TOL 环境变量覆盖，例如 IM2M_TOL=0.1,0.5,1
const tolerances = process.env.IM2M_TOL
    ? process.env.IM2M_TOL.split(',').map(Number)
    : [0.1, 2.0, 6.0, 20.0];
let failures = 0;

for (const [name, def] of Object.entries(shapes)) {
    const binary = def.make();
    let fg = 0;
    for (let i = 0; i < binary.grid.length; i++) fg += binary.grid[i];
    const wantHoles = expectedHoleCount(binary.grid, binary.width, binary.height);
    // 8-邻域轮廓追踪对「对角接触」的判定与 4-连通不同，允许 ±0 的严格比对，
    // 但对已知有对角接触的图形退化为「不变差」比对
    const holeTol = Math.max(def.holes ?? 0, 0);
    console.log(`\n=== ${name} === (前景像素 ${fg}, 连通域算出孔洞 ${wantHoles})`);

    for (const tol of tolerances) {
        const t0 = performance.now();
        const { report, meshes } = runPipeline(binary, tol);
        const elapsed = Math.round(performance.now() - t0);
        const badCoverage = report.coverage.filter(c => c.optRatio < 0.98 || c.optRatio > 1.02).length;
        const badEarcut = report.coverage.filter(c => c.earcutRatio < 0.98 || c.earcutRatio > 1.02).length;
        const overlap = report.coverage.filter(c => c.overlap > 0.02).length;
        const holeOK = report.holes === wantHoles;
        const bad = report.selfInt > 0 || badCoverage > 0 || overlap > 0 || report.degenerate > 0
            || (tol === tolerances[0] && !holeOK);
        if (bad) failures++;
        console.log(`${bad ? '❌' : '✅'} tol=${String(tol).padStart(4)}px  多边形 ${report.polys}  孔洞 ${report.holes}` +
            `${holeOK ? '' : `(期望 ${wantHoles})`}  保留 ${report.kept}  自交 ${report.selfInt}  退化 ${report.degenerate}  ` +
            `覆盖率 ${report.coverage.map(c => c.optRatio).join('/')}  重叠 ${overlap}  三角 ${meshes.reduce((s, m) => s + m.indices.length / 3, 0)}  ${elapsed}ms`);
        if (tol === tolerances[0]) console.log(`      轮廓长度 top6: [${report.topLengths.join(', ')}]`);
        for (const c of report.coverage) {
            if (c.optRatio < 0.98 || c.optRatio > 1.02 || c.overlap > 0.02) {
                console.log(`      ↳ pts ${c.outerPts}->${c.simplifiedPts}  孔 ${c.holes}  期望面积 ${c.expected}  ` +
                    `earcut ${c.earcutRatio} → 优化后 ${c.optRatio}  重叠 ${c.overlap}`);
            }
        }
    }
}

console.log(`\n${failures > 0 ? `❌ ${failures} 个用例存在问题` : '✅ 全部通过'}`);
process.exit(failures > 0 ? 1 : 0);
