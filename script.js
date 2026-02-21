const c = document.getElementById("canva");
const ctx = c.getContext("2d");

let rot = 0;
let player_pos = { x: 400, y: 300 };
let player_vel = { x: 0, y: 0 };
let mouse_pos = { x: 0, y: 0 };

let player_color = "rgb(255, 0, 0)";
let player_dims = { w: 15, h: 30 };
let accel = 250;
let drift_factor = 0.99;
let drag_factor = 0.999;

function updateValues() {
    const newAccel = document.getElementById("accelInput").value;
    const newDrift = document.getElementById("driftInput").value;
    const newDrag = document.getElementById("dragInput").value;

    accel = parseInt(newAccel);
    drift_factor = parseFloat(newDrift);
    drag_factor = parseFloat(newDrag);

    console.log(`Updated! Accel: ${accel}, Drift: ${drift_factor}, Drag: ${drag_factor}`);
}

let outer_border = [];
let inner_border = [];
let isRecordingInner = false; 

const keys = {};

window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "KeyR") { outer_border = []; inner_border = []; }
    if (e.code === "KeyT") isRecordingInner = !isRecordingInner;
    
    if (e.code === "KeyZ" && e.ctrlKey) {
        if (isRecordingInner) inner_border.pop();
        else outer_border.pop();
    }
});
window.addEventListener("keyup", e => keys[e.code] = false);

window.addEventListener("mousemove", e => {
    const rect = c.getBoundingClientRect();
    mouse_pos.x = e.clientX - rect.left;
    mouse_pos.y = e.clientY - rect.top;
});

window.addEventListener("mousedown", e => {
    if (keys["ShiftLeft"]) {
        const point = { x: mouse_pos.x, y: mouse_pos.y };
        if (isRecordingInner) inner_border.push(point);
        else outer_border.push(point);
    }
});

function dot(p1, p2) { return p1.x * p2.x + p1.y * p2.y; }

function rotate(x, y, degrees) {
    const rad = degrees * (Math.PI / 180);
    return {
        x: x * Math.cos(rad) - y * Math.sin(rad),
        y: x * Math.sin(rad) + y * Math.cos(rad)
    };
}

function generateCirclePoints(centerX, centerY, radius, numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        points.push({ x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
    }
    return points;
}

function lineRectIntersect(p1, p2, rectPos, rectDims, rectRot) {
    let lp1 = { x: p1.x - rectPos.x, y: p1.y - rectPos.y };
    let lp2 = { x: p2.x - rectPos.x, y: p2.y - rectPos.y };
    lp1 = rotate(lp1.x, lp1.y, -rectRot);
    lp2 = rotate(lp2.x, lp2.y, -rectRot);
    const halfW = rectDims.w / 2, halfH = rectDims.h / 2;
    let t0 = 0, t1 = 1, dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
    const p = [-dx, dx, -dy, dy], q = [lp1.x + halfW, halfW - lp1.x, lp1.y + halfH, halfH - lp1.y];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) return false; }
        else {
            let t = q[i] / p[i];
            if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
            else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
    }
    return t0 <= t1;
}

function drawPath(points, color = "white", isDashed = false) {
    if (points.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (isDashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y); // Fixed point indexing
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
}

function Rect(x, y, width, height, degrees, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.fillStyle = color;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
}

async function start() {
    outer_border = generateCirclePoints(c.width / 2, c.height / 2, 250, 60);
    inner_border = generateCirclePoints(c.width / 2, c.height / 2, 100, 60);
    player_pos = { x: c.width / 2 + 175, y: c.height / 2 };
}

let last_time = 0;
function loop(time) {
    let dt = (time - last_time) / 1000;
    last_time = time;
    if (dt > 0.1) dt = 0.1;

    let forwardDir = rotate(0, -1, rot);
    let rightDir = rotate(forwardDir.x, forwardDir.y, 90);
    let magnitude = Math.sqrt(player_vel.x ** 2 + player_vel.y ** 2);

    if (keys["KeyW"]) {
        player_vel.x += forwardDir.x * accel * dt;
        player_vel.y += forwardDir.y * accel * dt;
    }
    let steerSpeed = 180 * (magnitude / 300); 
    if (keys["KeyA"]) rot -= steerSpeed * dt;
    if (keys["KeyD"]) rot += steerSpeed * dt;

    let forwardMag = dot(player_vel, forwardDir);
    let sideMag = dot(player_vel, rightDir);
    player_vel.x = (forwardDir.x * forwardMag * drag_factor) + (rightDir.x * sideMag * drift_factor);
    player_vel.y = (forwardDir.y * forwardMag * drag_factor) + (rightDir.y * sideMag * drift_factor);

    player_pos.x += player_vel.x * dt;
    player_pos.y += player_vel.y * dt;

    const collide = (border) => {
        for (let i = 0; i < border.length; i++) {
            if (lineRectIntersect(border[i], border[(i + 1) % border.length], player_pos, player_dims, rot)) return true;
        }
        return false;
    };

    if (collide(outer_border) || collide(inner_border)) {
        player_vel.x *= -0.6; player_vel.y *= -0.6;
        player_pos.x += player_vel.x * dt * 8; player_pos.y += player_vel.y * dt * 8;
    }

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, c.width, c.height);

    drawPath(outer_border, "white");
    drawPath(inner_border, "#00ff00");

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(`Mode: ${isRecordingInner ? "INNER (Green)" : "OUTER (White)"}`, 10, 20);
    ctx.fillText("Shift+Click: Draw | Ctrl+Z: Undo | T: Toggle | R: Reset", 10, 40);

    let active = isRecordingInner ? inner_border : outer_border;
    if (active.length > 0 && keys["ShiftLeft"]) {
        ctx.strokeStyle = isRecordingInner ? "#00ff00" : "white";
        ctx.beginPath();
        ctx.moveTo(active[active.length-1].x, active[active.length-1].y);
        ctx.lineTo(mouse_pos.x, mouse_pos.y);
        ctx.stroke();
    }

    Rect(player_pos.x, player_pos.y, player_dims.w, player_dims.h, rot, player_color);
    requestAnimationFrame(loop);
}

start();
requestAnimationFrame(loop);
