# Graphify Agent Setup

Graphify builds a local knowledge graph for a project so coding agents can answer codebase and architecture questions without rereading the whole repository every time.

## What Gets Installed Once

Install the `graphify` command once on your machine. After that, every project can use the same executable.

Check whether it is available:

```bash
command -v graphify
graphify --help
```

On this machine it is installed at:

```text
/home/hema/.local/bin/graphify
```

## What Is Needed Per Project

Each project needs its own graph because each codebase has different files, symbols, and module relationships.

Run this from the project root:

```bash
graphify update .
```

This creates or refreshes:

```text
graphify-out/
  GRAPH_REPORT.md
  graph.json
  graph.html
  manifest.json
```

For Codex-style agents, also run:

```bash
graphify codex install
```

That writes graph instructions to `AGENTS.md` and registers a `.codex/hooks.json` reminder so agents check the graph before broad codebase searches.

## Current Client Dashboard Setup

The client dashboard already has Graphify initialized.

Project path:

```text
/home/hema/Projects/full app/client_dashbourd
```

Current graph summary:

```text
1289 nodes
1397 edges
45 communities
```

Important graph hubs from the latest report include:

- `useMutationWithToast()`
- `buildListQuery()`
- `ToastMessage()`
- `asRecord()`
- `fetchUpdateSettingEndpoint()`
- `normalizeProduct()`

## How Agents Should Use It

Before architecture or codebase questions, agents should read:

```bash
sed -n '1,220p' graphify-out/GRAPH_REPORT.md
```

For relationship questions, prefer graph commands before grep:

```bash
graphify query "how does authentication relate to protected routes?"
graphify explain "useMutationWithToast"
graphify path "LoginForm" "useAuth"
```

After code changes, refresh the graph:

```bash
graphify update .
```

This update is AST-only and does not need paid LLM/API calls.

## Should graphify-out Be Committed?

For small and medium private repos, committing `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` can help every developer and agent start with the same map.

For very large repos, generated graphs can be rebuilt locally instead. If the team does not want generated files in Git, add `graphify-out/` to `.gitignore` and document that developers should run:

```bash
graphify update .
graphify codex install
```

## Recommended Workflow For New Projects

1. Clone the project.
2. Confirm `graphify` is globally installed.
3. Run `graphify update .`.
4. Run the installer for the agent client you use, for example `graphify codex install`.
5. Ask agents to read `graphify-out/GRAPH_REPORT.md` before broad codebase work.
6. Run `graphify update .` after modifying code files.

