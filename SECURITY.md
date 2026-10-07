# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue.**

Instead, email `<YOUR_EMAIL>` (replace this placeholder with the maintainer's
email address) with:

- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested mitigations

You will receive a response within 72 hours. If the vulnerability is confirmed,
we will work with you on a fix and coordinate disclosure.

## Security Design

Ciel is designed with the following security principles:

- **Self-hosted only**: no data leaves the user's machine or network by default
- **Bearer-token authentication**: random 256-bit tokens, constant-time
  comparison, startup guard against weak tokens
- **Private content isolation**: private notes use local embedding and local
  model routing; no cloud provider calls
- **Write confirmation**: agent-initiated writes require explicit user
  approval, bound to the tool-call ID and exact stored arguments
- **Tool allowlist**: the agent can only invoke registered tools
- **Read-only mailbox**: Gmail integration uses `gmail.readonly` scope only;
  Ciel never sends email
- **No secret logging**: tokens, `.env` values, and raw private content never
  appear in logs or audit records

See [docs/security.md](docs/security.md) for the full security specification.
