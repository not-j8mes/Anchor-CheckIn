import assert from "node:assert/strict";
import test from "node:test";
import type { LabelData } from "@workspace/api-client-react";
import {
  firstNameFontSize,
  lastNameFontSize,
  pickupNameFontSize,
  renderLabelHtml,
  renderParentPickupLabelHtml,
  renderPrintPagesHtml,
} from "./label-renderer";

const sampleLabel: LabelData = {
  childName: "Charlotte Thomas",
  guardianName: "Elizabeth Thomas",
  labelCode: "A7K4",
  checkinDate: "2026-07-28T18:19:00.000Z",
  room: "Nursery",
  allergies: "Tree nuts",
  organizationName: "  Oakwood Bible Chapel  ",
};

test("registrant label names continuously scale down for longer text", () => {
  assert.equal(firstNameFontSize("Ava"), "52pt");
  assert.ok(parseFloat(firstNameFontSize("Alexandria-Montgomery")) < 21);
  assert.ok(parseFloat(lastNameFontSize("Montgomery-Wellington-Smythe")) < 10);
  assert.ok(
    parseFloat(
      pickupNameFontSize(
        "Alexandria Montgomery-Wellington-Smythe · Early Childhood Nursery",
        2,
      ),
    ) < 9,
  );
});

test("long registrant names print without ellipsis styling", () => {
  const html = renderLabelHtml(
    {
      ...sampleLabel,
      childName: "Alexandria-Montgomery Wellington-Smythe",
      guardianName: undefined,
      organizationName: "",
    },
    0,
    1,
  );
  assert.match(html, /Alexandria-Montgomery/);
  assert.doesNotMatch(html, /Alexandria-Montgomery<\/div>[^]*text-overflow:ellipsis/);
});

test("child labels render the trimmed organization and guardian footer", () => {
  const html = renderLabelHtml(sampleLabel, 0, 1);
  assert.match(html, /Oakwood Bible Chapel/);
  assert.doesNotMatch(html, /  Oakwood Bible Chapel  /);
  assert.match(
    html,
    /Parent\/Guardian:<\/strong>&nbsp;Elizabeth Thomas/,
  );
  assert.doesNotMatch(html, /Anchor Events/);
});

test("empty organization and guardian values never render invalid text", () => {
  const html = renderLabelHtml(
    {
      ...sampleLabel,
      organizationName: "   ",
      guardianName: undefined,
    },
    0,
    1,
  );
  assert.doesNotMatch(html, /undefined|null|Anchor Events/);
  assert.doesNotMatch(html, /Parent\/Guardian:/);
  assert.match(html, /justify-content:space-between/);
});

test("parent pickup labels retain organization, children, and pickup code", () => {
  const sibling = { ...sampleLabel, childName: "Henry Thomas" };
  const html = renderParentPickupLabelHtml([sampleLabel, sibling]);
  assert.match(html, /Oakwood Bible Chapel/);
  assert.match(html, /Charlotte Thomas · Nursery/);
  assert.match(html, /Henry Thomas · Nursery/);
  for (const character of sampleLabel.labelCode) {
    assert.match(html, new RegExp(`>${character}<`));
  }
});

test("family security printing produces one child page per child and one shared parent page", () => {
  const sibling = { ...sampleLabel, childName: "Henry Thomas" };
  const pages = renderPrintPagesHtml(
    [sampleLabel, sibling],
    "child_security",
  );
  assert.equal(pages.length, 3);
  assert.match(pages[0]!, /Elizabeth Thomas/);
  assert.match(pages[1]!, /Elizabeth Thomas/);
  assert.match(pages[2]!, /Charlotte Thomas/);
  assert.match(pages[2]!, /Henry Thomas/);
});

test("test-label pages contain labels only, never Desk Controls or application chrome", () => {
  const pages = renderPrintPagesHtml([sampleLabel], "child_security");
  const output = pages.join("");
  assert.equal(pages.length, 2);
  assert.match(output, /Charlotte Thomas/);
  assert.match(output, /PARENT PICKUP LABEL/);
  assert.match(output, /Oakwood Bible Chapel/);
  assert.match(output, /Parent\/Guardian:/);
  assert.doesNotMatch(output, /Desk Controls|Check-In Desk|Search-only mode|Sidebar/);
});

test("long organization names are constrained before the timestamp", () => {
  const html = renderLabelHtml(
    {
      ...sampleLabel,
      organizationName:
        "A Very Long Organization Name That Must Not Overlap The Timestamp",
    },
    0,
    1,
  );
  assert.match(html, /max-width:50mm;min-width:0/);
  assert.match(html, /text-overflow:ellipsis/);
  assert.match(html, /flex-shrink:0/);
});
