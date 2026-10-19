/* Əlevate world map maths: Equal Earth projection (Šavrič, Patterson, Jenny 2018) + a small TopoJSON reader.
   Equal Earth is a real equal-area projection. Nothing here claims the Earth is flat: it is how a round Earth is drawn on a flat screen.
   Works in the browser (window.ElvMap) and in node tests (module.exports). */
(function (root) {
  var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, D = Math.PI / 180;
  // lon/lat (degrees) -> x,y (unit-less plane). Width is about 5.45, height about 2.65.
  function project(lon, lat) {
    var th = Math.asin(M * Math.sin(lat * D)), t2 = th * th, t6 = t2 * t2 * t2;
    return [2 * Math.sqrt(3) * lon * D * Math.cos(th) / (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
            th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  }
  // x,y -> [lon, lat] degrees, or null when the point is outside the map outline.
  function invert(x, y) {
    var th = y, i, f, fp, t2, t6;
    for (i = 0; i < 12; i++) {
      t2 = th * th; t6 = t2 * t2 * t2;
      f = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y;
      fp = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
      th -= f / fp; if (Math.abs(f) < 1e-12) break;
    }
    if (!isFinite(th) || Math.abs(th) > Math.PI / 3 + 1e-9) return null;
    t2 = th * th; t6 = t2 * t2 * t2;
    var lat = Math.asin(Math.sin(th) / M) / D, lon = 3 * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)) / (2 * Math.sqrt(3) * Math.cos(th)) / D;
    return Math.abs(lon) > 180.0001 ? null : [lon, lat];
  }
  // TopoJSON (e.g. world-atlas countries-110m) -> [{id, name, polys:[[ring,...],...]}] with lon/lat points.
  function features(topo, objName) {
    var obj = topo && topo.objects && (topo.objects[objName] || topo.objects[Object.keys(topo.objects)[0]]);
    if (!obj || !Array.isArray(topo.arcs)) return [];
    var tr = topo.transform, arcs = topo.arcs.map(function (a) {
      var x = 0, y = 0; // positions are delta-encoded only when the file is quantized (has a transform)
      return a.map(function (p) { if (tr) { x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; } return [p[0], p[1]]; });
    });
    function arc(i) { return i < 0 ? arcs[~i].slice().reverse() : arcs[i]; }
    function ring(idx) { var pts = []; idx.forEach(function (i, k) { var a = arc(i); pts = pts.concat(k ? a.slice(1) : a); }); return pts; }
    var geoms = obj.type === "GeometryCollection" ? obj.geometries : [obj];
    return geoms.map(function (g, n) {
      var polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
      return { id: g.id != null ? String(g.id) : "f" + n, name: (g.properties && g.properties.name) || "Region " + (n + 1), polys: polys.map(function (p) { return p.map(ring); }) };
    });
  }
  // One SVG path string for a feature, in map units scaled by S (so the page can use whole-number-ish coordinates).
  function pathOf(f, S) {
    var d = "";
    f.polys.forEach(function (p) { p.forEach(function (r) {
      r.forEach(function (pt, i) { var q = project(pt[0], pt[1]); d += (i ? "L" : "M") + (q[0] * S).toFixed(1) + " " + (-q[1] * S).toFixed(1); }); d += "Z";
    }); });
    return d;
  }
  // Which feature holds this lon/lat (ray casting, first ring is the outer ring; holes ignored for speed).
  function inRing(r, lon, lat) { var c = false, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > lat) !== (r[j][1] > lat) && lon < (r[j][0] - r[i][0]) * (lat - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
  function featureAt(list, lon, lat) { for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].polys.length; j++) if (inRing(list[i].polys[j][0], lon, lat)) return list[i]; return null; }
  function bounds() { var e = project(180, 0), n = project(0, 90); return { w: e[0] * 2, h: n[1] * 2 }; }
  var api = { project: project, invert: invert, features: features, pathOf: pathOf, featureAt: featureAt, bounds: bounds };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ElvMap = api;
})(typeof window !== "undefined" ? window : this);
