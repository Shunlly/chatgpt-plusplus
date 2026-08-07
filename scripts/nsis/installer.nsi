; ChatGPT++ Windows 安装器（NSIS 3）
; 用法: makensis -DVERSION=1.0.0 -DSTAGEDIR=... -DOUTFILE=... installer.nsi
Unicode true
Name "ChatGPT++"

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!ifndef STAGEDIR
  !define STAGEDIR "dist/installers/nsis"
!endif
!ifndef OUTFILE
  !define OUTFILE "ChatGPT++-${VERSION}-win-x64-setup.exe"
!endif

OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\ChatGPT++"
RequestExecutionLevel user

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "安装 ChatGPT++"
  SetOutPath "$INSTDIR"
  ; 路径分隔符由打包脚本按平台传入（macOS: /，Windows: \）
  File "${STAGEDIR}${SEP}chatgpt-plusplus.exe"
  File "${STAGEDIR}${SEP}standalone.json"
  File /r "${STAGEDIR}${SEP}assets${SEP}*.*"
  File /r "${STAGEDIR}${SEP}tweaks${SEP}*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  CreateDirectory "$SMPROGRAMS\ChatGPT++"
  CreateShortcut "$SMPROGRAMS\ChatGPT++\ChatGPT++ 安装与修复.lnk" "cmd.exe" '/k ""$INSTDIR\chatgpt-plusplus.exe" install"' "$INSTDIR\chatgpt-plusplus.exe"
  CreateShortcut "$SMPROGRAMS\ChatGPT++\ChatGPT++ 命令行.lnk" "$INSTDIR\chatgpt-plusplus.exe" "" "$INSTDIR\chatgpt-plusplus.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayName" "ChatGPT++"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "Publisher" "chatgpt-plusplus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "UninstallString" '"$INSTDIR\uninstall.exe"'
SectionEnd

Section "给 ChatGPT/Codex 打补丁"
  DetailPrint "正在给 ChatGPT/Codex 应用安装 ChatGPT++ 补丁..."
  ; ExecToLog 会把 CLI 输出显示在安装详情里，失败原因不再黑盒。
  nsExec::ExecToLog '"$INSTDIR\chatgpt-plusplus.exe" install'
  Pop $0
  IntCmp $0 0 +4 0 0
    DetailPrint "补丁安装未完成（退出码 $0），可稍后手动重试。"
    MessageBox MB_ICONINFORMATION|MB_OK "补丁安装未完成（退出码 $0）。$\r$\n$\r$\n请先查看上方安装日志里的详细报错，常见原因：$\r$\n1. ChatGPT 正在运行，请完全退出后重试；$\r$\n2. 杀毒软件/SmartScreen 拦截了 chatgpt-plusplus.exe；$\r$\n3. 未找到 ChatGPT 安装目录。$\r$\n$\r$\n也可手动在终端执行：$\r$\n$INSTDIR\chatgpt-plusplus.exe install$\r$\n$\r$\n日志位置：$%APPDATA%\codex-plusplus\log"
SectionEnd

Section "Uninstall"
  ; 先恢复被打补丁的应用，再删除文件（失败不阻塞卸载）。
  ExecWait '"$INSTDIR\chatgpt-plusplus.exe" uninstall'
  Delete "$SMPROGRAMS\ChatGPT++\ChatGPT++ 安装与修复.lnk"
  Delete "$SMPROGRAMS\ChatGPT++\ChatGPT++ 命令行.lnk"
  RMDir "$SMPROGRAMS\ChatGPT++"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++"
  RMDir /r "$INSTDIR"
SectionEnd
