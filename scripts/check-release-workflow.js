#!/usr/bin/env node

const fs = require("node:fs");

function fail(message) {
    console.error(message);
    process.exitCode = 1;
}

function readJson(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

const rootPackage = readJson("package.json");
const compatPackage = readJson("compat/agora-agent-server-sdk/package.json");
const rootVersion = rootPackage.version;
const compatVersion = compatPackage.version;
const compatDependency = compatPackage.dependencies?.["agora-agents"];

if (compatVersion !== rootVersion) {
    fail(`Compat package version (${compatVersion}) must match root package version (${rootVersion}).`);
}

if (compatDependency !== `^${rootVersion}`) {
    fail(`Compat package dependency on agora-agents (${compatDependency}) must be ^${rootVersion}.`);
}

const releaseWorkflow = fs.readFileSync(".github/workflows/release.yml", "utf8");
const requiredWorkflowMarkers = [
    ["contents: write", "release workflow must have contents: write so it can create GitHub releases"],
    ["gh release create", "release workflow must create a GitHub release when one does not exist"],
    ["gh release edit", "release workflow must update an existing GitHub release"],
    ["release_notes.md", "release workflow must generate and use a release notes file"],
];

for (const [marker, message] of requiredWorkflowMarkers) {
    if (!releaseWorkflow.includes(marker)) {
        fail(message);
    }
}

if (process.exitCode) {
    process.exit(process.exitCode);
}

console.log("Release metadata and workflow checks passed.");
