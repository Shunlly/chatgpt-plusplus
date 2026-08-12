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
; 管理员权限：安装后自动给官方 ChatGPT 打补丁（WindowsApps 受保护需要提权）
RequestExecutionLevel admin

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "安装 ChatGPT++"
  SetOutPath "$INSTDIR"
  ; 路径分隔符由打包脚本按平台传入（macOS: /，Windows: \）
  File /r "${STAGEDIR}${SEP}*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 主入口（ChatGPT++.lnk / 桌面快捷方式）由 install 创建，直接指向补丁后的
  ; ChatGPT 主程序，打开即增强版 ChatGPT 主界面（与 macOS 一致）；
  ; 这里只放一个显式的“修复工具”入口（--panel 打开安装/修复/卸载面板）。
  CreateDirectory "$SMPROGRAMS\ChatGPT++"
  CreateShortcut "$SMPROGRAMS\ChatGPT++\ChatGPT++ 修复工具.lnk" "$INSTDIR\ChatGPT++.exe" "--panel" "$INSTDIR\ChatGPT++.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayName" "ChatGPT++"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "Publisher" "chatgpt-plusplus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++" "UninstallString" '"$INSTDIR\uninstall.exe"'

  ; 自动打补丁：官方 ChatGPT 已安装时装完即用；失败不阻塞安装（打开应用时面板会引导修复）
  nsExec::ExecToLog '"$INSTDIR\resources\cli\chatgpt-plusplus.exe" install'

  ; 装完兜底启动：install 已在运行时自动打开过主程序就不重复（官方 ChatGPT
  ; 单实例会去重）；未打开时面板会检测已安装状态并自动转跳到补丁后的主程序
  ; （增强版 ChatGPT 主界面），不会停留在“安装器”界面。
  ExecShell "open" "$INSTDIR\ChatGPT++.exe"
SectionEnd

Section "Uninstall"
  ; 先恢复被打补丁的应用，再删除文件（失败不阻塞卸载）。
  nsExec::ExecToLog 'taskkill /f /im ChatGPT++.exe'
  ExecWait '"$INSTDIR\resources\cli\chatgpt-plusplus.exe" uninstall'
  ; 通配符删除：兼容旧版乱码快捷方式名，也覆盖主入口和修复工具两个入口
  Delete "$SMPROGRAMS\ChatGPT++\*.lnk"
  Delete "$SMPROGRAMS\ChatGPT++.lnk"
  RMDir "$SMPROGRAMS\ChatGPT++"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatGPT++"
  RMDir /r "$INSTDIR"
SectionEnd
