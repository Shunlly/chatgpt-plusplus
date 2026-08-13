; ChatGPT++ Windows 安装器（Inno Setup 6）
; 用法: iscc /DVERSION=1.0.0 /DSTAGEDIR=... /O<输出目录> /F<输出文件名> installer.iss
; STAGEDIR 为打包脚本产出的完整应用目录（ChatGPT++.exe + resources/）
; 注意：本文件必须保持 UTF-8 with BOM，Inno Setup 6 才能正确解析中文。

#ifndef VERSION
  #define VERSION "1.0.23"
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

[Icons]
Name: "{group}\{#APP_NAME} 修复工具"; Filename: "{app}\{#APP_NAME}.exe"; Parameters: "--panel"; IconFilename: "{app}\{#APP_NAME}.exe"

[Run]
Filename: "{app}\{#APP_NAME}.exe"; Description: "启动 {#APP_NAME}"; Flags: nowait skipifsilent

[UninstallRun]
Filename: "taskkill.exe"; Parameters: "/f /im {#APP_NAME}.exe"; Flags: runhidden
Filename: "{app}\resources\cli\chatgpt-plusplus.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated skipifdoesntexist

[UninstallDelete]
; 通配符删除：兼容旧版 NSIS 乱码快捷方式名，也覆盖主入口和修复工具两个入口
Type: files; Name: "{group}\*.lnk"
Type: files; Name: "{userappdata}\Microsoft\Windows\Start Menu\Programs\{#APP_NAME}.lnk"

[Code]
procedure RunPostInstall();
var
  ResultCode: Integer;
begin
  // 自动打补丁：官方 ChatGPT 已安装时装完即用；失败不阻塞安装（打开应用时面板会引导修复）
  Exec(ExpandConstant('{app}\resources\cli\chatgpt-plusplus.exe'), 'install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunPostInstall();
end;
