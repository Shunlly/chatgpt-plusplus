using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class Program
{
    private const string Aumid = "com.chatgpt-plusplus.app";

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appID);

    private static int Main(string[] args)
    {
        try { SetCurrentProcessExplicitAppUserModelID(Aumid); } catch { }
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        try
        {
            string exe = GetArg(args, "--exe") ?? ReadJsonString(Path.Combine(baseDir, "launch.json"), "exe");
            string userData = GetArg(args, "--user-data-dir") ?? ReadJsonString(Path.Combine(baseDir, "launch.json"), "userDataDir");
            if (string.IsNullOrEmpty(exe) || !File.Exists(exe))
            {
                Log(baseDir, "missing exe: " + exe);
                return 1;
            }
            var psi = new ProcessStartInfo();
            psi.FileName = exe;
            psi.WorkingDirectory = Path.GetDirectoryName(exe) ?? "";
            psi.UseShellExecute = false;
            psi.Arguments = BuildChildArgs(userData);
            Process.Start(psi);
            return 0;
        }
        catch (Exception ex)
        {
            Log(baseDir, ex.ToString());
            return 1;
        }
    }

    private static string BuildChildArgs(string userData)
    {
        string aumid = "--app-user-model-id=" + Aumid;
        if (string.IsNullOrEmpty(userData)) return aumid;
        return "--user-data-dir=" + Quote(userData) + " " + aumid;
    }

    private static string Quote(string value)
    {
        if (value.IndexOfAny(new[] { ' ', '\t' }) < 0) return value;
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private static string GetArg(string[] args, string name)
    {
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        }
        return null;
    }

    private static string ReadJsonString(string path, string key)
    {
        if (!File.Exists(path)) return null;
        string json = File.ReadAllText(path, Encoding.UTF8);
        string needle = "\"" + key + "\"";
        int i = json.IndexOf(needle, StringComparison.Ordinal);
        if (i < 0) return null;
        i = json.IndexOf(':', i);
        if (i < 0) return null;
        i = json.IndexOf('"', i + 1);
        if (i < 0) return null;
        i++;
        var sb = new StringBuilder();
        while (i < json.Length)
        {
            char c = json[i++];
            if (c == '"') break;
            if (c == '\\' && i < json.Length)
            {
                char n = json[i++];
                sb.Append(n == 'n' ? '\n' : n == 'r' ? '\r' : n == 't' ? '\t' : n);
                continue;
            }
            sb.Append(c);
        }
        return sb.ToString();
    }

    private static void Log(string baseDir, string message)
    {
        try
        {
            File.AppendAllText(Path.Combine(baseDir, "launch.log"), DateTime.Now.ToString("o") + " " + message + Environment.NewLine, Encoding.UTF8);
        }
        catch { }
    }
}
