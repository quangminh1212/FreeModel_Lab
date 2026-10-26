Option Explicit

Dim shell, fileSystem, environment, pathParts, index, candidate, projectRoot, command, mode
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
projectRoot = fileSystem.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectRoot
Set environment = shell.Environment("Process")
pathParts = Split(environment("PATH"), ";")

candidate = ""
For index = 0 To UBound(pathParts)
  candidate = Replace(pathParts(index), Chr(34), "")
  If Len(candidate) > 0 Then
    If fileSystem.FileExists(fileSystem.BuildPath(candidate, "node.exe")) Then
      candidate = fileSystem.BuildPath(candidate, "node.exe")
      Exit For
    End If
  End If
  candidate = ""
Next

If Len(candidate) = 0 Then
  MsgBox "Cần cài Node.js 24 trở lên trước khi chạy FreeModel Lab.", vbExclamation, "FreeModel Lab"
  WScript.Quit 1
End If

mode = ""
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments.Item(0) = "--open" Then mode = " --open"
  If WScript.Arguments.Item(0) = "--no-open" Then mode = " --no-open"
End If

command = Chr(34) & candidate & Chr(34) & " " & Chr(34) & projectRoot & "\scripts\run-headless.cjs" & Chr(34) & " --start" & mode
shell.Run command, 0, False
