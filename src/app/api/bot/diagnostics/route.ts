import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
  const botUrl = env.ANIME_BOT_API_URL || "https://dubanix.onrender.com";
  const apiKey = env.ANIME_BOT_API_KEY || "";
  const botUsername = env.ANIME_BOT_USERNAME || "DubAniXbot";

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    config: {
      botUrl,
      botUsername,
      apiKeyConfigured: Boolean(apiKey),
    },
    checks: {},
  };

  // 1. Check Render /health endpoint
  try {
    const healthRes = await fetch(`${botUrl}/health`, {
      signal: AbortSignal.timeout(6000),
    });
    report.checks.renderServerHealth = {
      status: healthRes.ok ? "ONLINE" : "ERROR",
      httpCode: healthRes.status,
    };
  } catch (err: any) {
    report.checks.renderServerHealth = {
      status: "OFFLINE",
      error: err.message,
    };
  }

  // 2. Check Bot API Key with /api/animes
  try {
    const apiRes = await fetch(`${botUrl}/api/animes`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(6000),
    });
    const body = await apiRes.json().catch(() => null);
    report.checks.botApiKey = {
      status: apiRes.ok ? "VALID" : "INVALID",
      httpCode: apiRes.status,
      response: body,
    };
  } catch (err: any) {
    report.checks.botApiKey = {
      status: "ERROR",
      error: err.message,
    };
  }

  // 3. Check Telegram Bot Token via getMe
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${apiKey}/getMe`, {
      signal: AbortSignal.timeout(6000),
    });
    const tgData = await tgRes.json().catch(() => null);
    if (tgData?.ok) {
      report.checks.telegramBotToken = {
        status: "VALID_TELEGRAM_TOKEN",
        botUsername: tgData.result?.username,
        botName: tgData.result?.first_name,
        canReadMessages: tgData.result?.can_read_all_group_messages,
      };
    } else {
      report.checks.telegramBotToken = {
        status: "NOT_TELEGRAM_TOKEN",
        note: "API Key is not a Telegram bot token, or token is invalid",
      };
    }
  } catch (err: any) {
    report.checks.telegramBotToken = {
      status: "ERROR",
      error: err.message,
    };
  }

  // Summary diagnosis
  const isServerOnline = report.checks.renderServerHealth?.status === "ONLINE";
  const isApiKeyValid = report.checks.botApiKey?.status === "VALID";

  let diagnosis = "";
  if (isServerOnline && isApiKeyValid) {
    diagnosis = "Everything is configured correctly and working! ✅";
  } else if (isServerOnline && !isApiKeyValid) {
    diagnosis =
      "The bot server (Render) is online, but the X-API-Key is invalid. Check API_KEY under Environment Variables in your Render project.";
  } else {
    diagnosis = "The bot server (Render) is offline or unresponsive.";
  }

  return NextResponse.json({
    ok: isServerOnline && isApiKeyValid,
    diagnosis,
    report,
  });
}
