import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const SNAP_ID =
  process.env.SNAP_ID ||
  "210ac24090952b8d7fd4813cfc57f4fe5864ee8f570f096cb6b1ca93d0333cf7";
const API_BASE = process.env.API_BASE || "http://10.147.18.141:3020";
const RESOURCE_API_BASE = process.env.RESOURCE_API_BASE || "http://10.147.18.141:3000";
const PUBLIC_DIR = join(process.cwd(), "public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  res.end(body);
}

async function proxySnap(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const page = requestUrl.searchParams.get("page") || "1";
  const size = requestUrl.searchParams.get("size") || "9999";
  const snapId = requestUrl.searchParams.get("snapId") || SNAP_ID;
  const upstream = `${API_BASE}/snaps/${encodeURIComponent(snapId)}?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`;

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" }
    });
    const body = await response.text();
    send(
      res,
      response.status,
      body,
      response.headers.get("content-type") || "application/json; charset=utf-8"
    );
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({
        error: "Nao foi possivel buscar os dados da API.",
        detail: error.message,
        upstream
      }),
      "application/json; charset=utf-8"
    );
  }
}

async function proxyConfig(_req, res) {
  send(
    res,
    200,
    JSON.stringify({
      snapId: SNAP_ID,
      apiBase: API_BASE
    }),
    "application/json; charset=utf-8"
  );
}

async function proxyResources(_req, res) {
  const upstream = `${RESOURCE_API_BASE}/octopus/recurso`;

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" }
    });
    const body = await response.text();
    send(
      res,
      response.status,
      body,
      response.headers.get("content-type") || "application/json; charset=utf-8"
    );
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({
        error: "Nao foi possivel buscar os dados das maquinas.",
        detail: error.message,
        upstream
      }),
      "application/json; charset=utf-8"
    );
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    send(res, 200, file, contentTypes[extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found");
  }
}

createServer((req, res) => {
  if (req.url?.startsWith("/api/config")) {
    proxyConfig(req, res);
    return;
  }

  if (req.url?.startsWith("/api/snap")) {
    proxySnap(req, res);
    return;
  }

  if (req.url?.startsWith("/api/resources")) {
    proxyResources(req, res);
    return;
  }

  serveStatic(req, res);
}).listen(PORT, HOST, () => {
  console.log(`Gantt em http://${HOST}:${PORT}`);
});
