---
name: Tweak store review
about: Submit a Codex++ tweak for store review
title: "Tweak store review: owner/repo"
labels: tweak-store, review
---

## Tweak repo

https://github.com/owner/repo

## Commit to review

Full commit SHA:

Commit URL:

Do not approve a different commit. If the author pushes changes, ask them to resubmit.

## Manifest

- id:
- name:
- version:
- description:

## Screenshots

Screenshots must be committed in the repo at the reviewed commit.

Expected location: `.codexpp-store/screenshots/`

Required: 1-3 images, each exactly 1920x1080.

## Admin checklist

- [ ] `manifest.json` is valid
- [ ] screenshots exist at the reviewed commit and are exactly 1920x1080
- [ ] source was reviewed at the exact commit above
- [ ] `store/index.json` entry pins `approvedCommitSha` to the exact commit above
- [ ] screenshot URLs in `store/index.json` point at immutable raw URLs for the exact commit above
