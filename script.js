// --- 核心算法 1: Earcut (基础三角化) ---
const earcut=(function(){function earcut(data,holeIndices,dim){dim=dim||2;var hasHoles=holeIndices&&holeIndices.length,outerLen=hasHoles?holeIndices[0]*dim:data.length,outerNode=linkedList(data,0,outerLen,dim,true),triangles=[];if(!outerNode||outerNode.prev===outerNode)return triangles;var minX,minY,maxX,maxY,x,y,invSize;if(hasHoles)outerNode=eliminateHoles(data,holeIndices,outerNode,dim);if(data.length>80*dim){minX=maxX=data[0];minY=maxY=data[1];for(var i=dim;i<outerLen;i+=dim){x=data[i];y=data[i+1];if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}invSize=Math.max(maxX-minX,maxY-minY);invSize=invSize!==0?1/invSize:0;}earcutLinked(outerNode,triangles,dim,minX,minY,invSize);return triangles;}function linkedList(data,start,end,dim,clockwise){var i,last;if(clockwise===(signedArea(data,start,end,dim)>0)){for(i=start;i<end;i+=dim)last=insertNode(i,data[i],data[i+1],last);}else{for(i=end-dim;i>=start;i-=dim)last=insertNode(i,data[i],data[i+1],last);}if(last&&equals(last,last.next)){removeNode(last);last=last.next;}return last;}function filterPoints(start,end){if(!start)return start;if(!end)end=start;var p=start,again;do{again=false;if(!p.steiner&&(equals(p,p.next)||area(p.prev,p,p.next)===0)){removeNode(p);p=end=p.prev;if(p===p.next)break;again=true;}else{p=p.next;}}while(again||p!==end);return end;}function earcutLinked(ear,triangles,dim,minX,minY,invSize,pass){if(!ear)return;if(!pass&&invSize)indexCurve(ear,minX,minY,invSize);var stop=ear,prev,next;while(ear.prev!==ear.next){prev=ear.prev;next=ear.next;if(invSize?isEarHashed(ear,minX,minY,invSize):isEar(ear)){triangles.push(prev.i/dim);triangles.push(ear.i/dim);triangles.push(next.i/dim);removeNode(ear);ear=next.next;stop=next.next;continue;}ear=next;if(ear===stop){if(!pass){earcutLinked(filterPoints(ear),triangles,dim,minX,minY,invSize,1);}else if(pass===1){earcutLinked(cureLocalIntersections(filterPoints(ear),triangles,dim),triangles,dim,minX,minY,invSize,2);}else if(pass===2){splitEarcut(ear,triangles,dim,minX,minY,invSize);}break;}}}function isEar(ear){var a=ear.prev,b=ear,c=ear.next;if(area(a,b,c)>=0)return false;var p=ear.next.next;while(p!==ear.prev){if(pointInTriangle(a.x,a.y,b.x,b.y,c.x,c.y,p.x,p.y)&&area(p.prev,p,p.next)>=0)return false;p=p.next;}return true;}function isEarHashed(ear,minX,minY,invSize){var a=ear.prev,b=ear,c=ear.next;if(area(a,b,c)>=0)return false;var minTX=a.x<b.x?(a.x<c.x?a.x:c.x):(b.x<c.x?b.x:c.x),minTY=a.y<b.y?(a.y<c.y?a.y:c.y):(b.y<c.y?b.y:c.y),maxTX=a.x>b.x?(a.x>c.x?a.x:c.x):(b.x>c.x?b.x:c.x),maxTY=a.y>b.y?(a.y>c.y?a.y:c.y):(b.y<c.y?b.y:c.y);var minZ=zOrder(minTX,minTY,minX,minY,invSize),maxZ=zOrder(maxTX,maxTY,minX,minY,invSize);var p=ear.prevZ,n=ear.nextZ;while(p&&p.z>=minZ&&n&&n.z<=maxZ){if(p!==ear.prev&&p!==ear.next&&pointInTriangle(a.x,a.y,b.x,b.y,c.x,c.y,p.x,p.y)&&area(p.prev,p,p.next)>=0)return false;p=p.prevZ;if(n!==ear.prev&&n!==ear.next&&pointInTriangle(a.x,a.y,b.x,b.y,c.x,c.y,n.x,n.y)&&area(n.prev,n,n.next)>=0)return false;n=n.nextZ;}while(p&&p.z>=minZ){if(p!==ear.prev&&p!==ear.next&&pointInTriangle(a.x,a.y,b.x,b.y,c.x,c.y,p.x,p.y)&&area(p.prev,p,p.next)>=0)return false;p=p.prevZ;}while(n&&n.z<=maxZ){if(n!==ear.prev&&n!==ear.next&&pointInTriangle(a.x,a.y,b.x,b.y,c.x,c.y,n.x,n.y)&&area(n.prev,n,n.next)>=0)return false;n=n.nextZ;}return true;}function cureLocalIntersections(start,triangles,dim){var p=start;do{var a=p.prev,b=p.next.next;if(!equals(a,b)&&intersects(a,p,p.next,b)&&locallyInside(a,b)&&locallyInside(b,a)){triangles.push(a.i/dim);triangles.push(p.i/dim);triangles.push(b.i/dim);removeNode(p);removeNode(p.next);p=start=b;}p=p.next;}while(p!==start);return filterPoints(p);}function splitEarcut(start,triangles,dim,minX,minY,invSize){var a=start;do{var b=a.next.next;while(b!==a.prev){if(a.i!==b.i&&isValidDiagonal(a,b)){var c=splitPolygon(a,b);a=filterPoints(a,a.next);c=filterPoints(c,c.next);earcutLinked(a,triangles,dim,minX,minY,invSize);earcutLinked(c,triangles,dim,minX,minY,invSize);return;}b=b.next;}a=a.next;}while(a!==start);}function eliminateHoles(data,holeIndices,outerNode,dim){var queue=[],i,len,start,end,list;for(i=0,len=holeIndices.length;i<len;i++){start=holeIndices[i]*dim;end=i<len-1?holeIndices[i+1]*dim:data.length;list=linkedList(data,start,end,dim,false);if(list===list.next)list.steiner=true;queue.push(getLeftmost(list));}queue.sort(compareX);for(i=0;i<queue.length;i++){eliminateHole(queue[i],outerNode);outerNode=filterPoints(outerNode,outerNode.next);}return outerNode;}function eliminateHole(hole,outerNode){var bridge=findHoleBridge(hole,outerNode);if(bridge){var bridgeReverse=splitPolygon(bridge,hole);filterPoints(bridgeReverse,bridgeReverse.next);filterPoints(bridge,bridge.next);}}function findHoleBridge(hole,outerNode){var p=outerNode,hx=hole.x,hy=hole.y,qx=-Infinity,m;do{if(hy<=p.y&&hy>=p.next.y&&p.next.y!==p.y){var x=p.x+(hy-p.y)*(p.next.x-p.x)/(p.next.y-p.y);if(x<=hx&&x>qx){qx=x;if(x===hx&&hy===p.y)return p;m=p;}}p=p.next;}while(p!==outerNode);if(!m)return null;if(hole.x===m.x)return m;var stop=m,mx=m.x,my=m.y,tanMin=Infinity,tan;p=m;do{if(hx>=p.x&&p.x>=mx&&hx!==p.x&&pointInTriangle(hy<my?hx:qx,hy,mx,my,hy<my?qx:hx,hy,p.x,p.y)){tan=Math.abs(hy-p.y)/(hx-p.x);if(locallyInside(p,hole)&&(tan<tanMin||(tan===tanMin&&(p.x>m.x||(p.x===m.x&&sectorContainsSector(m,p)))))){m=p;tanMin=tan;}}p=p.next;}while(p!==stop);return m;}function indexCurve(start,minX,minY,invSize){var p=start;do{if(p.z===null)p.z=zOrder(p.x,p.y,minX,minY,invSize);p.prevZ=p.prev;p.nextZ=p.next;p=p.next;}while(p!==start);p.prevZ.nextZ=null;p.prevZ=null;sortLinked(p);}function sortLinked(list){var i,p,q,e,tail,numMerges,pSize,qSize,inSize=1;do{p=list;list=null;tail=null;numMerges=0;while(p){numMerges++;q=p;pSize=0;for(i=0;i<inSize;i++){pSize++;q=q.nextZ;if(!q)break;}qSize=inSize;while(pSize>0||(qSize>0&&q)){if(pSize===0){e=q;q=q.nextZ;qSize--;}else if(qSize===0||!q){e=p;p=p.nextZ;pSize--;}else if(p.z<=q.z){e=p;p=p.nextZ;pSize--;}else{e=q;q=q.nextZ;qSize--;}if(tail)tail.nextZ=e;else list=e;e.prevZ=tail;tail=e;}p=q;}tail.nextZ=null;inSize*=2;}while(numMerges>1);return list;}function zOrder(x,y,minX,minY,invSize){x=32767*(x-minX)*invSize;y=32767*(y-minY)*invSize;x=(x|(x<<8))&0x00FF00FF;x=(x|(x<<4))&0x0F0F0F0F;x=(x|(x<<2))&0x33333333;x=(x|(x<<1))&0x55555555;y=(y|(y<<8))&0x00FF00FF;y=(y|(y<<4))&0x0F0F0F0F;y=(y|(y<<2))&0x33333333;y=(y|(y<<1))&0x55555555;return x|(y<<1);}function getLeftmost(start){var p=start,leftmost=start;do{if(p.x<leftmost.x||(p.x===leftmost.x&&p.y<leftmost.y))leftmost=p;p=p.next;}while(p!==start);return leftmost;}function pointInTriangle(ax,ay,bx,by,cx,cy,px,py){return(cx-px)*(ay-py)-(ax-px)*(cy-py)>=0&&(ax-px)*(by-py)-(bx-px)*(ay-py)>=0&&(bx-px)*(cy-py)-(cx-px)*(by-py)>=0;}function isValidDiagonal(a,b){return a.next.i!==b.i&&a.prev.i!==b.i&&!intersectsPolygon(a,b)&&(locallyInside(a,b)&&locallyInside(b,a)&&middleInside(a,b)&&(area(a.prev,a,b.prev)||area(a,b.prev,b))||equals(a,b)&&area(a.prev,a,a.next)>0&&area(b.prev,b,b.next)>0);}function area(p,q,r){return(q.y-p.y)*(r.x-q.x)-(q.x-p.x)*(r.y-q.y);}function equals(p1,p2){return p1.x===p2.x&&p1.y===p2.y;}function intersects(p1,q1,p2,q2){var o1=sign(area(p1,q1,p2)),o2=sign(area(p1,q1,q2)),o3=sign(area(p2,q2,p1)),o4=sign(area(p2,q2,q1));if(o1!==o2&&o3!==o4)return true;return false;}function intersectsPolygon(a,b){var p=a;do{if(p.i!==a.i&&p.next.i!==a.i&&p.i!==b.i&&p.next.i!==b.i&&intersects(p,p.next,a,b))return true;p=p.next;}while(p!==a);return false;}function locallyInside(a,b){return area(a.prev,a,a.next)<0?area(a,b,a.next)>=0&&area(a,a.prev,b)>=0:area(a,b,a.prev)<0||area(a,a.next,b)<0;}function middleInside(a,b){var p=a,inside=false,px=(a.x+b.x)/2,py=(a.y+b.y)/2;do{if(((p.y>py)!==(p.next.y>py))&&p.next.y!==p.y&&(px<(p.next.x-p.x)*(py-p.y)/(p.next.y-p.y)+p.x))inside=!inside;p=p.next;}while(p!==a);return inside;}function splitPolygon(a,b){var a2=new Node(a.i,a.x,a.y),b2=new Node(b.i,b.x,b.y),an=a.next,bp=b.prev;a.next=b;b.prev=a;a2.next=an;an.prev=a2;b2.next=a2;a2.prev=b2;bp.next=b2;b2.prev=bp;return b2;}function insertNode(i,x,y,last){var p=new Node(i,x,y);if(!last){p.prev=p;p.next=p;}else{p.next=last.next;p.prev=last;last.next.prev=p;last.next=p;}return p;}function removeNode(p){p.next.prev=p.prev;p.prev.next=p.next;if(p.prevZ)p.prevZ.nextZ=p.nextZ;if(p.nextZ)p.nextZ.prevZ=p.prevZ;}function Node(i,x,y){this.i=i;this.x=x;this.y=y;this.prev=null;this.next=null;this.z=null;this.prevZ=null;this.nextZ=null;this.steiner=false;}function sign(num){return num>0?1:num<0?-1:0;}function signedArea(data,start,end,dim){var sum=0,j=end-dim;for(var i=start;i<end;i+=dim){sum+=(data[j]-data[i])*(data[i+1]+data[j+1]);j=i;}return sum;}function compareX(a,b){return a.x-b.x;}return earcut;})();

