import ZAI, { VisionMessage } from "z-ai-web-dev-sdk";
import { readFileSync } from "node:fs";

/** Usage: bun scripts/vlm-check.ts <image-path> "<prompt>" */
async function main() {
  const [path, prompt] = process.argv.slice(2);
  if (!path || !prompt) {
    console.error("Usage: bun scripts/vlm-check.ts <image-path> \"<prompt>\"");
    process.exit(1);
  }
  const b64 = readFileSync(path).toString("base64");
  const ext = path.endsWith(".png") ? "png" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "jpeg" : "png";
  const zai = await ZAI.create();
  const messages: VisionMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: `${prompt}\n\nOutput only plain text, no markdown.` },
        { type: "image_url", image_url: { url: `data:image/${ext};base64,${b64}` } },
      ],
    },
  ];
  const response = await zai.chat.completions.createVision({
    model: "glm-4.6v",
    messages,
    thinking: { type: "disabled" },
  });
  console.log(response.choices?.[0]?.message?.content ?? JSON.stringify(response).slice(0, 2000));
}

main().catch((e) => {
  console.error("VLM check failed:", e?.message || e);
  process.exit(1);
});
