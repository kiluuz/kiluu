#!/bin/bash
# Fetch anime cover art via z-ai image-search (stdout capture approach)
mkdir -p /home/z/my-project/image-data
cd /home/z/my-project/image-data

declare -A QUERIES=(
  ["aot"]="Attack on Titan anime key visual poster art"
  ["demonslayer"]="Demon Slayer Kimetsu no Yaiba anime key visual poster"
  ["onepiece"]="One Piece anime key visual poster art"
  ["naruto"]="Naruto Shippuden anime key visual poster"
  ["deathnote"]="Death Note anime key visual poster art"
  ["fma"]="Fullmetal Alchemist Brotherhood anime poster"
  ["sao"]="Sword Art Online anime key visual poster"
  ["spyfamily"]="Spy x Family anime key visual poster"
  ["tokyorev"]="Tokyo Revengers anime key visual poster"
  ["violet"]="Violet Evergarden anime key visual poster"
  ["yourname"]="Your Name Kimi no Na wa anime movie poster"
  ["edgerunners"]="Cyberpunk Edgerunners anime key visual poster"
  ["bebop"]="Cowboy Bebop anime key visual poster art"
  ["dbz"]="Dragon Ball Super anime key visual poster"
  ["mob"]="Mob Psycho 100 anime key visual poster"
  ["banner-scenic1"]="anime scenic landscape wallpaper cherry blossom night sky"
  ["banner-scenic2"]="anime city night neon lights wallpaper scenery"
  ["banner-scenic3"]="anime fantasy landscape mountains wallpaper art"
  ["avatar1"]="anime girl portrait avatar illustration"
  ["avatar2"]="anime boy portrait avatar illustration"
)

run_search() {
  local name="$1"
  local query="$2"
  if [ -s "$name.json" ]; then
    echo "SKIP $name"
    return
  fi
  local out
  out=$(z-ai image-search -q "$query" --count 3 --gl us --no-rank 2>/dev/null)
  if echo "$out" | grep -q '"success": true'; then
    echo "$out" | sed -n '/^{/,$p' > "$name.json"
    echo "OK $name"
  else
    echo "FAIL $name"
  fi
}

# batches of 2 to avoid rate limits
batch=()
count=0
for name in "${!QUERIES[@]}"; do
  batch+=("$name")
  count=$((count+1))
  if [ $count -eq 2 ]; then
    for n in "${batch[@]}"; do run_search "$n" "${QUERIES[$n]}" & done
    wait
    batch=()
    count=0
    sleep 2
  fi
done
for n in "${batch[@]}"; do run_search "$n" "${QUERIES[$n]}" & done
wait

echo "=== DONE ==="
ls -la /home/z/my-project/image-data/
