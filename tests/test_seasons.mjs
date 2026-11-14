import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("custom_components/maison3d/www/season-effects.js","utf8");
const {automaticSeason,haCalendarDate}=await import(
  "data:text/javascript;base64,"+Buffer.from(source).toString("base64")
);
const at=iso=>new Date(iso);
const cases=[
  ["2026-02-28T12:00:00Z","winter"],
  ["2026-03-01T12:00:00Z","spring"],
  ["2026-05-31T12:00:00Z","spring"],
  ["2026-06-01T12:00:00Z","summer"],
  ["2026-08-31T12:00:00Z","summer"],
  ["2026-09-01T12:00:00Z","autumn"],
  ["2026-11-30T12:00:00Z","autumn"],
  ["2026-12-01T12:00:00Z","winter"],
  ["2027-01-01T12:00:00Z","winter"]
];
for(const [date,expected] of cases){
  assert.equal(automaticSeason("Europe/Paris",at(date)),expected,date);
}
// Before/after midnight in Home Assistant time zone. Different from UTC.
assert.equal(automaticSeason("Europe/Paris",at("2026-02-28T22:30:00Z")),"winter");
assert.equal(automaticSeason("Europe/Paris",at("2026-02-28T23:30:00Z")),"spring");
assert.equal(haCalendarDate("Europe/Paris",at("2026-02-28T23:30:00Z")).day,1);
assert.equal(automaticSeason("America/New_York",at("2026-03-01T01:00:00Z")),"winter");
assert.equal(automaticSeason("America/New_York",at("2026-03-01T06:00:00Z")),"spring");
console.log("Season boundary and Home Assistant timezone tests: OK");
