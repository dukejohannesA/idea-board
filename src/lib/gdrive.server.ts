import { google } from "googleapis";
import { Readable } from "stream";

const FOLDER_ID = process.env["GDRIVE_FOLDER_ID"] ?? "";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env["GDRIVE_CLIENT_EMAIL"] ?? "",
      private_key: (process.env["GDRIVE_PRIVATE_KEY"] ?? "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

/**
 * Upload a base64-encoded image to Google Drive and return a public view URL.
 * The file is placed inside the configured folder and made publicly readable.
 */
export async function uploadImage(
  base64Data: string,
  fileName: string,
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  // Strip data URL prefix if present
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match?.[1] ?? "image/jpeg";
  const raw = match ? match[2] : base64Data;

  const buf = Buffer.from(raw ?? "", "base64");

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType,
      body: Readable.from(buf),
    },
    fields: "id",
  });

  const fileId = res.data.id!;

  // Make the file publicly readable so the app can show it without auth
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  // Return a direct-ish thumbnail/view URL
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}