// --- 核心算法 2: 迭代式 RDP ---
function simplifyPoints(points, tolerance) {
    if (points.length <= 2) return points;
    const sqTolerance = tolerance * tolerance;
    const len = points.length;
    const markers = new Uint8Array(len);
    markers[0] = 1; markers[len - 1] = 1;
    const stack = [0, len - 1];
    while (stack.length > 0) {
        const last = stack.pop(), first = stack.pop();
        let maxSqDist = 0, index = -1;
        let x1 = points[first].x, y1 = points[first].y, x2 = points[last].x, y2 = points[last].y;
        let dx = x2 - x1, dy = y2 - y1, segLenSq = dx * dx + dy * dy;
        if (segLenSq === 0) {
             for (let i = first + 1; i < last; i++) {
                let d = (points[i].x - x1)**2 + (points[i].y - y1)**2;
                if (d > maxSqDist) { index = i; maxSqDist = d; }
             }
        } else {
            for (let i = first + 1; i < last; i++) {
                let px = points[i].x, py = points[i].y;
                let t = ((px - x1) * dx + (py - y1) * dy) / segLenSq;
                let cx = (t <= 0) ? x1 : (t >= 1 ? x2 : x1 + t * dx);
                let cy = (t <= 0) ? y1 : (t >= 1 ? y2 : y1 + t * dy);
                let d = (px - cx)**2 + (py - cy)**2;
                if (d > maxSqDist) { index = i; maxSqDist = d; }
            }
        }
        if (maxSqDist > sqTolerance) { markers[index] = 1; stack.push(index, last, first, index); }
    }
    const newPoints = [];
    for (let i = 0; i < len; i++) if (markers[i]) newPoints.push(points[i]);
    return newPoints;
}

