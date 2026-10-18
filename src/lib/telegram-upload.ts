const MAX_CLOUD_BYTES = Number(process.env.TELEGRAM_MAX_UPLOAD_MB || 49) * 1024 * 1024;

export function telegramApiRoot(): string {
  return (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").replace(/\/$/, "");
}

/**
 * Cloud Bot API ~50 MB. Local Bot API (~2 GB) when TELEGRAM_API_ROOT points at a local server.
 */
export async function sendVideoToStorageChannel(opts: {
  buffer: Buffer;
  filename: string;
  caption: string;
}): Promise<{ fileId: string; messageId: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID || process.env.CHANNEL_ID;
  if (!token || !channel) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID required for video ingest");
  }
  if (opts.buffer.length > MAX_CLOUD_BYTES && !process.env.TELEGRAM_API_ROOT) {
    throw new Error(
      `File too large for cloud Bot API (${Math.round(opts.buffer.length / 1024 / 1024)} MB). Use a local Bot API server (up to ~2 GB) or post to the channel with #slug N-qism.`
    );
  }
  const form = new FormData();
  form.set("chat_id", channel);
  form.set("caption", opts.caption);
  form.set("supports_streaming", "true");
  form.set("video", new Blob([new Uint8Array(opts.buffer)]), opts.filename);

  const res = await fetch(`${telegramApiRoot()}/bot${token}/sendVideo`, { method: "POST", body: form });
  const json = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id: number; video?: { file_id: string }; document?: { file_id: string } };
  };
  if (!json.ok || !json.result) {
    throw new Error(json.description || "Telegram sendVideo failed");
  }
  const fileId = json.result.video?.file_id || json.result.document?.file_id;
  if (!fileId) throw new Error("Telegram did not return file_id");
  return { fileId, messageId: String(json.result.message_id) };
}
