import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";

const {automaticSeason,haCalendarDate,haHour}=await import(
  pathToFileURL("custom_components/maison3d/www/season-effects.js").href
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
// Night fallback without sun entity: hour of the HA time zone, not of the browser.
assert.equal(haHour("Europe/Paris",at("2026-11-15T19:30:00Z")),20);
assert.equal(haHour("America/New_York",at("2026-11-15T19:30:00Z")),14);
assert.equal(haHour("Asia/Tokyo",at("2026-11-15T15:00:00Z")),0);
assert.equal(haHour("",at("2026-11-15T19:30:00Z")),19,"unknown zone → UTC");
assert.equal(haHour("Not/AZone",at("2026-11-15T05:00:00Z")),5);
console.log("Season boundary and Home Assistant timezone tests: OK");
