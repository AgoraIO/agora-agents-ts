# agora-agent-server-sdk

This package has been renamed to `agora-agents`.

New projects should install:

```sh
npm install agora-agents
```

This compatibility package re-exports the public API from `agora-agents` to support existing installs during the migration window.

Preview builds also re-export the additive v3 stored-agent API. These features are available from this preview checkout, not an announced npm release. See the [v3 preview guide](../../docs/guides/v3-preview.md) for deployment, secrets, variables, number assignment, and compatibility with existing v2 sessions.

Maintainers: dual-publish steps live in the repository release workflow, not in the root README.
