Option Explicit

Dim shell, fileSystem, localData, urlFile, attempt, inputFile, dashboardUrl
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
localData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
If InStr(localData, "%LOCALAPPDATA%") > 0 Then
  localData = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\AppData\Local"
End If
urlFile = localData & "\FreeModel Lab\dashboard.url"

For attempt = 1 To 1200
  If fileSystem.FileExists(urlFile) Then
    On Error Resume Next
    Set inputFile = fileSystem.OpenTextFile(urlFile, 1, False)
    dashboardUrl = Trim(inputFile.ReadAll)
    inputFile.Close
    On Error GoTo 0
    If Left(dashboardUrl, Len("http://127.0.0.1:")) = "http://127.0.0.1:" And InStr(1, dashboardUrl, "?session=", vbBinaryCompare) > 0 Then
      shell.Run dashboardUrl, 1, False
      WScript.Quit 0
    End If
  End If
  WScript.Sleep 250
Next
