$ErrorActionPreference = "Stop"

if (Get-Command codexplusplus -ErrorAction SilentlyContinue) {
  & codexplusplus update @args
  exit $LASTEXITCODE
}

if (Get-Command codex-plusplus -ErrorAction SilentlyContinue) {
  & codex-plusplus update @args
  exit $LASTEXITCODE
}

[Console]::Error.WriteLine("[!] codexplusplus is not installed in PATH; running the installer instead.")
irm https://raw.githubusercontent.com/b-nnett/codex-plusplus/main/install.ps1 | iex
