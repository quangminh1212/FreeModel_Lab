Option Explicit

Dim shell, dashboardUrl
If WScript.Arguments.Count = 0 Then WScript.Quit 0

dashboardUrl = Trim(WScript.Arguments.Item(0))
If Left(dashboardUrl, Len("http://127.0.0.1:")) <> "http://127.0.0.1:" Then WScript.Quit 0
If InStr(1, dashboardUrl, "/?session=", vbBinaryCompare) = 0 Then WScript.Quit 0

Set shell = CreateObject("WScript.Shell")
shell.Run dashboardUrl, 1, False
