const assert = require("node:assert/strict");
const shim = require("./index.js");
const root = require("agora-agents");

const exportsToVerify = [
    "AgoraClient",
    "Agent",
    "AgentSession",
    "Area",
    "DeepgramSTT",
    "OpenAI",
    "Tavus",
    "Protoface",
    "LemonSlice",
    "AgentPresets",
    "generateRtcToken",
];

for (const name of exportsToVerify) {
    assert.equal(shim[name], root[name], `missing compat export: ${name}`);
}

console.log("Compat package re-exports verified.");
