#!/bin/sh
# usage: scripts/labels.sh owner/repo
R=$1
mk(){ gh label create "$1" -R "$R" -c "$2" -d "$3" --force; }
mk sev1-blocker B60205 "Can't play/crash"; mk sev2-major D93F0B "Major break"; mk sev3-minor FBCA04 "Minor"; mk sev4-polish C2E0C6 "Polish"
for a in gameplay engine art audio ui net world perf mobile web; do mk "area:$a" 1D76DB "Area: $a"; done
mk feel 5319E7 "Game feel"; mk balance 5319E7 "Balance"; mk perf 5319E7 "Performance"; mk feedback 0E8A16 "Playtest feedback"
