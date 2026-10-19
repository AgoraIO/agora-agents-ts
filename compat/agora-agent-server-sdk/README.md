# agora-agent-server-sdk

This package has been renamed to `agora-agents`.

New projects should install:

```sh
npm install agora-agents
```

This compatibility package re-exports the public API from `agora-agents` to support existing installs during the migration window.

Preview builds also re-export the additive v3 stored-agent API. These features are available from this preview checkout, not an announced npm release. See the [Saving agents guide](../../docs/guides/saved-agents.md) for `Agent.save()`, `SavedAgent`, secrets, variables, number assignment, and existing session behavior.

Maintainers: dual-publish steps live in the repository release workflow, not in the root README.
