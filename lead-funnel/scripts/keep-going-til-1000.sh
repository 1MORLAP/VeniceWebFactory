#!/bin/bash
# Run lead-funnel queries until actionable count >= TARGET.
# Smart-resume safe: re-running this script after a kill picks up exactly
# where it left off (place_id UNIQUE prevents re-discovery).
#
# Usage:
#   ./keep-going-til-1000.sh                    # stops at 1000
#   TARGET=2000 ./keep-going-til-1000.sh        # stops at 2000
#   COUNT=20 ./keep-going-til-1000.sh           # 20 leads per query (default 30)
#
# Progress logged to: lead-funnel/reports/keep-going-<timestamp>.log

set -u

LEADS_DIR="/Users/tomasz/WebFactory/lead-funnel"
DB="$LEADS_DIR/leads.db"
TARGET="${TARGET:-1000}"
COUNT="${COUNT:-30}"
LOG="$LEADS_DIR/reports/keep-going-$(date +%Y%m%d-%H%M).log"
CLEANUP_EVERY=15

count_actionable() {
  sqlite3 "$DB" "SELECT COUNT(*) FROM leads WHERE filter_status='passed' AND awfulness_score IS NOT NULL AND outreach_email IS NOT NULL"
}

apply_email_filter() {
  echo "[$(date '+%H:%M:%S')] === applying email filter (backfill /contact + reject no-email) ===" | tee -a "$LOG"
  node "$LEADS_DIR/scripts/backfill-emails.js" 2>&1 | tail -3 | tee -a "$LOG"
  sqlite3 "$DB" "UPDATE leads SET filter_status='rejected', filter_reason='no_email' WHERE filter_status='passed' AND outreach_email IS NULL" 2>&1 | tee -a "$LOG"
  node "$LEADS_DIR/report.js" 2>&1 | tail -2 | tee -a "$LOG"
}

# Industries — broad survey of small-business categories that hit our V1 scope
INDUSTRIES=(
  "plumbers small rural"
  "HVAC contractors small rural"
  "electrical contractors small rural"
  "roofing contractors small rural"
  "siding contractors rural"
  "concrete contractors rural"
  "foundation repair rural"
  "masons rural"
  "chimney sweep rural"
  "gutter installation rural"
  "excavation rural"
  "small painters rural"
  "fence companies rural"
  "tree services rural"
  "snow removal rural"
  "small lawn care rural"
  "pest control small rural"
  "cleaning services rural"
  "carpet cleaning rural"
  "pressure washing rural"
  "window cleaning rural"
  "junk removal rural"
  "self-storage rural"
  "small accountants rural"
  "small tax preparers rural"
  "computer repair rural"
  "appliance repair rural"
  "garage door services rural"
  "small motels rural"
  "campgrounds rural"
  "RV parks rural"
  "machine shops rural"
  "welding shops rural"
  "upholstery rural"
  "small jewelers rural"
  "antique stores rural"
  "tire shops rural"
  "auto body shops rural"
  "tractor repair rural"
  "farm equipment repair rural"
  "marine repair"
  "small motorcycle shops rural"
  "feed stores rural"
  "lumber yards rural"
  "hardware stores rural"
  "small bakeries rural"
  "butcher shops rural"
  "florists rural"
  "small barbershops rural"
  "shoe repair rural"
  "watch repair rural"
  "picture framing rural"
  "music shops rural"
  "print shops rural"
  "wedding photographers rural"
  "piano tuning rural"
  "quilt shops rural"
  "yarn shops rural"
  "used book stores rural"
  "coin shops rural"
  "small custom tailor rural"
  "taxidermy rural"
  "towing services rural"
  "gunsmiths rural"
  "small bait shops"
  "small fishing tackle"
  "small bicycle shops rural"
  "propane delivery rural"
  "firewood delivery rural"
  "small art galleries rural"
  "funeral homes"
  "monument shops"
  "septic services rural"
  "well drilling rural"
  "veterinary rural"
  "locksmiths rural"
  "bail bonds"
  "custom home builders rural"
  "tractor sales rural"
  "small B&B rural"
)

# States — every US state plus productive Canadian provinces
STATES=(
  "Alabama" "Arkansas" "Connecticut" "Delaware" "Florida" "Georgia" "Idaho"
  "Illinois" "Indiana" "Iowa" "Kansas" "Kentucky" "Louisiana" "Maine"
  "Maryland" "Massachusetts" "Michigan" "Minnesota" "Mississippi" "Missouri"
  "Montana" "Nebraska" "Nevada" "New Hampshire" "New Jersey" "New Mexico"
  "New York" "North Carolina" "North Dakota" "Ohio" "Oklahoma" "Oregon"
  "Pennsylvania" "Rhode Island" "South Carolina" "South Dakota" "Tennessee"
  "Texas" "Utah" "Vermont" "Virginia" "Washington" "West Virginia" "Wisconsin"
  "Wyoming" "Ontario" "Alberta" "Manitoba" "Saskatchewan" "Nova Scotia"
  "New Brunswick"
)

echo "=== keep-going-til-1000 starting $(date) ===" | tee -a "$LOG"
echo "TARGET=$TARGET  COUNT=$COUNT  CLEANUP_EVERY=$CLEANUP_EVERY queries" | tee -a "$LOG"
echo "starting actionable count: $(count_actionable)" | tee -a "$LOG"
echo | tee -a "$LOG"

iter=0
since_cleanup=0

# Iterate state-then-industry to mix up progress (more variety per cleanup interval)
for state in "${STATES[@]}"; do
  for industry in "${INDUSTRIES[@]}"; do
    current=$(count_actionable)
    if [ "$current" -ge "$TARGET" ]; then
      echo "[$(date '+%H:%M:%S')] *** HIT TARGET *** actionable=$current >= $TARGET" | tee -a "$LOG"
      apply_email_filter
      final=$(count_actionable)
      echo "[$(date '+%H:%M:%S')] FINAL: $final actionable" | tee -a "$LOG"
      exit 0
    fi
    iter=$((iter + 1))
    since_cleanup=$((since_cleanup + 1))
    query="$industry $state"
    echo "[$(date '+%H:%M:%S')] iter=$iter cur=$current/$TARGET — $query" | tee -a "$LOG"
    node "$LEADS_DIR/index.js" "$query" "$COUNT" 2>&1 | grep -E "(passed|rejected|✓|FAILED|✗ done)" | head -8 | tee -a "$LOG"

    if [ "$since_cleanup" -ge "$CLEANUP_EVERY" ]; then
      apply_email_filter
      since_cleanup=0
    fi
  done
done

# Out of queries — apply final cleanup and report
apply_email_filter
final=$(count_actionable)
echo "[$(date '+%H:%M:%S')] EXHAUSTED query list — final actionable=$final / target=$TARGET" | tee -a "$LOG"
echo "(generate more industries/states and re-run if you need to push further)" | tee -a "$LOG"
