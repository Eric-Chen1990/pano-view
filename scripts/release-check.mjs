import assert from "node:assert/strict";
import { appendFile, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";

const registry = "https://registry.npmjs.org";
const repository = "git+https://github.com/Eric-Chen1990/pano-view.git";
const expectedPackages = new Set([
  "@ericchen1990/pano-view",
  "@ericchen1990/pano-editor",
  "@ericchen1990/pano-converter",
]);
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function shouldTestConverter(eventName, paths, hasConverterRelease = false) {
  // Manual runs and unavailable comparisons retain full release validation.
  if (eventName === "workflow_dispatch" || paths === null || hasConverterRelease) return true;
  const sharedFiles = new Set([
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    ".changeset/config.json",
    ".github/workflows/release.yml",
    ".github/workflows/converter.yml",
  ]);
  return paths.some((path) => !path.endsWith(".md") && (
    path.startsWith("packages/converter/") ||
    path.startsWith("shared/") ||
    path.startsWith(".github/actions/setup-ffmpeg/") ||
    sharedFiles.has(path) ||
    /^scripts\/release-check.*\.mjs$/.test(path)
  ));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readNpmPackage(name) {
  const response = await fetch(`${registry}/${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(30_000),
    headers: { accept: "application/json" },
  });
  // A missing package needs an initial manual setup; other failures must never
  // be treated as evidence that a version is unpublished.
  assert.ok(response.ok, `Cannot read ${name}: npm returned HTTP ${response.status}`);
  return response.json();
}

async function readReleasePackages(root) {
  const config = await readJson(resolve(root, ".changeset/config.json"));
  assert.equal(config.access, "public", "Changesets must publish public packages");
  const changesets = await readdir(resolve(root, ".changeset"));
  assert.ok(!changesets.includes("pre.json"), "This workflow supports stable releases only");

  const packages = [];
  for (const workspace of ["packages", "apps"]) {
    for (const entry of await readdir(resolve(root, workspace), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = resolve(root, workspace, entry.name);
      let manifest;
      try {
        manifest = await readJson(resolve(directory, "package.json"));
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      if (manifest.private) continue;
      assert.ok(expectedPackages.has(manifest.name), `Unexpected public package: ${manifest.name}`);
      assert.ok(!config.ignore.includes(manifest.name), `${manifest.name} is ignored by Changesets`);
      assert.equal(manifest.repository?.url, repository, `Wrong repository for ${manifest.name}`);
      assert.ok(stableVersion.test(manifest.version), `Invalid stable version for ${manifest.name}`);
      assert.ok(!manifest.publishConfig?.registry || manifest.publishConfig.registry.replace(/\/$/, "") === registry,
        `Wrong registry for ${manifest.name}`);
      assert.ok(!manifest.publishConfig?.access || manifest.publishConfig.access === "public",
        `Wrong access for ${manifest.name}`);
      const changelog = await readFile(resolve(directory, "CHANGELOG.md"), "utf8");
      assert.ok(changelog.split(/\r?\n/).includes(`## ${manifest.version}`),
        `Missing generated changelog for ${manifest.name}@${manifest.version}`);
      packages.push(manifest);
    }
  }
  assert.deepEqual(new Set(packages.map(({ name }) => name)), expectedPackages,
    "The release must include exactly the three configured public packages");
  return { packages, changesets };
}

async function readPackageMetadata(name, readPackage) {
  const metadata = await readPackage(name);
  assert.equal(metadata.name, name, `Invalid npm metadata for ${name}`);
  assert.ok(metadata.versions && typeof metadata.versions === "object" && !Array.isArray(metadata.versions),
    `Invalid npm versions for ${name}`);
  return metadata;
}

export async function checkRelease(root, readPackage = readNpmPackage) {
  const { packages, changesets } = await readReleasePackages(root);
  const unpublished = [];
  for (const { name, version } of packages) {
    const metadata = await readPackageMetadata(name, readPackage);
    if (Object.hasOwn(metadata.versions, version)) continue;
    const latest = metadata["dist-tags"]?.latest;
    assert.ok(stableVersion.test(latest), `Missing stable latest version for ${name}`);
    const currentParts = version.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);
    const difference = currentParts.map((part, index) => part - latestParts[index]).find((part) => part !== 0);
    assert.ok(difference > 0, `Refusing to move ${name} latest backwards from ${latest} to ${version}`);
    unpublished.push({ name, version });
  }
  if (unpublished.length) {
    assert.ok(!changesets.some((name) => name.endsWith(".md") && name !== "README.md"),
      "Pending changesets: run pnpm version-packages and commit versions/changelogs before release");
  }
  return unpublished;
}

export async function verifyPublishedVersions(root, {
  readPackage = readNpmPackage,
  wait = () => setTimeout(20_000),
  attempts = 61,
} = {}) {
  assert.ok(Number.isInteger(attempts) && attempts > 0, "Verification attempts must be positive");
  const { packages } = await readReleasePackages(root);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pending = [];
    for (const { name, version } of packages) {
      const metadata = await readPackageMetadata(name, readPackage);
      // npm can advance latest before scanning makes the version available.
      if (!Object.hasOwn(metadata.versions, version)) pending.push(`${name}@${version}`);
    }
    if (!pending.length) return;
    assert.ok(attempt < attempts,
      `Versions are still unavailable on npm: ${pending.join(", ")}. ` +
      "Accepted uploads may still be processing; inspect npm before retrying. Do not republish automatically.");
    console.log(`Waiting for npm availability (${attempt}/${attempts}): ${pending.join(", ")}`);
    await wait();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes("--verify")) {
    await verifyPublishedVersions(process.cwd());
    console.log("All workspace versions are available on npm.");
  } else {
    const unpublished = await checkRelease(process.cwd());
    const summary = unpublished.length
      ? `Packages to publish:\n${unpublished.map(({ name, version }) => `- ${name}@${version}`).join("\n")}`
      : "All workspace versions are already published; publication will be skipped.";
    console.log(summary);
    if (process.env.GITHUB_OUTPUT) {
      const hasConverterRelease = unpublished.some(({ name }) => name === "@ericchen1990/pano-converter");
      await appendFile(process.env.GITHUB_OUTPUT,
        `has-releases=${unpublished.length > 0}\nhas-converter-release=${hasConverterRelease}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n\n`);
    }
  }
}
