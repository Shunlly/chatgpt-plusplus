$ErrorActionPreference = "Stop"

if (Get-Command chatgptplusplus -ErrorAction SilentlyContinue) {
  & chatgptplusplus update @args
  exit $LASTEXITCODE
}
if (Get-Command chatgpt-plusplus -ErrorAction SilentlyContinue) {
  & chatgpt-plusplus update @args
  exit $LASTEXITCODE
}
if (Get-Command codexplusplus -ErrorAction SilentlyContinue) {
  & codexplusplus update @args
  exit $LASTEXITCODE
}
if (Get-Command codex-plusplus -ErrorAction SilentlyContinue) {
  & codex-plusplus update @args
  exit $LASTEXITCODE
}
[Console]::Error.WriteLine("[!] chatgptplusplus is not installed in PATH; running the installer instead.")
irm https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.ps1 | iex
