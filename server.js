const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const HOST = "127.0.0.1";
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const SETTINGS_FILE = path.join(DATA_DIR, "site-settings.json");
const ADMIN_PASSWORD = process.env.XVYN_ADMIN_PASSWORD || "xvynadmin";
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

ensureDataFile();

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, "[]", "utf8");
  }

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          sliderImages: {
            slide1: "",
            slide2: ""
          }
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readProducts() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
}

function readSettings() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

function parseCookies(request) {
  const header = request.headers.cookie;
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    })
  );
}

function isAuthenticated(request) {
  const cookies = parseCookies(request);
  return Boolean(cookies.xvyn_admin_session && sessions.has(cookies.xvyn_admin_session));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        request.destroy();
        reject(new Error("Body terlalu besar"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, data, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function serveFile(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(response, 404, "File tidak ditemukan");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function getStaticPath(urlPathname) {
  const safePath = urlPathname === "/" ? "/index.html" : urlPathname;
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return filePath;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    serveFile(response, path.join(ROOT_DIR, "admin.html"));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/products") {
    sendJson(response, 200, readProducts());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/settings") {
    sendJson(response, 200, readSettings());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readJsonBody(request).catch(() => null);
    if (!body || body.password !== ADMIN_PASSWORD) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    const token = crypto.randomUUID();
    sessions.set(token, { createdAt: Date.now() });
    sendJson(
      response,
      200,
      { success: true },
      { "Set-Cookie": `xvyn_admin_session=${token}; HttpOnly; Path=/; SameSite=Lax` }
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    const cookies = parseCookies(request);
    if (cookies.xvyn_admin_session) {
      sessions.delete(cookies.xvyn_admin_session);
    }
    sendJson(
      response,
      200,
      { success: true },
      { "Set-Cookie": "xvyn_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax" }
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/session") {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/products") {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    sendJson(response, 200, readProducts());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/settings") {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    sendJson(response, 200, readSettings());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/products") {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    const body = await readJsonBody(request).catch(() => null);
    if (!body || !body.code || !body.title || !body.price) {
      sendJson(response, 400, { message: "Data produk tidak lengkap" });
      return;
    }

    const products = readProducts();
    const product = {
      id: body.id || crypto.randomUUID(),
      code: String(body.code).trim(),
      title: String(body.title).trim(),
      price: String(body.price).trim(),
      secondaryPrice: String(body.secondaryPrice || "").trim(),
      banner: String(body.banner || "HANYA TERSEDIA DI WEBSITE!").trim(),
      checkoutLink: String(body.checkoutLink || "#").trim(),
      imageData: String(body.imageData || "").trim(),
      description: String(body.description || "").trim()
    };

    const index = products.findIndex((item) => item.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }

    writeProducts(products);
    sendJson(response, 200, product);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/settings") {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    const body = await readJsonBody(request).catch(() => null);
    if (!body) {
      sendJson(response, 400, { message: "Data settings tidak valid" });
      return;
    }

    const settings = {
      sliderImages: {
        slide1: String(body?.sliderImages?.slide1 || "").trim(),
        slide2: String(body?.sliderImages?.slide2 || "").trim()
      }
    };

    writeSettings(settings);
    sendJson(response, 200, settings);
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/products/")) {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: "Unauthorized" });
      return;
    }

    const id = url.pathname.split("/").pop();
    const products = readProducts().filter((item) => item.id !== id);
    writeProducts(products);
    sendJson(response, 200, { success: true });
    return;
  }

  const staticPath = getStaticPath(url.pathname);
  if (!staticPath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    serveFile(response, staticPath);
    return;
  }

  sendText(response, 404, "Halaman tidak ditemukan");
});

server.listen(PORT, HOST, () => {
  console.log(`XVYN server running at http://${HOST}:${PORT}`);
});
