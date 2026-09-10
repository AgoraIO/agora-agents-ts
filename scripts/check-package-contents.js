#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const distDirectory = path.join(__dirname, "..", "dist");
const disallowedPaths = [];

function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "__tests__") {
                disallowedPaths.push(path.relative(distDirectory, entryPath));
                continue;
            }
            walk(entryPath);
        }
    }
}

if (!fs.existsSync(distDirectory)) {
    throw new Error("dist does not exist; build the package before checking its contents");
}

walk(distDirectory);

if (disallowedPaths.length > 0) {
    throw new Error(`Production package contains test directories:\n${disallowedPaths.join("\n")}`);
}

console.log("Package contents check passed: no compiled test directories found.");
