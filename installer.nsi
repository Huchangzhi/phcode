; PH Code Editor 安装脚本 (v3 - Node.js)

!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\PHCodeEditor"
!define DEFAULT_INSTALL_DIR "$PROGRAMFILES\PH Code Editor"

RequestExecutionLevel admin

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "${PRODUCT_NAME}"
OutFile "phcode-installer-${VERSION}.exe"
InstallDir "${DEFAULT_INSTALL_DIR}"
ShowInstDetails show

!define MUI_ABORTWARNING
!define MUI_ICON "packages\frontend\public\static\logo.ico"
!define MUI_UNICON "packages\frontend\public\static\logo.ico"

!insertmacro MUI_PAGE_WELCOME
Page custom WebView2CheckPage WebView2CheckPageLeave
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

Var OldInstallDir
Var IsUpgrade
Var WebView2Installed
Var WebView2CheckMessage

Var WebView2Label
Var WebView2Status
Var WebView2InstallButton

Function WebView2CheckPage
    !insertmacro MUI_HEADER_TEXT "依赖项检查安装" "检查并安装 WebView2 运行时"
    nsDialogs::Create 1018
    Pop $0

    ${If} $0 == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 10 100% 24 "正在检查 WebView2 运行时..."
    Pop $WebView2Label

    ${NSD_CreateLabel} 0 40 100% 24 ""
    Pop $WebView2Status

    ${NSD_CreateButton} 0 70 100% 30 "安装 WebView2 运行时"
    Pop $WebView2InstallButton
    ${NSD_OnClick} $WebView2InstallButton WebView2InstallClick

    Call WebView2Check
    nsDialogs::Show
FunctionEnd

Function WebView2Check
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-4E62-4155-9C14-87FC2E237B33}" "pv"
    ${If} $0 == ""
        ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-4E62-4155-9C14-87FC2E237B33}" "pv"
    ${EndIf}

    ${If} $0 == ""
        StrCpy $WebView2Installed 0
        ${NSD_SetText} $WebView2Status "未安装 WebView2 运行时，请点击下方按钮安装。"
        MessageBox MB_ICONINFORMATION "需要 WebView2 运行时才能运行。$\n$\n点击确定后，安装程序将自动下载并安装 WebView2 运行时。"
    ${Else}
        StrCpy $WebView2Installed 1
        ${NSD_SetText} $WebView2Status "WebView2 运行时已安装 (版本: $0)"
        EnableWindow $WebView2InstallButton 0
    ${EndIf}
FunctionEnd

Function WebView2InstallClick
    StrCpy $WebView2CheckMessage "正在下载 WebView2 运行时..."
    ${NSD_SetText} $WebView2Status $WebView2CheckMessage
    EnableWindow $WebView2InstallButton 0

    InitPluginsDir
    SetDetailsPrint none
    NSISdl::download "https://go.microsoft.com/fwlink/p/?LinkId=2124703" "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe"
    Pop $0
    ${If} $0 == success
        ${NSD_SetText} $WebView2Status "正在安装 WebView2 运行时..."
        ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'
        Call WebView2Check
    ${Else}
        ${NSD_SetText} $WebView2Status "下载失败，请手动下载安装 WebView2 运行时。"
        MessageBox MB_ICONSTOP "下载 WebView2 运行时失败。$\n$\n请访问 https://developer.microsoft.com/microsoft-edge/webview2/ 手动下载安装。"
    ${EndIf}
    EnableWindow $WebView2InstallButton 1
FunctionEnd

Function WebView2CheckPageLeave
    ${If} $WebView2Installed == 0
        MessageBox MB_YESNO|MB_ICONQUESTION "WebView2 运行时尚未安装，程序可能无法正常运行。$\n$\n是否继续安装？" IDYES cont IDNO stop
        stop:
            Abort
        cont:
    ${EndIf}
FunctionEnd

Function DirPre
    ReadRegStr $OldInstallDir HKLM "${UNINSTALL_KEY}" "InstallLocation"
    ${If} $OldInstallDir != ""
        StrCpy $IsUpgrade 1
        StrCpy $INSTDIR $OldInstallDir
    ${EndIf}
FunctionEnd

Section "Install"
    SetShellVarContext all
    SetOutPath "$INSTDIR"

    ; 删除旧版本文件（兼容 Python 旧版）
    Delete "$INSTDIR\phcode.exe"
    Delete "$INSTDIR\uninstall.exe"
    RMDir /r "$INSTDIR\templates"
    RMDir /r "$INSTDIR\static\lib"
    RMDir /r "$INSTDIR\static\clangd"
    RMDir /r "$INSTDIR\static\local-compile"
    RMDir /r "$INSTDIR\static\models"

    ; 安装新版本文件
    File "packages\desktop\phcode.exe"

    ; 安装前端构建产物（Vite dist）
    SetOutPath "$INSTDIR"
    File /r "packages\frontend\dist\*"

    ; 安装 w64devkit（C++ 编译器套件）
    SetOutPath "$INSTDIR\w64devkit"
    File /r "w64devkit\*.*"

    SetOutPath "$INSTDIR"

    ; 创建快捷方式
    CreateDirectory "$SMPROGRAMS\PHCode"
    CreateShortcut "$SMPROGRAMS\PHCode\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    CreateShortcut "$SMPROGRAMS\PHCode\卸载.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\PH Code Editor.lnk" "$INSTDIR\phcode.exe"

    WriteUninstaller "$INSTDIR\uninstall.exe"

    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\phcode.exe,0"
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize" 100000

SectionEnd

Function un.onInit
    SetShellVarContext all
    ReadRegStr $INSTDIR HKLM "${UNINSTALL_KEY}" "InstallLocation"
    ${If} $INSTDIR == ""
        StrCpy $INSTDIR "${DEFAULT_INSTALL_DIR}"
    ${EndIf}
FunctionEnd

Section "Uninstall"
    SetShellVarContext all
    MessageBox MB_YESNO|MB_ICONQUESTION "是否删除用户数据目录？" IDYES del_data IDNO keep_data
    del_data:
        RMDir /r "$INSTDIR\phcode_data"
        Goto cont
    keep_data:
    cont:
        Delete "$SMPROGRAMS\PHCode\PH Code Editor.lnk"
        Delete "$SMPROGRAMS\PHCode\卸载.lnk"
        RMDir "$SMPROGRAMS\PHCode"
        Delete "$DESKTOP\PH Code Editor.lnk"
        Delete "$INSTDIR\phcode.exe"
        Delete "$INSTDIR\uninstall.exe"
        Delete "$INSTDIR\easyrun.html"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
        RMDir "$INSTDIR"
        DeleteRegKey HKLM "${UNINSTALL_KEY}"
SectionEnd
