# Security Policy

## Supported Versions

Only the latest released version receives security fixes while the project is in alpha.

## Reporting a Vulnerability

Report security issues privately to the repository maintainers. Do not open a public issue for suspected exploit paths.

Include:

- Affected version or commit.
- Platform and Codex app version.
- Reproduction steps.
- Impact and any proof-of-concept details.

## Tweak Update Policy

Tweaks are local code and should be treated as untrusted until reviewed. ChatGPT++ checks GitHub Releases once per day and displays update availability, but it never downloads, installs, or replaces tweak code automatically.

Before updating a tweak, review the release notes, changed files, repository ownership, and any new permissions or network behavior.

## Runtime Boundaries

Renderer tweaks run in the preload context and can modify the Codex UI. Main-process tweaks can use the main-process API exposed by ChatGPT++. Install only tweaks from sources you trust.
