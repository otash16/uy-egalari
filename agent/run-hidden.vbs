' Agentni ko'rinmas oynada ishga tushiradi (Startup yorlig'i shuni chaqiradi)
Set sh = CreateObject("WScript.Shell")
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "cmd /c """ & dir & "run-service.cmd""", 0, False
