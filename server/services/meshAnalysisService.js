/**
 * Instant Quote — server-side STL/OBJ mesh analysis.
 *
 * Deliberately self-contained (no node-stl / three.js dependency): research before
 * building this flagged that the available npm packages for STL+OBJ volume/area are
 * either years-stale (node-stl, STL-only, path-based) or require a DOM shim (Three.js
 * loaders). A binary/ASCII STL parser and a minimal OBJ parser are both small, well
 * understood formats — a few dozen lines each — so writing them directly avoids
 * depending on fragile packages for a calculation this central to pricing.
 *
 * Volume/area use the standard signed-tetrahedron-sum method (Möller 1994), which is
 * what every STL volume calculator (including the stale node-stl) implements anyway.
 */

const MAX_TRIANGLES = 2_000_000; // sanity ceiling — defends against adversarial/degenerate meshes
const MM3_TO_CM3 = 1 / 1000;
const MM2_TO_CM2 = 1 / 100;
const INCH_TO_MM = 25.4;

class MeshTooComplexError extends Error {
  constructor(count) {
    super(`Model has ${count.toLocaleString('en-IN')} triangles, over the ${MAX_TRIANGLES.toLocaleString('en-IN')} limit. Simplify the model and try again.`);
    this.status = 400;
  }
}
class MeshInvalidError extends Error {
  constructor(msg) { super(msg); this.status = 400; }
}

/* ── STL parsing ─────────────────────────────────────────── */

function isAsciiStl(buffer) {
  // Binary STL can legally start with the bytes "solid" too (header is free-form),
  // so the reliable check is: does the file size match the binary triangle-count math?
  const head = buffer.subarray(0, 5).toString('utf8').toLowerCase();
  if (head !== 'solid') return false;
  if (buffer.length < 84) return true; // too short to be a valid binary STL
  const triCount = buffer.readUInt32LE(80);
  const expectedBinarySize = 84 + triCount * 50;
  return buffer.length !== expectedBinarySize;
}

function parseBinaryStl(buffer) {
  if (buffer.length < 84) throw new MeshInvalidError('STL file is too small to be valid.');
  const triCount = buffer.readUInt32LE(80);
  if (triCount > MAX_TRIANGLES) throw new MeshTooComplexError(triCount);
  const expected = 84 + triCount * 50;
  if (buffer.length < expected) throw new MeshInvalidError('STL file is truncated or corrupted.');

  const triangles = new Array(triCount);
  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal
    const v1 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
    const v2 = [buffer.readFloatLE(offset + 12), buffer.readFloatLE(offset + 16), buffer.readFloatLE(offset + 20)];
    const v3 = [buffer.readFloatLE(offset + 24), buffer.readFloatLE(offset + 28), buffer.readFloatLE(offset + 32)];
    triangles[i] = [v1, v2, v3];
    offset += 36 + 2; // 3 vertices + attribute byte count
  }
  return triangles;
}

function parseAsciiStl(text) {
  const triangles = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let match;
  let current = [];
  while ((match = vertexRe.exec(text)) !== null) {
    current.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    if (current.length === 3) {
      triangles.push(current);
      current = [];
      if (triangles.length > MAX_TRIANGLES) throw new MeshTooComplexError(triangles.length);
    }
  }
  if (!triangles.length) throw new MeshInvalidError('No triangles found in ASCII STL file.');
  return triangles;
}

function parseStl(buffer) {
  if (isAsciiStl(buffer)) return parseAsciiStl(buffer.toString('utf8'));
  return parseBinaryStl(buffer);
}

/* ── OBJ parsing (vertices + faces only — normals/UVs/materials ignored) ── */