// --- 核心算法 3: 轮廓清洗 (防止重叠点 & 共线点) ---
function cleanContour(points, minDistance = 1.0) {
    if (points.length < 3) return points;
    let clean = [];
    const distSq = minDistance * minDistance;

    // 1. 距离过滤
    clean.push(points[0]);
    for (let i = 1; i < points.length; i++) {
        const last = clean[clean.length - 1];
        const curr = points[i];
        const d = (curr.x - last.x) ** 2 + (curr.y - last.y) ** 2;
        if (d >= distSq) {
            clean.push(curr);
        }
    }
    // 闭合检查
    if (clean.length > 2) {
        const first = clean[0];
        const last = clean[clean.length - 1];
        if ((first.x - last.x) ** 2 + (first.y - last.y) ** 2 < distSq) {
            clean.pop();
        }
    }
    
    // 2. 共线过滤 (移除对形状贡献极小的中间点)
    if (clean.length > 2) {
        const finalPass = [];
        finalPass.push(clean[0]);
        for(let i=1; i<clean.length-1; i++) {
            const prev = clean[i-1];
            const curr = clean[i];
            const next = clean[i+1];
            // 计算三角形面积，如果非常小则共线
            const area = Math.abs((curr.x - prev.x)*(next.y - prev.y) - (curr.y - prev.y)*(next.x - prev.x));
            if (area > 0.5) { // 阈值，面积大于0.5才保留
                finalPass.push(curr);
            }
        }
        finalPass.push(clean[clean.length-1]);
        clean = finalPass;
    }

    return clean;
}

