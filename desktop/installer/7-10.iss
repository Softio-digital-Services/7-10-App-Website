; 7-10 Inventory — Inno Setup installer
; Compile with: ISCC.exe Otargi.iss  (after publish)
; Requires Inno Setup 6.4+ for WebView2 download helper

#define MyAppName "7-10 Inventory"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "7-10 Store"
#define MyAppExeName "SevenTenInventorySystem.exe"
#define PublishDir "..\dist\app"
#define WebView2Url "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
AppId={{B71E2E01-7TEN-4100-B001-SEVENTEN}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\7-10 Inventory
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=SevenTenSetup
SetupIconFile=..\Assets\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checkedonce

[Dirs]
Name: "{app}"; Permissions: users-modify
Name: "{app}\Data"; Permissions: users-modify
Name: "{app}\Assets"; Permissions: users-modify
Name: "{app}\Assets\Products"; Permissions: users-modify
Name: "{app}\Assets\Categories"; Permissions: users-modify
Name: "{app}\Logs"; Permissions: users-modify
Name: "{app}\Backups"; Permissions: users-modify
Name: "{app}\Plugins"; Permissions: users-modify
Name: "{app}\Templates"; Permissions: users-modify

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\Assets\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\Assets\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch 7-10 Inventory"; Flags: nowait postinstall skipifsilent

[Code]
function IsWebView2RuntimeInstalled: Boolean;
var
  Ver: String;
begin
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Ver) then
  begin
    Result := (Ver <> '') and (Ver <> '0.0.0.0');
    exit;
  end;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Ver) then
  begin
    Result := (Ver <> '') and (Ver <> '0.0.0.0');
    exit;
  end;
  if RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Ver) then
  begin
    Result := (Ver <> '') and (Ver <> '0.0.0.0');
    exit;
  end;
  Result := False;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  SetupPath: String;
begin
  Result := '';
  NeedsRestart := False;

  if IsWebView2RuntimeInstalled then
    exit;

  WizardForm.StatusLabel.Caption := 'Downloading Microsoft Edge WebView2 Runtime...';
  try
    DownloadTemporaryFile('{#WebView2Url}', 'MicrosoftEdgeWebview2Setup.exe', '', nil);
  except
    Result := 'Could not download WebView2 Runtime. Install it manually from:'#13#10
      + 'https://developer.microsoft.com/microsoft-edge/webview2/'#13#10
      + 'Then run this setup again.';
    exit;
  end;

  SetupPath := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  WizardForm.StatusLabel.Caption := 'Installing Microsoft Edge WebView2 Runtime...';
  if not Exec(SetupPath, '/silent /install', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := 'WebView2 Runtime installer failed to start. Install it manually, then re-run setup.';
    exit;
  end;

  if (ResultCode <> 0) and (not IsWebView2RuntimeInstalled) then
  begin
    Result := 'WebView2 Runtime install returned code '
      + IntToStr(ResultCode)
      + '. Install it manually from https://developer.microsoft.com/microsoft-edge/webview2/';
  end;
end;
