param(
  [Parameter(Mandatory = $true)][string]$LnkPath,
  [Parameter(Mandatory = $true)][string]$AppId
)
$cs = @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
public class CShellLink {}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
public interface IPersistFile2 {
  void GetClassID(out Guid pClassID);
  [PreserveSig] int IsDirty();
  void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
  void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
  void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
  void GetCurFile(out IntPtr ppszFileName);
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct PROPERTYKEY { public Guid fmtid; public uint pid; }

[StructLayout(LayoutKind.Explicit)]
public struct PROPVARIANT {
  [FieldOffset(0)] public ushort vt;
  [FieldOffset(8)] public IntPtr pointerValue;
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
public interface IPropertyStore {
  void GetCount(out uint cProps);
  void GetAt(uint iProp, out PROPERTYKEY pkey);
  void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
  void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
  void Commit();
}

public static class ShortcutAumid {
  public static void Set(string lnk, string appId) {
    object sl = new CShellLink();
    var persist = (IPersistFile2)sl;
    persist.Load(lnk, 0);
    var store = (IPropertyStore)sl;
    var key = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
    var pv = new PROPVARIANT { vt = 31, pointerValue = Marshal.StringToCoTaskMemUni(appId) };
    store.SetValue(ref key, ref pv);
    store.Commit();
    persist.Save(lnk, true);
    Marshal.FreeCoTaskMem(pv.pointerValue);
  }
}
"@
Add-Type -TypeDefinition $cs -Language CSharp
[ShortcutAumid]::Set($LnkPath, $AppId)
