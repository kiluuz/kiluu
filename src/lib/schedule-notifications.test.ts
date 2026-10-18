import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SCHEDULE_TIMEZONE,
  formatScheduleLocalTime,
  resolveScheduleTimezone,
} from "@/lib/schedule-notifications";

test("schedule notification uses the configured timezone and Asia/Tashkent by default", () => {
  assert.equal(resolveScheduleTimezone(undefined), DEFAULT_SCHEDULE_TIMEZONE);
  assert.equal(resolveScheduleTimezone("Not/A_Timezone"), DEFAULT_SCHEDULE_TIMEZONE);
  assert.equal(resolveScheduleTimezone("America/Los_Angeles"), "America/Los_Angeles");
  assert.match(formatScheduleLocalTime(new Date("2026-10-15T12:00:00Z"), null), /Asia\/Tashkent/);
  assert.match(formatScheduleLocalTime(new Date("2026-10-15T12:00:00Z"), "America/Los_Angeles"), /America\/Los_Angeles/);
});