// --- 核心算法 4: 终极拓扑优化 (严格凸性检测) ---
// 彻底解决交叉问题：放弃相交检测，使用 4-Corner 凸性检测
function optimizeMeshTopology(vertices, indices, iterations = 8) {
    // 2D 叉积 (有向面积)
    function orient2d(ax, ay, bx, by, cx, cy) {
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }

    // Delaunay 条件 (点 D 是否在 ABC 外接圆内)
    function inCircle(a, b, c, d) {
        const ax = a.x - d.x, ay = a.y - d.y;
        const bx = b.x - d.x, by = b.y - d.y;
        const cx = c.x - d.x, cy = c.y - d.y;
        return (
            (ax * ax + ay * ay) * (bx * cy - cx * by) -
            (bx * bx + by * by) * (ax * cy - cx * ay) +
            (cx * cx + cy * cy) * (ax * by - bx * ay)
        ) > 1e-9; 
    }

    // 检查四边形 ABCD 是否严格凸 (Strictly Convex)
    // 只有严格凸四边形，对角线翻转才是几何安全的
    function isStrictlyConvex(a, b, c, d) {
        // 假设顺序是 (a, b, c) 和 (a, c, d) 组成的四边形 a-b-c-d
        // 需要检查四个角的转向是否一致 (全部 > 0)
        // 注意传入顺序：A, B, C, D 必须是逆时针排列的四边形顶点
        
        // 三角形 T1: A, B, C. T2: A, C, D. 
        // 实际四边形顶点顺序是 A -> B -> C -> D
        
        const cp1 = orient2d(a.x, a.y, b.x, b.y, c.x, c.y); // B 在 AC 左侧?
        const cp2 = orient2d(b.x, b.y, c.x, c.y, d.x, d.y); // C 在 BD 左侧?
        const cp3 = orient2d(c.x, c.y, d.x, d.y, a.x, a.y); // D 在 CA 左侧?
        const cp4 = orient2d(d.x, d.y, a.x, a.y, b.x, b.y); // A 在 DB 左侧?
        
        // 所有叉积必须同号且非零 (严格凸)
        // 这里的逻辑假设了特定的绕序，我们简化为：对角线必须完全在内部
        // 更简单的判定：新的对角线 BD 与 AC 必须有严格的物理相交
        
        // 回归物理相交检测，但这次不仅检测对角线，还检测是否退化
        return segmentsIntersectStrict(a, c, b, d);
    }
    
    // 严格线段相交 (跨立实验) - 用于判定是否为凸四边形
    function segmentsIntersectStrict(a, b, c, d) {
        const cp1 = orient2d(a.x, a.y, b.x, b.y, c.x, c.y);
        const cp2 = orient2d(a.x, a.y, b.x, b.y, d.x, d.y);
        const cp3 = orient2d(c.x, c.y, d.x, d.y, a.x, a.y);
        const cp4 = orient2d(c.x, c.y, d.x, d.y, b.x, b.y);
        // 必须严格跨立 (乘积 < 0)
        return (cp1 * cp2 < -1e-9) && (cp3 * cp4 < -1e-9);
    }

    for (let iter = 0; iter < iterations; iter++) {
        let flipped = false;
        const edgeMap = new Map();

        // 构建边索引
        for (let i = 0; i < indices.length; i += 3) {
            for (let j = 0; j < 3; j++) {
                const v1 = indices[i + j];
                const v2 = indices[i + (j + 1) % 3];
                const key = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
                if (!edgeMap.has(key)) edgeMap.set(key, []);
                edgeMap.get(key).push({ triIdx: i, localIdx: j });
            }
        }

        // 遍历所有内部共享边
        for (const [key, shared] of edgeMap) {
            if (shared.length !== 2) continue;

            const t1Base = shared[0].triIdx;
            const t2Base = shared[1].triIdx;
            const t1Local = shared[0].localIdx;
            
            // T1 顶点: A, B, C (BC 是共享边)
            const iA = indices[t1Base + (t1Local + 2) % 3];
            const iB = indices[t1Base + t1Local];
            const iC = indices[t1Base + (t1Local + 1) % 3];

            // T2 顶点: D (相对顶点)
            let iD = -1;
            for (let k = 0; k < 3; k++) {
                const idx = indices[t2Base + k];
                if (idx !== iB && idx !== iC) { iD = idx; break; }
            }
            if (iD === -1) continue;

            const A = vertices[iA], B = vertices[iB], C = vertices[iC], D = vertices[iD];

            // --- 核心修复 ---
            // 判定：四边形 ABDC 是否是严格凸四边形？
            // 判定方法：原对角线 BC 与 潜在对角线 AD 必须严格相交。
            // 只有相交，四边形才是凸的，翻转才不会产生重叠。
            if (!segmentsIntersectStrict(B, C, A, D)) continue;

            // --- 优化目标: Delaunay ---
            // 如果点 D 在三角形 ABC 的外接圆内，则翻转能优化角度
            if (inCircle(A, B, C, D)) {
                indices[t1Base] = iA; indices[t1Base + 1] = iB; indices[t1Base + 2] = iD;
                indices[t2Base] = iA; indices[t2Base + 1] = iD; indices[t2Base + 2] = iC;
                flipped = true;
            }
        }
        if (!flipped) break;
    }
    return indices;
}

