#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const rootPackagePath = path.join(repoRoot, "package.json");
const compatPackagePath = path.join(repoRoot, "compat", "agora-agent-server-sdk", "package.json");
const sdkVersionPath = path.join(repoRoot, "src", "version.ts");

function usage() {
    console.error("Usage: node scripts/prepare-release.js <version>");
    console.error("Example: node scripts/prepare-release.js 2.0.2");
}

function normalizeVersion(input) {
    const version = input?.trim().replace(/^v/, "");
    if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
        usage();
        process.exit(1);
    }
    return version;
}

function readPackage(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writePackage(filePath, packageJson) {
    fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 4)}\n`);
}

const version = normalizeVersion(process.argv[2]);
const rootPackage = readPackage(rootPackagePath);
const compatPackage = readPackage(compatPackagePath);

if (rootPackage.name !== "agora-agents") {
    throw new Error(`Unexpected root package name: ${rootPackage.name}`);
}

if (compatPackage.name !== "agora-agent-server-sdk") {
    throw new Error(`Unexpected compatibility package name: ${compatPackage.name}`);
}

if (!compatPackage.dependencies?.["agora-agents"]) {
    throw new Error("Compatibility package is missing dependency on agora-agents");
}

rootPackage.version = version;
compatPackage.version = version;
compatPackage.dependencies["agora-agents"] = `^${version}`;

writePackage(rootPackagePath, rootPackage);
writePackage(compatPackagePath, compatPackage);
fs.writeFileSync(sdkVersionPath, `export const SDK_VERSION = "v${version}";\n`);

console.log(`Prepared release ${version}.`);
console.log(`- agora-agents version: ${rootPackage.version}`);
console.log(`- agora-agent-server-sdk version: ${compatPackage.version}`);
console.log(`- compat dependency: ${compatPackage.dependencies["agora-agents"]}`);
