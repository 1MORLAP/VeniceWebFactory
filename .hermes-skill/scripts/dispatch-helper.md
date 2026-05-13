# WebFactory Dispatch Helper

This file documents how the Hermes `/webfactory` command is wired to the Python runner.

## Invocation Path

```
Discord: /webfactory <url> [--tier=quality|balanced|cost] [--skip-c]
    ↓
Hermes skill system loads ~/.hermes/skills/webfactory/SKILL.md
    ↓
Hermes executes: python3 ~/.hermes/skills/webfactory/scripts/dispatch.py <url> --tier=<tier>
    ↓
dispatch.py calls: python3 ~/VeniceWebFactory/scripts/webfactory.py <url> --tier=<tier>
    ↓
webfactory.py executes all 10 stages (single session, no sub-agents)
```

## Why a Dispatch Layer?

1. **Separation of concerns**: The skill entry point (SKILL.md) is Hermes-native; the runner (webfactory.py) is a standalone script that can also be run directly
2. **Path resolution**: dispatch.py resolves the runner location regardless of where Hermes runs from
3. **Future extensibility**: dispatch.py can add Hermes-specific setup (env vars, logging) before calling the runner

## Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `url` | — | URL to rebuild |
| `--tier` | `balanced` | Model tier: quality, balanced, cost |
| `--skip-c` | false | Skip Option C (design variant) |
| `--languages` | — | Comma-separated language codes for multilingual |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VENICE_API_KEY` | Yes | Venice API key |
| `VERCEL_SCOPE` | No | Vercel team scope (default: `tomek-group`) |
| `VERCEL_TOKEN` | No | Vercel token for non-interactive auth |

## Direct Execution (Bypass Dispatch)

```bash
cd ~/VeniceWebFactory && python3 scripts/webfactory.py https://example.com --tier=balanced
```

## Files

- `~/.hermes/skills/webfactory/scripts/dispatch.py` — Hermes skill dispatch
- `~/VeniceWebFactory/scripts/webfactory.py` — Main runner (all 10 stages)
- `~/.hermes/skills/webfactory/models/venice-model-config.json` — Model tier definitions
