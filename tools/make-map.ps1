# =====================================================
# 地図データ（js/map-data.js）を作るスクリプト
# OpenStreetMap のデータ（Overpass API で取得した JSON）から、
# 海岸線・湖・主な道路・山を取り出して、ゲームの座標に変換する。
#
# 使い方（PowerShell）:
#   powershell -ExecutionPolicy Bypass -File tools\make-map.ps1 -In <JSONのフォルダ>
#
# <JSONのフォルダ> には次のファイルを置く（中身は Overpass API の [out:json] の結果）:
#   coast.json  way["natural"="coastline"](37.70,138.15,38.40,138.65);out geom;
#   water.json  (way["natural"="water"](...);relation["natural"="water"](...););out geom;
#   roads.json  way["highway"~"^(trunk|primary|secondary)$"](...);out geom;
#   peaks.json  node["natural"="peak"]["name"](...);out;
#
# 地図データ © OpenStreetMap contributors（ODbL）
# =====================================================

param(
  [Parameter(Mandatory = $true)][string]$In,
  [string]$Out = ""
)
if (-not $Out) { $Out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\js\map-data.js" }

# 座標の変換（緯度・経度 → ゲームの x, y）。1km がだいたい 60 になる
$LON0 = 138.18; $LAT0 = 38.36; $KX = 5259; $KY = 6660

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
public static class Geo {
  // ダグラス・ポーカー法で線を間引く（pts は x,y,x,y,...）
  public static double[] Simplify(double[] pts, double tol) {
    int n = pts.Length / 2;
    if (n < 3) return pts;
    bool[] keep = new bool[n];
    keep[0] = keep[n - 1] = true;
    var stack = new Stack<int[]>();
    stack.Push(new int[] { 0, n - 1 });
    while (stack.Count > 0) {
      int[] r = stack.Pop();
      double ax = pts[r[0]*2], ay = pts[r[0]*2+1], bx = pts[r[1]*2], by = pts[r[1]*2+1];
      double dx = bx - ax, dy = by - ay, len = Math.Sqrt(dx*dx + dy*dy);
      double best = -1; int bi = -1;
      for (int i = r[0] + 1; i < r[1]; i++) {
        double px = pts[i*2], py = pts[i*2+1], d;
        if (len == 0) d = Math.Sqrt((px-ax)*(px-ax) + (py-ay)*(py-ay));
        else d = Math.Abs(dy*px - dx*py + bx*ay - by*ax) / len;
        if (d > best) { best = d; bi = i; }
      }
      if (best > tol) { keep[bi] = true; stack.Push(new int[] { r[0], bi }); stack.Push(new int[] { bi, r[1] }); }
    }
    var o = new List<double>();
    for (int i = 0; i < n; i++) if (keep[i]) { o.Add(pts[i*2]); o.Add(pts[i*2+1]); }
    return o.ToArray();
  }
  public static double Area(double[] pts) {
    double a = 0; int n = pts.Length / 2;
    for (int i = 0; i < n; i++) { int j = (i + 1) % n; a += pts[i*2]*pts[j*2+1] - pts[j*2]*pts[i*2+1]; }
    return Math.Abs(a / 2);
  }
}
"@

function Load($name) {
  $text = [IO.File]::ReadAllText((Join-Path $In $name), [Text.Encoding]::UTF8)
  return ($text | ConvertFrom-Json).elements
}

function Project($geom) {
  $geom = @($geom | Where-Object { $_ -ne $null })
  $a = [double[]]::new($geom.Count * 2)
  for ($i = 0; $i -lt $geom.Count; $i++) {
    $a[$i * 2] = [math]::Round(($geom[$i].lon - $LON0) * $KX, 1)
    $a[$i * 2 + 1] = [math]::Round(($LAT0 - $geom[$i].lat) * $KY, 1)
  }
  return ,$a
}

function Fmt($arr) {
  return "[" + (($arr | ForEach-Object { [math]::Round($_, 1).ToString([Globalization.CultureInfo]::InvariantCulture) }) -join ",") + "]"
}

# ---------- 海岸線：way をつないで輪にする ----------
$coastWays = Load "coast.json"
$byFirst = @{}
foreach ($w in $coastWays) { $byFirst[[string]$w.nodes[0]] = $w }
$used = @{}
$rings = @()
foreach ($w in $coastWays) {
  if ($used[[string]$w.id]) { continue }
  $used[[string]$w.id] = $true
  $geom = New-Object System.Collections.ArrayList
  $geom.AddRange(@($w.geometry))
  $first = [string]$w.nodes[0]
  $last = [string]$w.nodes[-1]
  while ($last -ne $first -and $byFirst.ContainsKey($last) -and -not $used[[string]$byFirst[$last].id]) {
    $nw = $byFirst[$last]
    $used[[string]$nw.id] = $true
    $geom.AddRange(@($nw.geometry[1..($nw.geometry.Count - 1)]))
    $last = [string]$nw.nodes[-1]
  }
  if ($last -ne $first) { continue } # 閉じていない線（範囲の外へ出るもの）は使わない
  $pts = [Geo]::Simplify((Project $geom), 1.8)
  if ([Geo]::Area($pts) -gt 900) { $rings += ,$pts }
}
Write-Host ("coast: {0} rings, {1} points" -f $rings.Count, (($rings | ForEach-Object { $_.Length / 2 }) | Measure-Object -Sum).Sum)

# ---------- 湖・池 ----------
function JoinByCoords($ways) {
  # relation の outer をつなぐ（node id が無いので座標でつなぐ）
  $out = @()
  $rest = New-Object System.Collections.ArrayList
  foreach ($w in $ways) { [void]$rest.Add(@($w.geometry)) }
  while ($rest.Count -gt 0) {
    $cur = New-Object System.Collections.ArrayList
    $cur.AddRange($rest[0]); $rest.RemoveAt(0)
    $grew = $true
    while ($grew) {
      $grew = $false
      $f = $cur[0]; $l = $cur[$cur.Count - 1]
      if ($f.lat -eq $l.lat -and $f.lon -eq $l.lon -and $cur.Count -gt 2) { break }
      for ($i = 0; $i -lt $rest.Count; $i++) {
        $g = $rest[$i]; $gf = $g[0]; $gl = $g[$g.Count - 1]
        if ($gf.lat -eq $l.lat -and $gf.lon -eq $l.lon) { $cur.AddRange($g[1..($g.Count - 1)]); $rest.RemoveAt($i); $grew = $true; break }
        if ($gl.lat -eq $l.lat -and $gl.lon -eq $l.lon) { [array]::Reverse($g); $cur.AddRange($g[1..($g.Count - 1)]); $rest.RemoveAt($i); $grew = $true; break }
      }
    }
    $out += ,$cur
  }
  return $out
}

$lakes = @()
foreach ($e in (Load "water.json")) {
  if ($e.tags.water -match "river|stream|canal|ditch") { continue }
  $geoms = @()
  if ($e.type -eq "way") { $geoms = ,$e.geometry }
  elseif ($e.type -eq "relation") { $geoms = JoinByCoords @($e.members | Where-Object { $_.role -eq "outer" -and $_.geometry }) }
  foreach ($g in $geoms) {
    $pts = [Geo]::Simplify((Project $g), 1.8)
    if ($pts.Length -ge 6 -and [Geo]::Area($pts) -gt 700) { $lakes += ,$pts }
  }
}
Write-Host ("lakes: {0}" -f $lakes.Count)

# ---------- 道路：交差点で区切ってから間引く（つながりを保つため） ----------
$roadWays = Load "roads.json"
$count = @{}
foreach ($w in $roadWays) { foreach ($n in $w.nodes) { $k = [string]$n; $count[$k] = 1 + [int]$count[$k] } }
$roads = @()
foreach ($w in $roadWays) {
  $cls = if ($w.tags.highway -eq "secondary") { 2 } else { 1 }
  $start = 0
  for ($i = 1; $i -lt $w.nodes.Count; $i++) {
    if ($i -eq $w.nodes.Count - 1 -or $count[[string]$w.nodes[$i]] -gt 1) {
      $pts = [Geo]::Simplify((Project $w.geometry[$start..$i]), 2.2)
      $roads += ,(@($cls) + $pts)
      $start = $i
    }
  }
}
Write-Host ("roads: {0} pieces, {1} points" -f $roads.Count, (($roads | ForEach-Object { ($_.Length - 1) / 2 }) | Measure-Object -Sum).Sum)

# ---------- 山 ----------
$peaks = @()
foreach ($p in (Load "peaks.json")) {
  $ele = 0
  [void][double]::TryParse(($p.tags.ele -replace "[^0-9.]", ""), [ref]$ele)
  if ($ele -lt 400) { continue }
  $x = [math]::Round(($p.lon - $LON0) * $KX, 1); $y = [math]::Round(($LAT0 - $p.lat) * $KY, 1)
  $name = $p.tags.name -replace '"', ''
  $peaks += '{{ name: "{0}", ele: {1}, x: {2}, y: {3} }}' -f $name, [math]::Round($ele), $x, $y
}
Write-Host ("peaks: {0}" -f $peaks.Count)

# ---------- 書き出し ----------
$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine("// 地図データ（tools/make-map.ps1 で自動生成。手で書きかえない）")
[void]$sb.AppendLine("// 地図データ © OpenStreetMap contributors（ODbL）")
[void]$sb.AppendLine("// 座標：x = (経度 - $LON0) * $KX、y = ($LAT0 - 緯度) * $KY（1km ≒ 60）")
[void]$sb.AppendLine("window.MAP_DATA = {")
[void]$sb.AppendLine("  coast: [" + (($rings | ForEach-Object { Fmt $_ }) -join ",`n    ") + "],")
[void]$sb.AppendLine("  lakes: [" + (($lakes | ForEach-Object { Fmt $_ }) -join ",`n    ") + "],")
[void]$sb.AppendLine("  // [種類(1=国道・主要道 2=県道), x, y, x, y, ...]")
[void]$sb.AppendLine("  roads: [" + (($roads | ForEach-Object { Fmt $_ }) -join ",`n    ") + "],")
[void]$sb.AppendLine("  peaks: [" + ($peaks -join ",`n    ") + "]")
[void]$sb.AppendLine("};")
[IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object Text.UTF8Encoding $false))
Write-Host ("wrote {0} ({1:N0} bytes)" -f $Out, (Get-Item $Out).Length)
