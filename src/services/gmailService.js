
import { google } from "googleapis";
import crypto from "node:crypto";
import GmailAuth from "../models/GmailAuth.js";

const ACCOUNT_EMAIL = process.env.GOOGLE_ACCOUNT_EMAIL;

const getEncryptionKey = () => {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("Invalid Gmail token encryption key");
  }

  return Buffer.from(key, "hex");
};

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Encrypt refresh token using AES-256-GCM
const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    encryptedRefreshToken: encrypted,
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex")
  };
};

// Decrypt refresh token
const decryptToken = ({ encryptedRefreshToken, iv, authTag }) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(
    encryptedRefreshToken,
    "hex",
    "utf8"
  );

  decrypted += decipher.final("utf8");

  return decrypted;
};

// Sign OAuth state to prevent callback CSRF
const createOAuthState = () => {
  const payload = Buffer.from(
    JSON.stringify({
      email: ACCOUNT_EMAIL,
      expiresAt: Date.now() + 10 * 60 * 1000
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
};

const verifyOAuthState = (state) => {
  const [payload, receivedSignature] = (state || "").split(".");

  if (!payload || !receivedSignature) {
    throw new Error("Invalid OAuth state");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(payload)
    .digest();

  const received = Buffer.from(receivedSignature, "hex");

  if (
    received.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(received, expectedSignature)
  ) {
    throw new Error("OAuth state verification failed");
  }

  const data = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  );

  if (
    data.email !== ACCOUNT_EMAIL ||
    data.expiresAt < Date.now()
  ) {
    throw new Error("OAuth state expired or invalid");
  }

  return data;
};

// Generate Google authorization URL
export const generateGmailAuthUrl = () => {
  const oauth2Client = getOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
    state: createOAuthState()
  });
};

// Exchange authorization code and save encrypted refresh token
export const saveGmailOAuthTokens = async (code, state) => {
  verifyOAuthState(state);

  const oauth2Client = getOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Please authorize again."
    );
  }

  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
  });

  const profile = await gmail.users.getProfile({
    userId: "me"
  });

  const authenticatedEmail = profile.data.emailAddress?.toLowerCase();

  if (authenticatedEmail !== ACCOUNT_EMAIL.toLowerCase()) {
    throw new Error("Connected Gmail account does not match configured account");
  }

  const encrypted = encryptToken(tokens.refresh_token);

  await GmailAuth.findOneAndUpdate(
    { accountEmail: ACCOUNT_EMAIL.toLowerCase() },
    {
      accountEmail: ACCOUNT_EMAIL.toLowerCase(),
      ...encrypted
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );

  return {
    connected: true,
    accountEmail: authenticatedEmail
  };
};

// Create authenticated Gmail API client
export const getGmailClient = async () => {
  const authRecord = await GmailAuth.findOne({
    accountEmail: ACCOUNT_EMAIL.toLowerCase()
  });

  if (!authRecord) {
    throw new Error("Gmail account is not connected");
  }

  const refreshToken = decryptToken(authRecord);

  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client
  });
};
