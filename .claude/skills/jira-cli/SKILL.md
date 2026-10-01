---
name: jira-cli
description: Read Jira issues through a token-cheap shell wrapper instead of the Atlassian MCP connector. Use for routine reads — what's assigned to me, what's in review, the details of one ticket, arbitrary JQL. Do not use for writes, for exploring an unfamiliar Jira schema, or for Confluence; those still belong to the MCP.
---

# Reading Jira without paying the MCP tax

The Atlassian MCP connector is the right tool for exploration and for writes. It
is the wrong tool for the three or four reads you make every day, because its
cost is fixed and its response shape is not negotiable.

`jira-cli` covers those reads. The MCP stays mounted for everything else.

## When to use which

| Task | Use |
|---|---|
| "What's assigned to me?" | `jira-cli mine` |
| "What's TPD-14038 about?" | `jira-cli issue TPD-14038` |
| Any JQL you already know how to write | `jira-cli jql "..."` |
| "What fields does this project's bug type have?" | **MCP** — `getJiraIssueTypeMetaWithFields` |
| Transition an issue, comment, create | **MCP** — typed validation before the write fires |
| Anything Confluence | **MCP** — no CLI equivalent here |
| Exploring a Jira site you don't know | **MCP** — discovery is what it's good at |

The rule: **CLI for frequent predictable reads, MCP for discovery and writes.**

## Setup

Three environment variables. The token is a secret — keep it in your shell
profile or a secrets manager, never in this repo.

```bash
export JIRA_SITE=your-org.atlassian.net      # no https://, no path
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=...                     # id.atlassian.com/manage-profile/security/api-tokens
```

Verify:

```bash
.claude/skills/jira-cli/jira-cli mine
```

## Commands

```bash
jira-cli mine [limit]            # assigned to you, unresolved, newest first
jira-cli review [limit]          # you reported, awaiting review
jira-cli issue TPD-14038         # one issue, description flattened to plain text
jira-cli jql "project = TPD AND status = Open" [limit]
jira-cli projects                # visible projects
jira-cli --raw mine              # unfiltered API JSON, for debugging the wrapper
```

Output is tab-separated — `KEY<TAB>STATUS<TAB>SUMMARY`. Leave it raw when a
machine reads it; pipe through `column -t -s $'\t'` when a human does.

## Why this exists

Measured against this repo's own Atlassian connector, same query, same account:

| | MCP path | `jira-cli` |
|---|---|---|
| Schema mounted to make the call possible | 845 tokens (`searchJiraIssuesUsingJql`) | 0 |
| Whole connector, if fully resident | 13,338 tokens across 27 tools | 0 |
| Response delivered into context | ~5.9 KB JSON | 480 bytes |

The response difference is structural, not incidental. The MCP tool returns
`self` URLs for every issue, `expand` strings, icon URLs, nested
`statusCategory` objects, and a trailing block of Atlassian feature flags —
and it has no parameter to make it return less. `jq` discards all of it before
a single token enters the context window.

See `docs/mcp-to-cli-measurement.md` for the full before/after.

## Caveats worth knowing

- **Deferred tool loading already helps.** Claude Code does not keep every MCP
  schema resident; it loads them on demand. The 13,338-token figure is what the
  connector costs fully loaded, not what it costs at rest. The per-call response
  saving is the part that recurs no matter what.
- **`review` hardcodes a Spanish status name** (`Listo para revisión`), because
  that is what the Tripleseat workflow uses. Change it for another site.
- **Read-only by design.** The wrapper never POSTs, PUTs, or DELETEs. Writes go
  through the MCP so that schema validation happens before the change lands.
