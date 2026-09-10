; ChatGPT++ Windows 安装器（Inno Setup 6）
; 用法: iscc /DVERSION=1.0.0 /DSTAGEDIR=... /O<输出目录> /F<输出文件名> installer.iss
; STAGEDIR 为打包脚本产出的完整应用目录（ChatGPT++.exe + resources/）
; 注意：本文件必须保持 UTF-8 with BOM，Inno Setup 6 才能正确解析中文。

#ifndef VERSION
  #define VERSION "1.1.9"
#endif
#ifndef STAGEDIR
  #define STAGEDIR "dist\installers\innosetup"
#endif

#define APP_NAME "ChatGPT++"

[Setup]
AppId={{3ca691cd-1d49-4c9e-88e3-2c61a998a893}
AppName={#APP_NAME}
AppVersion={#VERSION}
AppVerName={#APP_NAME} {#VERSION}
VersionInfoVersion={#VERSION}.0
DefaultDirName={localappdata}\Programs\{#APP_NAME}
DefaultGroupName={#APP_NAME}
DisableProgramGroupPage=yes
DisableWelcomePage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=.
OutputBaseFilename={#APP_NAME}-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#APP_NAME}

[Languages]
; 按系统语言自动匹配；第一个（english）作为未匹配语言时的兜底
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "languages\ChineseSimplified.isl"
Name: "chinesetraditional"; MessagesFile: "languages\ChineseTraditional.isl"

[Files]
Source: "{#STAGEDIR}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[InstallDelete]
Type: files; Name: "{group}\{#APP_NAME} 修复工具.lnk"
Type: files; Name: "{autoprograms}\{#APP_NAME} 修复工具.lnk"
Type: files; Name: "{userprograms}\{#APP_NAME} 修复工具.lnk"

[Icons]
Name: "{autoprograms}\{#APP_NAME}"; Filename: "{app}\{#APP_NAME}.exe"

[Run]
Filename: "{localappdata}\chatgpt-plusplus\bin\ChatGPT++.exe"; Description: "启动 ChatGPT++"; Flags: nowait postinstall skipifsilent skipifdoesntexist

[UninstallRun]
Filename: "taskkill.exe"; Parameters: "/f /im {#APP_NAME}.exe"; Flags: runhidden
Filename: "{app}\resources\cli\chatgpt-plusplus.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated skipifdoesntexist

[UninstallDelete]
; 通配符删除：兼容旧版 NSIS 乱码快捷方式名，也覆盖主入口和修复工具两个入口
Type: files; Name: "{group}\*.lnk"
Type: files; Name: "{userappdata}\Microsoft\Windows\Start Menu\Programs\{#APP_NAME}.lnk"
Type: filesandordirs; Name: "{localappdata}\chatgpt-plusplus"
Type: filesandordirs; Name: "{localappdata}\codex-plusplus"
Type: filesandordirs; Name: "{localappdata}\ChatGPT++"
Type: filesandordirs; Name: "{userappdata}\chatgpt-plusplus"
Type: filesandordirs; Name: "{userappdata}\codex-plusplus"

[Code]
procedure CreateChatGptPlusPlusShortcuts();
var
  Stub, Target, StartMenuLnk, DesktopLnk: String;
begin
  DeleteFile(ExpandConstant('{group}\{#APP_NAME} 修复工具.lnk'));
  DeleteFile(ExpandConstant('{autoprograms}\{#APP_NAME} 修复工具.lnk'));
  DeleteFile(ExpandConstant('{userprograms}\{#APP_NAME} 修复工具.lnk'));
  Stub := ExpandConstant('{localappdata}\chatgpt-plusplus\bin\ChatGPT++.exe');
  if FileExists(Stub) then
    Target := Stub
  else
    Target := ExpandConstant('{app}\{#APP_NAME}.exe');
  StartMenuLnk := ExpandConstant('{autoprograms}\{#APP_NAME}.lnk');
  DesktopLnk := ExpandConstant('{userdesktop}\{#APP_NAME}.lnk');
  CreateShellLink(StartMenuLnk, 'ChatGPT++', Target, '', ExtractFilePath(Target), Target, 0, SW_SHOWNORMAL);
  CreateShellLink(DesktopLnk, 'ChatGPT++', Target, '', ExtractFilePath(Target), Target, 0, SW_SHOWNORMAL);
end;

procedure RunPostInstall();
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{app}\resources\cli\chatgpt-plusplus.exe'), 'install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  CreateChatGptPlusPlusShortcuts();
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunPostInstall();
end;
