// Shared MSAL auth module with persistent file-based token cache.
// Authenticate once — all scripts reuse the cached token automatically.

const msal = require("@azure/msal-node");
const fs = require("fs");
const path = require("path");

const D365_URL = "https://mauriciomaster.crm.dynamics.com";
const CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";
const AUTHORITY = "https://login.microsoftonline.com/organizations";
const CACHE_FILE = path.join(__dirname, ".msal-cache.json");

// ── Persistent cache plugin ────────────────────────────────────────
function readCache() {
    try { return fs.readFileSync(CACHE_FILE, "utf-8"); } catch { return ""; }
}

function writeCache(data) {
    fs.writeFileSync(CACHE_FILE, data, "utf-8");
}

const cachePlugin = {
    beforeCacheAccess: async (ctx) => {
        const data = readCache();
        if (data) ctx.tokenCache.deserialize(data);
    },
    afterCacheAccess: async (ctx) => {
        if (ctx.cacheHasChanged) {
            writeCache(ctx.tokenCache.serialize());
        }
    },
};

// ── Singleton PCA ──────────────────────────────────────────────────
const pca = new msal.PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: AUTHORITY },
    cache: { cachePlugin },
});

const scopes = [`${D365_URL}/.default`];

async function getToken() {
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
        try {
            const result = await pca.acquireTokenSilent({
                scopes,
                account: accounts[0],
            });
            return result.accessToken;
        } catch {
            // Refresh token expired — fall through to interactive
        }
    }

    const result = await pca.acquireTokenByDeviceCode({
        scopes,
        deviceCodeCallback: (resp) => {
            console.log("\n=============================================");
            console.log(resp.message);
            console.log("=============================================\n");
        },
    });
    return result.accessToken;
}

// ── Shared HTTP helper ─────────────────────────────────────────────
const https = require("https");

function apiRequest(method, urlPath, accessToken, body, extraHeaders) {
    return new Promise((resolve, reject) => {
        const baseUrl = new URL(D365_URL);
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
        };
        if (extraHeaders) Object.assign(headers, extraHeaders);
        const options = {
            hostname: baseUrl.hostname,
            path: encodeURI(urlPath).replace(/'/g, "%27"),
            method,
            headers,
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
                } else {
                    const err = new Error(`HTTP ${res.statusCode}: ${data}`);
                    err.status = res.statusCode;
                    reject(err);
                }
            });
        });
        req.on("error", reject);
        if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
        req.end();
    });
}

async function apiGet(token, path) {
    return (await apiRequest("GET", path, token)).data;
}

module.exports = { D365_URL, getToken, apiGet, apiRequest };
