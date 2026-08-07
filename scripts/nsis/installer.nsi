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
  ExecWait '"$INSTDIR\chatgpt-plusplus.exe" install' $0
  IntCmp $0 0 +3 0 0
    MessageBox MB_ICONINFORMATION|MB_OK "补丁安装未完成（退出码 $0）。`n`n可稍后从开始菜单运行「ChatGPT++ 安装与修复」，或在终端执行：`n$INSTDIR\chatgpt-plusplus.exe install"
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
