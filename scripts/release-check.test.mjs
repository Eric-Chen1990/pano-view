import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkRelease, readNpmPackage, shouldTestConverter, verifyPublishedVersions } from "./release-check.mjs";

test("viewer/editor-only releases skip converter tests", () => {
  const paths = ["packages/react/package.json", "packages/react/src/index.ts", "packages/editor/package.json"];
  assert.equal(shouldTestConverter("push", paths), false);
  assert.equal(shouldTestConverter("pull_request", paths), false);
  assert.equal(shouldTestConverter("push", []), false);
  assert.equal(shouldTestConverter("push", ["packages/converter/README.md"]), false);
});

test("converter releases, source and shared inputs require converter tests", () => {
  assert.equal(shouldTestConverter("push", ["packages/react/package.json"], true), true);
  for (const path of [
    "packages/converter/src/index.ts", "packages/converter/test/converter.test.mjs",
    "packages/converter/package.json", "shared/viewer-config.ts", "package.json",
    "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", ".changeset/config.json",
    ".github/workflows/release.yml", ".github/workflows/converter.yml",
    "scripts/release-check.mjs", "scripts/release-check.test.mjs",
  ]) {
    assert.equal(shouldTestConverter("push", [path]), true, path);
    assert.equal(shouldTestConverter("pull_request", [path]), true, path);
  }
});

test("manual runs and unavailable comparisons keep full converter verification", () => {
  assert.equal(shouldTestConverter("workflow_dispatch", []), true);
  assert.equal(shouldTestConverter("push", null), true);
  assert.equal(shouldTestConverter("pull_request", null), true);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "pano-release-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".changeset"));
  await mkdir(join(root, "apps"));
  await writeFile(join(root, ".changeset/config.json"), JSON.stringify({ access: "public", ignore: [] }));
  for (const folder of ["view", "editor", "converter"]) {
    const directory = join(root, "packages", folder);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      name: `@ericchen1990/pano-${folder}`,
      version: "1.1.0",
      repository: { url: "git+https://github.com/Eric-Chen1990/pano-view.git" },
    }));
    await writeFile(join(directory, "CHANGELOG.md"), "## 1.1.0\n\n### Minor Changes\n\n- Feature\n");
  }
  return root;
}
const metadata = (published = false) => async (name) => ({
  name, versions: { "1.0.0": {}, ...(published ? { "1.1.0": {} } : {}) },
  "dist-tags": { latest: published ? "1.1.0" : "1.0.0" },
});

test("plans all unpublished packages and skips already published versions on retry", async (t) => {
  const root = await fixture(t);
  assert.equal((await checkRelease(root, metadata())).length, 3);
  assert.equal((await checkRelease(root, metadata(true))).length, 0);
  const remaining = await checkRelease(root, (name) => metadata(name.endsWith("view"))(name));
  assert.equal(remaining.length, 2);
  assert.ok(remaining.every(({ name }) => !name.endsWith("view")));
});
test("blocks pending changesets and missing changelogs", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, ".changeset/pending.md"), "---\n---\n");
  await assert.rejects(checkRelease(root, metadata()), /Pending changesets/);
  await rm(join(root, ".changeset/pending.md"));
  await writeFile(join(root, "packages/view/CHANGELOG.md"), "## 1.0.0\n");
  await assert.rejects(checkRelease(root, metadata()), /Missing generated changelog/);
});
test("blocks unknown public workspace packages and prerelease mode", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, ".changeset/pre.json"), "{}");
  await assert.rejects(checkRelease(root, metadata()), /stable releases only/);
  await rm(join(root, ".changeset/pre.json"));
  await mkdir(join(root, "apps/unexpected"));
  await writeFile(join(root, "apps/unexpected/package.json"), '{"name":"unexpected"}');
  await assert.rejects(checkRelease(root, metadata()), /Unexpected public package/);
});
test("blocks backwards latest updates, malformed metadata and registry failures", async (t) => {
  const root = await fixture(t);
  await assert.rejects(checkRelease(root, async (name) => ({
    name, versions: {}, "dist-tags": { latest: "2.0.0" },
  })), /latest backwards/);
  await assert.rejects(checkRelease(root, async (name) => ({ name })), /Invalid npm versions/);
  await assert.rejects(checkRelease(root, async () => { throw new Error("network unavailable"); }), /network unavailable/);
});
test("HTTP errors never become an unpublished release plan", async (t) => {
  for (const status of [401, 403, 404, 429, 503]) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    await assert.rejects(readNpmPackage("@ericchen1990/pano-view"), new RegExp(`HTTP ${status}`));
    t.mock.restoreAll();
  }
});

test("post-publish verification waits for accepted versions to become visible", async (t) => {
  const root = await fixture(t);
  let reads = 0;
  let waits = 0;
  await verifyPublishedVersions(root, {
    readPackage: (name) => metadata(++reads > 3)(name),
    wait: async () => { waits++; },
    attempts: 3,
  });
  assert.equal(reads, 6);
  assert.equal(waits, 1);
});

test("post-publish visibility waits even if latest moves before scanning finishes", async (t) => {
  const root = await fixture(t);
  let reads = 0;
  let waits = 0;
  await verifyPublishedVersions(root, {
    readPackage: async (name) => ({
      ...await metadata(++reads > 3)(name),
      "dist-tags": { latest: "1.1.0" },
    }),
    wait: async () => { waits++; },
    attempts: 2,
  });
  assert.equal(waits, 1);
});

test("post-publish verification stops after its read-only polling budget", async (t) => {
  const root = await fixture(t);
  let waits = 0;
  await assert.rejects(verifyPublishedVersions(root, {
    readPackage: metadata(),
    wait: async () => { waits++; },
    attempts: 2,
  }), /still unavailable.*pano-view@1\.1\.0.*Do not republish automatically/);
  assert.equal(waits, 1);
});

test("already visible releases return immediately; registry errors fail without waiting", async (t) => {
  const root = await fixture(t);
  let waits = 0;
  const wait = async () => { waits++; };
  await verifyPublishedVersions(root, { readPackage: metadata(true), wait });
  await assert.rejects(verifyPublishedVersions(root, {
    readPackage: async () => { throw new Error("HTTP 403"); }, wait,
  }), /HTTP 403/);
  assert.equal(waits, 0);
});