const ImageProcessor = {
    threshold: function(imageData, threshold, keyColor, colorTolerance) {
        const width = imageData.width, height = imageData.height, data = imageData.data;
        const grid = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const r = data[i*4], g = data[i*4+1], b = data[i*4+2], a = data[i*4+3];
            let isBackground = false;
            if (keyColor) {
                const dist = Math.sqrt((r-keyColor[0])**2 + (g-keyColor[1])**2 + (b-keyColor[2])**2);
                isBackground = dist <= colorTolerance; 
            } else {
                isBackground = a <= threshold;
            }
            grid[i] = isBackground ? 0 : 1; 
        }
        return { grid, width, height };
    },
    dilate: function(binaryImg, radius) {
        if (radius <= 0) return binaryImg;
        const { grid, width, height } = binaryImg;
        const newGrid = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y * width + x] === 1) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const ny = y + dy, nx = x + dx;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) newGrid[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }
        return { grid: newGrid, width, height };
    },
    findContours: function(binaryImg) {
        const { grid, width, height } = binaryImg;
        const paddedW = width + 2, paddedH = height + 2;
        const paddedGrid = new Uint8Array(paddedW * paddedH);
        for(let y=0; y<height; y++) for(let x=0; x<width; x++) if(grid[y*width+x]===1) paddedGrid[(y+1)*paddedW+(x+1)]=1;
        const queue = [0]; paddedGrid[0] = 2;
        while(queue.length > 0) {
            const idx = queue.pop();
            const dirs = [-1, 1, -paddedW, paddedW];
            for(let d of dirs) {
                const nIdx = idx + d;
                if(nIdx>=0 && nIdx<paddedGrid.length && paddedGrid[nIdx]===0) {
                    paddedGrid[nIdx]=2; queue.push(nIdx);
                }
            }
        }
        const contours = [];
        const visited = new Uint8Array(paddedW * paddedH);
        for (let y = 1; y < paddedH - 1; y++) {
            for (let x = 1; x < paddedW - 1; x++) {
                const idx = y * paddedW + x;
                if (paddedGrid[idx] === 1 && paddedGrid[idx - 1] === 2 && visited[idx] === 0) {
                    const contour = ImageProcessor.traceContour(paddedGrid, visited, x, y, paddedW, paddedH);
                    if (contour.length > 0) contours.push(contour.map(p => ({x: p.x - 1, y: p.y - 1})));
                }
            }
        }
        return contours;
    },
    traceContour: function(grid, visited, startX, startY, w, h) {
        const contour = [];
        let cx = startX, cy = startY;
        const dirs = [{x:0, y:-1}, {x:1, y:-1}, {x:1, y:0}, {x:1, y:1}, {x:0, y:1}, {x:-1, y:1}, {x:-1, y:0}, {x:-1, y:-1}];
        let dirIdx = 6;
        let loops = 0; const maxLoops = w * h * 2;
        do {
            contour.push({x: cx, y: cy});
            visited[cy * w + cx] = 1;
            let found = false;
            const startDir = (dirIdx + 6) % 8;
            for (let i = 0; i < 8; i++) {
                const idx = (startDir + i) % 8;
                const nx = cx + dirs[idx].x, ny = cy + dirs[idx].y;
                if (grid[ny * w + nx] === 1) {
                    cx = nx; cy = ny; dirIdx = idx; found = true; break;
                }
            }
            if (!found) break;
            loops++;
        } while ((cx !== startX || cy !== startY) && loops < maxLoops);
        return contour;
    }
};

