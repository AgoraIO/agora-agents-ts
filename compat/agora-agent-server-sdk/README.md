# agora-agent-server-sdk

This package has been renamed to `agora-agents`.

New projects should install:

```sh
npm install agora-agents@3.0.0-alpha.3
```

This compatibility package re-exports the public API from `agora-agents` to support existing installs during the migration window.

Preview `3.0.0-alpha.3` also re-exports the additive v3 stored-agent API. See the [Saving agents guide](../../docs/guides/saved-agents.md) for `Agent.save()`, `SavedAgent`, secrets, variables, number assignment, and existing session behavior.

Maintainers: dual-publish steps live in the repository release workflow, not in the root README.