function parseObj(text) {
  const vertices = [];
  const triangles = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.slice(2).trim().split(/\s+/).map(Number);
      if (parts.length >= 3 && parts.every(Number.isFinite)) vertices.push([parts[0], parts[1], parts[2]]);
    } else if (trimmed.startsWith('f ')) {
      const tokens = trimmed.slice(2).trim().split(/\s+/);
      // face vertex refs may be "v", "v/vt", "v/vt/vn", or "v//vn" — take the leading index only
      const idxs = tokens.map(tok => {
        let i = parseInt(tok.split('/')[0], 10);
        if (i < 0) i = vertices.length + i + 1; // OBJ allows negative (relative) indices
        return i - 1; // OBJ is 1-indexed
      });
      // fan-triangulate polygons with more than 3 vertices
      for (let i = 1; i < idxs.length - 1; i++) {
        const a = vertices[idxs[0]], b = vertices[idxs[i]], c = vertices[idxs[i + 1]];
        if (a && b && c) {
          triangles.push([a, b, c]);
          if (triangles.length > MAX_TRIANGLES) throw new MeshTooComplexError(triangles.length);
        }
      }
    }
  }
  if (!triangles.length) throw new MeshInvalidError('No faces found in OBJ file.');
  return triangles;
}

/* ── Geometry math ───────────────────────────────────────── */

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function length(a) { return Math.sqrt(dot(a, a)); }

/**
 * Signed-tetrahedron-sum volume (Möller 1994) + bounding box + surface area,
 * computed in a single pass over the triangle list. Units follow the input
 * vertex units (mm expected; caller converts if the source file is in inches).
 */
function computeMeshStats(triangles) {
  let signedVolumeSum = 0; // mm^3
  let areaSum = 0;         // mm^2
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const [v1, v2, v3] of triangles) {
    signedVolumeSum += dot(v1, cross(v2, v3)) / 6;
    areaSum += length(cross(sub(v2, v1), sub(v3, v1))) / 2;
    for (const v of [v1, v2, v3]) {
      for (let k = 0; k < 3; k++) {
        if (v[k] < min[k]) min[k] = v[k];
        if (v[k] > max[k]) max[k] = v[k];
      }
    }
  }

  const volumeMm3 = Math.abs(signedVolumeSum);
  if (volumeMm3 < 1e-6) {
    throw new MeshInvalidError('Model has zero or near-zero volume — the file may be empty, flat, or corrupted.');
  }

  return {
    volume_mm3: volumeMm3,
    surface_area_mm2: areaSum,
    dims_mm: {
      x: Math.round((max[0] - min[0]) * 100) / 100,
      y: Math.round((max[1] - min[1]) * 100) / 100,
      z: Math.round((max[2] - min[2]) * 100) / 100,
    },
    triangle_count: triangles.length,
  };
}

/**
 * Analyze an uploaded STL/OBJ buffer. `format` is 'stl' | 'obj'.
 * `unit` is 'mm' (default) | 'inch' — inch files get their vertex coords
 * scaled to mm before any stats are computed.
 */
export function analyzeMesh(buffer, format, unit = 'mm') {
  let triangles = format === 'obj' ? parseObj(buffer.toString('utf8')) : parseStl(buffer);

  if (unit === 'inch') {
    triangles = triangles.map(tri => tri.map(v => v.map(c => c * INCH_TO_MM)));
  }

  const stats = computeMeshStats(triangles);
  return {
    volume_cm3: Math.round(stats.volume_mm3 * MM3_TO_CM3 * 1000) / 1000,
    surface_area_cm2: Math.round(stats.surface_area_mm2 * MM2_TO_CM2 * 100) / 100,
    dims_mm: stats.dims_mm,
    triangle_count: stats.triangle_count,
  };
}

/** Hard timeout wrapper — defends against a pathological mesh hanging the parser. */
export function analyzeMeshWithTimeout(buffer, format, unit, timeoutMs = 15000) {
  return Promise.race([
    Promise.resolve().then(() => analyzeMesh(buffer, format, unit)),
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('Model analysis timed out — the file may be too complex.'), { status: 408 })), timeoutMs)
    ),
  ]);
}

export { MeshTooComplexError, MeshInvalidError };