// --- 应用状态 ---
let originalImage = null;
let processedMeshes = [];
let previewMask = null; 
let scale = 1.0, offsetX = 0, offsetY = 0, isDragging = false, lastMousePos = {x:0,y:0};
let keyColor = null;
let thresholdState = { alpha: 50, color: 30 };
let appMode = 'mask'; // 'mask' 或 'mesh'
let meshGenerationCancel = false;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('statusBar');
const polyCountDisplay = document.getElementById('polyCount');
const modeBadge = document.getElementById('modeBadge');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function resizeCanvas() {
    canvas.width = document.getElementById('mainView').clientWidth;
    canvas.height = document.getElementById('mainView').clientHeight;
    if (originalImage) requestAnimationFrame(draw);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    statusBar.innerText = "正在读取图片...";
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImage = img;
            scale = Math.min((canvas.width * 0.8) / img.width, (canvas.height * 0.8) / img.height);
            offsetX = (canvas.width - img.width * scale) / 2;
            offsetY = (canvas.height - img.height * scale) / 2;
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('generateBtn').disabled = false;
            
            const maxDimension = Math.max(img.width, img.height);
            let autoPrecision = 20; 
            if (maxDimension > 4000) autoPrecision = 120;
            else if (maxDimension > 2000) autoPrecision = 80; 
            else if (maxDimension > 1000) autoPrecision = 40; 
            document.getElementById('precision').value = autoPrecision;
            document.getElementById('val-precision').innerText = (autoPrecision * 0.1).toFixed(1) + "px";
            
            detectTransparencyAndSwitch(img);
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function detectTransparencyAndSwitch(img) {
    const tc = document.createElement('canvas'); tc.width = img.width; tc.height = img.height;
    tc.getContext('2d').drawImage(img, 0, 0);
    const data = tc.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) { hasTransparency = true; break; }
    }
    const colorPickerMode = document.getElementById('colorPickerMode');
    if (!hasTransparency) {
        colorPickerMode.checked = true;
        statusBar.innerText = "无透明通道 -> 已切至吸色模式";
    } else {
        colorPickerMode.checked = false;
        statusBar.innerText = "检测到透明 -> Alpha模式";
    }
    toggleColorPicker();
    updateMaskPreview();
}

function setAppMode(mode) {
    appMode = mode;
    modeBadge.classList.remove('hidden', 'mode-mask', 'mode-mesh');
    if (mode === 'mask') {
        modeBadge.innerText = "预览遮罩 (Preview)";
        modeBadge.classList.add('mode-mask');
        document.getElementById('exportBtn').disabled = true;
        document.getElementById('generateBtn').classList.remove('secondary');
        document.getElementById('generateBtn').innerText = "▶ 生成网格";
    } else {
        modeBadge.innerText = "网格视图 (Mesh)";
        modeBadge.classList.add('mode-mesh');
        document.getElementById('exportBtn').disabled = false;
        document.getElementById('generateBtn').classList.add('secondary');
        document.getElementById('generateBtn').innerText = "↻ 重新生成";
    }
    requestAnimationFrame(draw);
}

