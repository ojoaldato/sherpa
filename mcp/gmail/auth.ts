import { OAuth2Client } from "google-auth-library";
import http from "node:http";
import open from "open";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".sherpa", "gmail");
const OAUTH_PATH = path.join(CONFIG_DIR, "oauth-keys.json");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const oauthFile = Bun.file(OAUTH_PATH);
  if (!(await oauthFile.exists())) {
    throw new Error(
      `OAuth keys not found at ${OAUTH_PATH}\n` +
      `Download from Google Cloud Console and place at:\n  ${OAUTH_PATH}`
    );
  }

  const keys = await oauthFile.json();
  const clientConfig = keys.installed ?? keys.web;
  if (!clientConfig) {
    throw new Error("Invalid OAuth keys file — expected 'installed' or 'web' credentials");
  }

  const redirectUri = clientConfig.redirect_uris?.[0] ?? "http://localhost:3000/oauth2callback";

  const client = new OAuth2Client(
    clientConfig.client_id,
    clientConfig.client_secret,
    redirectUri
  );

  const credFile = Bun.file(CREDENTIALS_PATH);
  if (await credFile.exists()) {
    const creds = await credFile.json();
    client.setCredentials(creds);

    if (creds.expiry_date && creds.expiry_date < Date.now()) {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      await saveCredentials(credentials);
    }

    return client;
  }

  throw new Error(
    `No credentials found. Run 'bun mcp/gmail/server.ts auth' to authenticate.`
  );
}

export async function runAuthFlow(): Promise<void> {
  const oauthFile = Bun.file(OAUTH_PATH);
  if (!(await oauthFile.exists())) {
    console.error(`OAuth keys not found at ${OAUTH_PATH}`);
    console.error("1. Go to https://console.cloud.google.com/apis/credentials");
    console.error("2. Create OAuth client ID (Desktop app)");
    console.error("3. Download JSON and save to:");
    console.error(`   ${OAUTH_PATH}`);
    process.exit(1);
  }

  const keys = await oauthFile.json();
  const clientConfig = keys.installed ?? keys.web;

  const client = new OAuth2Client(
    clientConfig.client_id,
    clientConfig.client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  const code = await listenForCode();

  console.log("\nOpening browser for Google authentication...");
  await open(authUrl);

  const authCode = await code;
  const { tokens } = await client.getToken(authCode);

  await Bun.$`mkdir -p ${CONFIG_DIR}`.quiet();
  await saveCredentials(tokens);
  console.log(`\nCredentials saved to ${CREDENTIALS_PATH}`);
}

function listenForCode(): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, "http://localhost:3000");
      const code = url.searchParams.get("code");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authenticated. You can close this tab.</h2>");
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("Missing code parameter");
      }
    });

    server.listen(3000, () => {
      console.log("Waiting for OAuth callback on http://localhost:3000 ...");
    });
  });
}

async function saveCredentials(credentials: unknown): Promise<void> {
  await Bun.$`mkdir -p ${CONFIG_DIR}`.quiet();
  await Bun.write(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
}
