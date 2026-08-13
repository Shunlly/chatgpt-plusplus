# ChatGPT++ Tweak Store

The in-app Tweak Store reads the live reviewed registry from this repository:

`https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/store/index.json`

Released ChatGPT++ builds fetch this URL whenever the store page is opened or
refreshed. The registry can change without a ChatGPT++ app update.

GitHub raw serves this file with a short cache (about 5 minutes), so a store
update is visible quickly; there is no need to ship a new app release for it.

Registry entries must pin installs to `approvedCommitSha`. ChatGPT++ downloads
from GitHub's commit archive URL for that SHA and validates the downloaded
`manifest.json` before replacing an installed tweak.

Publishing flow:

1. User opens ChatGPT++ Settings -> Tweak Store -> Publish Tweak.
2. User enters a GitHub repo.
3. ChatGPT++ resolves the repo's current default-branch commit SHA.
4. ChatGPT++ opens a GitHub issue for admin review with that exact SHA.
5. An admin reviews the repo at that exact commit SHA.
6. The admin confirms the manifest includes an icon URL suitable for the store.
7. The admin adds or updates an `index.json` entry pinned to that SHA.

Admin acceptance:

1. Open the submitted commit URL.
2. Review source and `manifest.json` at that exact commit.
3. Confirm the manifest includes a usable `iconUrl`.
4. Add a `store/index.json` entry with `approvedCommitSha` set to the reviewed
   full SHA.
5. Commit the registry change to `gh-pages`; GitHub Pages publishes it.