function updateMaskPreview() {
    if (!originalImage) return;
    
    ['commonThreshold', 'expansion'].forEach(id => {
        document.getElementById('val-'+id).innerText = document.getElementById(id).value;
    });

    setAppMode('mask');
    processedMeshes = [];

    const commonVal = parseInt(document.getElementById('commonThreshold').value);
    const expansionVal = parseInt(document.getElementById('expansion').value);
    let threshVal, tolerance;
    if (keyColor) {
        threshVal = 0; tolerance = commonVal * 1.5; 
        thresholdState.color = commonVal;
    } else {
        threshVal = commonVal * 2.55; tolerance = 0;
        thresholdState.alpha = commonVal;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(originalImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    let binary = ImageProcessor.threshold(imageData, threshVal, keyColor, tolerance);
    if (expansionVal > 0) binary = ImageProcessor.dilate(binary, expansionVal);

    const maskData = new ImageData(binary.width, binary.height);
    const buf = maskData.data;
    for (let i = 0; i < binary.width * binary.height; i++) {
        buf[i*4] = 255;   // R
        buf[i*4+1] = 0;   // G
        buf[i*4+2] = 0;   // B
        buf[i*4+3] = binary.grid[i] ? 100 : 0; // Alpha
    }
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = binary.width;
    maskCanvas.height = binary.height;
    maskCanvas.getContext('2d').putImageData(maskData, 0, 0);
    
    previewMask = maskCanvas;
    requestAnimationFrame(draw);
}

function startMeshGeneration() {
    if (!originalImage) return;
    meshGenerationCancel = false;
    
    document.getElementById('generateBtn').disabled = true;
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    statusBar.innerText = "准备计算...";
    
    appMode = 'mesh'; 
    modeBadge.classList.remove('hidden', 'mode-mask');
    modeBadge.classList.add('mode-mesh');
    modeBadge.innerText = "正在计算 (Calculating)";

    setTimeout(() => {
        try {
            const commonVal = parseInt(document.getElementById('commonThreshold').value);
            const expansionVal = parseInt(document.getElementById('expansion').value);
            let threshVal, tolerance;
            if (keyColor) { threshVal = 0; tolerance = commonVal * 1.5; } else { threshVal = commonVal * 2.55; tolerance = 0; }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImage.width; tempCanvas.height = originalImage.height;
            tempCanvas.getContext('2d').drawImage(originalImage, 0, 0);
            const imageData = tempCanvas.getContext('2d').getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            let binary = ImageProcessor.threshold(imageData, threshVal, keyColor, tolerance);
            if (expansionVal > 0) binary = ImageProcessor.dilate(binary, expansionVal);

            const rawContours = ImageProcessor.findContours(binary);
            const precisionSlider = parseInt(document.getElementById('precision').value);
            const pixelTolerance = precisionSlider * 0.1;
            
            processedMeshes = [];
            processContoursAsync(rawContours, pixelTolerance);
            
        } catch (e) {
            console.error(e);
            statusBar.innerText = "错误: " + e.message;
            document.getElementById('generateBtn').disabled = false;
        }
    }, 50);
}

function processContoursAsync(contours, tolerance) {
    let index = 0;
    let totalVerts = 0;
    let totalTris = 0;
    const total = contours.length;

    function loop() {
        if (meshGenerationCancel) return;
        
        const loopStart = performance.now();
        while (index < total && performance.now() - loopStart < 16) {
            const contour = contours[index];
            
            let perimeter = 0;
            for(let i=0; i<contour.length; i++) {
                const p1 = contour[i], p2 = contour[(i+1)%contour.length];
                perimeter += Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2);
            }
            
            if (perimeter > 20 && contour.length > 5) {
                let safeTolerance = tolerance;
                if (contour.length > 3000 && safeTolerance < 1.0) safeTolerance = 1.0; 
                if (contour.length > 10000 && safeTolerance < 3.0) safeTolerance = 3.0;

                // 1. 简化 (RDP)
                let simplified = simplifyPoints(contour, safeTolerance);
                
                // 2. 清洗 (关键修复：去除距离 < 1.5px 的点 和 共线点)
                simplified = cleanContour(simplified, 1.5);

                if (simplified.length >= 3) {
                    const flatCoords = [];
                    simplified.forEach(p => flatCoords.push(p.x, p.y));
                    
                    // 3. Earcut
                    let indices = earcut(flatCoords);
                    
                    // 4. 优化 (严格凸性检测)
                    if (indices.length > 0) {
                        indices = optimizeMeshTopology(simplified, indices, 6);
                    }

                    processedMeshes.push({ vertices: simplified, indices: indices });
                    totalVerts += simplified.length;
                    totalTris += indices.length / 3;
                }
            }
            index++;
        }

        const percent = Math.floor((index / total) * 100);
        progressBar.style.width = percent + '%';
        statusBar.innerText = `计算中... ${index}/${total} 轮廓`;
        
        requestAnimationFrame(draw); 

        if (index < total) {
            requestAnimationFrame(loop);
        } else {
            progressContainer.style.display = 'none';
            document.getElementById('generateBtn').disabled = false;
            statusBar.innerText = `完成！点: ${totalVerts} | 面: ${totalTris}`;
            polyCountDisplay.innerText = `${totalTris} tris`;
            setAppMode('mesh');
        }
    }
    
    loop();
}

function updateMeshIfPossible() {
    const precisionVal = document.getElementById('precision').value;
    document.getElementById('val-precision').innerText = (precisionVal * 0.1).toFixed(1) + "px";
    
    if (appMode === 'mesh' && processedMeshes.length > 0) {
        if (window.meshDebounce) clearTimeout(window.meshDebounce);
        window.meshDebounce = setTimeout(startMeshGeneration, 300);
    }
}

function draw() {
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const size = 20;
    ctx.fillStyle = "#252525";
    for(let y=0; y<canvas.height; y+=size) for(let x=0; x<canvas.width; x+=size) if ((x/size + y/size) % 2 === 0) ctx.fillRect(x, y, size, size);

    if (!originalImage) return;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.globalAlpha = (appMode === 'mask') ? 0.8 : 0.4; 
    ctx.drawImage(originalImage, 0, 0);
    ctx.globalAlpha = 1.0;

    if (appMode === 'mask') {
        const showMask = document.getElementById('showMaskPreview').checked;
        if (previewMask && showMask) ctx.drawImage(previewMask, 0, 0);
    } else if (appMode === 'mesh') {
        const showWire = document.getElementById('showWireframe').checked;
        const showPoints = document.getElementById('showPoints').checked;
        
        if (processedMeshes.length > 0) {
            processedMeshes.forEach(mesh => {
                const verts = mesh.vertices;
                const inds = mesh.indices;
                
                ctx.strokeStyle = "#ff3333";
                ctx.lineWidth = 1.5 / scale;
                ctx.lineJoin = 'round';
                ctx.beginPath();
                if(verts.length > 0) {
                    ctx.moveTo(verts[0].x, verts[0].y);
                    for(let i=1; i<verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
                    ctx.closePath();
                }
                ctx.stroke();

                if (showWire) {
                    ctx.strokeStyle = "rgba(0, 255, 255, 0.5)"; 
                    ctx.lineWidth = 0.5 / scale;
                    ctx.beginPath();
                    for (let i = 0; i < inds.length; i += 3) {
                        const p1 = verts[inds[i]];
                        const p2 = verts[inds[i+1]];
                        const p3 = verts[inds[i+2]];
                        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                        ctx.lineTo(p3.x, p3.y); ctx.lineTo(p1.x, p1.y);
                    }
                    ctx.stroke();
                }
                
                if (showPoints) {
                     ctx.fillStyle = "#ffff00";
                     const pSize = Math.max(1, 3 / scale); 
                     for(let i=0; i<verts.length; i++) {
                         ctx.fillRect(verts[i].x - pSize/2, verts[i].y - pSize/2, pSize, pSize);
                     }
                }
            });
        }
    }
    ctx.restore();
}

const mainView = document.getElementById('mainView');
mainView.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; 
    const my = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.01, scale * delta), 50.0);
    
    offsetX = mx - (mx - offsetX) * (newScale / scale);
    offsetY = my - (my - offsetY) * (newScale / scale);
    
    if (!Number.isFinite(offsetX)) offsetX = 0;
    if (!Number.isFinite(offsetY)) offsetY = 0;
    
    scale = newScale;
    requestAnimationFrame(draw);
}, { passive: false });

