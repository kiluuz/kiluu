"""Add airDay/airTime to ONGOING animes in scripts/seed.ts (keeps fresh DBs in sync)."""
import re

SCHEDULE = {
    "demon-slayer": (0, "22:00"),
    "jujutsu-kaisen": (4, "21:30"),
    "one-piece": (0, "10:30"),
    "frieren-beyond-journeys-end": (5, "23:00"),
    "chainsaw-man": (2, "22:30"),
    "spy-x-family": (6, "18:30"),
    "hunter-x-hunter": (3, "19:00"),
    "tokyo-revengers": (6, "21:00"),
    "my-hero-academia": (6, "17:30"),
    "dragon-ball-super": (1, "11:00"),
    "bleach-tybw": (1, "22:00"),
    "made-in-abyss": (3, "23:30"),
}

path = "/home/z/my-project/scripts/seed.ts"
src = open(path).read()

for slug, (day, time) in SCHEDULE.items():
    # find the block for this slug, then the ONGOING status line within it
    m = re.search(r'(slug: "%s",.*?status: )"ONGOING"' % re.escape(slug), src, re.DOTALL)
    if not m:
        print(f"!! {slug}: block not found")
        continue
    if f'// {slug}' in src:
        continue
    # append airDay/airTime on the line that has episodes: eps(
    block_start = m.start()
    # find "episodes: eps(" after block_start
    ep_idx = src.index("episodes: eps(", block_start)
    line_end = src.index("\n", ep_idx)
    insertion = f", airDay: {day}, airTime: \"{time}\""
    # insert before the trailing comma+newline of that line: line ends with "episodes: eps(8),"
    line = src[block_start:line_end]
    src = src[:line_end] + f"\n    airDay: {day}, airTime: \"{time}\"," + src[line_end:]
    print(f"ok {slug} -> day {day} @ {time}")

open(path, "w").write(src)
print("seed.ts updated")
