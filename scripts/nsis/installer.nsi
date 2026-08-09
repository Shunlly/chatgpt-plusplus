; ChatGPT++ Windows 安装器（NSIS 3）
; 用法: makensis -DVERSION=1.0.0 -DSTAGEDIR=... -DOUTFILE=... installer.nsi
; STAGEDIR 为打包脚本产出的完整应用目录（ChatGPT++.exe + resources/）
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
  File /r "${STAGEDIR}${SEP}*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  CreateDirectory "$SMPROGRAMS\ChatGPT++"
  CreateShortcut "$SMPROGRAMS\ChatGPT++\ChatGPT++.lnk" "$INSTDIR\ChatGPT++.exe" "" "$INSTDIR\ChatGPT++.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayName" "ChatGPT++"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "Publisher" "chatgpt-plusplus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "UninstallString" '"$INSTDIR\uninstall.exe"'
SectionEnd

Section "Uninstall"
  ; 先恢复被打补丁的应用，再删除文件（失败不阻塞卸载）。
  nsExec::ExecToLog 'taskkill /f /im ChatGPT++.exe'
  ExecWait '"$INSTDIR\resources\cli\chatgpt-plusplus.exe" uninstall'
  Delete "$SMPROGRAMS\ChatGPT++\ChatGPT++.lnk"
  RMDir "$SMPROGRAMS\ChatGPT++"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++"
  RMDir /r "$INSTDIR"
SectionEnd