mainView.addEventListener('mousedown', (e) => {
    if (document.getElementById('colorPickerMode').checked && e.button === 0) {
        pickColor(e);
    } else if (e.button === 0) {
        isDragging = true; lastMousePos = { x: e.clientX, y: e.clientY };
    }
});
window.addEventListener('mouseup', () => isDragging = false);
window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX += e.clientX - lastMousePos.x;
        offsetY += e.clientY - lastMousePos.y;
        lastMousePos = { x: e.clientX, y: e.clientY };
        requestAnimationFrame(draw);
    }
});

function resetView() {
    if(!originalImage) return;
    scale = Math.min((canvas.width*0.8)/originalImage.width, (canvas.height*0.8)/originalImage.height);
    offsetX = (canvas.width-originalImage.width*scale)/2;
    offsetY = (canvas.height-originalImage.height*scale)/2;
    requestAnimationFrame(draw);
}

function toggleColorPicker() {
    const on = document.getElementById('colorPickerMode').checked;
    const toggleBtn = document.getElementById('eyedropperBtn');
    const label = document.getElementById('thresholdLabel');
    const slider = document.getElementById('commonThreshold');
    const valDisplay = document.getElementById('val-commonThreshold');
    const keyColorDisplay = document.getElementById('keyColorDisplay');

    if (on) {
        toggleBtn.classList.add('active');
        mainView.classList.add('picking');
        label.innerText = "颜色容差 (Similarity)";
        keyColorDisplay.classList.remove('hidden');
        slider.value = thresholdState.color;
        valDisplay.innerText = thresholdState.color;
        if (!keyColor) statusBar.innerText = ">> 请在图片上点击要保留的颜色 <<";
    } else {
        toggleBtn.classList.remove('active');
        mainView.classList.remove('picking');
        if (keyColor) {
            label.innerText = "颜色容差 (Similarity)";
            keyColorDisplay.classList.remove('hidden');
            slider.value = thresholdState.color;
            valDisplay.innerText = thresholdState.color;
        } else {
            label.innerText = "透明度阈值 (Alpha)";
            keyColorDisplay.classList.add('hidden');
            slider.value = thresholdState.alpha;
            valDisplay.innerText = thresholdState.alpha;
        }
        updateMaskPreview();
    }
}

function pickColor(e) {
    if (!originalImage) return;
    const rect = canvas.getBoundingClientRect();
    const ix = Math.floor((e.clientX - rect.left - offsetX) / scale);
    const iy = Math.floor((e.clientY - rect.top - offsetY) / scale);
    if (ix >= 0 && ix < originalImage.width && iy >= 0 && iy < originalImage.height) {
        const tc = document.createElement('canvas'); tc.width=1; tc.height=1;
        tc.getContext('2d').drawImage(originalImage, ix, iy, 1, 1, 0, 0, 1, 1);
        const p = tc.getContext('2d').getImageData(0,0,1,1).data;
        keyColor = [p[0], p[1], p[2]];
        
        document.getElementById('keyColorBox').style.background = `rgb(${p[0]},${p[1]},${p[2]})`;
        document.getElementById('keyColorText').innerText = `R:${p[0]} G:${p[1]} B:${p[2]}`;
        
        document.getElementById('colorPickerMode').checked = false;
        toggleColorPicker(); 
        
        statusBar.innerText = "颜色已选定，正在更新遮罩预览...";
        updateMaskPreview();
    }
}

function clearKeyColor() {
    keyColor = null;
    document.getElementById('colorPickerMode').checked = true;
    toggleColorPicker();
    updateMaskPreview();
}

function exportModel() {
    if (processedMeshes.length === 0) { alert("没有生成网格数据"); return; }
    let objContent = "# Generated by PNG2Mesh (Convex Fix)\n";
    let globalVertCount = 0;
    const imgWidth = originalImage.width;
    const imgHeight = originalImage.height;
    const aspectRatio = imgWidth / imgHeight;
    processedMeshes.forEach(mesh => {
        const verts = mesh.vertices;
        const inds = mesh.indices;
        verts.forEach(p => {
            const vx = (p.x / imgWidth - 0.5) * 2 * aspectRatio;
            const vy = -(p.y / imgHeight - 0.5) * 2; 
            const vz = 0;
            const u = p.x / imgWidth;
            const v = 1.0 - (p.y / imgHeight);
            objContent += `v ${vx.toFixed(6)} ${vy.toFixed(6)} ${vz.toFixed(6)}\n`;
            objContent += `vt ${u.toFixed(6)} ${v.toFixed(6)}\n`;
        });
        for (let i = 0; i < inds.length; i += 3) {
            const idx1 = globalVertCount + inds[i] + 1;
            const idx2 = globalVertCount + inds[i+1] + 1;
            const idx3 = globalVertCount + inds[i+2] + 1;
            objContent += `f ${idx1}/${idx1} ${idx2}/${idx2} ${idx3}/${idx3}\n`;
        }
        globalVertCount += verts.length;
    });
    const blob = new Blob([objContent], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "model_convex_fix.obj";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

