import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required (load it from your private .env file)`);
  return value;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const source = option("--source");
const prefix = option("--prefix")?.replace(/^\/+|\/+$/g, "");
if (!source || !prefix || !/^hls\/[a-zA-Z0-9_-]+\/[1-9]\d*$/.test(prefix)) {
  console.error("Usage: node --env-file=.env scripts/upload-hls-to-r2.mjs --source ./hls-output --prefix hls/<anime-slug>/<episode-number>");
  process.exitCode = 2;
} else {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  const root = path.resolve(source);
  const allowedTypes = new Map([
    [".m3u8", "application/vnd.apple.mpegurl"],
    [".ts", "video/mp2t"],
    [".m4s", "video/iso.segment"],
    [".mp4", "video/mp4"],
    [".aac", "audio/aac"],
    [".vtt", "text/vtt; charset=utf-8"],
  ]);

  async function listFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) throw new Error(`Hidden files are not allowed: ${entry.name}`);
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${fullPath}`);
      if (entry.isDirectory()) files.push(...await listFiles(fullPath));
      else if (entry.isFile()) files.push(fullPath);
    }
    return files;
  }

  try {
    const files = await listFiles(root);
    if (!files.some((file) => path.relative(root, file).split(path.sep).join("/") === "index.m3u8")) {
      throw new Error("Source folder must contain index.m3u8 at its root");
    }
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const contentType = allowedTypes.get(ext);
      if (!contentType) throw new Error(`Unsupported HLS file type: ${ext || "(no extension)"}`);
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (relative.split("/").some((part) =>
        part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part)
      )) {
        throw new Error(`Invalid source file path: ${relative}`);
      }
      const key = `${prefix}/${relative}`;
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(file),
        ContentType: contentType,
        CacheControl: "private, no-store",
      }));
      console.log(`Uploaded ${key}`);
    }
    console.log(`Done: ${files.length} HLS files uploaded.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "R2 HLS upload failed");
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}
