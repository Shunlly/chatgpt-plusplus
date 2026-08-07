"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_electron4 = require("electron");
var import_node_fs10 = require("node:fs");
var import_node_child_process3 = require("node:child_process");
var import_node_crypto3 = require("node:crypto");
var import_node_path9 = require("node:path");
var import_node_os2 = require("node:os");

// ../../node_modules/chokidar/esm/index.js
var import_fs2 = require("fs");
var import_promises3 = require("fs/promises");
var import_events = require("events");
var sysPath2 = __toESM(require("path"), 1);

// ../../node_modules/readdirp/esm/index.js
var import_promises = require("node:fs/promises");
var import_node_stream = require("node:stream");
var import_node_path = require("node:path");
var EntryTypes = {
  FILE_TYPE: "files",
  DIR_TYPE: "directories",
  FILE_DIR_TYPE: "files_directories",
  EVERYTHING_TYPE: "all"
};
var defaultOptions = {
  root: ".",
  fileFilter: (_entryInfo) => true,
  directoryFilter: (_entryInfo) => true,
  type: EntryTypes.FILE_TYPE,
  lstat: false,
  depth: 2147483648,
  alwaysStat: false,
  highWaterMark: 4096
};
Object.freeze(defaultOptions);
var RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
var NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
var ALL_TYPES = [
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
];
var DIR_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE
]);
var FILE_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
]);
var isNormalFlowError = (error) => NORMAL_FLOW_ERRORS.has(error.code);
var wantBigintFsStats = process.platform === "win32";
var emptyFn = (_entryInfo) => true;
var normalizeFilter = (filter) => {
  if (filter === void 0)
    return emptyFn;
  if (typeof filter === "function")
    return filter;
  if (typeof filter === "string") {
    const fl = filter.trim();
    return (entry) => entry.basename === fl;
  }
  if (Array.isArray(filter)) {
    const trItems = filter.map((item) => item.trim());
    return (entry) => trItems.some((f) => entry.basename === f);
  }
  return emptyFn;
};
var ReaddirpStream = class extends import_node_stream.Readable {
  constructor(options = {}) {
    super({
      objectMode: true,
      autoDestroy: true,
      highWaterMark: options.highWaterMark
    });
    const opts = { ...defaultOptions, ...options };
    const { root, type } = opts;
    this._fileFilter = normalizeFilter(opts.fileFilter);
    this._directoryFilter = normalizeFilter(opts.directoryFilter);
    const statMethod = opts.lstat ? import_promises.lstat : import_promises.stat;
    if (wantBigintFsStats) {
      this._stat = (path) => statMethod(path, { bigint: true });
    } else {
      this._stat = statMethod;
    }
    this._maxDepth = opts.depth ?? defaultOptions.depth;
    this._wantsDir = type ? DIR_TYPES.has(type) : false;
    this._wantsFile = type ? FILE_TYPES.has(type) : false;
    this._wantsEverything = type === EntryTypes.EVERYTHING_TYPE;
    this._root = (0, import_node_path.resolve)(root);
    this._isDirent = !opts.alwaysStat;
    this._statsProp = this._isDirent ? "dirent" : "stats";
    this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
    this.parents = [this._exploreDir(root, 1)];
    this.reading = false;
    this.parent = void 0;
  }
  async _read(batch) {
    if (this.reading)
      return;
    this.reading = true;
    try {
      while (!this.destroyed && batch > 0) {
        const par = this.parent;
        const fil = par && par.files;
        if (fil && fil.length > 0) {
          const { path, depth } = par;
          const slice = fil.splice(0, batch).map((dirent) => this._formatEntry(dirent, path));
          const awaited = await Promise.all(slice);
          for (const entry of awaited) {
            if (!entry)
              continue;
            if (this.destroyed)
              return;
            const entryType = await this._getEntryType(entry);
            if (entryType === "directory" && this._directoryFilter(entry)) {
              if (depth <= this._maxDepth) {
                this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
              }
              if (this._wantsDir) {
                this.push(entry);
                batch--;
              }
            } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
              if (this._wantsFile) {
                this.push(entry);
                batch--;
              }
            }
          }
        } else {
          const parent = this.parents.pop();
          if (!parent) {
            this.push(null);
            break;
          }
          this.parent = await parent;
          if (this.destroyed)
            return;
        }
      }
    } catch (error) {
      this.destroy(error);
    } finally {
      this.reading = false;
    }
  }
  async _exploreDir(path, depth) {
    let files;
    try {
      files = await (0, import_promises.readdir)(path, this._rdOptions);
    } catch (error) {
      this._onError(error);
    }
    return { files, depth, path };
  }
  async _formatEntry(dirent, path) {
    let entry;
    const basename3 = this._isDirent ? dirent.name : dirent;
    try {
      const fullPath = (0, import_node_path.resolve)((0, import_node_path.join)(path, basename3));
      entry = { path: (0, import_node_path.relative)(this._root, fullPath), fullPath, basename: basename3 };
      entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
    } catch (err) {
      this._onError(err);
      return;
    }
    return entry;
  }
  _onError(err) {
    if (isNormalFlowError(err) && !this.destroyed) {
      this.emit("warn", err);
    } else {
      this.destroy(err);
    }
  }
  async _getEntryType(entry) {
    if (!entry && this._statsProp in entry) {
      return "";
    }
    const stats = entry[this._statsProp];
    if (stats.isFile())
      return "file";
    if (stats.isDirectory())
      return "directory";
    if (stats && stats.isSymbolicLink()) {
      const full = entry.fullPath;
      try {
        const entryRealPath = await (0, import_promises.realpath)(full);
        const entryRealPathStats = await (0, import_promises.lstat)(entryRealPath);
        if (entryRealPathStats.isFile()) {
          return "file";
        }
        if (entryRealPathStats.isDirectory()) {
          const len = entryRealPath.length;
          if (full.startsWith(entryRealPath) && full.substr(len, 1) === import_node_path.sep) {
            const recursiveError = new Error(`Circular symlink detected: "${full}" points to "${entryRealPath}"`);
            recursiveError.code = RECURSIVE_ERROR_CODE;
            return this._onError(recursiveError);
          }
          return "directory";
        }
      } catch (error) {
        this._onError(error);
        return "";
      }
    }
  }
  _includeAsFile(entry) {
    const stats = entry && entry[this._statsProp];
    return stats && this._wantsEverything && !stats.isDirectory();
  }
};
function readdirp(root, options = {}) {
  let type = options.entryType || options.type;
  if (type === "both")
    type = EntryTypes.FILE_DIR_TYPE;
  if (type)
    options.type = type;
  if (!root) {
    throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
  } else if (typeof root !== "string") {
    throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
  } else if (type && !ALL_TYPES.includes(type)) {
    throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
  }
  options.root = root;
  return new ReaddirpStream(options);
}

// ../../node_modules/chokidar/esm/handler.js
var import_fs = require("fs");
var import_promises2 = require("fs/promises");
var sysPath = __toESM(require("path"), 1);
var import_os = require("os");
var STR_DATA = "data";
var STR_END = "end";
var STR_CLOSE = "close";
var EMPTY_FN = () => {
};
var pl = process.platform;
var isWindows = pl === "win32";
var isMacos = pl === "darwin";
var isLinux = pl === "linux";
var isFreeBSD = pl === "freebsd";
var isIBMi = (0, import_os.type)() === "OS400";
var EVENTS = {
  ALL: "all",
  READY: "ready",
  ADD: "add",
  CHANGE: "change",
  ADD_DIR: "addDir",
  UNLINK: "unlink",
  UNLINK_DIR: "unlinkDir",
  RAW: "raw",
  ERROR: "error"
};
var EV = EVENTS;
var THROTTLE_MODE_WATCH = "watch";
var statMethods = { lstat: import_promises2.lstat, stat: import_promises2.stat };
var KEY_LISTENERS = "listeners";
var KEY_ERR = "errHandlers";
var KEY_RAW = "rawEmitters";
var HANDLER_KEYS = [KEY_LISTENERS, KEY_ERR, KEY_RAW];
var binaryExtensions = /* @__PURE__ */ new Set([
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
]);
var isBinaryPath = (filePath) => binaryExtensions.has(sysPath.extname(filePath).slice(1).toLowerCase());
var foreach = (val, fn) => {
  if (val instanceof Set) {
    val.forEach(fn);
  } else {
    fn(val);
  }
};
var addAndConvert = (main, prop, item) => {
  let container = main[prop];
  if (!(container instanceof Set)) {
    main[prop] = container = /* @__PURE__ */ new Set([container]);
  }
  container.add(item);
};
var clearItem = (cont) => (key) => {
  const set = cont[key];
  if (set instanceof Set) {
    set.clear();
  } else {
    delete cont[key];
  }
};
var delFromSet = (main, prop, item) => {
  const container = main[prop];
  if (container instanceof Set) {
    container.delete(item);
  } else if (container === item) {
    delete main[prop];
  }
};
var isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
var FsWatchInstances = /* @__PURE__ */ new Map();
function createFsWatchInstance(path, options, listener, errHandler, emitRaw) {
  const handleEvent = (rawEvent, evPath) => {
    listener(path);
    emitRaw(rawEvent, evPath, { watchedPath: path });
    if (evPath && path !== evPath) {
      fsWatchBroadcast(sysPath.resolve(path, evPath), KEY_LISTENERS, sysPath.join(path, evPath));
    }
  };
  try {
    return (0, import_fs.watch)(path, {
      persistent: options.persistent
    }, handleEvent);
  } catch (error) {
    errHandler(error);
    return void 0;
  }
}
var fsWatchBroadcast = (fullPath, listenerType, val1, val2, val3) => {
  const cont = FsWatchInstances.get(fullPath);
  if (!cont)
    return;
  foreach(cont[listenerType], (listener) => {
    listener(val1, val2, val3);
  });
};
var setFsWatchListener = (path, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;
  let cont = FsWatchInstances.get(fullPath);
  let watcher;
  if (!options.persistent) {
    watcher = createFsWatchInstance(path, options, listener, errHandler, rawEmitter);
    if (!watcher)
      return;
    return watcher.close.bind(watcher);
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_ERR, errHandler);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    watcher = createFsWatchInstance(
      path,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      // no need to use broadcast here
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );
    if (!watcher)
      return;
    watcher.on(EV.ERROR, async (error) => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      if (cont)
        cont.watcherUnusable = true;
      if (isWindows && error.code === "EPERM") {
        try {
          const fd = await (0, import_promises2.open)(path, "r");
          await fd.close();
          broadcastErr(error);
        } catch (err) {
        }
      } else {
        broadcastErr(error);
      }
    });
    cont = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };
    FsWatchInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_ERR, errHandler);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      cont.watcher.close();
      FsWatchInstances.delete(fullPath);
      HANDLER_KEYS.forEach(clearItem(cont));
      cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var FsWatchFileInstances = /* @__PURE__ */ new Map();
var setFsWatchFileListener = (path, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;
  let cont = FsWatchFileInstances.get(fullPath);
  const copts = cont && cont.options;
  if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
    (0, import_fs.unwatchFile)(fullPath);
    cont = void 0;
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    cont = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: (0, import_fs.watchFile)(fullPath, options, (curr, prev) => {
        foreach(cont.rawEmitters, (rawEmitter2) => {
          rawEmitter2(EV.CHANGE, fullPath, { curr, prev });
        });
        const currmtime = curr.mtimeMs;
        if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
          foreach(cont.listeners, (listener2) => listener2(path, curr));
        }
      })
    };
    FsWatchFileInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      (0, import_fs.unwatchFile)(fullPath);
      cont.options = cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var NodeFsHandler = class {
  constructor(fsW) {
    this.fsw = fsW;
    this._boundHandleError = (error) => fsW._handleError(error);
  }
  /**
   * Watch file for changes with fs_watchFile or fs_watch.
   * @param path to file or dir
   * @param listener on fs change
   * @returns closer for the watcher instance
   */
  _watchWithNodeFs(path, listener) {
    const opts = this.fsw.options;
    const directory = sysPath.dirname(path);
    const basename3 = sysPath.basename(path);
    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename3);
    const absolutePath = sysPath.resolve(path);
    const options = {
      persistent: opts.persistent
    };
    if (!listener)
      listener = EMPTY_FN;
    let closer;
    if (opts.usePolling) {
      const enableBin = opts.interval !== opts.binaryInterval;
      options.interval = enableBin && isBinaryPath(basename3) ? opts.binaryInterval : opts.interval;
      closer = setFsWatchFileListener(path, absolutePath, options, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      closer = setFsWatchListener(path, absolutePath, options, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }
    return closer;
  }
  /**
   * Watch a file and emit add event if warranted.
   * @returns closer for the watcher instance
   */
  _handleFile(file, stats, initialAdd) {
    if (this.fsw.closed) {
      return;
    }
    const dirname6 = sysPath.dirname(file);
    const basename3 = sysPath.basename(file);
    const parent = this.fsw._getWatchedDir(dirname6);
    let prevStats = stats;
    if (parent.has(basename3))
      return;
    const listener = async (path, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file, 5))
        return;
      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const newStats2 = await (0, import_promises2.stat)(file);
          if (this.fsw.closed)
            return;
          const at = newStats2.atimeMs;
          const mt = newStats2.mtimeMs;
          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV.CHANGE, file, newStats2);
          }
          if ((isMacos || isLinux || isFreeBSD) && prevStats.ino !== newStats2.ino) {
            this.fsw._closeFile(path);
            prevStats = newStats2;
            const closer2 = this._watchWithNodeFs(file, listener);
            if (closer2)
              this.fsw._addPathCloser(path, closer2);
          } else {
            prevStats = newStats2;
          }
        } catch (error) {
          this.fsw._remove(dirname6, basename3);
        }
      } else if (parent.has(basename3)) {
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;
        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV.CHANGE, file, newStats);
        }
        prevStats = newStats;
      }
    };
    const closer = this._watchWithNodeFs(file, listener);
    if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file)) {
      if (!this.fsw._throttle(EV.ADD, file, 0))
        return;
      this.fsw._emit(EV.ADD, file, stats);
    }
    return closer;
  }
  /**
   * Handle symlinks encountered while reading a dir.
   * @param entry returned by readdirp
   * @param directory path of dir being read
   * @param path of this item
   * @param item basename of this item
   * @returns true if no more processing is needed for this entry.
   */
  async _handleSymlink(entry, directory, path, item) {
    if (this.fsw.closed) {
      return;
    }
    const full = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);
    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();
      let linkPath;
      try {
        linkPath = await (0, import_promises2.realpath)(path);
      } catch (e) {
        this.fsw._emitReady();
        return true;
      }
      if (this.fsw.closed)
        return;
      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(full) !== linkPath) {
          this.fsw._symlinkPaths.set(full, linkPath);
          this.fsw._emit(EV.CHANGE, path, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(full, linkPath);
        this.fsw._emit(EV.ADD, path, entry.stats);
      }
      this.fsw._emitReady();
      return true;
    }
    if (this.fsw._symlinkPaths.has(full)) {
      return true;
    }
    this.fsw._symlinkPaths.set(full, true);
  }
  _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
    directory = sysPath.join(directory, "");
    throttler = this.fsw._throttle("readdir", directory, 1e3);
    if (!throttler)
      return;
    const previous = this.fsw._getWatchedDir(wh.path);
    const current = /* @__PURE__ */ new Set();
    let stream = this.fsw._readdirp(directory, {
      fileFilter: (entry) => wh.filterPath(entry),
      directoryFilter: (entry) => wh.filterDir(entry)
    });
    if (!stream)
      return;
    stream.on(STR_DATA, async (entry) => {
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      const item = entry.path;
      let path = sysPath.join(directory, item);
      current.add(item);
      if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path, item)) {
        return;
      }
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      if (item === target || !target && !previous.has(item)) {
        this.fsw._incrReadyCount();
        path = sysPath.join(dir, sysPath.relative(dir, path));
        this._addToNodeFs(path, initialAdd, wh, depth + 1);
      }
    }).on(EV.ERROR, this._boundHandleError);
    return new Promise((resolve6, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve6(void 0);
        previous.getChildren().filter((item) => {
          return item !== directory && !current.has(item);
        }).forEach((item) => {
          this.fsw._remove(directory, item);
        });
        stream = void 0;
        if (wasThrottled)
          this._handleRead(directory, false, wh, target, dir, depth, throttler);
      });
    });
  }
  /**
   * Read directory to add / remove files from `@watched` list and re-read it on change.
   * @param dir fs path
   * @param stats
   * @param initialAdd
   * @param depth relative to user-supplied path
   * @param target child path targeted for watch
   * @param wh Common watch helpers for this path
   * @param realpath
   * @returns closer for the watcher instance.
   */
  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath2) {
    const parentDir = this.fsw._getWatchedDir(sysPath.dirname(dir));
    const tracked = parentDir.has(sysPath.basename(dir));
    if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
      this.fsw._emit(EV.ADD_DIR, dir, stats);
    }
    parentDir.add(sysPath.basename(dir));
    this.fsw._getWatchedDir(dir);
    let throttler;
    let closer;
    const oDepth = this.fsw.options.depth;
    if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath2)) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed)
          return;
      }
      closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
        if (stats2 && stats2.mtimeMs === 0)
          return;
        this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
      });
    }
    return closer;
  }
  /**
   * Handle added file, directory, or glob pattern.
   * Delegates call to _handleFile / _handleDir after checks.
   * @param path to file or ir
   * @param initialAdd was the file added at watch instantiation?
   * @param priorWh depth relative to user-supplied path
   * @param depth Child path actually targeted for watch
   * @param target Child path actually targeted for watch
   */
  async _addToNodeFs(path, initialAdd, priorWh, depth, target) {
    const ready = this.fsw._emitReady;
    if (this.fsw._isIgnored(path) || this.fsw.closed) {
      ready();
      return false;
    }
    const wh = this.fsw._getWatchHelpers(path);
    if (priorWh) {
      wh.filterPath = (entry) => priorWh.filterPath(entry);
      wh.filterDir = (entry) => priorWh.filterDir(entry);
    }
    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed)
        return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }
      const follow = this.fsw.options.followSymlinks;
      let closer;
      if (stats.isDirectory()) {
        const absPath = sysPath.resolve(path);
        const targetPath = follow ? await (0, import_promises2.realpath)(path) : path;
        if (this.fsw.closed)
          return;
        closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (absPath !== targetPath && targetPath !== void 0) {
          this.fsw._symlinkPaths.set(absPath, targetPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = follow ? await (0, import_promises2.realpath)(path) : path;
        if (this.fsw.closed)
          return;
        const parent = sysPath.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);
        this.fsw._emit(EV.ADD, wh.watchPath, stats);
        closer = await this._handleDir(parent, stats, initialAdd, depth, path, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (targetPath !== void 0) {
          this.fsw._symlinkPaths.set(sysPath.resolve(path), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }
      ready();
      if (closer)
        this.fsw._addPathCloser(path, closer);
      return false;
    } catch (error) {
      if (this.fsw._handleError(error)) {
        ready();
        return path;
      }
    }
  }
};

// ../../node_modules/chokidar/esm/index.js
var SLASH = "/";
var SLASH_SLASH = "//";
var ONE_DOT = ".";
var TWO_DOTS = "..";
var STRING_TYPE = "string";
var BACK_SLASH_RE = /\\/g;
var DOUBLE_SLASH_RE = /\/\//;
var DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
var REPLACER_RE = /^\.[/\\]/;
function arrify(item) {
  return Array.isArray(item) ? item : [item];
}
var isMatcherObject = (matcher) => typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp);
function createPattern(matcher) {
  if (typeof matcher === "function")
    return matcher;
  if (typeof matcher === "string")
    return (string) => matcher === string;
  if (matcher instanceof RegExp)
    return (string) => matcher.test(string);
  if (typeof matcher === "object" && matcher !== null) {
    return (string) => {
      if (matcher.path === string)
        return true;
      if (matcher.recursive) {
        const relative6 = sysPath2.relative(matcher.path, string);
        if (!relative6) {
          return false;
        }
        return !relative6.startsWith("..") && !sysPath2.isAbsolute(relative6);
      }
      return false;
    };
  }
  return () => false;
}
function normalizePath(path) {
  if (typeof path !== "string")
    throw new Error("string expected");
  path = sysPath2.normalize(path);
  path = path.replace(/\\/g, "/");
  let prepend = false;
  if (path.startsWith("//"))
    prepend = true;
  const DOUBLE_SLASH_RE2 = /\/\//;
  while (path.match(DOUBLE_SLASH_RE2))
    path = path.replace(DOUBLE_SLASH_RE2, "/");
  if (prepend)
    path = "/" + path;
  return path;
}
function matchPatterns(patterns, testString, stats) {
  const path = normalizePath(testString);
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    if (pattern(path, stats)) {
      return true;
    }
  }
  return false;
}
function anymatch(matchers, testString) {
  if (matchers == null) {
    throw new TypeError("anymatch: specify first argument");
  }
  const matchersArray = arrify(matchers);
  const patterns = matchersArray.map((matcher) => createPattern(matcher));
  if (testString == null) {
    return (testString2, stats) => {
      return matchPatterns(patterns, testString2, stats);
    };
  }
  return matchPatterns(patterns, testString);
}
var unifyPaths = (paths_) => {
  const paths = arrify(paths_).flat();
  if (!paths.every((p) => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
};
var toUnix = (string) => {
  let str = string.replace(BACK_SLASH_RE, SLASH);
  let prepend = false;
  if (str.startsWith(SLASH_SLASH)) {
    prepend = true;
  }
  while (str.match(DOUBLE_SLASH_RE)) {
    str = str.replace(DOUBLE_SLASH_RE, SLASH);
  }
  if (prepend) {
    str = SLASH + str;
  }
  return str;
};
var normalizePathToUnix = (path) => toUnix(sysPath2.normalize(toUnix(path)));
var normalizeIgnored = (cwd = "") => (path) => {
  if (typeof path === "string") {
    return normalizePathToUnix(sysPath2.isAbsolute(path) ? path : sysPath2.join(cwd, path));
  } else {
    return path;
  }
};
var getAbsolutePath = (path, cwd) => {
  if (sysPath2.isAbsolute(path)) {
    return path;
  }
  return sysPath2.join(cwd, path);
};
var EMPTY_SET = Object.freeze(/* @__PURE__ */ new Set());
var DirEntry = class {
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = /* @__PURE__ */ new Set();
  }
  add(item) {
    const { items } = this;
    if (!items)
      return;
    if (item !== ONE_DOT && item !== TWO_DOTS)
      items.add(item);
  }
  async remove(item) {
    const { items } = this;
    if (!items)
      return;
    items.delete(item);
    if (items.size > 0)
      return;
    const dir = this.path;
    try {
      await (0, import_promises3.readdir)(dir);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sysPath2.dirname(dir), sysPath2.basename(dir));
      }
    }
  }
  has(item) {
    const { items } = this;
    if (!items)
      return;
    return items.has(item);
  }
  getChildren() {
    const { items } = this;
    if (!items)
      return [];
    return [...items.values()];
  }
  dispose() {
    this.items.clear();
    this.path = "";
    this._removeWatcher = EMPTY_FN;
    this.items = EMPTY_SET;
    Object.freeze(this);
  }
};
var STAT_METHOD_F = "stat";
var STAT_METHOD_L = "lstat";
var WatchHelper = class {
  constructor(path, follow, fsw) {
    this.fsw = fsw;
    const watchPath = path;
    this.path = path = path.replace(REPLACER_RE, "");
    this.watchPath = watchPath;
    this.fullWatchPath = sysPath2.resolve(watchPath);
    this.dirParts = [];
    this.dirParts.forEach((parts) => {
      if (parts.length > 1)
        parts.pop();
    });
    this.followSymlinks = follow;
    this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
  }
  entryPath(entry) {
    return sysPath2.join(this.watchPath, sysPath2.relative(this.watchPath, entry.fullPath));
  }
  filterPath(entry) {
    const { stats } = entry;
    if (stats && stats.isSymbolicLink())
      return this.filterDir(entry);
    const resolvedPath = this.entryPath(entry);
    return this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
  }
  filterDir(entry) {
    return this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
};
var FSWatcher = class extends import_events.EventEmitter {
  // Not indenting methods for history sake; for now.
  constructor(_opts = {}) {
    super();
    this.closed = false;
    this._closers = /* @__PURE__ */ new Map();
    this._ignoredPaths = /* @__PURE__ */ new Set();
    this._throttled = /* @__PURE__ */ new Map();
    this._streams = /* @__PURE__ */ new Set();
    this._symlinkPaths = /* @__PURE__ */ new Map();
    this._watched = /* @__PURE__ */ new Map();
    this._pendingWrites = /* @__PURE__ */ new Map();
    this._pendingUnlinks = /* @__PURE__ */ new Map();
    this._readyCount = 0;
    this._readyEmitted = false;
    const awf = _opts.awaitWriteFinish;
    const DEF_AWF = { stabilityThreshold: 2e3, pollInterval: 100 };
    const opts = {
      // Defaults
      persistent: true,
      ignoreInitial: false,
      ignorePermissionErrors: false,
      interval: 100,
      binaryInterval: 300,
      followSymlinks: true,
      usePolling: false,
      // useAsync: false,
      atomic: true,
      // NOTE: overwritten later (depends on usePolling)
      ..._opts,
      // Change format
      ignored: _opts.ignored ? arrify(_opts.ignored) : arrify([]),
      awaitWriteFinish: awf === true ? DEF_AWF : typeof awf === "object" ? { ...DEF_AWF, ...awf } : false
    };
    if (isIBMi)
      opts.usePolling = true;
    if (opts.atomic === void 0)
      opts.atomic = !opts.usePolling;
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== void 0) {
      const envLower = envPoll.toLowerCase();
      if (envLower === "false" || envLower === "0")
        opts.usePolling = false;
      else if (envLower === "true" || envLower === "1")
        opts.usePolling = true;
      else
        opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval)
      opts.interval = Number.parseInt(envInterval, 10);
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EVENTS.READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EVENTS.RAW, ...args);
    this._boundRemove = this._remove.bind(this);
    this.options = opts;
    this._nodeFsHandler = new NodeFsHandler(this);
    Object.freeze(opts);
  }
  _addIgnoredPath(matcher) {
    if (isMatcherObject(matcher)) {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher.path && ignored.recursive === matcher.recursive) {
          return;
        }
      }
    }
    this._ignoredPaths.add(matcher);
  }
  _removeIgnoredPath(matcher) {
    this._ignoredPaths.delete(matcher);
    if (typeof matcher === "string") {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher) {
          this._ignoredPaths.delete(ignored);
        }
      }
    }
  }
  // Public methods
  /**
   * Adds paths to be watched on an existing FSWatcher instance.
   * @param paths_ file or file list. Other arguments are unused
   */
  add(paths_, _origAdd, _internal) {
    const { cwd } = this.options;
    this.closed = false;
    this._closePromise = void 0;
    let paths = unifyPaths(paths_);
    if (cwd) {
      paths = paths.map((path) => {
        const absPath = getAbsolutePath(path, cwd);
        return absPath;
      });
    }
    paths.forEach((path) => {
      this._removeIgnoredPath(path);
    });
    this._userIgnored = void 0;
    if (!this._readyCount)
      this._readyCount = 0;
    this._readyCount += paths.length;
    Promise.all(paths.map(async (path) => {
      const res = await this._nodeFsHandler._addToNodeFs(path, !_internal, void 0, 0, _origAdd);
      if (res)
        this._emitReady();
      return res;
    })).then((results) => {
      if (this.closed)
        return;
      results.forEach((item) => {
        if (item)
          this.add(sysPath2.dirname(item), sysPath2.basename(_origAdd || item));
      });
    });
    return this;
  }
  /**
   * Close watchers or start ignoring events from specified paths.
   */
  unwatch(paths_) {
    if (this.closed)
      return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;
    paths.forEach((path) => {
      if (!sysPath2.isAbsolute(path) && !this._closers.has(path)) {
        if (cwd)
          path = sysPath2.join(cwd, path);
        path = sysPath2.resolve(path);
      }
      this._closePath(path);
      this._addIgnoredPath(path);
      if (this._watched.has(path)) {
        this._addIgnoredPath({
          path,
          recursive: true
        });
      }
      this._userIgnored = void 0;
    });
    return this;
  }
  /**
   * Close watchers and remove all listeners from watched paths.
   */
  close() {
    if (this._closePromise) {
      return this._closePromise;
    }
    this.closed = true;
    this.removeAllListeners();
    const closers = [];
    this._closers.forEach((closerList) => closerList.forEach((closer) => {
      const promise = closer();
      if (promise instanceof Promise)
        closers.push(promise);
    }));
    this._streams.forEach((stream) => stream.destroy());
    this._userIgnored = void 0;
    this._readyCount = 0;
    this._readyEmitted = false;
    this._watched.forEach((dirent) => dirent.dispose());
    this._closers.clear();
    this._watched.clear();
    this._streams.clear();
    this._symlinkPaths.clear();
    this._throttled.clear();
    this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
    return this._closePromise;
  }
  /**
   * Expose list of watched paths
   * @returns for chaining
   */
  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sysPath2.relative(this.options.cwd, dir) : dir;
      const index = key || ONE_DOT;
      watchList[index] = entry.getChildren().sort();
    });
    return watchList;
  }
  emitWithAll(event, args) {
    this.emit(event, ...args);
    if (event !== EVENTS.ERROR)
      this.emit(EVENTS.ALL, event, ...args);
  }
  // Common helpers
  // --------------
  /**
   * Normalize and emit events.
   * Calling _emit DOES NOT MEAN emit() would be called!
   * @param event Type of event
   * @param path File or directory path
   * @param stats arguments to be passed with event
   * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  async _emit(event, path, stats) {
    if (this.closed)
      return;
    const opts = this.options;
    if (isWindows)
      path = sysPath2.normalize(path);
    if (opts.cwd)
      path = sysPath2.relative(opts.cwd, path);
    const args = [path];
    if (stats != null)
      args.push(stats);
    const awf = opts.awaitWriteFinish;
    let pw;
    if (awf && (pw = this._pendingWrites.get(path))) {
      pw.lastChange = /* @__PURE__ */ new Date();
      return this;
    }
    if (opts.atomic) {
      if (event === EVENTS.UNLINK) {
        this._pendingUnlinks.set(path, [event, ...args]);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, path2) => {
            this.emit(...entry);
            this.emit(EVENTS.ALL, ...entry);
            this._pendingUnlinks.delete(path2);
          });
        }, typeof opts.atomic === "number" ? opts.atomic : 100);
        return this;
      }
      if (event === EVENTS.ADD && this._pendingUnlinks.has(path)) {
        event = EVENTS.CHANGE;
        this._pendingUnlinks.delete(path);
      }
    }
    if (awf && (event === EVENTS.ADD || event === EVENTS.CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats2) => {
        if (err) {
          event = EVENTS.ERROR;
          args[0] = err;
          this.emitWithAll(event, args);
        } else if (stats2) {
          if (args.length > 1) {
            args[1] = stats2;
          } else {
            args.push(stats2);
          }
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path, awf.stabilityThreshold, event, awfEmit);
      return this;
    }
    if (event === EVENTS.CHANGE) {
      const isThrottled = !this._throttle(EVENTS.CHANGE, path, 50);
      if (isThrottled)
        return this;
    }
    if (opts.alwaysStat && stats === void 0 && (event === EVENTS.ADD || event === EVENTS.ADD_DIR || event === EVENTS.CHANGE)) {
      const fullPath = opts.cwd ? sysPath2.join(opts.cwd, path) : path;
      let stats2;
      try {
        stats2 = await (0, import_promises3.stat)(fullPath);
      } catch (err) {
      }
      if (!stats2 || this.closed)
        return;
      args.push(stats2);
    }
    this.emitWithAll(event, args);
    return this;
  }
  /**
   * Common handler for errors
   * @returns The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  _handleError(error) {
    const code = error && error.code;
    if (error && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
      this.emit(EVENTS.ERROR, error);
    }
    return error || this.closed;
  }
  /**
   * Helper utility for throttling
   * @param actionType type being throttled
   * @param path being acted upon
   * @param timeout duration of time to suppress duplicate actions
   * @returns tracking object or false if action should be suppressed
   */
  _throttle(actionType, path, timeout) {
    if (!this._throttled.has(actionType)) {
      this._throttled.set(actionType, /* @__PURE__ */ new Map());
    }
    const action = this._throttled.get(actionType);
    if (!action)
      throw new Error("invalid throttle");
    const actionPath = action.get(path);
    if (actionPath) {
      actionPath.count++;
      return false;
    }
    let timeoutObject;
    const clear = () => {
      const item = action.get(path);
      const count = item ? item.count : 0;
      action.delete(path);
      clearTimeout(timeoutObject);
      if (item)
        clearTimeout(item.timeoutObject);
      return count;
    };
    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    action.set(path, thr);
    return thr;
  }
  _incrReadyCount() {
    return this._readyCount++;
  }
  /**
   * Awaits write operation to finish.
   * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
   * @param path being acted upon
   * @param threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
   * @param event
   * @param awfEmit Callback to be called when ready for event to be emitted.
   */
  _awaitWriteFinish(path, threshold, event, awfEmit) {
    const awf = this.options.awaitWriteFinish;
    if (typeof awf !== "object")
      return;
    const pollInterval = awf.pollInterval;
    let timeoutHandler;
    let fullPath = path;
    if (this.options.cwd && !sysPath2.isAbsolute(path)) {
      fullPath = sysPath2.join(this.options.cwd, path);
    }
    const now = /* @__PURE__ */ new Date();
    const writes = this._pendingWrites;
    function awaitWriteFinishFn(prevStat) {
      (0, import_fs2.stat)(fullPath, (err, curStat) => {
        if (err || !writes.has(path)) {
          if (err && err.code !== "ENOENT")
            awfEmit(err);
          return;
        }
        const now2 = Number(/* @__PURE__ */ new Date());
        if (prevStat && curStat.size !== prevStat.size) {
          writes.get(path).lastChange = now2;
        }
        const pw = writes.get(path);
        const df = now2 - pw.lastChange;
        if (df >= threshold) {
          writes.delete(path);
          awfEmit(void 0, curStat);
        } else {
          timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval, curStat);
        }
      });
    }
    if (!writes.has(path)) {
      writes.set(path, {
        lastChange: now,
        cancelWait: () => {
          writes.delete(path);
          clearTimeout(timeoutHandler);
          return event;
        }
      });
      timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval);
    }
  }
  /**
   * Determines whether user has asked to ignore this path.
   */
  _isIgnored(path, stats) {
    if (this.options.atomic && DOT_RE.test(path))
      return true;
    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = (ign || []).map(normalizeIgnored(cwd));
      const ignoredPaths = [...this._ignoredPaths];
      const list = [...ignoredPaths.map(normalizeIgnored(cwd)), ...ignored];
      this._userIgnored = anymatch(list, void 0);
    }
    return this._userIgnored(path, stats);
  }
  _isntIgnored(path, stat4) {
    return !this._isIgnored(path, stat4);
  }
  /**
   * Provides a set of common helpers and properties relating to symlink handling.
   * @param path file or directory pattern being watched
   */
  _getWatchHelpers(path) {
    return new WatchHelper(path, this.options.followSymlinks, this);
  }
  // Directory helpers
  // -----------------
  /**
   * Provides directory tracking objects
   * @param directory path of the directory
   */
  _getWatchedDir(directory) {
    const dir = sysPath2.resolve(directory);
    if (!this._watched.has(dir))
      this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }
  // File helpers
  // ------------
  /**
   * Check for read permissions: https://stackoverflow.com/a/11781404/1358405
   */
  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors)
      return true;
    return Boolean(Number(stats.mode) & 256);
  }
  /**
   * Handles emitting unlink events for
   * files and directories, and via recursion, for
   * files and directories within directories that are unlinked
   * @param directory within which the following item is located
   * @param item      base path of item/directory
   */
  _remove(directory, item, isDirectory) {
    const path = sysPath2.join(directory, item);
    const fullPath = sysPath2.resolve(path);
    isDirectory = isDirectory != null ? isDirectory : this._watched.has(path) || this._watched.has(fullPath);
    if (!this._throttle("remove", path, 100))
      return;
    if (!isDirectory && this._watched.size === 1) {
      this.add(directory, item, true);
    }
    const wp = this._getWatchedDir(path);
    const nestedDirectoryChildren = wp.getChildren();
    nestedDirectoryChildren.forEach((nested) => this._remove(path, nested));
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }
    let relPath = path;
    if (this.options.cwd)
      relPath = sysPath2.relative(this.options.cwd, path);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EVENTS.ADD)
        return;
    }
    this._watched.delete(path);
    this._watched.delete(fullPath);
    const eventName = isDirectory ? EVENTS.UNLINK_DIR : EVENTS.UNLINK;
    if (wasTracked && !this._isIgnored(path))
      this._emit(eventName, path);
    this._closePath(path);
  }
  /**
   * Closes all watchers for a path
   */
  _closePath(path) {
    this._closeFile(path);
    const dir = sysPath2.dirname(path);
    this._getWatchedDir(dir).remove(sysPath2.basename(path));
  }
  /**
   * Closes only file-specific watchers
   */
  _closeFile(path) {
    const closers = this._closers.get(path);
    if (!closers)
      return;
    closers.forEach((closer) => closer());
    this._closers.delete(path);
  }
  _addPathCloser(path, closer) {
    if (!closer)
      return;
    let list = this._closers.get(path);
    if (!list) {
      list = [];
      this._closers.set(path, list);
    }
    list.push(closer);
  }
  _readdirp(root, opts) {
    if (this.closed)
      return;
    const options = { type: EVENTS.ALL, alwaysStat: true, lstat: true, ...opts, depth: 0 };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = void 0;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = void 0;
      }
    });
    return stream;
  }
};
function watch(paths, options = {}) {
  const watcher = new FSWatcher(options);
  watcher.add(paths);
  return watcher;
}
var esm_default = { watch, FSWatcher };

// src/tweak-discovery.ts
var import_node_fs = require("node:fs");
var import_node_path2 = require("node:path");
var ENTRY_CANDIDATES = ["index.js", "index.cjs", "index.mjs"];
function discoverTweaks(tweaksDir) {
  if (!(0, import_node_fs.existsSync)(tweaksDir)) return [];
  const out = [];
  for (const name of (0, import_node_fs.readdirSync)(tweaksDir)) {
    const dir = (0, import_node_path2.join)(tweaksDir, name);
    if (!(0, import_node_fs.statSync)(dir).isDirectory()) continue;
    const manifestPath = (0, import_node_path2.join)(dir, "manifest.json");
    if (!(0, import_node_fs.existsSync)(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse((0, import_node_fs.readFileSync)(manifestPath, "utf8"));
    } catch {
      continue;
    }
    if (!isValidManifest(manifest)) continue;
    const entry = resolveEntry(dir, manifest);
    if (!entry) continue;
    out.push({ dir, entry, manifest });
  }
  return out;
}
function isValidManifest(m) {
  if (!m.id || !m.name || !m.version || !m.githubRepo) return false;
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(m.githubRepo)) return false;
  if (m.scope && !["renderer", "main", "both"].includes(m.scope)) return false;
  return true;
}
function resolveEntry(dir, m) {
  if (m.main) {
    const p = (0, import_node_path2.join)(dir, m.main);
    return (0, import_node_fs.existsSync)(p) ? p : null;
  }
  for (const c of ENTRY_CANDIDATES) {
    const p = (0, import_node_path2.join)(dir, c);
    if ((0, import_node_fs.existsSync)(p)) return p;
  }
  return null;
}

// src/storage.ts
var import_node_fs2 = require("node:fs");
var import_node_path3 = require("node:path");
var FLUSH_DELAY_MS = 50;
function createDiskStorage(rootDir, id) {
  const dir = (0, import_node_path3.join)(rootDir, "storage");
  (0, import_node_fs2.mkdirSync)(dir, { recursive: true });
  const file = (0, import_node_path3.join)(dir, `${sanitize(id)}.json`);
  let data = {};
  if ((0, import_node_fs2.existsSync)(file)) {
    try {
      data = JSON.parse((0, import_node_fs2.readFileSync)(file, "utf8"));
    } catch {
      try {
        (0, import_node_fs2.renameSync)(file, `${file}.corrupt-${Date.now()}`);
      } catch {
      }
      data = {};
    }
  }
  let dirty = false;
  let timer = null;
  const scheduleFlush = () => {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (dirty) flush();
    }, FLUSH_DELAY_MS);
  };
  const flush = () => {
    if (!dirty) return;
    const tmp = `${file}.tmp`;
    try {
      (0, import_node_fs2.writeFileSync)(tmp, JSON.stringify(data, null, 2), "utf8");
      (0, import_node_fs2.renameSync)(tmp, file);
      dirty = false;
    } catch (e) {
      console.error("[chatgpt-plusplus] storage flush failed:", id, e);
    }
  };
  return {
    get: (k, d) => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : d,
    set(k, v) {
      data[k] = v;
      scheduleFlush();
    },
    delete(k) {
      if (k in data) {
        delete data[k];
        scheduleFlush();
      }
    },
    all: () => ({ ...data }),
    flush
  };
}
function sanitize(id) {
  return id.replace(/[^a-zA-Z0-9._@-]/g, "_");
}

// src/mcp-sync.ts
var import_node_fs3 = require("node:fs");
var import_node_path4 = require("node:path");
var MCP_MANAGED_START = "# BEGIN CHATGPT++ MANAGED MCP SERVERS";
var MCP_MANAGED_END = "# END CHATGPT++ MANAGED MCP SERVERS";
var LEGACY_MCP_MANAGED_START = "# BEGIN CODEX++ MANAGED MCP SERVERS";
var LEGACY_MCP_MANAGED_END = "# END CODEX++ MANAGED MCP SERVERS";
function syncManagedMcpServers({
  configPath,
  tweaks
}) {
  const current = (0, import_node_fs3.existsSync)(configPath) ? (0, import_node_fs3.readFileSync)(configPath, "utf8") : "";
  const built = buildManagedMcpBlock(tweaks, current);
  const next = mergeManagedMcpBlock(current, built.block);
  if (next !== current) {
    (0, import_node_fs3.mkdirSync)((0, import_node_path4.dirname)(configPath), { recursive: true });
    (0, import_node_fs3.writeFileSync)(configPath, next, "utf8");
  }
  return { ...built, changed: next !== current };
}
function buildManagedMcpBlock(tweaks, existingToml = "") {
  const manualToml = stripManagedMcpBlock(existingToml);
  const manualNames = findMcpServerNames(manualToml);
  const usedNames = new Set(manualNames);
  const serverNames = [];
  const skippedServerNames = [];
  const entries = [];
  for (const tweak of tweaks) {
    const mcp = normalizeMcpServer(tweak.manifest.mcp);
    if (!mcp) continue;
    const baseName = mcpServerNameFromTweakId(tweak.manifest.id);
    if (manualNames.has(baseName)) {
      skippedServerNames.push(baseName);
      continue;
    }
    const serverName = reserveUniqueName(baseName, usedNames);
    serverNames.push(serverName);
    entries.push(formatMcpServer(serverName, tweak.dir, mcp));
  }
  if (entries.length === 0) {
    return { block: "", serverNames, skippedServerNames };
  }
  return {
    block: [MCP_MANAGED_START, ...entries, MCP_MANAGED_END].join("\n"),
    serverNames,
    skippedServerNames
  };
}
function mergeManagedMcpBlock(currentToml, managedBlock) {
  if (!managedBlock && !currentToml.includes(MCP_MANAGED_START) && !currentToml.includes(LEGACY_MCP_MANAGED_START)) {
    return currentToml;
  }
  const stripped = stripManagedMcpBlock(currentToml).trimEnd();
  if (!managedBlock) return stripped ? `${stripped}
` : "";
  return `${stripped ? `${stripped}

` : ""}${managedBlock}
`;
}
function stripManagedMcpBlock(toml) {
  const pattern = new RegExp(
    `\\n?(?:${escapeRegExp(MCP_MANAGED_START)}|${escapeRegExp(LEGACY_MCP_MANAGED_START)})[\\s\\S]*?(?:${escapeRegExp(MCP_MANAGED_END)}|${escapeRegExp(LEGACY_MCP_MANAGED_END)})\\n?`,
    "g"
  );
  return toml.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}
function mcpServerNameFromTweakId(id) {
  const withoutPublisher = id.replace(/^co\.bennett\./, "");
  const slug = withoutPublisher.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return slug || "tweak-mcp";
}
function findMcpServerNames(toml) {
  const names = /* @__PURE__ */ new Set();
  const tablePattern = /^\s*\[mcp_servers\.([^\]\s]+)\]\s*$/gm;
  let match;
  while ((match = tablePattern.exec(toml)) !== null) {
    names.add(unquoteTomlKey(match[1] ?? ""));
  }
  return names;
}
function reserveUniqueName(baseName, usedNames) {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }
  for (let i = 2; ; i += 1) {
    const candidate = `${baseName}-${i}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
}
function normalizeMcpServer(value) {
  if (!value || typeof value.command !== "string" || value.command.length === 0) return null;
  if (value.args !== void 0 && !Array.isArray(value.args)) return null;
  if (value.args?.some((arg) => typeof arg !== "string")) return null;
  if (value.env !== void 0) {
    if (!value.env || typeof value.env !== "object" || Array.isArray(value.env)) return null;
    if (Object.values(value.env).some((envValue) => typeof envValue !== "string")) return null;
  }
  return value;
}
function formatMcpServer(serverName, tweakDir, mcp) {
  const lines = [
    `[mcp_servers.${formatTomlKey(serverName)}]`,
    `command = ${formatTomlString(resolveCommand(tweakDir, mcp.command))}`
  ];
  if (mcp.args && mcp.args.length > 0) {
    lines.push(`args = ${formatTomlStringArray(mcp.args.map((arg) => resolveArg(tweakDir, arg)))}`);
  }
  if (mcp.env && Object.keys(mcp.env).length > 0) {
    lines.push(`env = ${formatTomlInlineTable(mcp.env)}`);
  }
  return lines.join("\n");
}
function resolveCommand(tweakDir, command) {
  if ((0, import_node_path4.isAbsolute)(command) || !looksLikeRelativePath(command)) return command;
  return (0, import_node_path4.resolve)(tweakDir, command);
}
function resolveArg(tweakDir, arg) {
  if ((0, import_node_path4.isAbsolute)(arg) || arg.startsWith("-")) return arg;
  const candidate = (0, import_node_path4.resolve)(tweakDir, arg);
  return (0, import_node_fs3.existsSync)(candidate) ? candidate : arg;
}
function looksLikeRelativePath(value) {
  return value.startsWith("./") || value.startsWith("../") || value.includes("/");
}
function formatTomlString(value) {
  return JSON.stringify(value);
}
function formatTomlStringArray(values) {
  return `[${values.map(formatTomlString).join(", ")}]`;
}
function formatTomlInlineTable(record) {
  return `{ ${Object.entries(record).map(([key, value]) => `${formatTomlKey(key)} = ${formatTomlString(value)}`).join(", ")} }`;
}
function formatTomlKey(key) {
  return /^[a-zA-Z0-9_-]+$/.test(key) ? key : formatTomlString(key);
}
function unquoteTomlKey(key) {
  if (!key.startsWith('"') || !key.endsWith('"')) return key;
  try {
    return JSON.parse(key);
  } catch {
    return key;
  }
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/watcher-health.ts
var import_node_child_process = require("node:child_process");
var import_node_fs4 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path5 = require("node:path");
var LAUNCHD_LABEL = "com.chatgptplusplus.watcher";
var LEGACY_LAUNCHD_LABEL = "com.codexplusplus.watcher";
var WATCHER_LOG = (0, import_node_path5.join)((0, import_node_os.homedir)(), "Library", "Logs", "chatgpt-plusplus-watcher.log");
var LEGACY_WATCHER_LOG = (0, import_node_path5.join)((0, import_node_os.homedir)(), "Library", "Logs", "codex-plusplus-watcher.log");
function getWatcherHealth(userRoot2) {
  const checks = [];
  const state = readJson((0, import_node_path5.join)(userRoot2, "state.json"));
  const config = readJson((0, import_node_path5.join)(userRoot2, "config.json")) ?? {};
  const selfUpdate = readJson((0, import_node_path5.join)(userRoot2, "self-update-state.json"));
  checks.push({
    name: "Install state",
    status: state ? "ok" : "error",
    detail: state ? `ChatGPT++ ${state.version ?? "(unknown version)"}` : "state.json is missing"
  });
  if (!state) return summarize("none", checks);
  const autoUpdate = config.chatgptPlusPlus?.autoUpdate !== false && config.codexPlusPlus?.autoUpdate !== false;
  checks.push({
    name: "Automatic refresh",
    status: autoUpdate ? "ok" : "warn",
    detail: autoUpdate ? "enabled" : "disabled in ChatGPT++ config"
  });
  checks.push({
    name: "Watcher kind",
    status: state.watcher && state.watcher !== "none" ? "ok" : "error",
    detail: state.watcher ?? "none"
  });
  if (selfUpdate) {
    checks.push(selfUpdateCheck(selfUpdate));
  }
  const appRoot = state.appRoot ?? "";
  checks.push({
    name: "Codex app",
    status: appRoot && (0, import_node_fs4.existsSync)(appRoot) ? "ok" : "error",
    detail: appRoot || "missing appRoot in state"
  });
  switch ((0, import_node_os.platform)()) {
    case "darwin":
      checks.push(...checkLaunchdWatcher(appRoot));
      break;
    case "linux":
      checks.push(...checkSystemdWatcher(appRoot));
      break;
    case "win32":
      checks.push(...checkScheduledTaskWatcher());
      break;
    default:
      checks.push({
        name: "Platform watcher",
        status: "warn",
        detail: `unsupported platform: ${(0, import_node_os.platform)()}`
      });
  }
  return summarize(state.watcher ?? "none", checks);
}
function selfUpdateCheck(state) {
  const at = state.completedAt ?? state.checkedAt ?? "unknown time";
  if (state.status === "failed") {
    return {
      name: "last ChatGPT++ update",
      status: "warn",
      detail: state.error ? `failed ${at}: ${state.error}` : `failed ${at}`
    };
  }
  if (state.status === "disabled") {
    return { name: "last ChatGPT++ update", status: "warn", detail: `skipped ${at}: automatic refresh disabled` };
  }
  if (state.status === "updated") {
    return { name: "last ChatGPT++ update", status: "ok", detail: `updated ${at} to ${state.latestVersion ?? "new release"}` };
  }
  if (state.status === "up-to-date") {
    return { name: "last ChatGPT++ update", status: "ok", detail: `up to date ${at}` };
  }
  return { name: "last ChatGPT++ update", status: "warn", detail: `checking since ${at}` };
}
function checkLaunchdWatcher(appRoot) {
  const checks = [];
  const plistPath = (0, import_node_path5.join)((0, import_node_os.homedir)(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
  const plist = (0, import_node_fs4.existsSync)(plistPath) ? readFileSafe(plistPath) : "";
  const asarPath = appRoot ? (0, import_node_path5.join)(appRoot, "Contents", "Resources", "app.asar") : "";
  checks.push({
    name: "launchd plist",
    status: plist ? "ok" : "error",
    detail: plistPath
  });
  if (plist) {
    checks.push({
      name: "launchd label",
      status: plist.includes(LAUNCHD_LABEL) || plist.includes(LEGACY_LAUNCHD_LABEL) ? "ok" : "error",
      detail: LAUNCHD_LABEL
    });
    checks.push({
      name: "launchd trigger",
      status: asarPath && plist.includes(asarPath) ? "ok" : "error",
      detail: asarPath || "missing appRoot"
    });
    checks.push({
      name: "watcher command",
      status: (plist.includes("CHATGPT_PLUSPLUS_WATCHER=1") || plist.includes("CODEX_PLUSPLUS_WATCHER=1")) && plist.includes(" update --watcher --quiet") ? "ok" : "error",
      detail: commandSummary(plist)
    });
    const cliPath = extractFirst(plist, /'([^']*packages\/installer\/dist\/cli\.js)'/);
    if (cliPath) {
      checks.push({
        name: "repair CLI",
        status: (0, import_node_fs4.existsSync)(cliPath) ? "ok" : "error",
        detail: cliPath
      });
    }
  }
  const loaded = commandSucceeds("launchctl", ["list", LAUNCHD_LABEL]);
  checks.push({
    name: "launchd loaded",
    status: loaded ? "ok" : "error",
    detail: loaded ? "service is loaded" : "launchctl cannot find the watcher"
  });
  checks.push(watcherLogCheck());
  return checks;
}
function checkSystemdWatcher(appRoot) {
  const dir = (0, import_node_path5.join)((0, import_node_os.homedir)(), ".config", "systemd", "user");
  const service = (0, import_node_path5.join)(dir, "chatgpt-plusplus-watcher.service");
  const timer = (0, import_node_path5.join)(dir, "chatgpt-plusplus-watcher.timer");
  const pathUnit = (0, import_node_path5.join)(dir, "chatgpt-plusplus-watcher.path");
  const expectedPath = appRoot ? (0, import_node_path5.join)(appRoot, "resources", "app.asar") : "";
  const pathBody = (0, import_node_fs4.existsSync)(pathUnit) ? readFileSafe(pathUnit) : "";
  return [
    {
      name: "systemd service",
      status: (0, import_node_fs4.existsSync)(service) ? "ok" : "error",
      detail: service
    },
    {
      name: "systemd timer",
      status: (0, import_node_fs4.existsSync)(timer) ? "ok" : "error",
      detail: timer
    },
    {
      name: "systemd path",
      status: pathBody && expectedPath && pathBody.includes(expectedPath) ? "ok" : "error",
      detail: expectedPath || pathUnit
    },
    {
      name: "path unit active",
      status: commandSucceeds("systemctl", ["--user", "is-active", "--quiet", "chatgpt-plusplus-watcher.path"]) ? "ok" : "warn",
      detail: "systemctl --user is-active chatgpt-plusplus-watcher.path"
    },
    {
      name: "timer active",
      status: commandSucceeds("systemctl", ["--user", "is-active", "--quiet", "chatgpt-plusplus-watcher.timer"]) ? "ok" : "warn",
      detail: "systemctl --user is-active chatgpt-plusplus-watcher.timer"
    }
  ];
}
function checkScheduledTaskWatcher() {
  return [
    {
      name: "logon task",
      status: commandSucceeds("schtasks.exe", ["/Query", "/TN", "chatgpt-plusplus-watcher"]) ? "ok" : "error",
      detail: "chatgpt-plusplus-watcher"
    },
    {
      name: "hourly task",
      status: commandSucceeds("schtasks.exe", ["/Query", "/TN", "chatgpt-plusplus-watcher-hourly"]) ? "ok" : "warn",
      detail: "chatgpt-plusplus-watcher-hourly"
    }
  ];
}
function watcherLogCheck() {
  const logPath = (0, import_node_fs4.existsSync)(WATCHER_LOG) ? WATCHER_LOG : LEGACY_WATCHER_LOG;
  if (!(0, import_node_fs4.existsSync)(logPath)) {
    return { name: "watcher log", status: "warn", detail: "no watcher log yet" };
  }
  const tail = readFileSafe(logPath).split(/\r?\n/).slice(-40).join("\n");
  return analyzeWatcherLogTail(tail);
}
function analyzeWatcherLogTail(tail) {
  const hasError = /✗ (?:chatgpt|codex)-plusplus failed|(?:chatgpt|codex)-plusplus failed|error|failed/i.test(tail);
  const needsManualRepair = hasError && /Cannot write to .*Codex.*\.app|App Management|file ownership|sudo (?:chatgptplusplus|codexplusplus) (?:install|repair)|EACCES|EPERM/i.test(tail);
  return {
    name: "watcher log",
    status: hasError ? "warn" : "ok",
    detail: hasError ? needsManualRepair ? "auto-repair needs app permissions; run `chatgptplusplus repair` from Terminal" : "recent watcher log contains an error" : WATCHER_LOG
  };
}
function summarize(watcher, checks) {
  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");
  const status = hasError ? "error" : hasWarn ? "warn" : "ok";
  const failed = checks.filter((c) => c.status === "error").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const title = status === "ok" ? "Auto-repair watcher is ready" : status === "warn" ? "Auto-repair watcher needs review" : "Auto-repair watcher is not ready";
  const summary = status === "ok" ? "ChatGPT++ should automatically repair itself after Codex updates." : `${failed} failing check(s), ${warned} warning(s).`;
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status,
    title,
    summary,
    watcher,
    checks
  };
}
function commandSucceeds(command, args) {
  try {
    (0, import_node_child_process.execFileSync)(command, args, { stdio: "ignore", timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
function commandSummary(plist) {
  const command = extractFirst(plist, /<string>([^<]*(?:update --watcher --quiet|repair --quiet)[^<]*)<\/string>/);
  return command ? unescapeXml(command).replace(/\s+/g, " ").trim() : "watcher command not found";
}
function extractFirst(source, pattern) {
  return source.match(pattern)?.[1] ?? null;
}
function readJson(path) {
  try {
    return JSON.parse((0, import_node_fs4.readFileSync)(path, "utf8"));
  } catch {
    return null;
  }
}
function readFileSafe(path) {
  try {
    return (0, import_node_fs4.readFileSync)(path, "utf8");
  } catch {
    return "";
  }
}
function unescapeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// src/tweak-lifecycle.ts
function isMainProcessTweakScope(scope) {
  return scope !== "renderer";
}
function reloadTweaks(reason, deps) {
  deps.logInfo(`reloading tweaks (${reason})`);
  deps.stopAllMainTweaks();
  deps.clearTweakModuleCache();
  deps.loadAllMainTweaks();
  deps.broadcastReload();
}
function setTweakEnabledAndReload(id, enabled, deps) {
  const normalizedEnabled = !!enabled;
  deps.setTweakEnabled(id, normalizedEnabled);
  deps.logInfo(`tweak ${id} enabled=${normalizedEnabled}`);
  reloadTweaks("enabled-toggle", deps);
  return true;
}

// src/logging.ts
var import_node_fs5 = require("node:fs");
var MAX_LOG_BYTES = 10 * 1024 * 1024;
function appendCappedLog(path, line, maxBytes = MAX_LOG_BYTES) {
  const incoming = Buffer.from(line);
  if (incoming.byteLength >= maxBytes) {
    (0, import_node_fs5.writeFileSync)(path, incoming.subarray(incoming.byteLength - maxBytes));
    return;
  }
  try {
    if ((0, import_node_fs5.existsSync)(path)) {
      const size = (0, import_node_fs5.statSync)(path).size;
      const allowedExisting = maxBytes - incoming.byteLength;
      if (size > allowedExisting) {
        const existing = (0, import_node_fs5.readFileSync)(path);
        (0, import_node_fs5.writeFileSync)(path, existing.subarray(Math.max(0, existing.byteLength - allowedExisting)));
      }
    }
  } catch {
  }
  (0, import_node_fs5.appendFileSync)(path, incoming);
}

// src/codex-runtime-probe.ts
var import_electron = require("electron");
var import_node_fs6 = require("node:fs");
var import_node_path6 = require("node:path");
function getRuntimeInfo(opts) {
  return {
    type: detectRuntimeType(),
    codexVersion: opts.codexVersion ?? safeAppVersion(),
    channel: opts.channel,
    buildFlavor: safeBuildFlavor(),
    usesOwlAppShell: null,
    appPath: safeAppPath(),
    resourcesPath: process.resourcesPath ?? null
  };
}
function getRuntimeCapabilities(opts) {
  const services = asRecord(opts.getWindowServices());
  const windowManager = asRecord(services?.windowManager);
  const cdp = getCdpStatus();
  const native = opts.getNativeCapabilities?.() ?? defaultNativeCapabilities();
  const views = opts.getViewCapabilities?.() ?? defaultViewCapabilities();
  const canCreateWindow = typeof windowManager?.createWindow === "function" || typeof services?.createFreshWindow === "function" || typeof services?.createFreshLocalWindow === "function" || typeof services?.ensureHostWindow === "function";
  return {
    windows: {
      create: canCreateWindow,
      focus: true,
      primary: typeof services?.getPrimaryWindow === "function" || typeof windowManager?.getPrimaryWindow === "function",
      browserView: typeof windowManager?.registerWindow === "function"
    },
    views,
    cdp: {
      supported: true,
      enabled: cdp.enabled,
      port: cdp.port
    },
    native
  };
}
function getCdpStatus() {
  const enabled = process.env.CODEXPP_REMOTE_DEBUG === "1";
  const port = parseCdpPort(process.env.CODEXPP_REMOTE_DEBUG_PORT);
  return {
    supported: true,
    enabled,
    port: enabled ? port : null,
    url: enabled ? `http://127.0.0.1:${port}` : null
  };
}
async function listCdpTargets() {
  const status = getCdpStatus();
  if (!status.enabled || !status.url) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1e3);
  try {
    const res = await fetch(`${status.url}/json`, { signal: controller.signal });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => normalizeCdpTarget(row)).filter((row) => row !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
function detectRuntimeType() {
  if (process.platform === "darwin") {
    const appRoot = inferMacAppRoot();
    if (appRoot && (0, import_node_fs6.existsSync)((0, import_node_path6.join)(appRoot, "Contents", "Frameworks", "Codex Framework.framework"))) {
      return "owl";
    }
    if (appRoot && (0, import_node_fs6.existsSync)((0, import_node_path6.join)(appRoot, "Contents", "Frameworks", "Electron Framework.framework"))) {
      return "electron";
    }
    if (process.resourcesPath && (0, import_node_fs6.existsSync)((0, import_node_path6.join)(process.resourcesPath, "app.asar"))) {
      return "electron";
    }
    return "unknown";
  }
  return process.resourcesPath && (0, import_node_fs6.existsSync)((0, import_node_path6.join)(process.resourcesPath, "app.asar")) ? "electron" : "unknown";
}
function inferMacAppRoot() {
  const marker = ".app/Contents/MacOS/";
  const idx = process.execPath.indexOf(marker);
  return idx >= 0 ? process.execPath.slice(0, idx + ".app".length) : null;
}
function safeAppVersion() {
  try {
    return import_electron.app.getVersion();
  } catch {
    return null;
  }
}
function safeAppPath() {
  try {
    return import_electron.app.getAppPath();
  } catch {
    return process.resourcesPath ? (0, import_node_path6.join)(process.resourcesPath, "app.asar") : null;
  }
}
function safeBuildFlavor() {
  const appPath = safeAppPath();
  if (!appPath) return null;
  const parent = (0, import_node_path6.dirname)(appPath);
  if (parent.includes("Nightly")) return "nightly";
  return import_electron.app.isPackaged ? "prod" : "dev";
}
function parseCdpPort(value) {
  const parsed = Number(value ?? "9222");
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 9222;
}
function defaultNativeCapabilities() {
  return {
    inProcessModules: true,
    swiftModules: process.platform === "darwin",
    appKitEmbedding: false,
    childWindowOverlay: false,
    directViewAttach: false,
    metalViews: false,
    nativeHost: false,
    helpers: true
  };
}
function defaultViewCapabilities() {
  return {
    create: false,
    privateViewTree: false,
    webContentsView: false,
    browserViewFallback: typeof import_electron.BrowserWindow.fromId === "function"
  };
}
function normalizeCdpTarget(row) {
  const value = asRecord(row);
  if (!value || typeof value.id !== "string" || typeof value.type !== "string" || typeof value.url !== "string") {
    return null;
  }
  return {
    id: value.id,
    type: value.type,
    url: value.url,
    ...typeof value.title === "string" ? { title: value.title } : {},
    ...typeof value.webSocketDebuggerUrl === "string" ? { webSocketDebuggerUrl: value.webSocketDebuggerUrl } : {}
  };
}
function asRecord(value) {
  return value && typeof value === "object" ? value : null;
}

// src/native-bridge.ts
var import_electron2 = require("electron");
var import_node_child_process2 = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_node_fs8 = require("node:fs");
var import_node_readline = require("node:readline");

// src/native-paths.ts
var import_node_fs7 = require("node:fs");
var import_node_path7 = require("node:path");
function resolveNativeTweakPath(tweakDir, path) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("native path is required");
  const root = (0, import_node_fs7.realpathSync)(tweakDir);
  const full = (0, import_node_path7.resolve)(tweakDir, path);
  let target;
  try {
    target = (0, import_node_fs7.realpathSync)(full);
  } catch {
    throw new Error("native path does not exist");
  }
  if (!isPathInside(root, target) || target === root) {
    throw new Error("native path must stay inside the tweak directory");
  }
  return target;
}
function isPathInside(parent, target) {
  const rel = (0, import_node_path7.relative)((0, import_node_path7.resolve)(parent), (0, import_node_path7.resolve)(target));
  return rel === "" || !!rel && !rel.startsWith("..") && !(0, import_node_path7.isAbsolute)(rel);
}

// src/native-bridge.ts
var NativeBridge = class {
  constructor(log2, options = {}) {
    this.log = log2;
    this.options = options;
  }
  log;
  options;
  modules = /* @__PURE__ */ new Map();
  instances = /* @__PURE__ */ new Map();
  helpers = /* @__PURE__ */ new Map();
  nativeHostExports = null;
  nativeHostLoadError = null;
  getCapabilities() {
    const host = this.loadNativeHost(false);
    const hostCapabilities = host ? this.readNativeHostCapabilities(host) : {};
    const nativeHost = host !== null;
    return {
      inProcessModules: true,
      swiftModules: process.platform === "darwin",
      appKitEmbedding: Boolean(hostCapabilities.appKitEmbedding),
      childWindowOverlay: Boolean(hostCapabilities.childWindowOverlay),
      directViewAttach: Boolean(hostCapabilities.directViewAttach),
      metalViews: Boolean(hostCapabilities.metalViews),
      nativeHost,
      helpers: true
    };
  }
  loadModule(ctx, options) {
    const id = assertBridgeId(options.id, "native module id");
    const fullPath = resolveTweakPath(ctx, options.path);
    const kind = options.kind ?? inferModuleKind(fullPath);
    if (kind !== "node-addon") {
      throw new Error(
        `${kind} native modules must be loaded through a .node Objective-C++ shim in ChatGPT++ 1.0.0`
      );
    }
    if (!fullPath.endsWith(".node")) {
      throw new Error("node-addon native modules must use a .node file");
    }
    const loaded = require(fullPath);
    const exports2 = selectEntrypoint(loaded, options.entrypoint);
    const key = moduleKey(ctx.id, id);
    this.modules.set(key, { key, tweakId: ctx.id, id, kind, path: fullPath, exports: exports2 });
    this.log("info", `loaded native module ${ctx.id}:${id}`, { kind, path: fullPath });
    return this.moduleRef(ctx.id, id, kind);
  }
  async createPanel(ctx, options) {
    const created = await this.createNativeInstance(ctx, "panel", options.moduleId, options.factory ?? "createPanel", {
      parentWindowId: options.parentWindowId,
      bounds: options.bounds,
      transparent: options.transparent === true,
      passthroughMouse: options.passthroughMouse === true
    });
    return this.panelRef(created);
  }
  async attachView(ctx, options) {
    const created = await this.createNativeInstance(ctx, "view", options.moduleId, options.factory ?? "attachView", {
      parentWindowId: options.parentWindowId,
      bounds: options.bounds,
      zIndex: options.zIndex
    });
    return this.viewRef(created);
  }
  launchHelper(ctx, options) {
    const id = assertBridgeId(options.id, "native helper id");
    if ((options.transport ?? "stdio") !== "stdio") {
      throw new Error("native helpers support only stdio transport in ChatGPT++ 1.0.0");
    }
    if ((options.restart ?? "never") !== "never") {
      throw new Error("native helper restart policies are not available in ChatGPT++ 1.0.0");
    }
    const executable = resolveTweakPath(ctx, options.executable);
    const args = options.args ?? [];
    const env = { ...process.env, ...options.env ?? {} };
    const child = (0, import_node_child_process2.spawn)(executable, args, {
      cwd: ctx.dir,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const key = helperKey(ctx.id, id);
    const helper = {
      key,
      tweakId: ctx.id,
      id,
      child,
      pending: /* @__PURE__ */ new Map()
    };
    this.helpers.set(key, helper);
    const stdout = (0, import_node_readline.createInterface)({ input: child.stdout });
    stdout.on("line", (line) => this.handleHelperLine(helper, line));
    child.stderr.on("data", (chunk) => {
      this.log("warn", `native helper ${ctx.id}:${id} stderr`, String(chunk));
    });
    child.on("exit", (code, signal) => {
      this.log("info", `native helper ${ctx.id}:${id} exited`, { code, signal });
      this.helpers.delete(key);
      for (const request of helper.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error(`native helper exited before response`));
      }
      helper.pending.clear();
    });
    child.on("error", (error) => {
      this.log("error", `native helper ${ctx.id}:${id} failed`, error);
      this.helpers.delete(key);
      for (const request of helper.pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      helper.pending.clear();
    });
    this.log("info", `launched native helper ${ctx.id}:${id}`, { pid: child.pid, executable });
    return this.helperRef(ctx.id, id, child.pid ?? -1);
  }
  disposeTweak(tweakId) {
    for (const [key, instance] of [...this.instances]) {
      if (instance.tweakId !== tweakId) continue;
      void this.disposeInstance(instance).finally(() => this.instances.delete(key));
    }
    for (const [key, helper] of [...this.helpers]) {
      if (helper.tweakId !== tweakId) continue;
      this.stopHelper(helper);
      this.helpers.delete(key);
    }
    for (const [key, mod] of [...this.modules]) {
      if (mod.tweakId !== tweakId) continue;
      void callOptional(mod.exports, "dispose", []);
      this.modules.delete(key);
    }
  }
  disposeAll() {
    const tweakIds = /* @__PURE__ */ new Set([
      ...[...this.modules.values()].map((item) => item.tweakId),
      ...[...this.instances.values()].map((item) => item.tweakId),
      ...[...this.helpers.values()].map((item) => item.tweakId)
    ]);
    for (const id of tweakIds) this.disposeTweak(id);
  }
  async callInstance(tweakId, kind, id, method, arg) {
    if (kind === "panel") {
      if (method === "setBounds") return this.invokeInstance(tweakId, id, "setBounds", [arg]);
      if (method === "show") return this.invokeInstance(tweakId, id, "show", []);
      if (method === "hide") return this.invokeInstance(tweakId, id, "hide", []);
      if (method === "dispose") return this.disposeInstanceById(tweakId, id);
    }
    if (kind === "view") {
      if (method === "setBounds") return this.invokeInstance(tweakId, id, "setBounds", [arg]);
      if (method === "setVisible") return this.invokeInstance(tweakId, id, "setVisible", [arg]);
      if (method === "dispose") return this.disposeInstanceById(tweakId, id);
    }
    throw new Error(`unknown native ${kind} method: ${method}`);
  }
  async callHelper(tweakId, helperId, method, payload, timeoutMs) {
    if (method === "send") return this.sendHelper(tweakId, helperId, payload);
    if (method === "request") return this.requestHelper(tweakId, helperId, payload, timeoutMs);
    if (method === "stop") return this.stopHelperById(tweakId, helperId);
    throw new Error(`unknown native helper method: ${method}`);
  }
  moduleRef(tweakId, id, kind = this.moduleFor(tweakId, id).kind) {
    return {
      id,
      kind,
      request: (method, payload, timeoutMs) => this.requestModule(tweakId, id, method, payload, timeoutMs),
      dispose: () => this.disposeModule(tweakId, id)
    };
  }
  panelRef(instance) {
    return {
      id: instance.id,
      windowId: instance.windowId,
      setBounds: (bounds) => this.invokeInstance(instance.tweakId, instance.id, "setBounds", [bounds]),
      show: () => this.invokeInstance(instance.tweakId, instance.id, "show", []),
      hide: () => this.invokeInstance(instance.tweakId, instance.id, "hide", []),
      dispose: () => this.disposeInstanceById(instance.tweakId, instance.id)
    };
  }
  viewRef(instance) {
    return {
      id: instance.id,
      setBounds: (bounds) => this.invokeInstance(instance.tweakId, instance.id, "setBounds", [bounds]),
      setVisible: (visible) => this.invokeInstance(instance.tweakId, instance.id, "setVisible", [visible]),
      dispose: () => this.disposeInstanceById(instance.tweakId, instance.id)
    };
  }
  helperRef(tweakId, id, pid) {
    return {
      id,
      pid,
      send: (message) => this.sendHelper(tweakId, id, message),
      request: (message, timeoutMs) => this.requestHelper(tweakId, id, message, timeoutMs),
      stop: () => this.stopHelperById(tweakId, id)
    };
  }
  async requestModule(tweakId, id, method, payload, _timeoutMs) {
    const mod = this.moduleFor(tweakId, id);
    const target = asRecord2(mod.exports);
    const fn = target?.request;
    if (typeof fn === "function") {
      return await fn.call(mod.exports, method, payload);
    }
    const methodFn = target?.[method];
    if (typeof methodFn === "function") {
      return await methodFn.call(mod.exports, payload);
    }
    throw new Error(`native module ${tweakId}:${id} has no request() or ${method}()`);
  }
  async disposeModule(tweakId, id) {
    const key = moduleKey(tweakId, id);
    const mod = this.modules.get(key);
    if (!mod) return;
    await callOptional(mod.exports, "dispose", []);
    this.modules.delete(key);
  }
  async createNativeInstance(ctx, kind, moduleId, factory, options) {
    const target = moduleId ? this.moduleFor(ctx.id, moduleId).exports : this.loadNativeHost(true);
    const fn = asRecord2(target)?.[factory];
    if (typeof fn !== "function") {
      const label = moduleId ? `native module ${ctx.id}:${moduleId}` : "ChatGPT++ native host";
      throw new Error(`${label} has no factory ${factory}()`);
    }
    const parentWindow = typeof options.parentWindowId === "number" ? import_electron2.BrowserWindow.fromId(options.parentWindowId) : import_electron2.BrowserWindow.getFocusedWindow();
    const parentNativeHandle = nativeHandleForWindow(parentWindow);
    const value = await fn.call(target, {
      ...options,
      parentWindowId: windowIdFor(parentWindow),
      parentWebContentsId: webContentsIdFor(parentWindow),
      parentNativeHandle
    });
    const id = typeof asRecord2(value)?.id === "string" ? String(asRecord2(value)?.id) : (0, import_node_crypto.randomUUID)();
    const windowId = typeof asRecord2(value)?.windowId === "number" ? Number(asRecord2(value)?.windowId) : null;
    const instance = {
      key: instanceKey(ctx.id, id),
      tweakId: ctx.id,
      id,
      kind,
      value,
      parentWindowId: windowIdFor(parentWindow),
      windowId,
      disposeBindings: [],
      disposing: false
    };
    this.instances.set(instance.key, instance);
    if (canBindParentWindow(parentWindow)) {
      this.bindInstanceToParent(instance, parentWindow);
      this.syncParentState(instance, parentWindow, "created");
    }
    this.log("info", `created native ${kind} ${ctx.id}:${id}`, {
      moduleId: moduleId ?? "codexpp.native-host",
      factory,
      windowId
    });
    return instance;
  }
  loadNativeHost(required) {
    if (this.nativeHostExports) return this.nativeHostExports;
    if (this.nativeHostLoadError && !required) return null;
    const nativeHostPath = this.options.nativeHostPath;
    if (!nativeHostPath || !(0, import_node_fs8.existsSync)(nativeHostPath)) {
      const error = new Error("ChatGPT++ native host is not installed");
      this.nativeHostLoadError = error;
      if (required) throw error;
      return null;
    }
    try {
      this.nativeHostExports = require(nativeHostPath);
      this.nativeHostLoadError = null;
      this.log("info", "loaded ChatGPT++ native host", { path: nativeHostPath });
      return this.nativeHostExports;
    } catch (error) {
      this.nativeHostLoadError = error instanceof Error ? error : new Error(String(error));
      this.log("error", "failed to load ChatGPT++ native host", this.nativeHostLoadError);
      if (required) throw this.nativeHostLoadError;
      return null;
    }
  }
  readNativeHostCapabilities(host) {
    const getCapabilities = asRecord2(host)?.getCapabilities;
    if (typeof getCapabilities !== "function") return {};
    try {
      const capabilities = getCapabilities.call(host);
      return asRecord2(capabilities) ?? {};
    } catch (error) {
      this.log("warn", "ChatGPT++ native host capability probe failed", error);
      return {};
    }
  }
  async invokeInstance(tweakId, id, method, args) {
    const instance = this.instanceFor(tweakId, id);
    const fn = asRecord2(instance.value)?.[method];
    if (typeof fn === "function") {
      await fn.apply(instance.value, args);
      return;
    }
    if (instance.windowId !== null) {
      const win = import_electron2.BrowserWindow.fromId(instance.windowId);
      if (win && !win.isDestroyed()) {
        if (method === "setBounds") win.setBounds(args[0]);
        else if (method === "show") win.show();
        else if (method === "hide") win.hide();
        else if (method === "setVisible") args[0] ? win.show() : win.hide();
        return;
      }
    }
    throw new Error(`native ${instance.kind} ${tweakId}:${id} does not implement ${method}()`);
  }
  async disposeInstanceById(tweakId, id) {
    const key = instanceKey(tweakId, id);
    const instance = this.instances.get(key);
    if (!instance) return;
    await this.disposeInstance(instance);
    this.instances.delete(key);
  }
  async disposeInstance(instance) {
    if (instance.disposing) return;
    instance.disposing = true;
    for (const dispose of instance.disposeBindings.splice(0)) {
      try {
        dispose();
      } catch {
      }
    }
    await callOptional(instance.value, "dispose", []);
    if (instance.windowId !== null) {
      const win = import_electron2.BrowserWindow.fromId(instance.windowId);
      if (win && !win.isDestroyed()) win.close();
    }
  }
  bindInstanceToParent(instance, parentWindow) {
    const on = (event, listener) => {
      parentWindow.on(event, listener);
      instance.disposeBindings.push(() => parentWindow.off(event, listener));
    };
    const syncBounds = () => this.syncParentState(instance, parentWindow, "bounds");
    const syncFocus = (focused) => this.signalParentState(instance, parentWindow, "focus", { focused });
    const syncVisibility = (visible) => this.signalParentState(instance, parentWindow, "visibility", { visible });
    const disposeWithParent = () => {
      this.log("info", `disposing native ${instance.kind} ${instance.tweakId}:${instance.id}; parent closed`);
      void this.disposeInstanceById(instance.tweakId, instance.id);
    };
    on("move", syncBounds);
    on("resize", syncBounds);
    on("enter-full-screen", syncBounds);
    on("leave-full-screen", syncBounds);
    on("maximize", syncBounds);
    on("unmaximize", syncBounds);
    on("minimize", syncBounds);
    on("restore", syncBounds);
    on("show", () => syncVisibility(true));
    on("hide", () => syncVisibility(false));
    on("focus", () => syncFocus(true));
    on("blur", () => syncFocus(false));
    on("close", disposeWithParent);
    on("closed", disposeWithParent);
  }
  syncParentState(instance, parentWindow, reason) {
    const state = parentWindowState(parentWindow, reason);
    if (!state) return;
    void this.callFirstOptionalInstance(instance, ["syncParent", "parentChanged"], [state]).then((handled) => {
      if (!handled) {
        return this.callFirstOptionalInstance(
          instance,
          ["setParentBounds", "parentBoundsChanged"],
          [state.bounds, state]
        );
      }
      return false;
    }).catch((error) => this.log("warn", `native ${instance.kind} parent sync failed`, error));
  }
  signalParentState(instance, parentWindow, reason, patch) {
    const state = parentWindowState(parentWindow, reason);
    if (!state) return;
    const payload = { ...state, ...patch };
    void this.callFirstOptionalInstance(instance, ["parentStateChanged", "parentChanged"], [payload]).catch((error) => this.log("warn", `native ${instance.kind} parent signal failed`, error));
  }
  async callFirstOptionalInstance(instance, methods, args) {
    const target = asRecord2(instance.value);
    for (const method of methods) {
      const fn = target?.[method];
      if (typeof fn !== "function") continue;
      await fn.apply(instance.value, args);
      return true;
    }
    return false;
  }
  async sendHelper(tweakId, id, message) {
    const helper = this.helperFor(tweakId, id);
    helper.child.stdin.write(`${JSON.stringify(message)}
`);
  }
  async requestHelper(tweakId, id, message, timeoutMs = 1e4) {
    const helper = this.helperFor(tweakId, id);
    const requestId = (0, import_node_crypto.randomUUID)();
    const payload = { id: requestId, message };
    return await new Promise((resolve6, reject) => {
      const timer = setTimeout(() => {
        helper.pending.delete(requestId);
        reject(new Error(`native helper request timed out: ${tweakId}:${id}`));
      }, timeoutMs);
      helper.pending.set(requestId, { resolve: resolve6, reject, timer });
      helper.child.stdin.write(`${JSON.stringify(payload)}
`);
    });
  }
  async stopHelperById(tweakId, id) {
    const key = helperKey(tweakId, id);
    const helper = this.helpers.get(key);
    if (!helper) return;
    this.stopHelper(helper);
    this.helpers.delete(key);
  }
  stopHelper(helper) {
    if (helper.child.killed) return;
    helper.child.kill();
    const timer = setTimeout(() => {
      if (!helper.child.killed) helper.child.kill("SIGKILL");
    }, 1500);
    timer.unref?.();
  }
  handleHelperLine(helper, line) {
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      this.log("info", `native helper ${helper.tweakId}:${helper.id}`, line);
      return;
    }
    if (typeof payload.id !== "string") return;
    const request = helper.pending.get(payload.id);
    if (!request) return;
    helper.pending.delete(payload.id);
    clearTimeout(request.timer);
    if (payload.error) {
      request.reject(new Error(String(payload.error)));
    } else {
      request.resolve(payload.result);
    }
  }
  moduleFor(tweakId, id) {
    const mod = this.modules.get(moduleKey(tweakId, id));
    if (!mod) throw new Error(`native module is not loaded: ${tweakId}:${id}`);
    return mod;
  }
  instanceFor(tweakId, id) {
    const instance = this.instances.get(instanceKey(tweakId, id));
    if (!instance) throw new Error(`native instance is not loaded: ${tweakId}:${id}`);
    return instance;
  }
  helperFor(tweakId, id) {
    const helper = this.helpers.get(helperKey(tweakId, id));
    if (!helper) throw new Error(`native helper is not running: ${tweakId}:${id}`);
    return helper;
  }
};
function resolveTweakPath(ctx, path) {
  return resolveNativeTweakPath(ctx.dir, path);
}
function inferModuleKind(path) {
  if (path.endsWith(".node")) return "node-addon";
  if (path.endsWith(".dylib")) return "dylib";
  if (path.endsWith(".framework")) return "framework";
  throw new Error("native module path must end in .node, .dylib, or .framework");
}
function selectEntrypoint(loaded, entrypoint) {
  if (!entrypoint) return asRecord2(loaded)?.default ?? loaded;
  const selected = asRecord2(loaded)?.[entrypoint];
  if (selected === void 0) throw new Error(`native module entrypoint not found: ${entrypoint}`);
  return selected;
}
function assertBridgeId(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`${label} may only contain letters, numbers, dots, underscores, and dashes`);
  }
  return value;
}
function moduleKey(tweakId, moduleId) {
  return `${tweakId}:${moduleId}`;
}
function instanceKey(tweakId, id) {
  return `${tweakId}:${id}`;
}
function helperKey(tweakId, id) {
  return `${tweakId}:${id}`;
}
function asRecord2(value) {
  return value && typeof value === "object" ? value : null;
}
async function callOptional(target, method, args) {
  const fn = asRecord2(target)?.[method];
  if (typeof fn === "function") await fn.apply(target, args);
}
function parentWindowState(parentWindow, reason) {
  if (isWindowDestroyed(parentWindow)) return null;
  const bounds = callWindowMethod(parentWindow, "getBounds");
  const contentBounds = callWindowMethod(parentWindow, "getContentBounds");
  return {
    reason,
    windowId: windowIdFor(parentWindow),
    webContentsId: webContentsIdFor(parentWindow),
    bounds,
    contentBounds,
    visible: callWindowMethod(parentWindow, "isVisible") ?? null,
    focused: callWindowMethod(parentWindow, "isFocused") ?? null,
    minimized: callWindowMethod(parentWindow, "isMinimized") ?? null,
    maximized: callWindowMethod(parentWindow, "isMaximized") ?? null,
    fullscreen: callWindowMethod(parentWindow, "isFullScreen") ?? null
  };
}
function nativeHandleForWindow(parentWindow) {
  if (!parentWindow || isWindowDestroyed(parentWindow)) return null;
  const fn = asRecord2(parentWindow)?.getNativeWindowHandle;
  if (typeof fn !== "function") return null;
  try {
    const handle = fn.call(parentWindow);
    return Buffer.isBuffer(handle) ? handle : null;
  } catch {
    return null;
  }
}
function canBindParentWindow(parentWindow) {
  if (!parentWindow || isWindowDestroyed(parentWindow)) return false;
  return typeof asRecord2(parentWindow)?.on === "function" && typeof asRecord2(parentWindow)?.off === "function";
}
function isWindowDestroyed(parentWindow) {
  const fn = asRecord2(parentWindow)?.isDestroyed;
  if (typeof fn !== "function") return false;
  try {
    return Boolean(fn.call(parentWindow));
  } catch {
    return true;
  }
}
function windowIdFor(parentWindow) {
  const id = asRecord2(parentWindow)?.id;
  return typeof id === "number" ? id : null;
}
function webContentsIdFor(parentWindow) {
  const webContents2 = asRecord2(asRecord2(parentWindow)?.webContents);
  const id = webContents2?.id;
  return typeof id === "number" ? id : null;
}
function callWindowMethod(parentWindow, method) {
  const fn = asRecord2(parentWindow)?.[method];
  if (typeof fn !== "function") return null;
  try {
    return fn.call(parentWindow);
  } catch {
    return null;
  }
}

// src/tweak-store.ts
var DEFAULT_TWEAK_STORE_INDEX_URL = "https://b-nnett.github.io/codex-plusplus/store/index.json";
var GITHUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
var FULL_SHA_RE = /^[a-f0-9]{40}$/i;
function normalizeGitHubRepo(input) {
  const raw = input.trim();
  if (!raw) throw new Error("GitHub repo is required");
  const ssh = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(raw);
  if (ssh) return normalizeRepoPart(ssh[1]);
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.hostname !== "github.com") throw new Error("Only github.com repositories are supported");
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) throw new Error("GitHub repo URL must include owner and repository");
    return normalizeRepoPart(`${parts[0]}/${parts[1]}`);
  }
  return normalizeRepoPart(raw);
}
function normalizeStoreRegistry(input) {
  const registry = input;
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.entries)) {
    throw new Error("Unsupported tweak store registry");
  }
  const entries = registry.entries.map(normalizeStoreEntry);
  entries.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return {
    schemaVersion: 1,
    generatedAt: typeof registry.generatedAt === "string" ? registry.generatedAt : void 0,
    entries
  };
}
function shuffleStoreEntries(entries, randomIndex = (exclusiveMax) => Math.floor(Math.random() * exclusiveMax)) {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) {
      throw new Error(`shuffle randomIndex returned ${j}; expected an integer from 0 to ${i}`);
    }
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
function normalizeStoreEntry(input) {
  const entry = input;
  if (!entry || typeof entry !== "object") throw new Error("Invalid tweak store entry");
  const repo = normalizeGitHubRepo(String(entry.repo ?? entry.manifest?.githubRepo ?? ""));
  const manifest = entry.manifest;
  if (!manifest?.id || !manifest.name || !manifest.version) {
    throw new Error(`Store entry for ${repo} is missing manifest fields`);
  }
  if (normalizeGitHubRepo(manifest.githubRepo) !== repo) {
    throw new Error(`Store entry ${manifest.id} repo does not match manifest githubRepo`);
  }
  if (!isFullCommitSha(String(entry.approvedCommitSha ?? ""))) {
    throw new Error(`Store entry ${manifest.id} must pin a full approved commit SHA`);
  }
  return {
    id: manifest.id,
    manifest,
    repo,
    approvedCommitSha: String(entry.approvedCommitSha),
    approvedAt: typeof entry.approvedAt === "string" ? entry.approvedAt : "",
    approvedBy: typeof entry.approvedBy === "string" ? entry.approvedBy : "",
    platforms: normalizeStorePlatforms(entry.platforms),
    releaseUrl: optionalGithubUrl(entry.releaseUrl),
    reviewUrl: optionalGithubUrl(entry.reviewUrl)
  };
}
function storeArchiveUrl(entry) {
  if (!isFullCommitSha(entry.approvedCommitSha)) {
    throw new Error(`Store entry ${entry.id} is not pinned to a full commit SHA`);
  }
  return `https://codeload.github.com/${entry.repo}/tar.gz/${entry.approvedCommitSha}`;
}
function isFullCommitSha(value) {
  return FULL_SHA_RE.test(value);
}
function normalizeRepoPart(value) {
  const repo = value.trim().replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (!GITHUB_REPO_RE.test(repo)) throw new Error("GitHub repo must be in owner/repo form");
  return repo;
}
function normalizeStorePlatforms(input) {
  if (input === void 0) return void 0;
  if (!Array.isArray(input)) throw new Error("Store entry platforms must be an array");
  const allowed = /* @__PURE__ */ new Set(["darwin", "win32", "linux"]);
  const platforms = Array.from(new Set(input.map((value) => {
    if (typeof value !== "string" || !allowed.has(value)) {
      throw new Error(`Unsupported store platform: ${String(value)}`);
    }
    return value;
  })));
  return platforms.length > 0 ? platforms : void 0;
}
function optionalGithubUrl(value) {
  if (typeof value !== "string" || !value.trim()) return void 0;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "github.com") return void 0;
  return url.toString();
}

// src/browser-ui.ts
var import_electron3 = require("electron");
var import_node_crypto2 = require("node:crypto");
var import_node_fs9 = require("node:fs");
var import_node_http = require("node:http");
var import_node_path8 = require("node:path");
var CONNECT_PORT_CHANNEL = "codexpp:browser-ui-connect-app-host";
var BRIDGE_REQUEST_CHANNEL = "codexpp:browser-ui-bridge-request";
var BRIDGE_RESPONSE_CHANNEL = "codexpp:browser-ui-bridge-response";
var MESSAGE_FOR_VIEW_CHANNEL = "codexpp:browser-ui-message-for-view";
var WORKER_MESSAGE_CHANNEL = "codexpp:browser-ui-worker-message";
var SYSTEM_THEME_CHANNEL = "codexpp:browser-ui-system-theme";
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};
var activeServer = null;
var activeHost = null;
var activeOptions = null;
var bridgeRequests = /* @__PURE__ */ new Map();
var controlClients = /* @__PURE__ */ new Set();
function maybeStartBrowserUiServer(opts) {
  if (process.env.CODEXPP_BROWSER_UI !== "1") return;
  const port = parsePort(process.env.CODEXPP_BROWSER_UI_PORT, 8765);
  startBrowserUiServer({
    ...opts,
    port,
    host: "127.0.0.1",
    hideMainWindow: process.env.CODEXPP_BROWSER_UI_HIDE_MAIN === "1"
  });
}
function startBrowserUiServer(opts) {
  if (activeServer) return;
  activeOptions = opts;
  installBrowserUiIpcHandlers(opts.log);
  const server = (0, import_node_http.createServer)((req, res) => {
    handleHttpRequest(req, res).catch((error) => {
      opts.log("error", "browser UI request failed", { message: error.message });
      sendText(res, 500, "Internal Server Error\n", "text/plain; charset=utf-8");
    });
  });
  server.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head).catch((error) => {
      opts.log("warn", "browser UI websocket upgrade failed", { message: error.message });
      socket.destroy();
    });
  });
  server.on("error", (error) => {
    opts.log("error", "browser UI server failed", { message: error.message });
  });
  server.listen(opts.port, opts.host, () => {
    opts.log("info", `browser UI server listening at http://${opts.host}:${opts.port}/`);
  });
  activeServer = server;
  if (opts.hideMainWindow) {
    for (const delayMs of [500, 1500, 3e3]) {
      const timer = setTimeout(hideVisibleCodexWindows, delayMs);
      timer.unref?.();
    }
  }
}
function installBrowserUiIpcHandlers(log2) {
  import_electron3.ipcMain.removeAllListeners(BRIDGE_RESPONSE_CHANNEL);
  import_electron3.ipcMain.removeAllListeners(MESSAGE_FOR_VIEW_CHANNEL);
  import_electron3.ipcMain.removeAllListeners(WORKER_MESSAGE_CHANNEL);
  import_electron3.ipcMain.removeAllListeners(SYSTEM_THEME_CHANNEL);
  import_electron3.ipcMain.on(BRIDGE_RESPONSE_CHANNEL, (event, payload) => {
    if (!isBrowserUiHostSender(event.sender)) return;
    const response = asRecord3(payload);
    const id = typeof response?.id === "string" ? response.id : "";
    const pending = bridgeRequests.get(id);
    if (!pending) return;
    bridgeRequests.delete(id);
    clearTimeout(pending.timer);
    if (response?.ok === true) {
      pending.resolve(response.value);
    } else {
      pending.reject(new Error(typeof response?.error === "string" ? response.error : "Bridge request failed"));
    }
  });
  import_electron3.ipcMain.on(MESSAGE_FOR_VIEW_CHANNEL, (event, message) => {
    if (!isBrowserUiHostSender(event.sender)) return;
    broadcastControl({ type: "message-for-view", message });
  });
  import_electron3.ipcMain.on(WORKER_MESSAGE_CHANNEL, (event, workerId, message) => {
    if (!isBrowserUiHostSender(event.sender)) return;
    if (typeof workerId !== "string") return;
    broadcastControl({ type: "worker-message", workerId, message });
  });
  import_electron3.ipcMain.on(SYSTEM_THEME_CHANNEL, (event, value) => {
    if (!isBrowserUiHostSender(event.sender)) return;
    broadcastControl({ type: "system-theme-variant-updated", value });
  });
  process.once("exit", () => {
    for (const pending of bridgeRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("ChatGPT++ browser UI server stopped"));
    }
    bridgeRequests.clear();
    for (const client of controlClients) client.close();
    controlClients.clear();
    try {
      if (activeHost && !activeHost.webContents.isDestroyed()) {
        activeHost.webContents.close({ waitForBeforeUnload: false });
      }
    } catch (error) {
      log2("warn", "browser UI host cleanup failed", { message: String(error) });
    }
  });
}
async function handleHttpRequest(req, res) {
  const options = requireOptions();
  const url = requestUrl(req);
  if (!url) {
    sendText(res, 400, "Bad Request\n", "text/plain; charset=utf-8");
    return;
  }
  if (url.pathname === "/codexpp/browser-ui/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/codexpp/browser-ui/bridge") {
    if (req.method !== "POST") {
      sendText(res, 405, "Method Not Allowed\n", "text/plain; charset=utf-8");
      return;
    }
    const body = asRecord3(await readJsonBody(req));
    const method = typeof body?.method === "string" ? body.method : "";
    const args = Array.isArray(body?.args) ? body.args : [];
    try {
      const value = await callHiddenBridge(method, args);
      sendJson(res, 200, { ok: true, value });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }
  if (url.pathname === "/codexpp/browser-ui/bridge.js") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method Not Allowed\n", "text/plain; charset=utf-8");
      return;
    }
    const script = browserBridgeScript(await collectInitialState(options));
    sendBuffer(res, 200, Buffer.from(script), MIME_TYPES[".js"], req.method === "HEAD");
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed\n", "text/plain; charset=utf-8");
    return;
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await browserIndexHtml(options);
    sendBuffer(res, 200, Buffer.from(html), MIME_TYPES[".html"], req.method === "HEAD");
    return;
  }
  const file = webviewFile(url.pathname);
  if (!file) {
    sendText(res, 404, "Not Found\n", "text/plain; charset=utf-8");
    return;
  }
  const content = (0, import_node_fs9.readFileSync)(file);
  sendBuffer(res, 200, content, mimeType(file), req.method === "HEAD");
}
async function handleUpgrade(req, socket, head) {
  const url = requestUrl(req);
  if (!url) throw new Error("bad websocket URL");
  if (url.pathname !== "/codexpp/browser-ui/rpc" && url.pathname !== "/codexpp/browser-ui/control") {
    socket.destroy();
    return;
  }
  const ws = acceptWebSocket(req, socket, head);
  if (url.pathname === "/codexpp/browser-ui/control") {
    controlClients.add(ws);
    ws.onClose(() => controlClients.delete(ws));
    ws.sendJson({ type: "hello" });
    return;
  }
  const host = await ensureBrowserUiHost();
  const { port1, port2 } = new import_electron3.MessageChannelMain();
  host.webContents.postMessage(CONNECT_PORT_CHANNEL, {}, [port2]);
  bridgeMessagePortToWebSocket(port1, ws);
}
async function browserIndexHtml(options) {
  const indexPath = (0, import_node_path8.join)(webviewRoot(), "index.html");
  let html = relaxBrowserUiCsp((0, import_node_fs9.readFileSync)(indexPath, "utf8"));
  const shim = `<script src="/codexpp/browser-ui/bridge.js"></script>`;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${shim}
  </head>`);
  } else {
    html = `${shim}
${html}`;
  }
  return html;
}
function relaxBrowserUiCsp(html) {
  return html.replace(
    /(<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=")([^"]*)(")/,
    (_match, prefix, content, suffix) => {
      const directives = parseCspDirectives(decodeHtmlAttribute(content));
      directives.set("child-src", "'self' blob: data: http: https:");
      directives.set("frame-src", "'self' blob: data: http: https:");
      directives.set("connect-src", "'self' http: https: ws: wss: sentry-ipc:");
      return `${prefix}${encodeHtmlAttribute(formatCspDirectives(directives))}${suffix}`;
    }
  );
}
function parseCspDirectives(content) {
  const directives = /* @__PURE__ */ new Map();
  for (const part of content.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split(/\s+/);
    if (!name) continue;
    directives.set(name, rest.join(" "));
  }
  return directives;
}
function formatCspDirectives(directives) {
  return [...directives.entries()].map(([name, value]) => value ? `${name} ${value}` : name).join("; ");
}
function decodeHtmlAttribute(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function encodeHtmlAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
async function collectInitialState(options) {
  await ensureBrowserUiHost();
  const [snapshot, systemThemeVariant, sentryInitOptions, buildFlavor, usesOwlAppShell] = await Promise.all([
    callHiddenBridge("snapshot", []),
    callHiddenBridge("systemTheme", []),
    callHiddenBridge("sentryOptions", []),
    callHiddenBridge("buildFlavor", []),
    callHiddenBridge("usesOwlAppShell", [])
  ]);
  if (options.hideMainWindow) hideVisibleCodexWindows();
  return {
    snapshot: asPlainObject(snapshot),
    systemThemeVariant: typeof systemThemeVariant === "string" ? systemThemeVariant : currentSystemThemeVariant(),
    sentryInitOptions,
    buildFlavor,
    usesOwlAppShell: usesOwlAppShell === true,
    platform: process.platform,
    arch: process.arch
  };
}
async function ensureBrowserUiHost() {
  if (activeHost && !activeHost.webContents.isDestroyed()) return activeHost;
  const options = requireOptions();
  const services = await waitForWindowServices(options);
  const windowManager = services.windowManager;
  if (!windowManager?.registerWindow) {
    throw new Error("Codex window registration services are unavailable");
  }
  const view = new import_electron3.BrowserView({
    webPreferences: {
      preload: windowManager.options?.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: windowManager.options?.allowDevtools
    }
  });
  const windowLike = makeWindowLikeForView(view);
  windowManager.registerWindow(windowLike, "local", false, "secondary");
  const context = services.getContextForWebContents?.(view.webContents) ?? services.getContext?.("local");
  context?.registerWindow?.(windowLike);
  await view.webContents.loadURL("about:blank");
  activeHost = { view, webContents: view.webContents };
  view.webContents.once("destroyed", () => {
    if (activeHost?.webContents === view.webContents) activeHost = null;
  });
  options.log("info", "browser UI hidden host ready", { webContentsId: view.webContents.id });
  return activeHost;
}
async function waitForWindowServices(options) {
  const started = Date.now();
  while (Date.now() - started < 3e4) {
    const services = options.getWindowServices();
    if (services?.windowManager?.registerWindow && (services.getContext || services.getContextForWebContents)) {
      return services;
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for Codex window services");
}
function callHiddenBridge(method, args) {
  assertBridgeMethod(method);
  return ensureBrowserUiHost().then((host) => {
    const id = (0, import_node_crypto2.randomUUID)();
    return new Promise((resolve6, reject) => {
      const timer = setTimeout(() => {
        bridgeRequests.delete(id);
        reject(new Error(`Timed out waiting for browser UI bridge method: ${method}`));
      }, 15e3);
      bridgeRequests.set(id, { resolve: resolve6, reject, timer });
      host.webContents.send(BRIDGE_REQUEST_CHANNEL, { id, method, args });
    });
  });
}
function bridgeMessagePortToWebSocket(port, ws) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      port.postMessage(null);
    } catch {
    }
    try {
      port.close();
    } catch {
    }
    ws.close();
  };
  port.start();
  port.on("message", (event) => {
    if (closed) return;
    if (event.data == null) {
      close();
      return;
    }
    if (typeof event.data === "string") {
      ws.sendText(event.data);
    }
  });
  port.on("close", close);
  ws.onText((text) => {
    if (closed) return;
    port.postMessage(text);
  });
  ws.onClose(close);
}
function broadcastControl(payload) {
  for (const client of [...controlClients]) {
    try {
      client.sendJson(payload);
    } catch {
      client.close();
      controlClients.delete(client);
    }
  }
}
function browserBridgeScript(state) {
  return `
(() => {
  const initialState = ${safeJson(state)};
  const snapshot = new Map(Object.entries(initialState.snapshot || {}));
  const workerSubscribers = new Map();
  const themeSubscribers = new Set();
  const browserSidebarSnapshots = new Map();
  const browserSidebarSeededLocalServers = new Set();
  let systemThemeVariant = initialState.systemThemeVariant || "light";

  window.__codexppBrowserUi = true;
  installBrowserUiWebviewShim();

  const control = new WebSocket(new URL("/codexpp/browser-ui/control", location.href));
  control.addEventListener("message", (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    if (payload.type === "message-for-view") {
      const message = payload.message;
      if (message && message.type === "shared-object-updated") {
        if (message.value === undefined) snapshot.delete(message.key);
        else snapshot.set(message.key, message.value);
      }
      rememberBrowserSidebarHostMessage(message);
      window.dispatchEvent(new MessageEvent("message", { data: message }));
    } else if (payload.type === "worker-message") {
      const subs = workerSubscribers.get(payload.workerId);
      if (subs) for (const fn of [...subs]) fn(payload.message);
    } else if (payload.type === "system-theme-variant-updated") {
      systemThemeVariant = payload.value;
      for (const fn of [...themeSubscribers]) fn();
    }
  });

  async function bridge(method, args = []) {
    const res = await fetch("/codexpp/browser-ui/bridge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error || "ChatGPT++ browser bridge failed");
    return body.value;
  }

  function legacyBrowserTabId(conversationId) {
    return String(conversationId || "new-conversation") + ":legacy";
  }

  function browserSidebarKey(conversationId, browserTabId) {
    return String(conversationId || "new-conversation") + "::" + String(browserTabId || legacyBrowserTabId(conversationId));
  }

  function normalizeBrowserUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      return new URL(raw).href;
    } catch {}
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
    try {
      return new URL("https://" + raw).href;
    } catch {
      return raw;
    }
  }

  function browserTitleForUrl(url) {
    if (!url) return "New tab";
    try {
      const host = new URL(url).hostname.replace(/^www\\./, "");
      return host || url;
    } catch {
      return url;
    }
  }

  function makeBrowserSidebarSnapshot(url, patch = {}) {
    const normalized = normalizeBrowserUrl(url);
    return {
      tabType: normalized ? "web" : "new-tab-page",
      isSuspended: false,
      title: normalized ? browserTitleForUrl(normalized) : "New tab",
      url: normalized,
      faviconUrl: null,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      zoomPercent: 100,
      commentModeDisabledReason: null,
      interactionMode: "browse",
      annotationEditorMode: "comment",
      isAnnotationAddModifierPressed: false,
      isOriginalViewEnabled: false,
      isTweaksEditorOpen: false,
      comments: [],
      ...patch,
    };
  }

  function dispatchBrowserSidebarMessage(message) {
    window.dispatchEvent(new MessageEvent("message", { data: message }));
  }

  function seedBrowserSidebarLocalServers(conversationId) {
    if (!conversationId || browserSidebarSeededLocalServers.has(conversationId)) return;
    browserSidebarSeededLocalServers.add(conversationId);
    queueMicrotask(() => {
      dispatchBrowserSidebarMessage({
        type: "browser-sidebar-local-servers",
        conversationId,
        state: { isLoading: false, servers: [], hiddenServers: [] },
      });
    });
  }

  function rememberBrowserSidebarHostMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "browser-sidebar-state") {
      const conversationId = message.conversationId;
      if (!conversationId || !message.snapshot) return;
      browserSidebarSnapshots.set(browserSidebarKey(conversationId, message.browserTabId), message.snapshot);
    } else if (message.type === "browser-sidebar-local-servers") {
      if (message.conversationId) browserSidebarSeededLocalServers.add(message.conversationId);
    }
  }

  function sendBrowserSidebarSnapshot(conversationId, browserTabId, snapshotPatch) {
    if (!conversationId) return;
    const key = browserSidebarKey(conversationId, browserTabId);
    const previous = browserSidebarSnapshots.get(key) || makeBrowserSidebarSnapshot("");
    const next = { ...previous, ...snapshotPatch };
    browserSidebarSnapshots.set(key, next);
    dispatchBrowserSidebarMessage({
      type: "browser-sidebar-state",
      conversationId,
      ...(browserTabId ? { browserTabId } : {}),
      snapshot: next,
    });
  }

  function setBrowserSidebarUrl(conversationId, browserTabId, url, isLoading = false) {
    const normalized = normalizeBrowserUrl(url);
    sendBrowserSidebarSnapshot(conversationId, browserTabId, makeBrowserSidebarSnapshot(normalized, { isLoading }));
  }

  function findBrowserSidebarFrame(conversationId, browserTabId) {
    const selector = "[data-browser-sidebar-conversation-id='" + cssEscape(conversationId) + "'][data-browser-sidebar-browser-tab-id='" + cssEscape(browserTabId || legacyBrowserTabId(conversationId)) + "']";
    return document.querySelector(selector);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/['\\\\]/g, "\\\\$&");
  }

  function handleBrowserSidebarViewMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "browser-sidebar-sync") {
      const payload = message.payload || {};
      seedBrowserSidebarLocalServers(payload.conversationId);
      return;
    }
    if (message.type === "browser-sidebar-owner-sync") {
      seedBrowserSidebarLocalServers(message.conversationId);
      return;
    }
    if (message.type !== "browser-sidebar-command") return;

    const conversationId = message.conversationId;
    const browserTabId = message.browserTabId;
    const command = message.command || {};
    seedBrowserSidebarLocalServers(conversationId);

    if (command.type === "navigate") {
      const normalized = normalizeBrowserUrl(command.url);
      setBrowserSidebarUrl(conversationId, browserTabId, normalized, true);
      queueMicrotask(() => {
        const frame = findBrowserSidebarFrame(conversationId, browserTabId);
        if (!frame || !normalized || frame.getURL?.() === normalized) return;
        frame.loadURL?.(normalized);
      });
      window.setTimeout(() => setBrowserSidebarUrl(conversationId, browserTabId, normalized, false), 500);
    } else if (command.type === "reload") {
      const frame = findBrowserSidebarFrame(conversationId, browserTabId);
      frame?.reload?.();
      const current = browserSidebarSnapshots.get(browserSidebarKey(conversationId, browserTabId));
      if (current?.url) {
        sendBrowserSidebarSnapshot(conversationId, browserTabId, { ...current, isLoading: true });
        window.setTimeout(() => sendBrowserSidebarSnapshot(conversationId, browserTabId, { ...current, isLoading: false }), 250);
      }
    } else if (command.type === "go-back") {
      findBrowserSidebarFrame(conversationId, browserTabId)?.goBack?.();
    } else if (command.type === "go-forward") {
      findBrowserSidebarFrame(conversationId, browserTabId)?.goForward?.();
    } else if (command.type === "stop") {
      const current = browserSidebarSnapshots.get(browserSidebarKey(conversationId, browserTabId));
      if (current) sendBrowserSidebarSnapshot(conversationId, browserTabId, { ...current, isLoading: false });
    } else if (command.type === "reset" || command.type === "close-tab") {
      sendBrowserSidebarSnapshot(conversationId, browserTabId, makeBrowserSidebarSnapshot(""));
    }
  }

  window.codexWindowType = "electron";
  window.electronBridge = {
    windowType: "electron",
    sendMessageFromView: (message) => {
      if (message && message.type === "shared-object-set") snapshot.set(message.key, message.value);
      handleBrowserSidebarViewMessage(message);
      return bridge("sendMessageFromView", [message]);
    },
    getPathForFile: () => null,
    sendWorkerMessageFromView: (workerId, message) => bridge("sendWorkerMessageFromView", [workerId, message]),
    subscribeToWorkerMessages: (workerId, handler) => {
      let subs = workerSubscribers.get(workerId);
      if (!subs) {
        subs = new Set();
        workerSubscribers.set(workerId, subs);
        bridge("subscribeWorkerMessages", [workerId]).catch(console.error);
      }
      subs.add(handler);
      return () => {
        const current = workerSubscribers.get(workerId);
        if (!current) return;
        current.delete(handler);
        if (current.size === 0) {
          workerSubscribers.delete(workerId);
          bridge("unsubscribeWorkerMessages", [workerId]).catch(console.error);
        }
      };
    },
    showContextMenu: (items) => bridge("showContextMenu", [items]),
    showApplicationMenu: (menuId, x, y) => bridge("showApplicationMenu", [menuId, x, y]),
    getFastModeRolloutMetrics: (params) => bridge("getFastModeRolloutMetrics", [params]),
    getSharedObjectSnapshotValue: (key) => snapshot.get(key),
    getSystemThemeVariant: () => systemThemeVariant,
    subscribeToSystemThemeVariant: (handler) => {
      themeSubscribers.add(handler);
      return () => themeSubscribers.delete(handler);
    },
    triggerSentryTestError: () => bridge("triggerSentryTestError", []),
    getSentryInitOptions: () => null,
    getAppSessionId: () => null,
    getBuildFlavor: () => initialState.buildFlavor,
    isIntelMacBuild: () => initialState.platform === "darwin" && initialState.arch === "x64",
    usesOwlAppShell: () => initialState.usesOwlAppShell,
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "connect-app-host") return;
    const port = event.data.port;
    if (!port) return;
    const ws = new WebSocket(new URL("/codexpp/browser-ui/rpc", location.href));
    ws.addEventListener("message", (message) => port.postMessage(message.data));
    ws.addEventListener("close", () => {
      try { port.postMessage(null); } catch {}
      try { port.close(); } catch {}
    });
    ws.addEventListener("open", () => {
      port.onmessage = (message) => {
        if (message.data == null) {
          ws.close();
          return;
        }
        ws.send(message.data);
      };
      port.start && port.start();
    });
  });

  function installBrowserUiWebviewShim() {
    if (window.__codexppWebviewShimInstalled) return;
    window.__codexppWebviewShimInstalled = true;
    const originalCreateElement = Document.prototype.createElement;
    Document.prototype.createElement = function(tagName, options) {
      if (String(tagName).toLowerCase() !== "webview") {
        return originalCreateElement.call(this, tagName, options);
      }
      return createWebviewIframe(this);
    };

    function createWebviewIframe(doc) {
      const iframe = originalCreateElement.call(doc, "iframe");
      iframe.dataset.codexppWebviewShim = "true";
      iframe.style.border = "0";
      iframe.style.display = "block";
      iframe.style.backgroundColor = "#fff";
      iframe.setAttribute("allow", "autoplay; clipboard-read; clipboard-write; display-capture; fullscreen; microphone; camera");
      const nativeSetAttribute = iframe.setAttribute.bind(iframe);
      const nativeGetAttribute = iframe.getAttribute.bind(iframe);

      try {
        Object.defineProperty(iframe, "tagName", { configurable: true, get: () => "WEBVIEW" });
        Object.defineProperty(iframe, "nodeName", { configurable: true, get: () => "WEBVIEW" });
      } catch {}

      const emit = (type, extra = {}) => {
        const event = new Event(type);
        Object.assign(event, extra);
        iframe.dispatchEvent(event);
      };
      const currentUrl = () => iframe.dataset.codexppRequestedSrc || nativeGetAttribute("src") || "about:blank";
      const actualFrameUrl = (url) => {
        const requested = String(url || "about:blank");
        if (!shouldBreakRecursiveFrameLoad(requested)) return requested;
        try {
          const next = new URL(requested, location.href);
          next.searchParams.set("__codexpp_frame_depth", String(frameAncestorDepth() + 1));
          return next.href;
        } catch {
          return requested;
        }
      };
      const setFrameUrl = (url) => {
        const requested = String(url || "about:blank");
        iframe.dataset.codexppRequestedSrc = requested;
        nativeSetAttribute("src", actualFrameUrl(requested));
      };
      const navigate = (url) => {
        const next = String(url || "about:blank");
        emit("did-start-loading", { url: next });
        setFrameUrl(next);
      };

      iframe.setAttribute = (name, value) => {
        if (String(name).toLowerCase() === "src") {
          setFrameUrl(value);
          return;
        }
        nativeSetAttribute(name, value);
      };

      try {
        Object.defineProperty(iframe, "src", {
          configurable: true,
          get: () => currentUrl(),
          set: (value) => setFrameUrl(value),
        });
      } catch {}

      iframe.addEventListener("load", () => {
        const url = currentUrl();
        emit("dom-ready", { url });
        emit("did-navigate", { url });
        emit("did-stop-loading", { url });
        emit("did-finish-load", { url });
        let title = "";
        try {
          title = iframe.contentDocument?.title || "";
        } catch {}
        const conversationId = iframe.getAttribute("data-browser-sidebar-conversation-id");
        const browserTabId = iframe.getAttribute("data-browser-sidebar-browser-tab-id");
        if (conversationId) {
          sendBrowserSidebarSnapshot(conversationId, browserTabId, makeBrowserSidebarSnapshot(url, {
            title: title || browserTitleForUrl(url),
            isLoading: false,
          }));
        }
        if (title) emit("page-title-updated", { title });
      });
      iframe.addEventListener("error", () => {
        emit("did-fail-load", { errorCode: -2, errorDescription: "iframe load failed", validatedURL: currentUrl() });
        emit("did-stop-loading", { url: currentUrl() });
      });

      Object.defineProperties(iframe, {
        destroy: { value: () => iframe.remove() },
        getURL: { value: () => currentUrl() },
        getTitle: {
          value: () => {
            try {
              return iframe.contentDocument?.title || "";
            } catch {
              return "";
            }
          },
        },
        loadURL: { value: (url) => { navigate(url); return Promise.resolve(); } },
        reload: {
          value: () => {
            try {
              iframe.contentWindow?.location.reload();
            } catch {
              navigate(currentUrl());
            }
          },
        },
        stop: { value: () => {} },
        canGoBack: { value: () => false },
        canGoForward: { value: () => false },
        goBack: {
          value: () => {
            try {
              iframe.contentWindow?.history.back();
            } catch {}
          },
        },
        goForward: {
          value: () => {
            try {
              iframe.contentWindow?.history.forward();
            } catch {}
          },
        },
        executeJavaScript: {
          value: (code) => {
            try {
              return Promise.resolve(iframe.contentWindow?.eval(String(code)));
            } catch (error) {
              return Promise.reject(error);
            }
          },
        },
        insertCSS: { value: () => Promise.resolve("") },
        openDevTools: { value: () => {} },
        closeDevTools: { value: () => {} },
        isDevToolsOpened: { value: () => false },
        send: { value: () => {} },
      });

      return iframe;
    }

    function frameAncestorDepth() {
      let depth = 0;
      let current = window;
      const seen = new Set();
      while (current && !seen.has(current)) {
        seen.add(current);
        let parent;
        try {
          parent = current.parent;
        } catch {
          break;
        }
        if (parent === current) break;
        depth += 1;
        current = parent;
      }
      return depth;
    }

    function shouldBreakRecursiveFrameLoad(url) {
      let target;
      try {
        target = new URL(url, location.href).href;
      } catch {
        return false;
      }
      let current = window;
      const seen = new Set();
      while (current && !seen.has(current)) {
        seen.add(current);
        try {
          if (new URL(current.location.href).href === target) return true;
          if (current.parent === current) break;
          current = current.parent;
        } catch {
          return false;
        }
      }
      return false;
    }
  }
})();
`;
}
function hideVisibleCodexWindows() {
  if (process.platform === "darwin") {
    try {
      import_electron3.app.hide();
    } catch {
    }
  }
  for (const win of import_electron3.BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (activeHost && win.webContents.id === activeHost.webContents.id) continue;
    if (!win.isVisible()) continue;
    try {
      win.hide();
    } catch {
    }
  }
}
function makeWindowLikeForView(view) {
  const viewBounds = () => view.getBounds();
  return {
    id: view.webContents.id,
    webContents: view.webContents,
    on: (event, listener) => {
      if (event === "closed") view.webContents.once("destroyed", listener);
      else view.webContents.on(event, listener);
      return view;
    },
    once: (event, listener) => {
      view.webContents.once(event, listener);
      return view;
    },
    off: (event, listener) => {
      view.webContents.off(event, listener);
      return view;
    },
    removeListener: (event, listener) => {
      view.webContents.removeListener(event, listener);
      return view;
    },
    isDestroyed: () => view.webContents.isDestroyed(),
    isFocused: () => view.webContents.isFocused(),
    focus: () => view.webContents.focus(),
    show: () => {
    },
    hide: () => {
    },
    getBounds: viewBounds,
    getContentBounds: viewBounds,
    getSize: () => {
      const b = viewBounds();
      return [b.width, b.height];
    },
    getContentSize: () => {
      const b = viewBounds();
      return [b.width, b.height];
    },
    setTitle: () => {
    },
    getTitle: () => "",
    setRepresentedFilename: () => {
    },
    setDocumentEdited: () => {
    },
    setWindowButtonVisibility: () => {
    }
  };
}
function acceptWebSocket(req, socket, head) {
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string") throw new Error("missing Sec-WebSocket-Key");
  const accept = (0, import_node_crypto2.createHash)("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n"
    ].join("\r\n")
  );
  const ws = new WebSocketConnection(socket);
  if (head.length > 0) ws.acceptHead(head);
  return ws;
}
var WebSocketConnection = class {
  constructor(socket) {
    this.socket = socket;
    socket.on("data", (chunk) => this.acceptHead(chunk));
    socket.on("close", () => this.emitClose());
    socket.on("error", () => this.emitClose());
  }
  socket;
  buffer = Buffer.alloc(0);
  textHandlers = /* @__PURE__ */ new Set();
  closeHandlers = /* @__PURE__ */ new Set();
  closed = false;
  acceptHead(chunk) {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.readFrames();
  }
  onText(handler) {
    this.textHandlers.add(handler);
  }
  onClose(handler) {
    this.closeHandlers.add(handler);
  }
  sendJson(payload) {
    this.sendText(JSON.stringify(payload));
  }
  sendText(text) {
    this.sendFrame(1, Buffer.from(text, "utf8"));
  }
  close() {
    if (this.closed) return;
    try {
      this.sendFrame(8, Buffer.alloc(0));
    } catch {
    }
    this.closed = true;
    this.socket.end();
    this.emitClose();
  }
  readFrames() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 15;
      const masked = (second & 128) !== 0;
      let length = second & 127;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        const high = this.buffer.readUInt32BE(offset);
        const low = this.buffer.readUInt32BE(offset + 4);
        if (high !== 0) {
          this.close();
          return;
        }
        length = low;
        offset += 8;
      }
      const maskOffset = offset;
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) return;
      const mask = masked ? this.buffer.subarray(maskOffset, maskOffset + 4) : null;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      if (mask) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      if (opcode === 8) {
        this.close();
      } else if (opcode === 9) {
        this.sendFrame(10, payload);
      } else if (opcode === 1) {
        const text = payload.toString("utf8");
        for (const handler of [...this.textHandlers]) handler(text);
      }
    }
  }
  sendFrame(opcode, payload) {
    if (this.closed && opcode !== 8) return;
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.from([128 | opcode, length]);
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 128 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 128 | opcode;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(length, 6);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }
  emitClose() {
    if (!this.closed) this.closed = true;
    for (const handler of [...this.closeHandlers]) handler();
    this.closeHandlers.clear();
    this.textHandlers.clear();
  }
};
function requestUrl(req) {
  try {
    return new URL(req.url ?? "/", "http://127.0.0.1");
  } catch {
    return null;
  }
}
function readJsonBody(req) {
  return new Promise((resolve6, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve6(null);
        return;
      }
      try {
        resolve6(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
function sendJson(res, status, body) {
  sendBuffer(res, status, Buffer.from(JSON.stringify(body)), MIME_TYPES[".json"], false);
}
function sendText(res, status, body, contentType) {
  sendBuffer(res, status, Buffer.from(body), contentType, false);
}
function sendBuffer(res, status, body, contentType, headOnly) {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": body.length,
    "cache-control": "no-store"
  });
  if (headOnly) res.end();
  else res.end(body);
}
function webviewRoot() {
  return (0, import_node_path8.join)(process.resourcesPath, "app.asar", "webview");
}
function webviewFile(pathname) {
  const cleanPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!cleanPath || cleanPath.includes("\0")) return null;
  const root = webviewRoot();
  const file = (0, import_node_path8.normalize)((0, import_node_path8.join)(root, cleanPath));
  const rel = (0, import_node_path8.relative)(root, file);
  if (rel.startsWith("..") || rel === "") return null;
  if (!(0, import_node_fs9.existsSync)(file) || !(0, import_node_fs9.statSync)(file).isFile()) return null;
  return file;
}
function mimeType(file) {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}
function requireOptions() {
  if (!activeOptions) throw new Error("ChatGPT++ browser UI server is not configured");
  return activeOptions;
}
function isBrowserUiHostSender(sender) {
  return !!activeHost && !activeHost.webContents.isDestroyed() && sender.id === activeHost.webContents.id;
}
function assertBridgeMethod(method) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(method)) throw new Error("invalid bridge method");
}
function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}
function asRecord3(value) {
  return value && typeof value === "object" ? value : null;
}
function asPlainObject(value) {
  const record = asRecord3(value);
  return record && !Array.isArray(record) ? record : {};
}
function currentSystemThemeVariant() {
  return import_electron3.nativeTheme.shouldUseDarkColors ? "dark" : "light";
}
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function delay(ms) {
  return new Promise((resolve6) => setTimeout(resolve6, ms));
}

// src/main.ts
var userRoot = process.env.CHATGPT_PLUSPLUS_USER_ROOT ?? process.env.CODEX_PLUSPLUS_USER_ROOT;
var runtimeDir = process.env.CHATGPT_PLUSPLUS_RUNTIME ?? process.env.CODEX_PLUSPLUS_RUNTIME;
if (!userRoot || !runtimeDir) {
  throw new Error(
    "chatgpt-plusplus runtime started without CHATGPT_PLUSPLUS_USER_ROOT/RUNTIME envs"
  );
}
var PRELOAD_PATH = (0, import_node_path9.resolve)(runtimeDir, "preload.js");
var TWEAKS_DIR = (0, import_node_path9.join)(userRoot, "tweaks");
var LOG_DIR = (0, import_node_path9.join)(userRoot, "log");
var LOG_FILE = (0, import_node_path9.join)(LOG_DIR, "main.log");
var CONFIG_FILE = (0, import_node_path9.join)(userRoot, "config.json");
var CODEX_CONFIG_FILE = (0, import_node_path9.join)((0, import_node_os2.homedir)(), ".codex", "config.toml");
var INSTALLER_STATE_FILE = (0, import_node_path9.join)(userRoot, "state.json");
var UPDATE_MODE_FILE = (0, import_node_path9.join)(userRoot, "update-mode.json");
var SELF_UPDATE_STATE_FILE = (0, import_node_path9.join)(userRoot, "self-update-state.json");
var SIGNED_CODEX_BACKUP = (0, import_node_path9.join)(userRoot, "backup", "Codex.app");
var CHATGPT_PLUSPLUS_VERSION = "1.0.6";
var CHATGPT_PLUSPLUS_REPO = "Shunlly/chatgpt-plusplus";
var TWEAK_STORE_INDEX_URL = process.env.CHATGPT_PLUSPLUS_STORE_INDEX_URL ?? process.env.CODEX_PLUSPLUS_STORE_INDEX_URL ?? DEFAULT_TWEAK_STORE_INDEX_URL;
var CODEX_WINDOW_SERVICES_KEY = "__codexpp_window_services__";
(0, import_node_fs10.mkdirSync)(LOG_DIR, { recursive: true });
(0, import_node_fs10.mkdirSync)(TWEAKS_DIR, { recursive: true });
if (process.env.CODEXPP_REMOTE_DEBUG === "1") {
  const port = process.env.CODEXPP_REMOTE_DEBUG_PORT ?? "9222";
  import_electron4.app.commandLine.appendSwitch("remote-debugging-port", port);
  log("info", `remote debugging enabled on port ${port}`);
}
function readState() {
  let state = {};
  try {
    state = JSON.parse((0, import_node_fs10.readFileSync)(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
  if (state.codexPlusPlus && !state.chatgptPlusPlus) {
    state.chatgptPlusPlus = state.codexPlusPlus;
    delete state.codexPlusPlus;
    writeState(state);
  }
  return state;
}
function writeState(s) {
  try {
    (0, import_node_fs10.writeFileSync)(CONFIG_FILE, JSON.stringify(s, null, 2));
  } catch (e) {
    log("warn", "writeState failed:", String(e.message));
  }
}
function isChatgptPlusPlusAutoUpdateEnabled() {
  return readState().chatgptPlusPlus?.autoUpdate !== false;
}
function setChatgptPlusPlusAutoUpdate(enabled) {
  const s = readState();
  s.chatgptPlusPlus ??= {};
  s.chatgptPlusPlus.autoUpdate = enabled;
  writeState(s);
}
function setChatgptPlusPlusUpdateConfig(config) {
  const s = readState();
  s.chatgptPlusPlus ??= {};
  if (config.updateChannel) s.chatgptPlusPlus.updateChannel = config.updateChannel;
  if ("updateRepo" in config) s.chatgptPlusPlus.updateRepo = cleanOptionalString(config.updateRepo);
  if ("updateRef" in config) s.chatgptPlusPlus.updateRef = cleanOptionalString(config.updateRef);
  writeState(s);
}
function isChatgptPlusPlusSafeModeEnabled() {
  return readState().chatgptPlusPlus?.safeMode === true;
}
function isTweakEnabled(id) {
  const s = readState();
  if (s.chatgptPlusPlus?.safeMode === true) return false;
  return s.tweaks?.[id]?.enabled !== false;
}
function setTweakEnabled(id, enabled) {
  const s = readState();
  s.tweaks ??= {};
  s.tweaks[id] = { ...s.tweaks[id], enabled };
  writeState(s);
}
function readInstallerState() {
  try {
    return JSON.parse((0, import_node_fs10.readFileSync)(INSTALLER_STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}
function readSelfUpdateState() {
  try {
    return JSON.parse((0, import_node_fs10.readFileSync)(SELF_UPDATE_STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}
function writeSelfUpdateState(state) {
  try {
    (0, import_node_fs10.writeFileSync)(SELF_UPDATE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log("warn", "writeSelfUpdateState failed:", String(e.message));
  }
}
function cleanOptionalString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function isPathInside2(parent, target) {
  const rel = (0, import_node_path9.relative)((0, import_node_path9.resolve)(parent), (0, import_node_path9.resolve)(target));
  return rel === "" || !!rel && !rel.startsWith("..") && !(0, import_node_path9.isAbsolute)(rel);
}
function log(level, ...args) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level}] ${args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}
`;
  try {
    appendCappedLog(LOG_FILE, line);
  } catch {
  }
  if (level === "error") console.error("[chatgpt-plusplus]", ...args);
}
function installSparkleUpdateHook() {
  if (process.platform !== "darwin") return;
  const Module = require("node:module");
  const originalLoad = Module._load;
  if (typeof originalLoad !== "function") return;
  Module._load = function chatgptPlusPlusModuleLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, [request, parent, isMain]);
    if (typeof request === "string" && /sparkle(?:\.node)?$/i.test(request)) {
      wrapSparkleExports(loaded);
    }
    return loaded;
  };
}
function wrapSparkleExports(loaded) {
  if (!loaded || typeof loaded !== "object") return;
  const exports2 = loaded;
  if (exports2.__codexppSparkleWrapped) return;
  exports2.__codexppSparkleWrapped = true;
  for (const name of ["installUpdatesIfAvailable"]) {
    const fn = exports2[name];
    if (typeof fn !== "function") continue;
    exports2[name] = function chatgptPlusPlusSparkleWrapper(...args) {
      prepareSignedCodexForSparkleInstall();
      return Reflect.apply(fn, this, args);
    };
  }
  if (exports2.default && exports2.default !== exports2) {
    wrapSparkleExports(exports2.default);
  }
}
function prepareSignedCodexForSparkleInstall() {
  if (process.platform !== "darwin") return;
  if ((0, import_node_fs10.existsSync)(UPDATE_MODE_FILE)) {
    log("info", "Sparkle update prep skipped; update mode already active");
    return;
  }
  if (!(0, import_node_fs10.existsSync)(SIGNED_CODEX_BACKUP)) {
    log("warn", "Sparkle update prep skipped; signed Codex.app backup is missing");
    return;
  }
  if (!isDeveloperIdSignedApp(SIGNED_CODEX_BACKUP)) {
    log("warn", "Sparkle update prep skipped; Codex.app backup is not Developer ID signed");
    return;
  }
  const state = readInstallerState();
  const appRoot = state?.appRoot ?? inferMacAppRoot2();
  if (!appRoot) {
    log("warn", "Sparkle update prep skipped; could not infer Codex.app path");
    return;
  }
  const mode = {
    enabledAt: (/* @__PURE__ */ new Date()).toISOString(),
    appRoot,
    codexVersion: state?.codexVersion ?? null
  };
  (0, import_node_fs10.writeFileSync)(UPDATE_MODE_FILE, JSON.stringify(mode, null, 2));
  try {
    (0, import_node_child_process3.execFileSync)("ditto", [SIGNED_CODEX_BACKUP, appRoot], { stdio: "ignore" });
    try {
      (0, import_node_child_process3.execFileSync)("xattr", ["-dr", "com.apple.quarantine", appRoot], { stdio: "ignore" });
    } catch {
    }
    log("info", "Restored signed Codex.app before Sparkle install", { appRoot });
  } catch (e) {
    log("error", "Failed to restore signed Codex.app before Sparkle install", {
      message: e.message
    });
  }
}
function isDeveloperIdSignedApp(appRoot) {
  const result = (0, import_node_child_process3.spawnSync)("codesign", ["-dv", "--verbose=4", appRoot], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return result.status === 0 && /Authority=Developer ID Application:/.test(output) && !/Signature=adhoc/.test(output) && !/TeamIdentifier=not set/.test(output);
}
function inferMacAppRoot2() {
  const marker = ".app/Contents/MacOS/";
  const idx = process.execPath.indexOf(marker);
  return idx >= 0 ? process.execPath.slice(0, idx + ".app".length) : null;
}
process.on("uncaughtException", (e) => {
  log("error", "uncaughtException", { code: e.code, message: e.message, stack: e.stack });
});
process.on("unhandledRejection", (e) => {
  log("error", "unhandledRejection", { value: String(e) });
});
installSparkleUpdateHook();
var tweakState = {
  discovered: [],
  loadedMain: /* @__PURE__ */ new Map()
};
var nativeBridge = new NativeBridge(log, {
  nativeHostPath: (0, import_node_path9.join)(runtimeDir, "native", "codexpp_native_host.node")
});
var owlViews = /* @__PURE__ */ new Map();
var tweakLifecycleDeps = {
  logInfo: (message) => log("info", message),
  setTweakEnabled,
  stopAllMainTweaks,
  clearTweakModuleCache,
  loadAllMainTweaks,
  broadcastReload
};
function registerPreload(s, label) {
  try {
    const reg = s.registerPreloadScript;
    if (typeof reg === "function") {
      reg.call(s, { type: "frame", filePath: PRELOAD_PATH, id: "chatgpt-plusplus" });
      log("info", `preload registered (registerPreloadScript) on ${label}:`, PRELOAD_PATH);
      return;
    }
    const existing = s.getPreloads();
    if (!existing.includes(PRELOAD_PATH)) {
      s.setPreloads([...existing, PRELOAD_PATH]);
    }
    log("info", `preload registered (setPreloads) on ${label}:`, PRELOAD_PATH);
  } catch (e) {
    if (e instanceof Error && e.message.includes("existing ID")) {
      log("info", `preload already registered on ${label}:`, PRELOAD_PATH);
      return;
    }
    log("error", `preload registration on ${label} failed:`, e);
  }
}
import_electron4.app.whenReady().then(() => {
  log("info", "app ready fired");
  if (isChatgptPlusPlusSafeModeEnabled()) {
    log("warn", "safe mode is enabled; preload will not be registered");
    return;
  }
  registerPreload(import_electron4.session.defaultSession, "defaultSession");
  maybeStartBrowserUiServer({
    getWindowServices: getCodexWindowServices,
    log
  });
});
import_electron4.app.on("session-created", (s) => {
  if (isChatgptPlusPlusSafeModeEnabled()) return;
  registerPreload(s, "session-created");
});
import_electron4.app.on("web-contents-created", (_e, wc) => {
  try {
    const wp = wc.getLastWebPreferences?.();
    log("info", "web-contents-created", {
      id: wc.id,
      type: wc.getType(),
      sessionIsDefault: wc.session === import_electron4.session.defaultSession,
      sandbox: wp?.sandbox,
      contextIsolation: wp?.contextIsolation
    });
    wc.on("preload-error", (_ev, p, err) => {
      log("error", `wc ${wc.id} preload-error path=${p}`, String(err?.stack ?? err));
    });
  } catch (e) {
    log("error", "web-contents-created handler failed:", String(e?.stack ?? e));
  }
});
log("info", "main.ts evaluated; app.isReady=" + import_electron4.app.isReady());
if (isChatgptPlusPlusSafeModeEnabled()) {
  log("warn", "safe mode is enabled; tweaks will not be loaded");
}
loadAllMainTweaks();
import_electron4.app.on("will-quit", () => {
  stopAllMainTweaks();
  nativeBridge.disposeAll();
  disposeAllOwlViews();
  for (const t of tweakState.loadedMain.values()) {
    try {
      t.storage.flush();
    } catch {
    }
  }
});
import_electron4.ipcMain.handle("codexpp:list-tweaks", async () => {
  await Promise.all(tweakState.discovered.map((t) => ensureTweakUpdateCheck(t)));
  const updateChecks = readState().tweakUpdateChecks ?? {};
  return tweakState.discovered.map((t) => ({
    manifest: t.manifest,
    entry: t.entry,
    dir: t.dir,
    entryExists: (0, import_node_fs10.existsSync)(t.entry),
    enabled: isTweakEnabled(t.manifest.id),
    update: updateChecks[t.manifest.id] ?? null
  }));
});
import_electron4.ipcMain.handle("codexpp:get-tweak-enabled", (_e, id) => isTweakEnabled(id));
import_electron4.ipcMain.handle("codexpp:set-tweak-enabled", (_e, id, enabled) => {
  return setTweakEnabledAndReload(id, enabled, tweakLifecycleDeps);
});
import_electron4.ipcMain.handle("codexpp:get-config", () => {
  const s = readState();
  const installerState = readInstallerState();
  const sourceRoot = installerState?.sourceRoot ?? fallbackSourceRoot();
  return {
    version: CHATGPT_PLUSPLUS_VERSION,
    autoUpdate: s.chatgptPlusPlus?.autoUpdate !== false,
    safeMode: s.chatgptPlusPlus?.safeMode === true,
    updateChannel: s.chatgptPlusPlus?.updateChannel ?? "stable",
    updateRepo: s.chatgptPlusPlus?.updateRepo ?? CHATGPT_PLUSPLUS_REPO,
    updateRef: s.chatgptPlusPlus?.updateRef ?? "",
    updateCheck: s.chatgptPlusPlus?.updateCheck ?? null,
    selfUpdate: readSelfUpdateState(),
    installationSource: describeInstallationSource(sourceRoot)
  };
});
import_electron4.ipcMain.handle("codexpp:set-auto-update", (_e, enabled) => {
  setChatgptPlusPlusAutoUpdate(!!enabled);
  return { autoUpdate: isChatgptPlusPlusAutoUpdateEnabled() };
});
import_electron4.ipcMain.handle("codexpp:set-update-config", (_e, config) => {
  setChatgptPlusPlusUpdateConfig(config);
  const s = readState();
  return {
    updateChannel: s.chatgptPlusPlus?.updateChannel ?? "stable",
    updateRepo: s.chatgptPlusPlus?.updateRepo ?? CHATGPT_PLUSPLUS_REPO,
    updateRef: s.chatgptPlusPlus?.updateRef ?? ""
  };
});
import_electron4.ipcMain.handle("codexpp:check-codexpp-update", async (_e, force) => {
  return ensureChatgptPlusPlusUpdateCheck(force === true);
});
import_electron4.ipcMain.handle("codexpp:run-codexpp-update", async () => {
  const sourceRoot = readInstallerState()?.sourceRoot ?? fallbackSourceRoot();
  if (!sourceRoot) {
    throw new Error("ChatGPT++ source CLI was not found. Run the installer once, then try again.");
  }
  if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(sourceRoot, "standalone.json"))) {
    const s = readState();
    const releaseUrl = s.chatgptPlusPlus?.updateCheck?.releaseUrl ?? `https://github.com/${CHATGPT_PLUSPLUS_REPO}/releases`;
    import_electron4.shell.openExternal(releaseUrl).catch(() => {
    });
    return { standalone: true, releaseUrl };
  }
  const cli = (0, import_node_path9.join)(sourceRoot, "packages", "installer", "dist", "cli.js");
  if (!(0, import_node_fs10.existsSync)(cli)) {
    throw new Error("ChatGPT++ source CLI was not found. Run the installer once, then try again.");
  }
  const pending = markSelfUpdateStarted(sourceRoot);
  startInstalledCli(cli, ["update", "--watcher"]);
  return pending;
});
import_electron4.ipcMain.handle("codexpp:get-watcher-health", () => getWatcherHealth(userRoot));
import_electron4.ipcMain.handle("codexpp:get-tweak-store", async () => {
  const store = await fetchTweakStoreRegistry();
  const registry = store.registry;
  const installed = new Map(tweakState.discovered.map((t) => [t.manifest.id, t]));
  const entries = shuffleStoreEntries(registry.entries, import_node_crypto3.randomInt);
  return {
    ...registry,
    sourceUrl: TWEAK_STORE_INDEX_URL,
    fetchedAt: store.fetchedAt,
    entries: entries.map((entry) => {
      const local = installed.get(entry.id);
      const platform2 = storeEntryPlatformCompatibility(entry);
      const runtime = storeEntryRuntimeCompatibility(entry);
      return {
        ...entry,
        platform: platform2,
        runtime,
        installed: local ? {
          version: local.manifest.version,
          enabled: isTweakEnabled(local.manifest.id)
        } : null
      };
    })
  };
});
import_electron4.ipcMain.handle("codexpp:install-store-tweak", async (_e, id) => {
  const { registry } = await fetchTweakStoreRegistry();
  const entry = registry.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Tweak store entry not found: ${id}`);
  assertStoreEntryPlatformCompatible(entry);
  assertStoreEntryRuntimeCompatible(entry);
  await installStoreTweak(entry);
  reloadTweaks("store-install", tweakLifecycleDeps);
  return { installed: entry.id };
});
import_electron4.ipcMain.handle("codexpp:prepare-tweak-store-submission", async (_e, repoInput) => {
  return prepareTweakStoreSubmission(repoInput);
});
import_electron4.ipcMain.handle("codexpp:read-tweak-source", (_e, entryPath) => {
  const resolved = (0, import_node_path9.resolve)(entryPath);
  if (!isPathInside2(TWEAKS_DIR, resolved)) {
    throw new Error("path outside tweaks dir");
  }
  return require("node:fs").readFileSync(resolved, "utf8");
});
var ASSET_MAX_BYTES = 1024 * 1024;
var MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
import_electron4.ipcMain.handle(
  "codexpp:read-tweak-asset",
  (_e, tweakDir, relPath) => {
    const fs = require("node:fs");
    const dir = (0, import_node_path9.resolve)(tweakDir);
    if (!isPathInside2(TWEAKS_DIR, dir)) {
      throw new Error("tweakDir outside tweaks dir");
    }
    const full = (0, import_node_path9.resolve)(dir, relPath);
    if (!isPathInside2(dir, full) || full === dir) {
      throw new Error("path traversal");
    }
    const stat4 = fs.statSync(full);
    if (stat4.size > ASSET_MAX_BYTES) {
      throw new Error(`asset too large (${stat4.size} > ${ASSET_MAX_BYTES})`);
    }
    const ext = full.slice(full.lastIndexOf(".")).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const buf = fs.readFileSync(full);
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
);
import_electron4.ipcMain.on("codexpp:preload-log", (_e, level, msg) => {
  const lvl = level === "error" || level === "warn" ? level : "info";
  try {
    appendCappedLog((0, import_node_path9.join)(LOG_DIR, "preload.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] [${lvl}] ${msg}
`);
  } catch {
  }
});
import_electron4.ipcMain.handle("codexpp:tweak-fs", (_e, op, id, p, c) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("bad tweak id");
  const dir = (0, import_node_path9.join)(userRoot, "tweak-data", id);
  (0, import_node_fs10.mkdirSync)(dir, { recursive: true });
  const full = (0, import_node_path9.resolve)(dir, p);
  if (!isPathInside2(dir, full) || full === dir) throw new Error("path traversal");
  const fs = require("node:fs");
  switch (op) {
    case "read":
      return fs.readFileSync(full, "utf8");
    case "write":
      return fs.writeFileSync(full, c ?? "", "utf8");
    case "exists":
      return fs.existsSync(full);
    case "dataDir":
      return dir;
    default:
      throw new Error(`unknown op: ${op}`);
  }
});
import_electron4.ipcMain.handle("codexpp:user-paths", () => ({
  userRoot,
  runtimeDir,
  tweaksDir: TWEAKS_DIR,
  logDir: LOG_DIR
}));
import_electron4.ipcMain.handle("codexpp:codex-runtime-info", () => currentRuntimeInfo());
import_electron4.ipcMain.handle("codexpp:codex-runtime-capabilities", () => currentRuntimeCapabilities());
import_electron4.ipcMain.handle("codexpp:codex-cdp-status", () => getCdpStatus());
import_electron4.ipcMain.handle("codexpp:codex-cdp-targets", () => listCdpTargets());
import_electron4.ipcMain.handle("codexpp:codex-window-create", (_e, opts) => {
  return createCodexWindow(opts);
});
import_electron4.ipcMain.handle("codexpp:codex-window-primary", () => getPrimaryCodexWindowRef());
import_electron4.ipcMain.handle("codexpp:codex-window-focus", (_e, windowId) => focusCodexWindow(windowId));
import_electron4.ipcMain.handle("codexpp:codex-window-show", (_e, windowId) => showCodexWindow(windowId));
import_electron4.ipcMain.handle(
  "codexpp:codex-view-create",
  async (_e, tweakId, options) => {
    const tweak = assertTweakViewPermissionForId(tweakId);
    const ref = await createOwlView({ id: tweak.manifest.id, dir: tweak.dir }, options);
    return {
      id: ref.id,
      webContentsId: ref.webContentsId,
      parentWindowId: ref.parentWindowId
    };
  }
);
import_electron4.ipcMain.handle(
  "codexpp:codex-view-call",
  (_e, tweakId, viewId, method, arg, arg2) => {
    assertTweakViewPermissionForId(tweakId);
    return callOwlView(tweakId, viewId, method, arg, arg2);
  }
);
import_electron4.ipcMain.handle("codexpp:codex-view-dispose-tweak", (_e, tweakId) => {
  assertTweakId(tweakId);
  disposeOwlViewsForTweak(tweakId);
});
import_electron4.ipcMain.handle(
  "codexpp:native-load-module",
  (_e, tweakId, options) => {
    const ref = nativeBridge.loadModule(tweakContext(tweakId, "native-module"), options);
    return { id: ref.id, kind: ref.kind };
  }
);
import_electron4.ipcMain.handle(
  "codexpp:native-module-request",
  (_e, tweakId, moduleId, method, payload, timeoutMs) => {
    assertTweakPermissionForId(tweakId, "native-module");
    return nativeBridge.requestModule(tweakId, moduleId, method, payload, timeoutMs);
  }
);
import_electron4.ipcMain.handle("codexpp:native-module-dispose", (_e, tweakId, moduleId) => {
  assertTweakPermissionForId(tweakId, "native-module");
  return nativeBridge.disposeModule(tweakId, moduleId);
});
import_electron4.ipcMain.handle("codexpp:native-dispose-tweak", (_e, tweakId) => {
  assertTweakId(tweakId);
  nativeBridge.disposeTweak(tweakId);
});
import_electron4.ipcMain.handle(
  "codexpp:native-create-panel",
  async (_e, tweakId, options) => {
    const ref = await nativeBridge.createPanel(tweakContext(tweakId, "native-view"), options);
    return { id: ref.id, windowId: ref.windowId };
  }
);
import_electron4.ipcMain.handle(
  "codexpp:native-attach-view",
  async (_e, tweakId, options) => {
    const ref = await nativeBridge.attachView(tweakContext(tweakId, "native-view"), options);
    return { id: ref.id };
  }
);
import_electron4.ipcMain.handle(
  "codexpp:native-instance-call",
  async (_e, tweakId, kind, instanceId, method, arg) => {
    assertTweakPermissionForId(tweakId, "native-view");
    return nativeBridge.callInstance(tweakId, kind, instanceId, method, arg);
  }
);
import_electron4.ipcMain.handle(
  "codexpp:native-launch-helper",
  (_e, tweakId, options) => {
    const ref = nativeBridge.launchHelper(tweakContext(tweakId, "native-helper"), options);
    return { id: ref.id, pid: ref.pid };
  }
);
import_electron4.ipcMain.handle(
  "codexpp:native-helper-call",
  (_e, tweakId, helperId, method, payload, timeoutMs) => {
    assertTweakPermissionForId(tweakId, "native-helper");
    return nativeBridge.callHelper(tweakId, helperId, method, payload, timeoutMs);
  }
);
import_electron4.ipcMain.handle("codexpp:reveal", (_e, p) => {
  import_electron4.shell.openPath(p).catch(() => {
  });
});
import_electron4.ipcMain.handle("codexpp:open-external", (_e, url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error("only github.com links can be opened from tweak metadata");
  }
  import_electron4.shell.openExternal(parsed.toString()).catch(() => {
  });
});
import_electron4.ipcMain.handle("codexpp:copy-text", (_e, text) => {
  import_electron4.clipboard.writeText(String(text));
  return true;
});
import_electron4.ipcMain.handle("codexpp:reload-tweaks", () => {
  reloadTweaks("manual", tweakLifecycleDeps);
  return { at: Date.now(), count: tweakState.discovered.length };
});
var RELOAD_DEBOUNCE_MS = 250;
var reloadTimer = null;
function scheduleReload(reason) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    reloadTweaks(reason, tweakLifecycleDeps);
  }, RELOAD_DEBOUNCE_MS);
}
try {
  const watcher = esm_default.watch(TWEAKS_DIR, {
    ignoreInitial: true,
    // Wait for files to settle before triggering — guards against partially
    // written tweak files during editor saves / git checkouts.
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    // Avoid eating CPU on huge node_modules trees inside tweak folders.
    ignored: (p) => p.includes(`${TWEAKS_DIR}/`) && /\/node_modules\//.test(p)
  });
  watcher.on("all", (event, path) => scheduleReload(`${event} ${path}`));
  watcher.on("error", (e) => log("warn", "watcher error:", e));
  log("info", "watching", TWEAKS_DIR);
  import_electron4.app.on("will-quit", () => watcher.close().catch(() => {
  }));
} catch (e) {
  log("error", "failed to start watcher:", e);
}
function loadAllMainTweaks() {
  try {
    tweakState.discovered = discoverTweaks(TWEAKS_DIR);
    log(
      "info",
      `discovered ${tweakState.discovered.length} tweak(s):`,
      tweakState.discovered.map((t) => t.manifest.id).join(", ")
    );
  } catch (e) {
    log("error", "tweak discovery failed:", e);
    tweakState.discovered = [];
  }
  syncMcpServersFromEnabledTweaks();
  for (const t of tweakState.discovered) {
    if (!isMainProcessTweakScope(t.manifest.scope)) continue;
    if (!isTweakEnabled(t.manifest.id)) {
      log("info", `skipping disabled main tweak: ${t.manifest.id}`);
      continue;
    }
    try {
      const mod = require(t.entry);
      const tweak = mod.default ?? mod;
      if (typeof tweak?.start === "function") {
        const storage = createDiskStorage(userRoot, t.manifest.id);
        tweak.start({
          manifest: t.manifest,
          process: "main",
          log: makeLogger(t.manifest.id),
          storage,
          ipc: makeMainIpc(t.manifest.id),
          fs: makeMainFs(t.manifest.id),
          codex: makeCodexApi(t)
        });
        tweakState.loadedMain.set(t.manifest.id, {
          stop: tweak.stop,
          storage
        });
        log("info", `started main tweak: ${t.manifest.id}`);
      }
    } catch (e) {
      log("error", `tweak ${t.manifest.id} failed to start:`, e);
    }
  }
}
function syncMcpServersFromEnabledTweaks() {
  try {
    const result = syncManagedMcpServers({
      configPath: CODEX_CONFIG_FILE,
      tweaks: tweakState.discovered.filter((t) => isTweakEnabled(t.manifest.id))
    });
    if (result.changed) {
      log("info", `synced Codex MCP config: ${result.serverNames.join(", ") || "none"}`);
    }
    if (result.skippedServerNames.length > 0) {
      log(
        "info",
        `skipped ChatGPT++ managed MCP server(s) already configured by user: ${result.skippedServerNames.join(", ")}`
      );
    }
  } catch (e) {
    log("warn", "failed to sync Codex MCP config:", e);
  }
}
function stopAllMainTweaks() {
  for (const [id, t] of tweakState.loadedMain) {
    try {
      t.stop?.();
      t.storage.flush();
      log("info", `stopped main tweak: ${id}`);
    } catch (e) {
      log("warn", `stop failed for ${id}:`, e);
    } finally {
      nativeBridge.disposeTweak(id);
      disposeOwlViewsForTweak(id);
    }
  }
  tweakState.loadedMain.clear();
}
function clearTweakModuleCache() {
  const rootSet = /* @__PURE__ */ new Set([TWEAKS_DIR, safeRealpath(TWEAKS_DIR)]);
  const entrySet = /* @__PURE__ */ new Set();
  for (const tweak of tweakState.discovered) {
    rootSet.add(tweak.dir);
    rootSet.add(safeRealpath(tweak.dir));
    entrySet.add(tweak.entry);
    entrySet.add(safeRealpath(tweak.entry));
  }
  const roots = [...rootSet];
  for (const key of Object.keys(require.cache)) {
    const realKey = safeRealpath(key);
    const isTweakModule = entrySet.has(key) || entrySet.has(realKey) || roots.some((root) => isPathInside2(root, key) || isPathInside2(root, realKey));
    if (isTweakModule) delete require.cache[key];
  }
}
function safeRealpath(filePath) {
  try {
    return (0, import_node_fs10.realpathSync)(filePath);
  } catch {
    return filePath;
  }
}
var UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1e3;
var VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
async function ensureChatgptPlusPlusUpdateCheck(force = false) {
  const state = readState();
  const cached = state.chatgptPlusPlus?.updateCheck;
  const channel = state.chatgptPlusPlus?.updateChannel ?? "stable";
  const repo = state.chatgptPlusPlus?.updateRepo ?? CHATGPT_PLUSPLUS_REPO;
  if (!force && cached && cached.currentVersion === CHATGPT_PLUSPLUS_VERSION && Date.now() - Date.parse(cached.checkedAt) < UPDATE_CHECK_INTERVAL_MS) {
    return cached;
  }
  const release = await fetchLatestRelease(repo, CHATGPT_PLUSPLUS_VERSION, channel === "prerelease");
  const latestVersion = release.latestTag ? normalizeVersion(release.latestTag) : null;
  const check = {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    currentVersion: CHATGPT_PLUSPLUS_VERSION,
    latestVersion,
    releaseUrl: release.releaseUrl ?? `https://github.com/${repo}/releases`,
    releaseNotes: release.releaseNotes,
    updateAvailable: latestVersion ? compareVersions(normalizeVersion(latestVersion), CHATGPT_PLUSPLUS_VERSION) > 0 : false,
    ...release.error ? { error: release.error } : {}
  };
  state.chatgptPlusPlus ??= {};
  state.chatgptPlusPlus.updateCheck = check;
  writeState(state);
  return check;
}
async function ensureTweakUpdateCheck(t) {
  const id = t.manifest.id;
  const repo = t.manifest.githubRepo;
  const state = readState();
  const cached = state.tweakUpdateChecks?.[id];
  if (cached && cached.repo === repo && cached.currentVersion === t.manifest.version && Date.now() - Date.parse(cached.checkedAt) < UPDATE_CHECK_INTERVAL_MS) {
    return;
  }
  const next = await fetchLatestRelease(repo, t.manifest.version);
  const latestVersion = next.latestTag ? normalizeVersion(next.latestTag) : null;
  const check = {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    repo,
    currentVersion: t.manifest.version,
    latestVersion,
    latestTag: next.latestTag,
    releaseUrl: next.releaseUrl,
    updateAvailable: latestVersion ? compareVersions(latestVersion, normalizeVersion(t.manifest.version)) > 0 : false,
    ...next.error ? { error: next.error } : {}
  };
  state.tweakUpdateChecks ??= {};
  state.tweakUpdateChecks[id] = check;
  writeState(state);
}
async function fetchLatestRelease(repo, currentVersion, includePrerelease = false) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    try {
      const endpoint = includePrerelease ? "releases?per_page=20" : "releases/latest";
      const res = await fetch(`https://api.github.com/repos/${repo}/${endpoint}`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": `chatgpt-plusplus/${currentVersion}`
        },
        signal: controller.signal
      });
      if (res.status === 404) {
        return { latestTag: null, releaseUrl: null, releaseNotes: null, error: "no GitHub release found" };
      }
      if (!res.ok) {
        return { latestTag: null, releaseUrl: null, releaseNotes: null, error: `GitHub returned ${res.status}` };
      }
      const json = await res.json();
      const body = Array.isArray(json) ? json.find((release) => !release.draft) : json;
      if (!body) {
        return { latestTag: null, releaseUrl: null, releaseNotes: null, error: "no GitHub release found" };
      }
      return {
        latestTag: body.tag_name ?? null,
        releaseUrl: body.html_url ?? `https://github.com/${repo}/releases`,
        releaseNotes: body.body ?? null
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    return {
      latestTag: null,
      releaseUrl: null,
      releaseNotes: null,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
var StoreTweakModifiedError = class extends Error {
  constructor(tweakName) {
    super(
      `${tweakName} has local source changes, so ChatGPT++ can't auto-update it. Revert your local changes or reinstall the tweak manually.`
    );
    this.name = "StoreTweakModifiedError";
  }
};
function storeEntryPlatformCompatibility(entry) {
  const supported = entry.platforms ?? null;
  const compatible = !supported || supported.includes(process.platform);
  return {
    current: process.platform,
    supported,
    compatible,
    reason: compatible ? null : `${entry.manifest.name} is only available on ${formatStorePlatforms(supported)}.`
  };
}
function assertStoreEntryPlatformCompatible(entry) {
  const platform2 = storeEntryPlatformCompatibility(entry);
  if (!platform2.compatible) {
    throw new Error(platform2.reason ?? `${entry.manifest.name} is not available on this platform.`);
  }
}
function storeEntryRuntimeCompatibility(entry) {
  const required = cleanMinRuntime(entry.manifest.minRuntime);
  const compatible = !required || compareVersions(CHATGPT_PLUSPLUS_VERSION, required) >= 0;
  return {
    current: CHATGPT_PLUSPLUS_VERSION,
    required,
    compatible,
    reason: compatible || !required ? null : `${entry.manifest.name} requires ChatGPT++ ${required} or newer.`
  };
}
function assertStoreEntryRuntimeCompatible(entry) {
  const runtime = storeEntryRuntimeCompatibility(entry);
  if (!runtime.compatible) {
    throw new Error(runtime.reason ?? `${entry.manifest.name} requires a newer ChatGPT++ runtime.`);
  }
}
function cleanMinRuntime(value) {
  if (typeof value !== "string") return null;
  const version = normalizeVersion(value.replace(/^>=?\s*/, ""));
  return VERSION_RE.test(version) ? version : null;
}
function formatStorePlatforms(platforms) {
  if (!platforms || platforms.length === 0) return "supported platforms";
  return platforms.map((platform2) => {
    if (platform2 === "darwin") return "macOS";
    if (platform2 === "win32") return "Windows";
    return "Linux";
  }).join(", ");
}
async function fetchTweakStoreRegistry() {
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    try {
      const res = await fetch(TWEAK_STORE_INDEX_URL, {
        headers: {
          "Accept": "application/json",
          "User-Agent": `chatgpt-plusplus/${CHATGPT_PLUSPLUS_VERSION}`
        },
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`store returned ${res.status}`);
      return {
        registry: normalizeStoreRegistry(await res.json()),
        fetchedAt
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    log("warn", "failed to fetch tweak store registry:", error.message);
    throw error;
  }
}
async function installStoreTweak(entry) {
  const url = storeArchiveUrl(entry);
  const work = (0, import_node_fs10.mkdtempSync)((0, import_node_path9.join)((0, import_node_os2.tmpdir)(), "codexpp-store-tweak-"));
  const archive = (0, import_node_path9.join)(work, "source.tar.gz");
  const extractDir = (0, import_node_path9.join)(work, "extract");
  const target = (0, import_node_path9.join)(TWEAKS_DIR, entry.id);
  const stagedTarget = (0, import_node_path9.join)(work, "staged", entry.id);
  try {
    log("info", `installing store tweak ${entry.id} from ${entry.repo}@${entry.approvedCommitSha}`);
    const res = await fetch(url, {
      headers: { "User-Agent": `chatgpt-plusplus/${CHATGPT_PLUSPLUS_VERSION}` },
      redirect: "follow"
    });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    (0, import_node_fs10.writeFileSync)(archive, bytes);
    (0, import_node_fs10.mkdirSync)(extractDir, { recursive: true });
    extractTarArchive(archive, extractDir);
    const source = findTweakRoot(extractDir);
    if (!source) throw new Error("downloaded archive did not contain manifest.json");
    validateStoreTweakSource(entry, source);
    (0, import_node_fs10.rmSync)(stagedTarget, { recursive: true, force: true });
    copyTweakSource(source, stagedTarget);
    const stagedFiles = hashTweakSource(stagedTarget);
    (0, import_node_fs10.writeFileSync)(
      (0, import_node_path9.join)(stagedTarget, ".codexpp-store.json"),
      JSON.stringify(
        {
          repo: entry.repo,
          approvedCommitSha: entry.approvedCommitSha,
          installedAt: (/* @__PURE__ */ new Date()).toISOString(),
          storeIndexUrl: TWEAK_STORE_INDEX_URL,
          files: stagedFiles
        },
        null,
        2
      )
    );
    await assertStoreTweakCleanForAutoUpdate(entry, target, work);
    (0, import_node_fs10.rmSync)(target, { recursive: true, force: true });
    (0, import_node_fs10.cpSync)(stagedTarget, target, { recursive: true });
  } finally {
    (0, import_node_fs10.rmSync)(work, { recursive: true, force: true });
  }
}
async function prepareTweakStoreSubmission(repoInput) {
  const repo = normalizeGitHubRepo(repoInput);
  const repoInfo = await fetchGithubJson(`https://api.github.com/repos/${repo}`);
  const defaultBranch = repoInfo.default_branch;
  if (!defaultBranch) throw new Error(`Could not resolve default branch for ${repo}`);
  const commit = await fetchGithubJson(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(defaultBranch)}`);
  if (!commit.sha) throw new Error(`Could not resolve current commit for ${repo}`);
  const manifest = await fetchManifestAtCommit(repo, commit.sha).catch((e) => {
    log("warn", `could not read manifest for store submission ${repo}@${commit.sha}:`, e);
    return void 0;
  });
  return {
    repo,
    defaultBranch,
    commitSha: commit.sha,
    commitUrl: commit.html_url ?? `https://github.com/${repo}/commit/${commit.sha}`,
    manifest: manifest ? {
      id: typeof manifest.id === "string" ? manifest.id : void 0,
      name: typeof manifest.name === "string" ? manifest.name : void 0,
      version: typeof manifest.version === "string" ? manifest.version : void 0,
      description: typeof manifest.description === "string" ? manifest.description : void 0,
      iconUrl: typeof manifest.iconUrl === "string" ? manifest.iconUrl : void 0
    } : void 0
  };
}
async function fetchGithubJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8e3);
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": `chatgpt-plusplus/${CHATGPT_PLUSPLUS_VERSION}`
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchManifestAtCommit(repo, commitSha) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${commitSha}/manifest.json`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": `chatgpt-plusplus/${CHATGPT_PLUSPLUS_VERSION}`
    }
  });
  if (!res.ok) throw new Error(`manifest fetch returned ${res.status}`);
  return await res.json();
}
function extractTarArchive(archive, targetDir) {
  const result = (0, import_node_child_process3.spawnSync)("tar", ["-xzf", archive, "-C", targetDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed: ${result.stderr || result.stdout || result.status}`);
  }
}
function validateStoreTweakSource(entry, source) {
  const manifestPath = (0, import_node_path9.join)(source, "manifest.json");
  const manifest = JSON.parse((0, import_node_fs10.readFileSync)(manifestPath, "utf8"));
  if (manifest.id !== entry.manifest.id) {
    throw new Error(`downloaded tweak id ${manifest.id} does not match approved id ${entry.manifest.id}`);
  }
  if (manifest.githubRepo !== entry.repo) {
    throw new Error(`downloaded tweak repo ${manifest.githubRepo} does not match approved repo ${entry.repo}`);
  }
  if (manifest.version !== entry.manifest.version) {
    throw new Error(`downloaded tweak version ${manifest.version} does not match approved version ${entry.manifest.version}`);
  }
}
function findTweakRoot(dir) {
  if (!(0, import_node_fs10.existsSync)(dir)) return null;
  if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(dir, "manifest.json"))) return dir;
  for (const name of (0, import_node_fs10.readdirSync)(dir)) {
    const child = (0, import_node_path9.join)(dir, name);
    try {
      if (!(0, import_node_fs10.statSync)(child).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findTweakRoot(child);
    if (found) return found;
  }
  return null;
}
function copyTweakSource(source, target) {
  (0, import_node_fs10.cpSync)(source, target, {
    recursive: true,
    filter: (src) => !/(^|[/\\])(?:\.git|node_modules)(?:[/\\]|$)/.test(src)
  });
}
async function assertStoreTweakCleanForAutoUpdate(entry, target, work) {
  if (!(0, import_node_fs10.existsSync)(target)) return;
  const metadata = readStoreInstallMetadata(target);
  if (!metadata) return;
  if (metadata.repo !== entry.repo) {
    throw new StoreTweakModifiedError(entry.manifest.name);
  }
  const currentFiles = hashTweakSource(target);
  const baselineFiles = metadata.files ?? await fetchBaselineStoreTweakHashes(metadata, work);
  if (!sameFileHashes(currentFiles, baselineFiles)) {
    throw new StoreTweakModifiedError(entry.manifest.name);
  }
}
function readStoreInstallMetadata(target) {
  const metadataPath = (0, import_node_path9.join)(target, ".codexpp-store.json");
  if (!(0, import_node_fs10.existsSync)(metadataPath)) return null;
  try {
    const parsed = JSON.parse((0, import_node_fs10.readFileSync)(metadataPath, "utf8"));
    if (typeof parsed.repo !== "string" || typeof parsed.approvedCommitSha !== "string") return null;
    return {
      repo: parsed.repo,
      approvedCommitSha: parsed.approvedCommitSha,
      installedAt: typeof parsed.installedAt === "string" ? parsed.installedAt : "",
      storeIndexUrl: typeof parsed.storeIndexUrl === "string" ? parsed.storeIndexUrl : "",
      files: isHashRecord(parsed.files) ? parsed.files : void 0
    };
  } catch {
    return null;
  }
}
async function fetchBaselineStoreTweakHashes(metadata, work) {
  const baselineDir = (0, import_node_path9.join)(work, "baseline");
  const archive = (0, import_node_path9.join)(work, "baseline.tar.gz");
  const res = await fetch(`https://codeload.github.com/${metadata.repo}/tar.gz/${metadata.approvedCommitSha}`, {
    headers: { "User-Agent": `chatgpt-plusplus/${CHATGPT_PLUSPLUS_VERSION}` },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Could not verify local tweak changes before update: ${res.status}`);
  (0, import_node_fs10.writeFileSync)(archive, Buffer.from(await res.arrayBuffer()));
  (0, import_node_fs10.mkdirSync)(baselineDir, { recursive: true });
  extractTarArchive(archive, baselineDir);
  const source = findTweakRoot(baselineDir);
  if (!source) throw new Error("Could not verify local tweak changes before update: baseline manifest missing");
  return hashTweakSource(source);
}
function hashTweakSource(root) {
  const out = {};
  collectTweakFileHashes(root, root, out);
  return out;
}
function collectTweakFileHashes(root, dir, out) {
  for (const name of (0, import_node_fs10.readdirSync)(dir).sort()) {
    if (name === ".git" || name === "node_modules" || name === ".codexpp-store.json") continue;
    const full = (0, import_node_path9.join)(dir, name);
    const rel = (0, import_node_path9.relative)(root, full).split("\\").join("/");
    const stat4 = (0, import_node_fs10.statSync)(full);
    if (stat4.isDirectory()) {
      collectTweakFileHashes(root, full, out);
      continue;
    }
    if (!stat4.isFile()) continue;
    out[rel] = (0, import_node_crypto3.createHash)("sha256").update((0, import_node_fs10.readFileSync)(full)).digest("hex");
  }
}
function sameFileHashes(a, b) {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    const key = ak[i];
    if (key !== bk[i] || a[key] !== b[key]) return false;
  }
  return true;
}
function isHashRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}
function normalizeVersion(v) {
  return v.trim().replace(/^v/i, "");
}
function compareVersions(a, b) {
  const av = VERSION_RE.exec(a);
  const bv = VERSION_RE.exec(b);
  if (!av || !bv) return 0;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(av[i]) - Number(bv[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}
function fallbackSourceRoot() {
  const candidates = [
    (0, import_node_path9.join)((0, import_node_os2.homedir)(), ".chatgpt-plusplus", "source"),
    (0, import_node_path9.join)((0, import_node_os2.homedir)(), ".codex-plusplus", "source"),
    (0, import_node_path9.join)(userRoot, "source")
  ];
  for (const candidate of candidates) {
    if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(candidate, "packages", "installer", "dist", "cli.js"))) return candidate;
  }
  return null;
}
function describeInstallationSource(sourceRoot) {
  if (!sourceRoot) {
    return {
      kind: "unknown",
      label: "Unknown",
      detail: "ChatGPT++ source location is not recorded yet."
    };
  }
  const normalized = sourceRoot.replace(/\\/g, "/");
  if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(sourceRoot, "standalone.json"))) {
    return { kind: "standalone-package", label: "Standalone \u5B89\u88C5\u5305", detail: sourceRoot };
  }
  if (/\/(?:Homebrew|homebrew)\/Cellar\/(?:chatgptplusplus|codexplusplus)\//.test(normalized)) {
    return { kind: "homebrew", label: "Homebrew", detail: sourceRoot };
  }
  if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(sourceRoot, ".git"))) {
    return { kind: "local-dev", label: "Local development checkout", detail: sourceRoot };
  }
  if (normalized.endsWith("/.chatgpt-plusplus/source") || normalized.includes("/.chatgpt-plusplus/source/") || normalized.endsWith("/.codex-plusplus/source") || normalized.includes("/.codex-plusplus/source/")) {
    return { kind: "github-source", label: "GitHub source installer", detail: sourceRoot };
  }
  if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(sourceRoot, "package.json"))) {
    return { kind: "source-archive", label: "Source archive", detail: sourceRoot };
  }
  return { kind: "unknown", label: "Unknown", detail: sourceRoot };
}
function startInstalledCli(cli, args) {
  if (process.platform === "darwin" && startInstalledCliWithLaunchd(cli, args)) {
    return;
  }
  const child = (0, import_node_child_process3.spawn)(process.execPath, [cli, ...args], {
    cwd: (0, import_node_path9.resolve)((0, import_node_path9.dirname)(cli), "..", "..", ".."),
    env: { ...process.env, CHATGPT_PLUSPLUS_MANUAL_UPDATE: "1" },
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}
function startInstalledCliWithLaunchd(cli, args) {
  const label = `com.chatgptplusplus.patch-helper.${process.pid}.${Date.now()}`;
  const cleanup = `launchctl remove ${label} >/dev/null 2>&1 || launchctl bootout gui/$(id -u)/${label} >/dev/null 2>&1 || true`;
  const command = [
    `trap ${shellQuote(cleanup)} EXIT`,
    `cd ${shellQuote((0, import_node_path9.resolve)((0, import_node_path9.dirname)(cli), "..", "..", ".."))}`,
    `CHATGPT_PLUSPLUS_MANUAL_UPDATE=1 ${[process.execPath, cli, ...args].map(shellQuote).join(" ")}`
  ].join(" && ");
  const result = (0, import_node_child_process3.spawnSync)(
    "launchctl",
    [
      "submit",
      "-l",
      label,
      "--",
      "/bin/sh",
      "-c",
      `${command} || true`
    ],
    {
      encoding: "utf8",
      stdio: "ignore"
    }
  );
  if (result.status === 0) return true;
  log("warn", `launchctl submit failed for ChatGPT++ patch helper: ${result.error?.message ?? result.status}`);
  return false;
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function markSelfUpdateStarted(sourceRoot) {
  const config = readState().chatgptPlusPlus;
  const channel = config?.updateChannel ?? "stable";
  const state = {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "checking",
    currentVersion: CHATGPT_PLUSPLUS_VERSION,
    latestVersion: null,
    targetRef: config?.updateChannel === "custom" ? config.updateRef ?? null : null,
    releaseUrl: null,
    repo: config?.updateRepo ?? CHATGPT_PLUSPLUS_REPO,
    channel,
    sourceRoot,
    installationSource: describeInstallationSource(sourceRoot)
  };
  writeSelfUpdateState(state);
  return state;
}
function broadcastReload() {
  const payload = {
    at: Date.now(),
    tweaks: tweakState.discovered.map((t) => t.manifest.id)
  };
  for (const wc of import_electron4.webContents.getAllWebContents()) {
    try {
      wc.send("codexpp:tweaks-changed", payload);
    } catch (e) {
      log("warn", "broadcast send failed:", e);
    }
  }
}
function makeLogger(scope) {
  return {
    debug: (...a) => log("info", `[${scope}]`, ...a),
    info: (...a) => log("info", `[${scope}]`, ...a),
    warn: (...a) => log("warn", `[${scope}]`, ...a),
    error: (...a) => log("error", `[${scope}]`, ...a)
  };
}
function makeMainIpc(id) {
  const ch = (c) => `codexpp:${id}:${c}`;
  return {
    on: (c, h) => {
      const wrapped = (_e, ...args) => h(...args);
      import_electron4.ipcMain.on(ch(c), wrapped);
      return () => import_electron4.ipcMain.removeListener(ch(c), wrapped);
    },
    send: (_c) => {
      throw new Error("ipc.send is renderer\u2192main; main side uses handle/on");
    },
    invoke: (_c) => {
      throw new Error("ipc.invoke is renderer\u2192main; main side uses handle");
    },
    handle: (c, handler) => {
      import_electron4.ipcMain.handle(ch(c), (_e, ...args) => handler(...args));
    }
  };
}
function makeMainFs(id) {
  const dir = (0, import_node_path9.join)(userRoot, "tweak-data", id);
  (0, import_node_fs10.mkdirSync)(dir, { recursive: true });
  const fs = require("node:fs/promises");
  return {
    dataDir: dir,
    read: (p) => fs.readFile((0, import_node_path9.join)(dir, p), "utf8"),
    write: (p, c) => fs.writeFile((0, import_node_path9.join)(dir, p), c, "utf8"),
    exists: async (p) => {
      try {
        await fs.access((0, import_node_path9.join)(dir, p));
        return true;
      } catch {
        return false;
      }
    }
  };
}
function currentRuntimeInfo() {
  const installerState = readInstallerState();
  return getRuntimeInfo({
    userRoot,
    runtimeDir,
    codexVersion: installerState?.codexVersion ?? null,
    channel: null,
    getWindowServices: getCodexWindowServices
  });
}
function currentRuntimeCapabilities() {
  const installerState = readInstallerState();
  return getRuntimeCapabilities({
    userRoot,
    runtimeDir,
    codexVersion: installerState?.codexVersion ?? null,
    channel: null,
    getWindowServices: getCodexWindowServices,
    getNativeCapabilities: () => nativeBridge.getCapabilities(),
    getViewCapabilities: () => getOwlViewCapabilities()
  });
}
function tweakContext(tweakId, permission) {
  const tweak = permission ? assertTweakPermissionForId(tweakId, permission) : tweakById(tweakId);
  return { id: tweak.manifest.id, dir: tweak.dir };
}
function tweakById(tweakId) {
  assertTweakId(tweakId);
  const tweak = tweakState.discovered.find((item) => item.manifest.id === tweakId);
  if (!tweak) throw new Error(`unknown tweak: ${tweakId}`);
  if (!isTweakEnabled(tweakId)) throw new Error(`tweak is disabled: ${tweakId}`);
  return tweak;
}
function assertTweakPermissionForId(tweakId, permission) {
  const tweak = tweakById(tweakId);
  assertTweakPermission(tweak, permission);
  return tweak;
}
function assertTweakViewPermissionForId(tweakId) {
  const tweak = tweakById(tweakId);
  assertTweakViewPermission(tweak);
  return tweak;
}
function assertTweakPermission(tweak, permission) {
  if (tweak.manifest.permissions?.includes(permission)) return;
  throw new Error(`tweak ${tweak.manifest.id} must declare ${permission} permission`);
}
function assertTweakViewPermission(tweak) {
  if (tweak.manifest.permissions?.includes("codex-views") || tweak.manifest.permissions?.includes("codex.views")) {
    return;
  }
  throw new Error(`tweak ${tweak.manifest.id} must declare codex-views permission`);
}
function assertTweakId(tweakId) {
  if (!/^[a-zA-Z0-9._-]+$/.test(tweakId)) throw new Error("bad tweak id");
}
function getPrimaryCodexWindow() {
  const services = getCodexWindowServices();
  const fromServices = typeof services?.getPrimaryWindow === "function" ? services.getPrimaryWindow("local") : null;
  if (fromServices && !fromServices.isDestroyed()) return fromServices;
  const fromManager = typeof services?.windowManager?.getPrimaryWindow === "function" ? services.windowManager.getPrimaryWindow.call(services.windowManager) : null;
  if (fromManager && !fromManager.isDestroyed()) return fromManager;
  const focused = import_electron4.BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  return import_electron4.BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()) ?? null;
}
function getPrimaryCodexWindowRef() {
  const win = getPrimaryCodexWindow();
  if (!win || win.isDestroyed()) return null;
  return { windowId: win.id, webContentsId: win.webContents.id };
}
function focusCodexWindow(windowId) {
  const win = import_electron4.BrowserWindow.fromId(windowId);
  if (!win || win.isDestroyed()) return false;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return true;
}
function showCodexWindow(windowId) {
  const win = import_electron4.BrowserWindow.fromId(windowId);
  if (!win || win.isDestroyed()) return false;
  win.show();
  return true;
}
function getOwlViewCapabilities() {
  const parent = getPrimaryCodexWindow() ?? import_electron4.BrowserWindow.getFocusedWindow();
  const contentView = asRecord4(parent)?.contentView;
  let sampleView = null;
  try {
    sampleView = new import_electron4.BrowserView({ webPreferences: { sandbox: true } });
  } catch {
  }
  const webContentsView = asRecord4(sampleView)?.webContentsView;
  const privateViewTree = typeof asRecord4(contentView)?.addChildView === "function" && typeof asRecord4(contentView)?.removeChildView === "function";
  const webContentsViewAvailable = Boolean(webContentsView) && typeof asRecord4(webContentsView)?.setBounds === "function";
  const privateAttach = privateViewTree && webContentsViewAvailable;
  const browserViewFallback = typeof asRecord4(parent)?.addBrowserView === "function";
  try {
    if (sampleView && !sampleView.webContents.isDestroyed()) {
      sampleView.webContents.close({ waitForBeforeUnload: false });
    }
  } catch {
  }
  return {
    create: privateAttach || browserViewFallback,
    privateViewTree: privateAttach,
    webContentsView: webContentsViewAvailable,
    browserViewFallback
  };
}
async function createOwlView(ctx, opts) {
  const id = assertBridgeId2(opts.id ?? (0, import_node_crypto3.randomUUID)(), "Codex view id");
  const key = owlViewKey(ctx.id, id);
  if (owlViews.has(key)) throw new Error(`Codex view already exists: ${ctx.id}:${id}`);
  const parent = typeof opts.parentWindowId === "number" ? import_electron4.BrowserWindow.fromId(opts.parentWindowId) : getPrimaryCodexWindow();
  if (!parent || isWindowDestroyed2(parent)) {
    throw new Error("Codex view needs an active parent window");
  }
  const services = getCodexWindowServices();
  const windowManager = services?.windowManager;
  const route = opts.route === void 0 ? null : normalizeCodexRoute(opts.route);
  const hostId = opts.hostId || "local";
  const view = new import_electron4.BrowserView({
    webPreferences: {
      preload: opts.registerWithCodex === false ? void 0 : windowManager?.options?.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: windowManager?.options?.allowDevtools
    }
  });
  if (opts.backgroundColor) {
    callObjectMethod(view, "setBackgroundColor", [opts.backgroundColor]);
    callObjectMethod(asRecord4(view)?.webContentsView, "setBackgroundColor", [opts.backgroundColor]);
  }
  const managed = {
    key,
    tweakId: ctx.id,
    id,
    view,
    parentWindowId: windowIdFor2(parent),
    attachMode: null,
    disposeBindings: [],
    disposed: false
  };
  owlViews.set(key, managed);
  try {
    if (route !== null && opts.registerWithCodex !== false && windowManager?.registerWindow) {
      const appearance = opts.appearance || "secondary";
      const windowLike = makeWindowLikeForView2(view);
      windowManager.registerWindow(windowLike, hostId, false, appearance);
      services?.getContext?.(hostId)?.registerWindow?.(windowLike);
    }
    attachOwlView(managed, parent);
    if (opts.bounds) setOwlViewBounds(managed, opts.bounds);
    if (opts.visible === false) setOwlViewVisible(managed, false);
    if (route !== null) {
      await view.webContents.loadURL(codexAppUrl(route, hostId));
    } else if (opts.url) {
      await view.webContents.loadURL(normalizeOwlViewUrl(opts.url));
    } else {
      await view.webContents.loadURL("about:blank");
    }
  } catch (e) {
    disposeOwlView(managed);
    throw e;
  }
  log("info", `created Owl view ${ctx.id}:${id}`, {
    parentWindowId: managed.parentWindowId,
    webContentsId: view.webContents.id,
    attachMode: managed.attachMode
  });
  return owlViewRef(managed);
}
async function callOwlView(tweakId, id, method, arg, arg2) {
  const view = owlViewFor(tweakId, id);
  if (method === "setBounds") return setOwlViewBounds(view, arg);
  if (method === "setVisible") return setOwlViewVisible(view, Boolean(arg));
  if (method === "bringToFront") return bringOwlViewToFront(view);
  if (method === "loadRoute") {
    const route = normalizeCodexRoute(String(arg));
    const hostId = typeof arg2 === "string" && arg2 ? arg2 : "local";
    return view.view.webContents.loadURL(codexAppUrl(route, hostId));
  }
  if (method === "loadUrl") return view.view.webContents.loadURL(normalizeOwlViewUrl(String(arg)));
  if (method === "dispose") return disposeOwlViewById(tweakId, id);
  throw new Error(`unknown Codex view method: ${method}`);
}
function owlViewRef(view) {
  return {
    id: view.id,
    webContentsId: view.view.webContents.id,
    parentWindowId: view.parentWindowId,
    setBounds: (bounds) => Promise.resolve(setOwlViewBounds(view, bounds)),
    setVisible: (visible) => Promise.resolve(setOwlViewVisible(view, visible)),
    bringToFront: () => Promise.resolve(bringOwlViewToFront(view)),
    loadRoute: (route, hostId) => view.view.webContents.loadURL(codexAppUrl(normalizeCodexRoute(route), hostId || "local")).then(() => {
    }),
    loadUrl: (url) => view.view.webContents.loadURL(normalizeOwlViewUrl(url)).then(() => {
    }),
    dispose: () => Promise.resolve(disposeOwlViewById(view.tweakId, view.id))
  };
}
function attachOwlView(view, parent) {
  const contentView = asRecord4(parent)?.contentView;
  const webContentsView = asRecord4(view.view)?.webContentsView;
  if (typeof asRecord4(parent)?.addBrowserView === "function") {
    callObjectMethod(parent, "addBrowserView", [view.view]);
    view.attachMode = "browserView";
  } else if (typeof asRecord4(contentView)?.addChildView === "function" && webContentsView) {
    try {
      addOwlChildView(parent, view.view);
      view.attachMode = "contentView";
    } catch (e) {
      log("warn", "Owl contentView attachment failed; falling back to BrowserView", {
        tweakId: view.tweakId,
        viewId: view.id,
        error: String(e)
      });
    }
  }
  if (!view.attachMode) {
    throw new Error("Owl view attachment is not available on this Codex window");
  }
  const dispose = () => disposeOwlViewById(view.tweakId, view.id);
  bindWindowEvent(parent, view, "closed", dispose);
  bindWindowEvent(parent, view, "close", dispose);
}
function bringOwlViewToFront(view) {
  if (view.disposed) return;
  const parent = view.parentWindowId === null ? null : import_electron4.BrowserWindow.fromId(view.parentWindowId);
  if (!parent || isWindowDestroyed2(parent)) return;
  const contentView = asRecord4(parent)?.contentView;
  const webContentsView = asRecord4(view.view)?.webContentsView;
  if (view.attachMode === "contentView" && webContentsView) {
    try {
      if (typeof asRecord4(parent)?.setTopBrowserView === "function") {
        callObjectMethod(parent, "setTopBrowserView", [view.view]);
      } else {
        callObjectMethod(contentView, "addChildView", [webContentsView]);
      }
      return;
    } catch (e) {
      log("warn", "Owl contentView bring-to-front failed", {
        tweakId: view.tweakId,
        viewId: view.id,
        error: String(e)
      });
    }
  }
  if (typeof asRecord4(parent)?.setTopBrowserView === "function") {
    callObjectMethod(parent, "setTopBrowserView", [view.view]);
  }
}
function setOwlViewBounds(view, bounds) {
  assertBounds(bounds);
  callObjectMethod(view.view, "setBounds", [bounds]);
  callObjectMethod(asRecord4(view.view)?.webContentsView, "setBounds", [bounds]);
}
function setOwlViewVisible(view, visible) {
  callObjectMethod(asRecord4(view.view)?.webContentsView, "setVisible", [visible]);
}
function disposeOwlViewById(tweakId, id) {
  const view = owlViews.get(owlViewKey(tweakId, id));
  if (!view) return;
  disposeOwlView(view);
}
function disposeOwlViewsForTweak(tweakId) {
  for (const view of [...owlViews.values()]) {
    if (view.tweakId === tweakId) disposeOwlView(view);
  }
}
function disposeAllOwlViews() {
  for (const view of [...owlViews.values()]) disposeOwlView(view);
}
function disposeOwlView(view) {
  if (view.disposed) return;
  view.disposed = true;
  owlViews.delete(view.key);
  for (const dispose of view.disposeBindings.splice(0)) {
    try {
      dispose();
    } catch {
    }
  }
  const parent = view.parentWindowId === null ? null : import_electron4.BrowserWindow.fromId(view.parentWindowId);
  if (parent && !isWindowDestroyed2(parent)) {
    try {
      if (view.attachMode === "contentView") {
        removeOwlChildView(parent, view.view);
      } else if (view.attachMode === "browserView") {
        callObjectMethod(parent, "removeBrowserView", [view.view]);
      }
    } catch (e) {
      log("warn", "Owl view detach failed during dispose", {
        tweakId: view.tweakId,
        viewId: view.id,
        error: String(e)
      });
    }
  }
  try {
    if (!view.view.webContents.isDestroyed()) {
      view.view.webContents.close({ waitForBeforeUnload: false });
    }
  } catch {
  }
}
function owlViewFor(tweakId, id) {
  const view = owlViews.get(owlViewKey(tweakId, id));
  if (!view || view.disposed) throw new Error(`Codex view is not loaded: ${tweakId}:${id}`);
  return view;
}
function owlViewKey(tweakId, viewId) {
  return `${tweakId}:${viewId}`;
}
function addOwlChildView(parent, child) {
  const ownerWindow = asRecord4(child)?.ownerWindow;
  if (ownerWindow && ownerWindow !== parent) {
    callObjectMethod(ownerWindow, "removeBrowserView", [child]);
  }
  callObjectMethod(asRecord4(parent)?.contentView, "addChildView", [asRecord4(child)?.webContentsView]);
  try {
    child.ownerWindow = parent;
  } catch {
  }
  callObjectMethod(asRecord4(child.webContents), "_setOwnerWindow", [parent]);
  const browserViews = asRecord4(parent)?._browserViews;
  if (Array.isArray(browserViews) && !browserViews.includes(child)) {
    browserViews.push(child);
  }
}
function removeOwlChildView(parent, child) {
  callObjectMethod(asRecord4(parent)?.contentView, "removeChildView", [asRecord4(child)?.webContentsView]);
  try {
    child.ownerWindow = null;
  } catch {
  }
  const browserViews = asRecord4(parent)?._browserViews;
  if (Array.isArray(browserViews)) {
    const index = browserViews.indexOf(child);
    if (index >= 0) browserViews.splice(index, 1);
  }
}
async function createCodexBrowserView(opts) {
  const services = getCodexWindowServices();
  const windowManager = services?.windowManager;
  if (!services || !windowManager?.registerWindow) {
    throw new Error(
      "Codex embedded view services are not available. Reinstall ChatGPT++ 1.0.0 or later."
    );
  }
  const route = normalizeCodexRoute(opts.route);
  const hostId = opts.hostId || "local";
  const appearance = opts.appearance || "secondary";
  const view = new import_electron4.BrowserView({
    webPreferences: {
      preload: windowManager.options?.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: windowManager.options?.allowDevtools
    }
  });
  const windowLike = makeWindowLikeForView2(view);
  windowManager.registerWindow(windowLike, hostId, false, appearance);
  services.getContext?.(hostId)?.registerWindow?.(windowLike);
  await view.webContents.loadURL(codexAppUrl(route, hostId));
  return view;
}
async function createCodexWindow(opts) {
  const services = getCodexWindowServices();
  if (!services) {
    throw new Error(
      "Codex window services are not available. Reinstall ChatGPT++ 1.0.0 or later."
    );
  }
  const route = normalizeCodexRoute(opts.route);
  const hostId = opts.hostId || "local";
  const parent = typeof opts.parentWindowId === "number" ? import_electron4.BrowserWindow.fromId(opts.parentWindowId) : import_electron4.BrowserWindow.getFocusedWindow();
  const createWindow = services.windowManager?.createWindow;
  let win;
  if (typeof createWindow === "function") {
    win = await createWindow.call(services.windowManager, {
      initialRoute: route,
      hostId,
      show: opts.show !== false,
      appearance: opts.appearance || "secondary",
      parent
    });
  } else if (hostId === "local" && typeof services.createFreshWindow === "function") {
    win = await services.createFreshWindow(route);
  } else if (hostId === "local" && typeof services.createFreshLocalWindow === "function") {
    win = await services.createFreshLocalWindow(route);
  } else if (typeof services.ensureHostWindow === "function") {
    win = await services.ensureHostWindow(hostId);
  }
  if (!win || win.isDestroyed()) {
    throw new Error("Codex did not return a window for the requested route");
  }
  if (opts.bounds) {
    win.setBounds(opts.bounds);
  }
  if (parent && !parent.isDestroyed()) {
    try {
      win.setParentWindow(parent);
    } catch {
    }
  }
  if (opts.show !== false) {
    win.show();
  }
  return {
    windowId: win.id,
    webContentsId: win.webContents.id
  };
}
function makeCodexApi(tweak) {
  const ctx = () => ({ id: tweak.manifest.id, dir: tweak.dir });
  return {
    runtime: {
      getInfo: async () => currentRuntimeInfo(),
      getCapabilities: async () => currentRuntimeCapabilities()
    },
    windows: {
      create: createCodexWindow,
      getPrimary: async () => getPrimaryCodexWindowRef(),
      focus: async (windowId) => focusCodexWindow(windowId),
      show: async (windowId) => showCodexWindow(windowId)
    },
    views: {
      create: async (options) => {
        assertTweakViewPermission(tweak);
        return createOwlView(ctx(), options);
      }
    },
    cdp: {
      getStatus: async () => getCdpStatus(),
      listTargets: async () => listCdpTargets()
    },
    native: {
      loadModule: async (options) => {
        assertTweakPermission(tweak, "native-module");
        return nativeBridge.loadModule(ctx(), options);
      },
      createPanel: async (options) => {
        assertTweakPermission(tweak, "native-view");
        return nativeBridge.createPanel(ctx(), options);
      },
      attachView: async (options) => {
        assertTweakPermission(tweak, "native-view");
        return nativeBridge.attachView(ctx(), options);
      },
      launchHelper: async (options) => {
        assertTweakPermission(tweak, "native-helper");
        return nativeBridge.launchHelper(ctx(), options);
      }
    },
    createBrowserView: createCodexBrowserView,
    createWindow: createCodexWindow
  };
}
function makeWindowLikeForView2(view) {
  const viewBounds = () => view.getBounds();
  return {
    id: view.webContents.id,
    webContents: view.webContents,
    on: (event, listener) => {
      if (event === "closed") {
        view.webContents.once("destroyed", listener);
      } else {
        view.webContents.on(event, listener);
      }
      return view;
    },
    once: (event, listener) => {
      view.webContents.once(event, listener);
      return view;
    },
    off: (event, listener) => {
      view.webContents.off(event, listener);
      return view;
    },
    removeListener: (event, listener) => {
      view.webContents.removeListener(event, listener);
      return view;
    },
    isDestroyed: () => view.webContents.isDestroyed(),
    isFocused: () => view.webContents.isFocused(),
    focus: () => view.webContents.focus(),
    show: () => {
    },
    hide: () => {
    },
    getBounds: viewBounds,
    getContentBounds: viewBounds,
    getSize: () => {
      const b = viewBounds();
      return [b.width, b.height];
    },
    getContentSize: () => {
      const b = viewBounds();
      return [b.width, b.height];
    },
    setTitle: () => {
    },
    getTitle: () => "",
    setRepresentedFilename: () => {
    },
    setDocumentEdited: () => {
    },
    setWindowButtonVisibility: () => {
    }
  };
}
function codexAppUrl(route, hostId) {
  const url = new URL("app://-/index.html");
  url.searchParams.set("hostId", hostId);
  if (route !== "/") url.searchParams.set("initialRoute", route);
  return url.toString();
}
function normalizeOwlViewUrl(url) {
  if (typeof url !== "string" || url.includes("\n") || url.includes("\r")) {
    throw new Error("Owl view URL must be a string without control characters");
  }
  const parsed = new URL(url);
  if (!["http:", "https:", "app:", "file:", "data:", "about:"].includes(parsed.protocol)) {
    throw new Error(`unsupported Owl view URL protocol: ${parsed.protocol}`);
  }
  return parsed.toString();
}
function getCodexWindowServices() {
  const services = globalThis[CODEX_WINDOW_SERVICES_KEY];
  return services && typeof services === "object" ? services : null;
}
function normalizeCodexRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/")) {
    throw new Error("Codex route must be an absolute app route");
  }
  if (route.includes("://") || route.includes("\n") || route.includes("\r")) {
    throw new Error("Codex route must not include a protocol or control characters");
  }
  return route;
}
function asRecord4(value) {
  return value && typeof value === "object" ? value : null;
}
function callObjectMethod(target, method, args) {
  const fn = asRecord4(target)?.[method];
  if (typeof fn !== "function") return void 0;
  return fn.apply(target, args);
}
function isWindowDestroyed2(win) {
  if (!win) return true;
  const fn = asRecord4(win)?.isDestroyed;
  if (typeof fn !== "function") return false;
  try {
    return Boolean(fn.call(win));
  } catch {
    return true;
  }
}
function windowIdFor2(win) {
  const id = asRecord4(win)?.id;
  return typeof id === "number" ? id : null;
}
function bindWindowEvent(win, view, event, listener) {
  const on = asRecord4(win)?.on;
  const off = asRecord4(win)?.off;
  if (typeof on !== "function") return;
  on.call(win, event, listener);
  view.disposeBindings.push(() => {
    if (typeof off === "function") off.call(win, event, listener);
    else callObjectMethod(win, "removeListener", [event, listener]);
  });
}
function assertBridgeId2(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`${label} may only contain letters, numbers, dots, underscores, and dashes`);
  }
  return value;
}
function assertBounds(bounds) {
  const values = [bounds?.x, bounds?.y, bounds?.width, bounds?.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("bounds must contain finite x, y, width, and height numbers");
  }
  if (bounds.width < 0 || bounds.height < 0) {
    throw new Error("bounds width and height must be non-negative");
  }
}
/*! Bundled license information:

chokidar/esm/index.js:
  (*! chokidar - MIT License (c) 2012 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2Nob2tpZGFyL2VzbS9pbmRleC5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvcmVhZGRpcnAvZXNtL2luZGV4LmpzIiwgIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9jaG9raWRhci9lc20vaGFuZGxlci5qcyIsICIuLi9zcmMvdHdlYWstZGlzY292ZXJ5LnRzIiwgIi4uL3NyYy9zdG9yYWdlLnRzIiwgIi4uL3NyYy9tY3Atc3luYy50cyIsICIuLi9zcmMvd2F0Y2hlci1oZWFsdGgudHMiLCAiLi4vc3JjL3R3ZWFrLWxpZmVjeWNsZS50cyIsICIuLi9zcmMvbG9nZ2luZy50cyIsICIuLi9zcmMvY29kZXgtcnVudGltZS1wcm9iZS50cyIsICIuLi9zcmMvbmF0aXZlLWJyaWRnZS50cyIsICIuLi9zcmMvbmF0aXZlLXBhdGhzLnRzIiwgIi4uL3NyYy90d2Vhay1zdG9yZS50cyIsICIuLi9zcmMvYnJvd3Nlci11aS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBNYWluLXByb2Nlc3MgYm9vdHN0cmFwLiBMb2FkZWQgYnkgdGhlIGFzYXIgbG9hZGVyIGJlZm9yZSBDb2RleCdzIG93blxuICogbWFpbiBwcm9jZXNzIGNvZGUgcnVucy4gV2UgaG9vayBgQnJvd3NlcldpbmRvd2Agc28gZXZlcnkgd2luZG93IENvZGV4XG4gKiBjcmVhdGVzIGdldHMgb3VyIHByZWxvYWQgc2NyaXB0IGF0dGFjaGVkLiBXZSBhbHNvIHN0YW5kIHVwIGFuIElQQ1xuICogY2hhbm5lbCBmb3IgdHdlYWtzIHRvIHRhbGsgdG8gdGhlIG1haW4gcHJvY2Vzcy5cbiAqXG4gKiBXZSBhcmUgaW4gQ0pTIGxhbmQgaGVyZSAobWF0Y2hlcyBFbGVjdHJvbidzIG1haW4gcHJvY2VzcyBhbmQgQ29kZXgncyBvd25cbiAqIGNvZGUpLiBUaGUgcmVuZGVyZXItc2lkZSBydW50aW1lIGlzIGJ1bmRsZWQgc2VwYXJhdGVseSBpbnRvIHByZWxvYWQuanMuXG4gKi9cbmltcG9ydCB7IGFwcCwgQnJvd3NlclZpZXcsIEJyb3dzZXJXaW5kb3csIGNsaXBib2FyZCwgaXBjTWFpbiwgc2Vzc2lvbiwgc2hlbGwsIHdlYkNvbnRlbnRzIH0gZnJvbSBcImVsZWN0cm9uXCI7XG5pbXBvcnQgeyBjcFN5bmMsIGV4aXN0c1N5bmMsIG1rZGlyU3luYywgbWtkdGVtcFN5bmMsIHJlYWRkaXJTeW5jLCByZWFkRmlsZVN5bmMsIHJlYWxwYXRoU3luYywgcm1TeW5jLCBzdGF0U3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBleGVjRmlsZVN5bmMsIHNwYXduLCBzcGF3blN5bmMgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBjcmVhdGVIYXNoLCByYW5kb21JbnQsIHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IGRpcm5hbWUsIGlzQWJzb2x1dGUsIGpvaW4sIHJlbGF0aXZlLCByZXNvbHZlIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgaG9tZWRpciwgdG1wZGlyIH0gZnJvbSBcIm5vZGU6b3NcIjtcbmltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcbmltcG9ydCB7IGRpc2NvdmVyVHdlYWtzLCB0eXBlIERpc2NvdmVyZWRUd2VhayB9IGZyb20gXCIuL3R3ZWFrLWRpc2NvdmVyeVwiO1xuaW1wb3J0IHsgY3JlYXRlRGlza1N0b3JhZ2UsIHR5cGUgRGlza1N0b3JhZ2UgfSBmcm9tIFwiLi9zdG9yYWdlXCI7XG5pbXBvcnQgeyBzeW5jTWFuYWdlZE1jcFNlcnZlcnMgfSBmcm9tIFwiLi9tY3Atc3luY1wiO1xuaW1wb3J0IHsgZ2V0V2F0Y2hlckhlYWx0aCB9IGZyb20gXCIuL3dhdGNoZXItaGVhbHRoXCI7XG5pbXBvcnQge1xuICBpc01haW5Qcm9jZXNzVHdlYWtTY29wZSxcbiAgcmVsb2FkVHdlYWtzLFxuICBzZXRUd2Vha0VuYWJsZWRBbmRSZWxvYWQsXG59IGZyb20gXCIuL3R3ZWFrLWxpZmVjeWNsZVwiO1xuaW1wb3J0IHsgYXBwZW5kQ2FwcGVkTG9nIH0gZnJvbSBcIi4vbG9nZ2luZ1wiO1xuaW1wb3J0IHtcbiAgZ2V0Q2RwU3RhdHVzLFxuICBnZXRSdW50aW1lQ2FwYWJpbGl0aWVzLFxuICBnZXRSdW50aW1lSW5mbyxcbiAgbGlzdENkcFRhcmdldHMsXG59IGZyb20gXCIuL2NvZGV4LXJ1bnRpbWUtcHJvYmVcIjtcbmltcG9ydCB7IE5hdGl2ZUJyaWRnZSwgdHlwZSBOYXRpdmVUd2Vha0NvbnRleHQgfSBmcm9tIFwiLi9uYXRpdmUtYnJpZGdlXCI7XG5pbXBvcnQgdHlwZSB7IFR3ZWFrTWFuaWZlc3QgfSBmcm9tIFwiQGNoYXRncHQtcGx1c3BsdXMvc2RrXCI7XG5pbXBvcnQgdHlwZSB7XG4gIENvZGV4UnVudGltZUNhcGFiaWxpdGllcyxcbiAgQ29kZXhSdW50aW1lSW5mbyxcbiAgQ29kZXhWaWV3Q3JlYXRlT3B0aW9ucyxcbiAgQ29kZXhWaWV3UmVmLFxuICBDb2RleFdpbmRvd1JlZixcbiAgTmF0aXZlSGVscGVyTGF1bmNoT3B0aW9ucyxcbiAgTmF0aXZlTW9kdWxlTG9hZE9wdGlvbnMsXG4gIE5hdGl2ZVBhbmVsQ3JlYXRlT3B0aW9ucyxcbiAgTmF0aXZlVmlld0F0dGFjaE9wdGlvbnMsXG4gIFR3ZWFrUGVybWlzc2lvbixcbn0gZnJvbSBcIkBjaGF0Z3B0LXBsdXNwbHVzL3Nka1wiO1xuaW1wb3J0IHtcbiAgREVGQVVMVF9UV0VBS19TVE9SRV9JTkRFWF9VUkwsXG4gIG5vcm1hbGl6ZUdpdEh1YlJlcG8sXG4gIG5vcm1hbGl6ZVN0b3JlUmVnaXN0cnksXG4gIHNodWZmbGVTdG9yZUVudHJpZXMsXG4gIHN0b3JlQXJjaGl2ZVVybCxcbiAgdHlwZSBUd2Vha1N0b3JlUHVibGlzaFN1Ym1pc3Npb24sXG4gIHR5cGUgVHdlYWtTdG9yZUVudHJ5LFxuICB0eXBlIFR3ZWFrU3RvcmVSZWdpc3RyeSxcbiAgdHlwZSBUd2Vha1N0b3JlUGxhdGZvcm0sXG59IGZyb20gXCIuL3R3ZWFrLXN0b3JlXCI7XG5pbXBvcnQgeyBtYXliZVN0YXJ0QnJvd3NlclVpU2VydmVyIH0gZnJvbSBcIi4vYnJvd3Nlci11aVwiO1xuXG5jb25zdCB1c2VyUm9vdCA9IHByb2Nlc3MuZW52LkNIQVRHUFRfUExVU1BMVVNfVVNFUl9ST09UID8/IHByb2Nlc3MuZW52LkNPREVYX1BMVVNQTFVTX1VTRVJfUk9PVDtcbmNvbnN0IHJ1bnRpbWVEaXIgPSBwcm9jZXNzLmVudi5DSEFUR1BUX1BMVVNQTFVTX1JVTlRJTUUgPz8gcHJvY2Vzcy5lbnYuQ09ERVhfUExVU1BMVVNfUlVOVElNRTtcblxuaWYgKCF1c2VyUm9vdCB8fCAhcnVudGltZURpcikge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgXCJjaGF0Z3B0LXBsdXNwbHVzIHJ1bnRpbWUgc3RhcnRlZCB3aXRob3V0IENIQVRHUFRfUExVU1BMVVNfVVNFUl9ST09UL1JVTlRJTUUgZW52c1wiLFxuICApO1xufVxuXG5jb25zdCBQUkVMT0FEX1BBVEggPSByZXNvbHZlKHJ1bnRpbWVEaXIsIFwicHJlbG9hZC5qc1wiKTtcbmNvbnN0IFRXRUFLU19ESVIgPSBqb2luKHVzZXJSb290LCBcInR3ZWFrc1wiKTtcbmNvbnN0IExPR19ESVIgPSBqb2luKHVzZXJSb290LCBcImxvZ1wiKTtcbmNvbnN0IExPR19GSUxFID0gam9pbihMT0dfRElSLCBcIm1haW4ubG9nXCIpO1xuY29uc3QgQ09ORklHX0ZJTEUgPSBqb2luKHVzZXJSb290LCBcImNvbmZpZy5qc29uXCIpO1xuY29uc3QgQ09ERVhfQ09ORklHX0ZJTEUgPSBqb2luKGhvbWVkaXIoKSwgXCIuY29kZXhcIiwgXCJjb25maWcudG9tbFwiKTtcbmNvbnN0IElOU1RBTExFUl9TVEFURV9GSUxFID0gam9pbih1c2VyUm9vdCwgXCJzdGF0ZS5qc29uXCIpO1xuY29uc3QgVVBEQVRFX01PREVfRklMRSA9IGpvaW4odXNlclJvb3QsIFwidXBkYXRlLW1vZGUuanNvblwiKTtcbmNvbnN0IFNFTEZfVVBEQVRFX1NUQVRFX0ZJTEUgPSBqb2luKHVzZXJSb290LCBcInNlbGYtdXBkYXRlLXN0YXRlLmpzb25cIik7XG5jb25zdCBTSUdORURfQ09ERVhfQkFDS1VQID0gam9pbih1c2VyUm9vdCwgXCJiYWNrdXBcIiwgXCJDb2RleC5hcHBcIik7XG5jb25zdCBDSEFUR1BUX1BMVVNQTFVTX1ZFUlNJT04gPSBcIjEuMC42XCI7XG5jb25zdCBDSEFUR1BUX1BMVVNQTFVTX1JFUE8gPSBcIlNodW5sbHkvY2hhdGdwdC1wbHVzcGx1c1wiO1xuY29uc3QgVFdFQUtfU1RPUkVfSU5ERVhfVVJMID0gcHJvY2Vzcy5lbnYuQ0hBVEdQVF9QTFVTUExVU19TVE9SRV9JTkRFWF9VUkwgPz8gcHJvY2Vzcy5lbnYuQ09ERVhfUExVU1BMVVNfU1RPUkVfSU5ERVhfVVJMID8/IERFRkFVTFRfVFdFQUtfU1RPUkVfSU5ERVhfVVJMO1xuY29uc3QgQ09ERVhfV0lORE9XX1NFUlZJQ0VTX0tFWSA9IFwiX19jb2RleHBwX3dpbmRvd19zZXJ2aWNlc19fXCI7XG5cbm1rZGlyU3luYyhMT0dfRElSLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbm1rZGlyU3luYyhUV0VBS1NfRElSLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuLy8gT3B0aW9uYWw6IGVuYWJsZSBDaHJvbWUgRGV2VG9vbHMgUHJvdG9jb2wgb24gYSBUQ1AgcG9ydCBzbyB3ZSBjYW4gZHJpdmUgdGhlXG4vLyBydW5uaW5nIENvZGV4IGZyb20gb3V0c2lkZSAoY3VybCBodHRwOi8vbG9jYWxob3N0Ojxwb3J0Pi9qc29uLCBhdHRhY2ggdmlhXG4vLyBDRFAgV2ViU29ja2V0LCB0YWtlIHNjcmVlbnNob3RzLCBldmFsdWF0ZSBpbiByZW5kZXJlciwgZXRjLikuIENvZGV4J3Ncbi8vIHByb2R1Y3Rpb24gYnVpbGQgc2V0cyB3ZWJQcmVmZXJlbmNlcy5kZXZUb29scz1mYWxzZSwgd2hpY2gga2lsbHMgdGhlXG4vLyBpbi13aW5kb3cgRGV2VG9vbHMgc2hvcnRjdXQsIGJ1dCBgLS1yZW1vdGUtZGVidWdnaW5nLXBvcnRgIHdvcmtzIHJlZ2FyZGxlc3Ncbi8vIGJlY2F1c2UgaXQncyBhIENocm9taXVtIGNvbW1hbmQtbGluZSBzd2l0Y2ggcHJvY2Vzc2VkIGJlZm9yZSBhcHAgaW5pdC5cbi8vXG4vLyBPZmYgYnkgZGVmYXVsdC4gU2V0IENPREVYUFBfUkVNT1RFX0RFQlVHPTEgKG9wdGlvbmFsbHkgQ09ERVhQUF9SRU1PVEVfREVCVUdfUE9SVClcbi8vIHRvIHR1cm4gaXQgb24uIE11c3QgYmUgYXBwZW5kZWQgYmVmb3JlIGBhcHBgIGJlY29tZXMgcmVhZHk7IHdlJ3JlIGF0IG1vZHVsZVxuLy8gdG9wLWxldmVsIHNvIHRoYXQncyBmaW5lLlxuaWYgKHByb2Nlc3MuZW52LkNPREVYUFBfUkVNT1RFX0RFQlVHID09PSBcIjFcIikge1xuICBjb25zdCBwb3J0ID0gcHJvY2Vzcy5lbnYuQ09ERVhQUF9SRU1PVEVfREVCVUdfUE9SVCA/PyBcIjkyMjJcIjtcbiAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaChcInJlbW90ZS1kZWJ1Z2dpbmctcG9ydFwiLCBwb3J0KTtcbiAgbG9nKFwiaW5mb1wiLCBgcmVtb3RlIGRlYnVnZ2luZyBlbmFibGVkIG9uIHBvcnQgJHtwb3J0fWApO1xufVxuXG5pbnRlcmZhY2UgUGVyc2lzdGVkU3RhdGUge1xuICAvKiogXHU2NUU3XHU3MjQ4XHU2NzJDXHU5MTREXHU3RjZFXHU5NTJFXHU1NDBEXHVGRjA4djEuMC41IFx1NEU0Qlx1NTI0RFx1RkYwOVx1RkYwQ1x1OEJGQlx1NTNENlx1NjVGNlx1ODFFQVx1NTJBOFx1OEZDMVx1NzlGQlx1NTIzMCBjaGF0Z3B0UGx1c1BsdXNcdTMwMDIgKi9cbiAgY29kZXhQbHVzUGx1cz86IHtcbiAgICBhdXRvVXBkYXRlPzogYm9vbGVhbjtcbiAgICBzYWZlTW9kZT86IGJvb2xlYW47XG4gICAgdXBkYXRlQ2hhbm5lbD86IFNlbGZVcGRhdGVDaGFubmVsO1xuICAgIHVwZGF0ZVJlcG8/OiBzdHJpbmc7XG4gICAgdXBkYXRlUmVmPzogc3RyaW5nO1xuICAgIHVwZGF0ZUNoZWNrPzogQ2hhdGdwdFBsdXNQbHVzVXBkYXRlQ2hlY2s7XG4gIH07XG4gIGNoYXRncHRQbHVzUGx1cz86IHtcbiAgICBhdXRvVXBkYXRlPzogYm9vbGVhbjtcbiAgICBzYWZlTW9kZT86IGJvb2xlYW47XG4gICAgdXBkYXRlQ2hhbm5lbD86IFNlbGZVcGRhdGVDaGFubmVsO1xuICAgIHVwZGF0ZVJlcG8/OiBzdHJpbmc7XG4gICAgdXBkYXRlUmVmPzogc3RyaW5nO1xuICAgIHVwZGF0ZUNoZWNrPzogQ2hhdGdwdFBsdXNQbHVzVXBkYXRlQ2hlY2s7XG4gIH07XG4gIC8qKiBQZXItdHdlYWsgZW5hYmxlIGZsYWdzLiBNaXNzaW5nIGVudHJpZXMgZGVmYXVsdCB0byBlbmFibGVkLiAqL1xuICB0d2Vha3M/OiBSZWNvcmQ8c3RyaW5nLCB7IGVuYWJsZWQ/OiBib29sZWFuIH0+O1xuICAvKiogQ2FjaGVkIEdpdEh1YiByZWxlYXNlIGNoZWNrcy4gUnVudGltZSBuZXZlciBhdXRvLWluc3RhbGxzIHVwZGF0ZXMuICovXG4gIHR3ZWFrVXBkYXRlQ2hlY2tzPzogUmVjb3JkPHN0cmluZywgVHdlYWtVcGRhdGVDaGVjaz47XG59XG5cbmludGVyZmFjZSBDaGF0Z3B0UGx1c1BsdXNVcGRhdGVDaGVjayB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlTm90ZXM6IHN0cmluZyB8IG51bGw7XG4gIHVwZGF0ZUF2YWlsYWJsZTogYm9vbGVhbjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbnR5cGUgU2VsZlVwZGF0ZUNoYW5uZWwgPSBcInN0YWJsZVwiIHwgXCJwcmVyZWxlYXNlXCIgfCBcImN1c3RvbVwiO1xudHlwZSBTZWxmVXBkYXRlU3RhdHVzID0gXCJjaGVja2luZ1wiIHwgXCJ1cC10by1kYXRlXCIgfCBcInVwZGF0ZWRcIiB8IFwiZmFpbGVkXCIgfCBcImRpc2FibGVkXCI7XG5cbmludGVyZmFjZSBTZWxmVXBkYXRlU3RhdGUge1xuICBjaGVja2VkQXQ6IHN0cmluZztcbiAgY29tcGxldGVkQXQ/OiBzdHJpbmc7XG4gIHN0YXR1czogU2VsZlVwZGF0ZVN0YXR1cztcbiAgY3VycmVudFZlcnNpb246IHN0cmluZztcbiAgbGF0ZXN0VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgdGFyZ2V0UmVmOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICByZXBvOiBzdHJpbmc7XG4gIGNoYW5uZWw6IFNlbGZVcGRhdGVDaGFubmVsO1xuICBzb3VyY2VSb290OiBzdHJpbmc7XG4gIGluc3RhbGxhdGlvblNvdXJjZT86IEluc3RhbGxhdGlvblNvdXJjZTtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJbnN0YWxsYXRpb25Tb3VyY2Uge1xuICBraW5kOiBcImdpdGh1Yi1zb3VyY2VcIiB8IFwiaG9tZWJyZXdcIiB8IFwibG9jYWwtZGV2XCIgfCBcInNvdXJjZS1hcmNoaXZlXCIgfCBcInN0YW5kYWxvbmUtcGFja2FnZVwiIHwgXCJ1bmtub3duXCI7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGRldGFpbDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVHdlYWtVcGRhdGVDaGVjayB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICByZXBvOiBzdHJpbmc7XG4gIGN1cnJlbnRWZXJzaW9uOiBzdHJpbmc7XG4gIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIGxhdGVzdFRhZzogc3RyaW5nIHwgbnVsbDtcbiAgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDtcbiAgdXBkYXRlQXZhaWxhYmxlOiBib29sZWFuO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVhZFN0YXRlKCk6IFBlcnNpc3RlZFN0YXRlIHtcbiAgbGV0IHN0YXRlOiBQZXJzaXN0ZWRTdGF0ZSA9IHt9O1xuICB0cnkge1xuICAgIHN0YXRlID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoQ09ORklHX0ZJTEUsIFwidXRmOFwiKSkgYXMgUGVyc2lzdGVkU3RhdGU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7fTtcbiAgfVxuICAvLyBcdTRFMDBcdTZCMjFcdTYwMjdcdThGQzFcdTc5RkJcdUZGMUF2MS4wLjUgXHU1M0NBXHU2NkY0XHU2NUU5XHU3MjQ4XHU2NzJDXHU3NTI4IGNvZGV4UGx1c1BsdXMgXHU5NTJFXHU1QjU4XHU1MEE4XHU5MTREXHU3RjZFXHUzMDAyXG4gIGlmIChzdGF0ZS5jb2RleFBsdXNQbHVzICYmICFzdGF0ZS5jaGF0Z3B0UGx1c1BsdXMpIHtcbiAgICBzdGF0ZS5jaGF0Z3B0UGx1c1BsdXMgPSBzdGF0ZS5jb2RleFBsdXNQbHVzO1xuICAgIGRlbGV0ZSBzdGF0ZS5jb2RleFBsdXNQbHVzO1xuICAgIHdyaXRlU3RhdGUoc3RhdGUpO1xuICB9XG4gIHJldHVybiBzdGF0ZTtcbn1cbmZ1bmN0aW9uIHdyaXRlU3RhdGUoczogUGVyc2lzdGVkU3RhdGUpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICB3cml0ZUZpbGVTeW5jKENPTkZJR19GSUxFLCBKU09OLnN0cmluZ2lmeShzLCBudWxsLCAyKSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwid3JpdGVTdGF0ZSBmYWlsZWQ6XCIsIFN0cmluZygoZSBhcyBFcnJvcikubWVzc2FnZSkpO1xuICB9XG59XG5mdW5jdGlvbiBpc0NoYXRncHRQbHVzUGx1c0F1dG9VcGRhdGVFbmFibGVkKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gcmVhZFN0YXRlKCkuY2hhdGdwdFBsdXNQbHVzPy5hdXRvVXBkYXRlICE9PSBmYWxzZTtcbn1cbmZ1bmN0aW9uIHNldENoYXRncHRQbHVzUGx1c0F1dG9VcGRhdGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHMuY2hhdGdwdFBsdXNQbHVzID8/PSB7fTtcbiAgcy5jaGF0Z3B0UGx1c1BsdXMuYXV0b1VwZGF0ZSA9IGVuYWJsZWQ7XG4gIHdyaXRlU3RhdGUocyk7XG59XG5mdW5jdGlvbiBzZXRDaGF0Z3B0UGx1c1BsdXNVcGRhdGVDb25maWcoY29uZmlnOiB7XG4gIHVwZGF0ZUNoYW5uZWw/OiBTZWxmVXBkYXRlQ2hhbm5lbDtcbiAgdXBkYXRlUmVwbz86IHN0cmluZztcbiAgdXBkYXRlUmVmPzogc3RyaW5nO1xufSk6IHZvaWQge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHMuY2hhdGdwdFBsdXNQbHVzID8/PSB7fTtcbiAgaWYgKGNvbmZpZy51cGRhdGVDaGFubmVsKSBzLmNoYXRncHRQbHVzUGx1cy51cGRhdGVDaGFubmVsID0gY29uZmlnLnVwZGF0ZUNoYW5uZWw7XG4gIGlmIChcInVwZGF0ZVJlcG9cIiBpbiBjb25maWcpIHMuY2hhdGdwdFBsdXNQbHVzLnVwZGF0ZVJlcG8gPSBjbGVhbk9wdGlvbmFsU3RyaW5nKGNvbmZpZy51cGRhdGVSZXBvKTtcbiAgaWYgKFwidXBkYXRlUmVmXCIgaW4gY29uZmlnKSBzLmNoYXRncHRQbHVzUGx1cy51cGRhdGVSZWYgPSBjbGVhbk9wdGlvbmFsU3RyaW5nKGNvbmZpZy51cGRhdGVSZWYpO1xuICB3cml0ZVN0YXRlKHMpO1xufVxuZnVuY3Rpb24gaXNDaGF0Z3B0UGx1c1BsdXNTYWZlTW9kZUVuYWJsZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiByZWFkU3RhdGUoKS5jaGF0Z3B0UGx1c1BsdXM/LnNhZmVNb2RlID09PSB0cnVlO1xufVxuZnVuY3Rpb24gaXNUd2Vha0VuYWJsZWQoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIGlmIChzLmNoYXRncHRQbHVzUGx1cz8uc2FmZU1vZGUgPT09IHRydWUpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHMudHdlYWtzPy5baWRdPy5lbmFibGVkICE9PSBmYWxzZTtcbn1cbmZ1bmN0aW9uIHNldFR3ZWFrRW5hYmxlZChpZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IHMgPSByZWFkU3RhdGUoKTtcbiAgcy50d2Vha3MgPz89IHt9O1xuICBzLnR3ZWFrc1tpZF0gPSB7IC4uLnMudHdlYWtzW2lkXSwgZW5hYmxlZCB9O1xuICB3cml0ZVN0YXRlKHMpO1xufVxuXG5pbnRlcmZhY2UgSW5zdGFsbGVyU3RhdGUge1xuICBhcHBSb290OiBzdHJpbmc7XG4gIGNvZGV4VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgc291cmNlUm9vdD86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVhZEluc3RhbGxlclN0YXRlKCk6IEluc3RhbGxlclN0YXRlIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKElOU1RBTExFUl9TVEFURV9GSUxFLCBcInV0ZjhcIikpIGFzIEluc3RhbGxlclN0YXRlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkU2VsZlVwZGF0ZVN0YXRlKCk6IFNlbGZVcGRhdGVTdGF0ZSB8IG51bGwge1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhTRUxGX1VQREFURV9TVEFURV9GSUxFLCBcInV0ZjhcIikpIGFzIFNlbGZVcGRhdGVTdGF0ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIHdyaXRlU2VsZlVwZGF0ZVN0YXRlKHN0YXRlOiBTZWxmVXBkYXRlU3RhdGUpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICB3cml0ZUZpbGVTeW5jKFNFTEZfVVBEQVRFX1NUQVRFX0ZJTEUsIEpTT04uc3RyaW5naWZ5KHN0YXRlLCBudWxsLCAyKSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwid3JpdGVTZWxmVXBkYXRlU3RhdGUgZmFpbGVkOlwiLCBTdHJpbmcoKGUgYXMgRXJyb3IpLm1lc3NhZ2UpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhbk9wdGlvbmFsU3RyaW5nKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgcmV0dXJuIHRyaW1tZWQgPyB0cmltbWVkIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc1BhdGhJbnNpZGUocGFyZW50OiBzdHJpbmcsIHRhcmdldDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHJlbCA9IHJlbGF0aXZlKHJlc29sdmUocGFyZW50KSwgcmVzb2x2ZSh0YXJnZXQpKTtcbiAgcmV0dXJuIHJlbCA9PT0gXCJcIiB8fCAoISFyZWwgJiYgIXJlbC5zdGFydHNXaXRoKFwiLi5cIikgJiYgIWlzQWJzb2x1dGUocmVsKSk7XG59XG5cbmZ1bmN0aW9uIGxvZyhsZXZlbDogXCJpbmZvXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiwgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG4gIGNvbnN0IGxpbmUgPSBgWyR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfV0gWyR7bGV2ZWx9XSAke2FyZ3NcbiAgICAubWFwKChhKSA9PiAodHlwZW9mIGEgPT09IFwic3RyaW5nXCIgPyBhIDogSlNPTi5zdHJpbmdpZnkoYSkpKVxuICAgIC5qb2luKFwiIFwiKX1cXG5gO1xuICB0cnkge1xuICAgIGFwcGVuZENhcHBlZExvZyhMT0dfRklMRSwgbGluZSk7XG4gIH0gY2F0Y2gge31cbiAgaWYgKGxldmVsID09PSBcImVycm9yXCIpIGNvbnNvbGUuZXJyb3IoXCJbY2hhdGdwdC1wbHVzcGx1c11cIiwgLi4uYXJncyk7XG59XG5cbmZ1bmN0aW9uIGluc3RhbGxTcGFya2xlVXBkYXRlSG9vaygpOiB2b2lkIHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09IFwiZGFyd2luXCIpIHJldHVybjtcblxuICBjb25zdCBNb2R1bGUgPSByZXF1aXJlKFwibm9kZTptb2R1bGVcIikgYXMgdHlwZW9mIGltcG9ydChcIm5vZGU6bW9kdWxlXCIpICYge1xuICAgIF9sb2FkPzogKHJlcXVlc3Q6IHN0cmluZywgcGFyZW50OiB1bmtub3duLCBpc01haW46IGJvb2xlYW4pID0+IHVua25vd247XG4gIH07XG4gIGNvbnN0IG9yaWdpbmFsTG9hZCA9IE1vZHVsZS5fbG9hZDtcbiAgaWYgKHR5cGVvZiBvcmlnaW5hbExvYWQgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuXG4gIE1vZHVsZS5fbG9hZCA9IGZ1bmN0aW9uIGNoYXRncHRQbHVzUGx1c01vZHVsZUxvYWQocmVxdWVzdDogc3RyaW5nLCBwYXJlbnQ6IHVua25vd24sIGlzTWFpbjogYm9vbGVhbikge1xuICAgIGNvbnN0IGxvYWRlZCA9IG9yaWdpbmFsTG9hZC5hcHBseSh0aGlzLCBbcmVxdWVzdCwgcGFyZW50LCBpc01haW5dKSBhcyB1bmtub3duO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdCA9PT0gXCJzdHJpbmdcIiAmJiAvc3BhcmtsZSg/OlxcLm5vZGUpPyQvaS50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICB3cmFwU3BhcmtsZUV4cG9ydHMobG9hZGVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGxvYWRlZDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcFNwYXJrbGVFeHBvcnRzKGxvYWRlZDogdW5rbm93bik6IHZvaWQge1xuICBpZiAoIWxvYWRlZCB8fCB0eXBlb2YgbG9hZGVkICE9PSBcIm9iamVjdFwiKSByZXR1cm47XG4gIGNvbnN0IGV4cG9ydHMgPSBsb2FkZWQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gJiB7IF9fY29kZXhwcFNwYXJrbGVXcmFwcGVkPzogYm9vbGVhbiB9O1xuICBpZiAoZXhwb3J0cy5fX2NvZGV4cHBTcGFya2xlV3JhcHBlZCkgcmV0dXJuO1xuICBleHBvcnRzLl9fY29kZXhwcFNwYXJrbGVXcmFwcGVkID0gdHJ1ZTtcblxuICBmb3IgKGNvbnN0IG5hbWUgb2YgW1wiaW5zdGFsbFVwZGF0ZXNJZkF2YWlsYWJsZVwiXSkge1xuICAgIGNvbnN0IGZuID0gZXhwb3J0c1tuYW1lXTtcbiAgICBpZiAodHlwZW9mIGZuICE9PSBcImZ1bmN0aW9uXCIpIGNvbnRpbnVlO1xuICAgIGV4cG9ydHNbbmFtZV0gPSBmdW5jdGlvbiBjaGF0Z3B0UGx1c1BsdXNTcGFya2xlV3JhcHBlcih0aGlzOiB1bmtub3duLCAuLi5hcmdzOiB1bmtub3duW10pIHtcbiAgICAgIHByZXBhcmVTaWduZWRDb2RleEZvclNwYXJrbGVJbnN0YWxsKCk7XG4gICAgICByZXR1cm4gUmVmbGVjdC5hcHBseShmbiwgdGhpcywgYXJncyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChleHBvcnRzLmRlZmF1bHQgJiYgZXhwb3J0cy5kZWZhdWx0ICE9PSBleHBvcnRzKSB7XG4gICAgd3JhcFNwYXJrbGVFeHBvcnRzKGV4cG9ydHMuZGVmYXVsdCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJlcGFyZVNpZ25lZENvZGV4Rm9yU3BhcmtsZUluc3RhbGwoKTogdm9pZCB7XG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSBcImRhcndpblwiKSByZXR1cm47XG4gIGlmIChleGlzdHNTeW5jKFVQREFURV9NT0RFX0ZJTEUpKSB7XG4gICAgbG9nKFwiaW5mb1wiLCBcIlNwYXJrbGUgdXBkYXRlIHByZXAgc2tpcHBlZDsgdXBkYXRlIG1vZGUgYWxyZWFkeSBhY3RpdmVcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghZXhpc3RzU3luYyhTSUdORURfQ09ERVhfQkFDS1VQKSkge1xuICAgIGxvZyhcIndhcm5cIiwgXCJTcGFya2xlIHVwZGF0ZSBwcmVwIHNraXBwZWQ7IHNpZ25lZCBDb2RleC5hcHAgYmFja3VwIGlzIG1pc3NpbmdcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghaXNEZXZlbG9wZXJJZFNpZ25lZEFwcChTSUdORURfQ09ERVhfQkFDS1VQKSkge1xuICAgIGxvZyhcIndhcm5cIiwgXCJTcGFya2xlIHVwZGF0ZSBwcmVwIHNraXBwZWQ7IENvZGV4LmFwcCBiYWNrdXAgaXMgbm90IERldmVsb3BlciBJRCBzaWduZWRcIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgc3RhdGUgPSByZWFkSW5zdGFsbGVyU3RhdGUoKTtcbiAgY29uc3QgYXBwUm9vdCA9IHN0YXRlPy5hcHBSb290ID8/IGluZmVyTWFjQXBwUm9vdCgpO1xuICBpZiAoIWFwcFJvb3QpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwiU3BhcmtsZSB1cGRhdGUgcHJlcCBza2lwcGVkOyBjb3VsZCBub3QgaW5mZXIgQ29kZXguYXBwIHBhdGhcIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbW9kZSA9IHtcbiAgICBlbmFibGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBhcHBSb290LFxuICAgIGNvZGV4VmVyc2lvbjogc3RhdGU/LmNvZGV4VmVyc2lvbiA/PyBudWxsLFxuICB9O1xuICB3cml0ZUZpbGVTeW5jKFVQREFURV9NT0RFX0ZJTEUsIEpTT04uc3RyaW5naWZ5KG1vZGUsIG51bGwsIDIpKTtcblxuICB0cnkge1xuICAgIGV4ZWNGaWxlU3luYyhcImRpdHRvXCIsIFtTSUdORURfQ09ERVhfQkFDS1VQLCBhcHBSb290XSwgeyBzdGRpbzogXCJpZ25vcmVcIiB9KTtcbiAgICB0cnkge1xuICAgICAgZXhlY0ZpbGVTeW5jKFwieGF0dHJcIiwgW1wiLWRyXCIsIFwiY29tLmFwcGxlLnF1YXJhbnRpbmVcIiwgYXBwUm9vdF0sIHsgc3RkaW86IFwiaWdub3JlXCIgfSk7XG4gICAgfSBjYXRjaCB7fVxuICAgIGxvZyhcImluZm9cIiwgXCJSZXN0b3JlZCBzaWduZWQgQ29kZXguYXBwIGJlZm9yZSBTcGFya2xlIGluc3RhbGxcIiwgeyBhcHBSb290IH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgbG9nKFwiZXJyb3JcIiwgXCJGYWlsZWQgdG8gcmVzdG9yZSBzaWduZWQgQ29kZXguYXBwIGJlZm9yZSBTcGFya2xlIGluc3RhbGxcIiwge1xuICAgICAgbWVzc2FnZTogKGUgYXMgRXJyb3IpLm1lc3NhZ2UsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNEZXZlbG9wZXJJZFNpZ25lZEFwcChhcHBSb290OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgcmVzdWx0ID0gc3Bhd25TeW5jKFwiY29kZXNpZ25cIiwgW1wiLWR2XCIsIFwiLS12ZXJib3NlPTRcIiwgYXBwUm9vdF0sIHtcbiAgICBlbmNvZGluZzogXCJ1dGY4XCIsXG4gICAgc3RkaW86IFtcImlnbm9yZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICB9KTtcbiAgY29uc3Qgb3V0cHV0ID0gYCR7cmVzdWx0LnN0ZG91dCA/PyBcIlwifSR7cmVzdWx0LnN0ZGVyciA/PyBcIlwifWA7XG4gIHJldHVybiAoXG4gICAgcmVzdWx0LnN0YXR1cyA9PT0gMCAmJlxuICAgIC9BdXRob3JpdHk9RGV2ZWxvcGVyIElEIEFwcGxpY2F0aW9uOi8udGVzdChvdXRwdXQpICYmXG4gICAgIS9TaWduYXR1cmU9YWRob2MvLnRlc3Qob3V0cHV0KSAmJlxuICAgICEvVGVhbUlkZW50aWZpZXI9bm90IHNldC8udGVzdChvdXRwdXQpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGluZmVyTWFjQXBwUm9vdCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbWFya2VyID0gXCIuYXBwL0NvbnRlbnRzL01hY09TL1wiO1xuICBjb25zdCBpZHggPSBwcm9jZXNzLmV4ZWNQYXRoLmluZGV4T2YobWFya2VyKTtcbiAgcmV0dXJuIGlkeCA+PSAwID8gcHJvY2Vzcy5leGVjUGF0aC5zbGljZSgwLCBpZHggKyBcIi5hcHBcIi5sZW5ndGgpIDogbnVsbDtcbn1cblxuLy8gU3VyZmFjZSB1bmhhbmRsZWQgZXJyb3JzIGZyb20gYW55d2hlcmUgaW4gdGhlIG1haW4gcHJvY2VzcyB0byBvdXIgbG9nLlxucHJvY2Vzcy5vbihcInVuY2F1Z2h0RXhjZXB0aW9uXCIsIChlOiBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9KSA9PiB7XG4gIGxvZyhcImVycm9yXCIsIFwidW5jYXVnaHRFeGNlcHRpb25cIiwgeyBjb2RlOiBlLmNvZGUsIG1lc3NhZ2U6IGUubWVzc2FnZSwgc3RhY2s6IGUuc3RhY2sgfSk7XG59KTtcbnByb2Nlc3Mub24oXCJ1bmhhbmRsZWRSZWplY3Rpb25cIiwgKGUpID0+IHtcbiAgbG9nKFwiZXJyb3JcIiwgXCJ1bmhhbmRsZWRSZWplY3Rpb25cIiwgeyB2YWx1ZTogU3RyaW5nKGUpIH0pO1xufSk7XG5cbmluc3RhbGxTcGFya2xlVXBkYXRlSG9vaygpO1xuXG5pbnRlcmZhY2UgTG9hZGVkTWFpblR3ZWFrIHtcbiAgc3RvcD86ICgpID0+IHZvaWQ7XG4gIHN0b3JhZ2U6IERpc2tTdG9yYWdlO1xufVxuXG5pbnRlcmZhY2UgQ29kZXhXaW5kb3dTZXJ2aWNlcyB7XG4gIGNyZWF0ZUZyZXNoV2luZG93PzogKHJvdXRlPzogc3RyaW5nKSA9PiBQcm9taXNlPEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsPjtcbiAgY3JlYXRlRnJlc2hMb2NhbFdpbmRvdz86IChyb3V0ZT86IHN0cmluZykgPT4gUHJvbWlzZTxFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbD47XG4gIGVuc3VyZUhvc3RXaW5kb3c/OiAoaG9zdElkPzogc3RyaW5nKSA9PiBQcm9taXNlPEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsPjtcbiAgZ2V0UHJpbWFyeVdpbmRvdz86IChob3N0SWQ/OiBzdHJpbmcpID0+IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsO1xuICBnZXRDb250ZXh0PzogKGhvc3RJZDogc3RyaW5nKSA9PiB7IHJlZ2lzdGVyV2luZG93PzogKHdpbmRvd0xpa2U6IENvZGV4V2luZG93TGlrZSkgPT4gdm9pZCB9IHwgbnVsbDtcbiAgd2luZG93TWFuYWdlcj86IHtcbiAgICBjcmVhdGVXaW5kb3c/OiAob3B0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IFByb21pc2U8RWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGw+O1xuICAgIGdldFByaW1hcnlXaW5kb3c/OiAoKSA9PiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbDtcbiAgICByZWdpc3RlcldpbmRvdz86IChcbiAgICAgIHdpbmRvd0xpa2U6IENvZGV4V2luZG93TGlrZSxcbiAgICAgIGhvc3RJZDogc3RyaW5nLFxuICAgICAgcHJpbWFyeTogYm9vbGVhbixcbiAgICAgIGFwcGVhcmFuY2U6IHN0cmluZyxcbiAgICApID0+IHZvaWQ7XG4gICAgb3B0aW9ucz86IHtcbiAgICAgIGFsbG93RGV2dG9vbHM/OiBib29sZWFuO1xuICAgICAgcHJlbG9hZFBhdGg/OiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbn1cblxuaW50ZXJmYWNlIENvZGV4V2luZG93TGlrZSB7XG4gIGlkOiBudW1iZXI7XG4gIHdlYkNvbnRlbnRzOiBFbGVjdHJvbi5XZWJDb250ZW50cztcbiAgb24oZXZlbnQ6IFwiY2xvc2VkXCIsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdW5rbm93bjtcbiAgb25jZT8oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpOiB1bmtub3duO1xuICBvZmY/KGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKTogdW5rbm93bjtcbiAgcmVtb3ZlTGlzdGVuZXI/KGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKTogdW5rbm93bjtcbiAgaXNEZXN0cm95ZWQ/KCk6IGJvb2xlYW47XG4gIGlzRm9jdXNlZD8oKTogYm9vbGVhbjtcbiAgZm9jdXM/KCk6IHZvaWQ7XG4gIHNob3c/KCk6IHZvaWQ7XG4gIGhpZGU/KCk6IHZvaWQ7XG4gIGdldEJvdW5kcz8oKTogRWxlY3Ryb24uUmVjdGFuZ2xlO1xuICBnZXRDb250ZW50Qm91bmRzPygpOiBFbGVjdHJvbi5SZWN0YW5nbGU7XG4gIGdldFNpemU/KCk6IFtudW1iZXIsIG51bWJlcl07XG4gIGdldENvbnRlbnRTaXplPygpOiBbbnVtYmVyLCBudW1iZXJdO1xuICBzZXRUaXRsZT8odGl0bGU6IHN0cmluZyk6IHZvaWQ7XG4gIGdldFRpdGxlPygpOiBzdHJpbmc7XG4gIHNldFJlcHJlc2VudGVkRmlsZW5hbWU/KGZpbGVuYW1lOiBzdHJpbmcpOiB2b2lkO1xuICBzZXREb2N1bWVudEVkaXRlZD8oZWRpdGVkOiBib29sZWFuKTogdm9pZDtcbiAgc2V0V2luZG93QnV0dG9uVmlzaWJpbGl0eT8odmlzaWJsZTogYm9vbGVhbik6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBDb2RleENyZWF0ZVdpbmRvd09wdGlvbnMge1xuICByb3V0ZTogc3RyaW5nO1xuICBob3N0SWQ/OiBzdHJpbmc7XG4gIHNob3c/OiBib29sZWFuO1xuICBhcHBlYXJhbmNlPzogc3RyaW5nO1xuICBwYXJlbnRXaW5kb3dJZD86IG51bWJlcjtcbiAgYm91bmRzPzogRWxlY3Ryb24uUmVjdGFuZ2xlO1xufVxuXG5pbnRlcmZhY2UgQ29kZXhDcmVhdGVWaWV3T3B0aW9ucyB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIGhvc3RJZD86IHN0cmluZztcbiAgYXBwZWFyYW5jZT86IHN0cmluZztcbn1cblxudHlwZSBPd2xWaWV3QXR0YWNoTW9kZSA9IFwiY29udGVudFZpZXdcIiB8IFwiYnJvd3NlclZpZXdcIjtcblxuaW50ZXJmYWNlIE1hbmFnZWRPd2xWaWV3IHtcbiAga2V5OiBzdHJpbmc7XG4gIHR3ZWFrSWQ6IHN0cmluZztcbiAgaWQ6IHN0cmluZztcbiAgdmlldzogRWxlY3Ryb24uQnJvd3NlclZpZXc7XG4gIHBhcmVudFdpbmRvd0lkOiBudW1iZXIgfCBudWxsO1xuICBhdHRhY2hNb2RlOiBPd2xWaWV3QXR0YWNoTW9kZSB8IG51bGw7XG4gIGRpc3Bvc2VCaW5kaW5nczogQXJyYXk8KCkgPT4gdm9pZD47XG4gIGRpc3Bvc2VkOiBib29sZWFuO1xufVxuXG5jb25zdCB0d2Vha1N0YXRlID0ge1xuICBkaXNjb3ZlcmVkOiBbXSBhcyBEaXNjb3ZlcmVkVHdlYWtbXSxcbiAgbG9hZGVkTWFpbjogbmV3IE1hcDxzdHJpbmcsIExvYWRlZE1haW5Ud2Vhaz4oKSxcbn07XG5cbmNvbnN0IG5hdGl2ZUJyaWRnZSA9IG5ldyBOYXRpdmVCcmlkZ2UobG9nLCB7XG4gIG5hdGl2ZUhvc3RQYXRoOiBqb2luKHJ1bnRpbWVEaXIsIFwibmF0aXZlXCIsIFwiY29kZXhwcF9uYXRpdmVfaG9zdC5ub2RlXCIpLFxufSk7XG5jb25zdCBvd2xWaWV3cyA9IG5ldyBNYXA8c3RyaW5nLCBNYW5hZ2VkT3dsVmlldz4oKTtcblxuY29uc3QgdHdlYWtMaWZlY3ljbGVEZXBzID0ge1xuICBsb2dJbmZvOiAobWVzc2FnZTogc3RyaW5nKSA9PiBsb2coXCJpbmZvXCIsIG1lc3NhZ2UpLFxuICBzZXRUd2Vha0VuYWJsZWQsXG4gIHN0b3BBbGxNYWluVHdlYWtzLFxuICBjbGVhclR3ZWFrTW9kdWxlQ2FjaGUsXG4gIGxvYWRBbGxNYWluVHdlYWtzLFxuICBicm9hZGNhc3RSZWxvYWQsXG59O1xuXG4vLyAxLiBIb29rIGV2ZXJ5IHNlc3Npb24gc28gb3VyIHByZWxvYWQgcnVucyBpbiBldmVyeSByZW5kZXJlci5cbi8vXG4vLyBXZSB1c2UgRWxlY3Ryb24ncyBtb2Rlcm4gYHNlc3Npb24ucmVnaXN0ZXJQcmVsb2FkU2NyaXB0YCBBUEkgKGFkZGVkIGluXG4vLyBFbGVjdHJvbiAzNSkuIFRoZSBkZXByZWNhdGVkIGBzZXRQcmVsb2Fkc2AgcGF0aCBzaWxlbnRseSBuby1vcHMgaW4gc29tZVxuLy8gY29uZmlndXJhdGlvbnMgKG5vdGFibHkgd2l0aCBzYW5kYm94ZWQgcmVuZGVyZXJzKSwgc28gcmVnaXN0ZXJQcmVsb2FkU2NyaXB0XG4vLyBpcyB0aGUgb25seSByZWxpYWJsZSB3YXkgdG8gaW5qZWN0IGludG8gQ29kZXgncyBCcm93c2VyV2luZG93cy5cbmZ1bmN0aW9uIHJlZ2lzdGVyUHJlbG9hZChzOiBFbGVjdHJvbi5TZXNzaW9uLCBsYWJlbDogc3RyaW5nKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVnID0gKHMgYXMgdW5rbm93biBhcyB7XG4gICAgICByZWdpc3RlclByZWxvYWRTY3JpcHQ/OiAob3B0czoge1xuICAgICAgICB0eXBlPzogXCJmcmFtZVwiIHwgXCJzZXJ2aWNlLXdvcmtlclwiO1xuICAgICAgICBpZD86IHN0cmluZztcbiAgICAgICAgZmlsZVBhdGg6IHN0cmluZztcbiAgICAgIH0pID0+IHN0cmluZztcbiAgICB9KS5yZWdpc3RlclByZWxvYWRTY3JpcHQ7XG4gICAgaWYgKHR5cGVvZiByZWcgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmVnLmNhbGwocywgeyB0eXBlOiBcImZyYW1lXCIsIGZpbGVQYXRoOiBQUkVMT0FEX1BBVEgsIGlkOiBcImNoYXRncHQtcGx1c3BsdXNcIiB9KTtcbiAgICAgIGxvZyhcImluZm9cIiwgYHByZWxvYWQgcmVnaXN0ZXJlZCAocmVnaXN0ZXJQcmVsb2FkU2NyaXB0KSBvbiAke2xhYmVsfTpgLCBQUkVMT0FEX1BBVEgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBGYWxsYmFjayBmb3Igb2xkZXIgRWxlY3Ryb24gdmVyc2lvbnMuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBzLmdldFByZWxvYWRzKCk7XG4gICAgaWYgKCFleGlzdGluZy5pbmNsdWRlcyhQUkVMT0FEX1BBVEgpKSB7XG4gICAgICBzLnNldFByZWxvYWRzKFsuLi5leGlzdGluZywgUFJFTE9BRF9QQVRIXSk7XG4gICAgfVxuICAgIGxvZyhcImluZm9cIiwgYHByZWxvYWQgcmVnaXN0ZXJlZCAoc2V0UHJlbG9hZHMpIG9uICR7bGFiZWx9OmAsIFBSRUxPQURfUEFUSCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIGUubWVzc2FnZS5pbmNsdWRlcyhcImV4aXN0aW5nIElEXCIpKSB7XG4gICAgICBsb2coXCJpbmZvXCIsIGBwcmVsb2FkIGFscmVhZHkgcmVnaXN0ZXJlZCBvbiAke2xhYmVsfTpgLCBQUkVMT0FEX1BBVEgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2coXCJlcnJvclwiLCBgcHJlbG9hZCByZWdpc3RyYXRpb24gb24gJHtsYWJlbH0gZmFpbGVkOmAsIGUpO1xuICB9XG59XG5cbmFwcC53aGVuUmVhZHkoKS50aGVuKCgpID0+IHtcbiAgbG9nKFwiaW5mb1wiLCBcImFwcCByZWFkeSBmaXJlZFwiKTtcbiAgaWYgKGlzQ2hhdGdwdFBsdXNQbHVzU2FmZU1vZGVFbmFibGVkKCkpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwic2FmZSBtb2RlIGlzIGVuYWJsZWQ7IHByZWxvYWQgd2lsbCBub3QgYmUgcmVnaXN0ZXJlZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVnaXN0ZXJQcmVsb2FkKHNlc3Npb24uZGVmYXVsdFNlc3Npb24sIFwiZGVmYXVsdFNlc3Npb25cIik7XG4gIG1heWJlU3RhcnRCcm93c2VyVWlTZXJ2ZXIoe1xuICAgIGdldFdpbmRvd1NlcnZpY2VzOiBnZXRDb2RleFdpbmRvd1NlcnZpY2VzLFxuICAgIGxvZyxcbiAgfSk7XG59KTtcblxuYXBwLm9uKFwic2Vzc2lvbi1jcmVhdGVkXCIsIChzKSA9PiB7XG4gIGlmIChpc0NoYXRncHRQbHVzUGx1c1NhZmVNb2RlRW5hYmxlZCgpKSByZXR1cm47XG4gIHJlZ2lzdGVyUHJlbG9hZChzLCBcInNlc3Npb24tY3JlYXRlZFwiKTtcbn0pO1xuXG4vLyBESUFHTk9TVElDOiBsb2cgZXZlcnkgd2ViQ29udGVudHMgY3JlYXRpb24uIFVzZWZ1bCBmb3IgdmVyaWZ5aW5nIG91clxuLy8gcHJlbG9hZCByZWFjaGVzIGV2ZXJ5IHJlbmRlcmVyIENvZGV4IHNwYXducy5cbmFwcC5vbihcIndlYi1jb250ZW50cy1jcmVhdGVkXCIsIChfZSwgd2MpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB3cCA9ICh3YyBhcyB1bmtub3duIGFzIHsgZ2V0TGFzdFdlYlByZWZlcmVuY2VzPzogKCkgPT4gUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfSlcbiAgICAgIC5nZXRMYXN0V2ViUHJlZmVyZW5jZXM/LigpO1xuICAgIGxvZyhcImluZm9cIiwgXCJ3ZWItY29udGVudHMtY3JlYXRlZFwiLCB7XG4gICAgICBpZDogd2MuaWQsXG4gICAgICB0eXBlOiB3Yy5nZXRUeXBlKCksXG4gICAgICBzZXNzaW9uSXNEZWZhdWx0OiB3Yy5zZXNzaW9uID09PSBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLFxuICAgICAgc2FuZGJveDogd3A/LnNhbmRib3gsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiB3cD8uY29udGV4dElzb2xhdGlvbixcbiAgICB9KTtcbiAgICB3Yy5vbihcInByZWxvYWQtZXJyb3JcIiwgKF9ldiwgcCwgZXJyKSA9PiB7XG4gICAgICBsb2coXCJlcnJvclwiLCBgd2MgJHt3Yy5pZH0gcHJlbG9hZC1lcnJvciBwYXRoPSR7cH1gLCBTdHJpbmcoZXJyPy5zdGFjayA/PyBlcnIpKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGxvZyhcImVycm9yXCIsIFwid2ViLWNvbnRlbnRzLWNyZWF0ZWQgaGFuZGxlciBmYWlsZWQ6XCIsIFN0cmluZygoZSBhcyBFcnJvcik/LnN0YWNrID8/IGUpKTtcbiAgfVxufSk7XG5cbmxvZyhcImluZm9cIiwgXCJtYWluLnRzIGV2YWx1YXRlZDsgYXBwLmlzUmVhZHk9XCIgKyBhcHAuaXNSZWFkeSgpKTtcbmlmIChpc0NoYXRncHRQbHVzUGx1c1NhZmVNb2RlRW5hYmxlZCgpKSB7XG4gIGxvZyhcIndhcm5cIiwgXCJzYWZlIG1vZGUgaXMgZW5hYmxlZDsgdHdlYWtzIHdpbGwgbm90IGJlIGxvYWRlZFwiKTtcbn1cblxuLy8gMi4gSW5pdGlhbCB0d2VhayBkaXNjb3ZlcnkgKyBtYWluLXNjb3BlIGxvYWQuXG5sb2FkQWxsTWFpblR3ZWFrcygpO1xuXG5hcHAub24oXCJ3aWxsLXF1aXRcIiwgKCkgPT4ge1xuICBzdG9wQWxsTWFpblR3ZWFrcygpO1xuICBuYXRpdmVCcmlkZ2UuZGlzcG9zZUFsbCgpO1xuICBkaXNwb3NlQWxsT3dsVmlld3MoKTtcbiAgLy8gQmVzdC1lZmZvcnQgZmx1c2ggb2YgYW55IHBlbmRpbmcgc3RvcmFnZSB3cml0ZXMuXG4gIGZvciAoY29uc3QgdCBvZiB0d2Vha1N0YXRlLmxvYWRlZE1haW4udmFsdWVzKCkpIHtcbiAgICB0cnkge1xuICAgICAgdC5zdG9yYWdlLmZsdXNoKCk7XG4gICAgfSBjYXRjaCB7fVxuICB9XG59KTtcblxuLy8gMy4gSVBDOiBleHBvc2UgdHdlYWsgbWV0YWRhdGEgKyByZXZlYWwtaW4tZmluZGVyLlxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmxpc3QtdHdlYWtzXCIsIGFzeW5jICgpID0+IHtcbiAgYXdhaXQgUHJvbWlzZS5hbGwodHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLm1hcCgodCkgPT4gZW5zdXJlVHdlYWtVcGRhdGVDaGVjayh0KSkpO1xuICBjb25zdCB1cGRhdGVDaGVja3MgPSByZWFkU3RhdGUoKS50d2Vha1VwZGF0ZUNoZWNrcyA/PyB7fTtcbiAgcmV0dXJuIHR3ZWFrU3RhdGUuZGlzY292ZXJlZC5tYXAoKHQpID0+ICh7XG4gICAgbWFuaWZlc3Q6IHQubWFuaWZlc3QsXG4gICAgZW50cnk6IHQuZW50cnksXG4gICAgZGlyOiB0LmRpcixcbiAgICBlbnRyeUV4aXN0czogZXhpc3RzU3luYyh0LmVudHJ5KSxcbiAgICBlbmFibGVkOiBpc1R3ZWFrRW5hYmxlZCh0Lm1hbmlmZXN0LmlkKSxcbiAgICB1cGRhdGU6IHVwZGF0ZUNoZWNrc1t0Lm1hbmlmZXN0LmlkXSA/PyBudWxsLFxuICB9KSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmdldC10d2Vhay1lbmFibGVkXCIsIChfZSwgaWQ6IHN0cmluZykgPT4gaXNUd2Vha0VuYWJsZWQoaWQpKTtcbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpzZXQtdHdlYWstZW5hYmxlZFwiLCAoX2UsIGlkOiBzdHJpbmcsIGVuYWJsZWQ6IGJvb2xlYW4pID0+IHtcbiAgcmV0dXJuIHNldFR3ZWFrRW5hYmxlZEFuZFJlbG9hZChpZCwgZW5hYmxlZCwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbn0pO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6Z2V0LWNvbmZpZ1wiLCAoKSA9PiB7XG4gIGNvbnN0IHMgPSByZWFkU3RhdGUoKTtcbiAgY29uc3QgaW5zdGFsbGVyU3RhdGUgPSByZWFkSW5zdGFsbGVyU3RhdGUoKTtcbiAgY29uc3Qgc291cmNlUm9vdCA9IGluc3RhbGxlclN0YXRlPy5zb3VyY2VSb290ID8/IGZhbGxiYWNrU291cmNlUm9vdCgpO1xuICByZXR1cm4ge1xuICAgIHZlcnNpb246IENIQVRHUFRfUExVU1BMVVNfVkVSU0lPTixcbiAgICBhdXRvVXBkYXRlOiBzLmNoYXRncHRQbHVzUGx1cz8uYXV0b1VwZGF0ZSAhPT0gZmFsc2UsXG4gICAgc2FmZU1vZGU6IHMuY2hhdGdwdFBsdXNQbHVzPy5zYWZlTW9kZSA9PT0gdHJ1ZSxcbiAgICB1cGRhdGVDaGFubmVsOiBzLmNoYXRncHRQbHVzUGx1cz8udXBkYXRlQ2hhbm5lbCA/PyBcInN0YWJsZVwiLFxuICAgIHVwZGF0ZVJlcG86IHMuY2hhdGdwdFBsdXNQbHVzPy51cGRhdGVSZXBvID8/IENIQVRHUFRfUExVU1BMVVNfUkVQTyxcbiAgICB1cGRhdGVSZWY6IHMuY2hhdGdwdFBsdXNQbHVzPy51cGRhdGVSZWYgPz8gXCJcIixcbiAgICB1cGRhdGVDaGVjazogcy5jaGF0Z3B0UGx1c1BsdXM/LnVwZGF0ZUNoZWNrID8/IG51bGwsXG4gICAgc2VsZlVwZGF0ZTogcmVhZFNlbGZVcGRhdGVTdGF0ZSgpLFxuICAgIGluc3RhbGxhdGlvblNvdXJjZTogZGVzY3JpYmVJbnN0YWxsYXRpb25Tb3VyY2Uoc291cmNlUm9vdCksXG4gIH07XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnNldC1hdXRvLXVwZGF0ZVwiLCAoX2UsIGVuYWJsZWQ6IGJvb2xlYW4pID0+IHtcbiAgc2V0Q2hhdGdwdFBsdXNQbHVzQXV0b1VwZGF0ZSghIWVuYWJsZWQpO1xuICByZXR1cm4geyBhdXRvVXBkYXRlOiBpc0NoYXRncHRQbHVzUGx1c0F1dG9VcGRhdGVFbmFibGVkKCkgfTtcbn0pO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6c2V0LXVwZGF0ZS1jb25maWdcIiwgKF9lLCBjb25maWc6IHtcbiAgdXBkYXRlQ2hhbm5lbD86IFNlbGZVcGRhdGVDaGFubmVsO1xuICB1cGRhdGVSZXBvPzogc3RyaW5nO1xuICB1cGRhdGVSZWY/OiBzdHJpbmc7XG59KSA9PiB7XG4gIHNldENoYXRncHRQbHVzUGx1c1VwZGF0ZUNvbmZpZyhjb25maWcpO1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHJldHVybiB7XG4gICAgdXBkYXRlQ2hhbm5lbDogcy5jaGF0Z3B0UGx1c1BsdXM/LnVwZGF0ZUNoYW5uZWwgPz8gXCJzdGFibGVcIixcbiAgICB1cGRhdGVSZXBvOiBzLmNoYXRncHRQbHVzUGx1cz8udXBkYXRlUmVwbyA/PyBDSEFUR1BUX1BMVVNQTFVTX1JFUE8sXG4gICAgdXBkYXRlUmVmOiBzLmNoYXRncHRQbHVzUGx1cz8udXBkYXRlUmVmID8/IFwiXCIsXG4gIH07XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNoZWNrLWNvZGV4cHAtdXBkYXRlXCIsIGFzeW5jIChfZSwgZm9yY2U/OiBib29sZWFuKSA9PiB7XG4gIHJldHVybiBlbnN1cmVDaGF0Z3B0UGx1c1BsdXNVcGRhdGVDaGVjayhmb3JjZSA9PT0gdHJ1ZSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJ1bi1jb2RleHBwLXVwZGF0ZVwiLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IHNvdXJjZVJvb3QgPSByZWFkSW5zdGFsbGVyU3RhdGUoKT8uc291cmNlUm9vdCA/PyBmYWxsYmFja1NvdXJjZVJvb3QoKTtcbiAgaWYgKCFzb3VyY2VSb290KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2hhdEdQVCsrIHNvdXJjZSBDTEkgd2FzIG5vdCBmb3VuZC4gUnVuIHRoZSBpbnN0YWxsZXIgb25jZSwgdGhlbiB0cnkgYWdhaW4uXCIpO1xuICB9XG4gIC8vIFx1NzJFQ1x1N0FDQlx1NUI4OVx1ODhDNVx1NTMwNVx1RkYwOGRtZy9leGVcdUZGMDlcdUZGMUFcdTZFOTBcdTc4MDEgQ0xJIFx1NEUwRFx1NUI1OFx1NTcyOFx1RkYwQ1x1NjZGNFx1NjVCMFx1NjVCOVx1NUYwRlx1NEUzQVx1NEUwQlx1OEY3RFx1NjVCMFx1NzI0OFx1NUI4OVx1ODhDNVx1NTMwNVx1RkYwQ1x1NzZGNFx1NjNBNVx1NjI1M1x1NUYwMCBHaXRIdWIgUmVsZWFzZXNcbiAgaWYgKGV4aXN0c1N5bmMoam9pbihzb3VyY2VSb290LCBcInN0YW5kYWxvbmUuanNvblwiKSkpIHtcbiAgICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gICAgY29uc3QgcmVsZWFzZVVybCA9IHMuY2hhdGdwdFBsdXNQbHVzPy51cGRhdGVDaGVjaz8ucmVsZWFzZVVybCA/PyBgaHR0cHM6Ly9naXRodWIuY29tLyR7Q0hBVEdQVF9QTFVTUExVU19SRVBPfS9yZWxlYXNlc2A7XG4gICAgc2hlbGwub3BlbkV4dGVybmFsKHJlbGVhc2VVcmwpLmNhdGNoKCgpID0+IHt9KTtcbiAgICByZXR1cm4geyBzdGFuZGFsb25lOiB0cnVlLCByZWxlYXNlVXJsIH07XG4gIH1cbiAgY29uc3QgY2xpID0gam9pbihzb3VyY2VSb290LCBcInBhY2thZ2VzXCIsIFwiaW5zdGFsbGVyXCIsIFwiZGlzdFwiLCBcImNsaS5qc1wiKTtcbiAgaWYgKCFleGlzdHNTeW5jKGNsaSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDaGF0R1BUKysgc291cmNlIENMSSB3YXMgbm90IGZvdW5kLiBSdW4gdGhlIGluc3RhbGxlciBvbmNlLCB0aGVuIHRyeSBhZ2Fpbi5cIik7XG4gIH1cbiAgY29uc3QgcGVuZGluZyA9IG1hcmtTZWxmVXBkYXRlU3RhcnRlZChzb3VyY2VSb290KTtcbiAgc3RhcnRJbnN0YWxsZWRDbGkoY2xpLCBbXCJ1cGRhdGVcIiwgXCItLXdhdGNoZXJcIl0pO1xuICByZXR1cm4gcGVuZGluZztcbn0pO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6Z2V0LXdhdGNoZXItaGVhbHRoXCIsICgpID0+IGdldFdhdGNoZXJIZWFsdGgodXNlclJvb3QhKSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpnZXQtdHdlYWstc3RvcmVcIiwgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBzdG9yZSA9IGF3YWl0IGZldGNoVHdlYWtTdG9yZVJlZ2lzdHJ5KCk7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gc3RvcmUucmVnaXN0cnk7XG4gIGNvbnN0IGluc3RhbGxlZCA9IG5ldyBNYXAodHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLm1hcCgodCkgPT4gW3QubWFuaWZlc3QuaWQsIHRdKSk7XG4gIGNvbnN0IGVudHJpZXMgPSBzaHVmZmxlU3RvcmVFbnRyaWVzKHJlZ2lzdHJ5LmVudHJpZXMsIHJhbmRvbUludCk7XG4gIHJldHVybiB7XG4gICAgLi4ucmVnaXN0cnksXG4gICAgc291cmNlVXJsOiBUV0VBS19TVE9SRV9JTkRFWF9VUkwsXG4gICAgZmV0Y2hlZEF0OiBzdG9yZS5mZXRjaGVkQXQsXG4gICAgZW50cmllczogZW50cmllcy5tYXAoKGVudHJ5KSA9PiB7XG4gICAgICBjb25zdCBsb2NhbCA9IGluc3RhbGxlZC5nZXQoZW50cnkuaWQpO1xuICAgICAgY29uc3QgcGxhdGZvcm0gPSBzdG9yZUVudHJ5UGxhdGZvcm1Db21wYXRpYmlsaXR5KGVudHJ5KTtcbiAgICAgIGNvbnN0IHJ1bnRpbWUgPSBzdG9yZUVudHJ5UnVudGltZUNvbXBhdGliaWxpdHkoZW50cnkpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uZW50cnksXG4gICAgICAgIHBsYXRmb3JtLFxuICAgICAgICBydW50aW1lLFxuICAgICAgICBpbnN0YWxsZWQ6IGxvY2FsXG4gICAgICAgICAgPyB7XG4gICAgICAgICAgICAgIHZlcnNpb246IGxvY2FsLm1hbmlmZXN0LnZlcnNpb24sXG4gICAgICAgICAgICAgIGVuYWJsZWQ6IGlzVHdlYWtFbmFibGVkKGxvY2FsLm1hbmlmZXN0LmlkKSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICA6IG51bGwsXG4gICAgICB9O1xuICAgIH0pLFxuICB9O1xufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDppbnN0YWxsLXN0b3JlLXR3ZWFrXCIsIGFzeW5jIChfZSwgaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IHJlZ2lzdHJ5IH0gPSBhd2FpdCBmZXRjaFR3ZWFrU3RvcmVSZWdpc3RyeSgpO1xuICBjb25zdCBlbnRyeSA9IHJlZ2lzdHJ5LmVudHJpZXMuZmluZCgoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUuaWQgPT09IGlkKTtcbiAgaWYgKCFlbnRyeSkgdGhyb3cgbmV3IEVycm9yKGBUd2VhayBzdG9yZSBlbnRyeSBub3QgZm91bmQ6ICR7aWR9YCk7XG4gIGFzc2VydFN0b3JlRW50cnlQbGF0Zm9ybUNvbXBhdGlibGUoZW50cnkpO1xuICBhc3NlcnRTdG9yZUVudHJ5UnVudGltZUNvbXBhdGlibGUoZW50cnkpO1xuICBhd2FpdCBpbnN0YWxsU3RvcmVUd2VhayhlbnRyeSk7XG4gIHJlbG9hZFR3ZWFrcyhcInN0b3JlLWluc3RhbGxcIiwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbiAgcmV0dXJuIHsgaW5zdGFsbGVkOiBlbnRyeS5pZCB9O1xufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpwcmVwYXJlLXR3ZWFrLXN0b3JlLXN1Ym1pc3Npb25cIiwgYXN5bmMgKF9lLCByZXBvSW5wdXQ6IHN0cmluZykgPT4ge1xuICByZXR1cm4gcHJlcGFyZVR3ZWFrU3RvcmVTdWJtaXNzaW9uKHJlcG9JbnB1dCk7XG59KTtcblxuLy8gU2FuZGJveGVkIHJlbmRlcmVyIHByZWxvYWQgY2FuJ3QgdXNlIE5vZGUgZnMgdG8gcmVhZCB0d2VhayBzb3VyY2UuIE1haW5cbi8vIHJlYWRzIGl0IG9uIHRoZSByZW5kZXJlcidzIGJlaGFsZi4gUGF0aCBtdXN0IGxpdmUgdW5kZXIgdHdlYWtzRGlyIGZvclxuLy8gc2VjdXJpdHkgXHUyMDE0IHdlIHJlZnVzZSBhbnl0aGluZyBlbHNlLlxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJlYWQtdHdlYWstc291cmNlXCIsIChfZSwgZW50cnlQYXRoOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlKGVudHJ5UGF0aCk7XG4gIGlmICghaXNQYXRoSW5zaWRlKFRXRUFLU19ESVIsIHJlc29sdmVkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInBhdGggb3V0c2lkZSB0d2Vha3MgZGlyXCIpO1xuICB9XG4gIHJldHVybiByZXF1aXJlKFwibm9kZTpmc1wiKS5yZWFkRmlsZVN5bmMocmVzb2x2ZWQsIFwidXRmOFwiKTtcbn0pO1xuXG4vKipcbiAqIFJlYWQgYW4gYXJiaXRyYXJ5IGFzc2V0IGZpbGUgZnJvbSBpbnNpZGUgYSB0d2VhaydzIGRpcmVjdG9yeSBhbmQgcmV0dXJuIGl0XG4gKiBhcyBhIGBkYXRhOmAgVVJMLiBVc2VkIGJ5IHRoZSBzZXR0aW5ncyBpbmplY3RvciB0byByZW5kZXIgbWFuaWZlc3QgaWNvbnNcbiAqICh0aGUgcmVuZGVyZXIgaXMgc2FuZGJveGVkOyBgZmlsZTovL2Agd29uJ3QgbG9hZCkuXG4gKlxuICogU2VjdXJpdHk6IGNhbGxlciBwYXNzZXMgYHR3ZWFrRGlyYCBhbmQgYHJlbFBhdGhgOyB3ZSAoMSkgcmVxdWlyZSB0d2Vha0RpclxuICogdG8gbGl2ZSB1bmRlciBUV0VBS1NfRElSLCAoMikgcmVzb2x2ZSByZWxQYXRoIGFnYWluc3QgaXQgYW5kIHJlLWNoZWNrIHRoZVxuICogcmVzdWx0IHN0aWxsIGxpdmVzIHVuZGVyIFRXRUFLU19ESVIsICgzKSBjYXAgb3V0cHV0IHNpemUgYXQgMSBNaUIuXG4gKi9cbmNvbnN0IEFTU0VUX01BWF9CWVRFUyA9IDEwMjQgKiAxMDI0O1xuY29uc3QgTUlNRV9CWV9FWFQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwiLnBuZ1wiOiBcImltYWdlL3BuZ1wiLFxuICBcIi5qcGdcIjogXCJpbWFnZS9qcGVnXCIsXG4gIFwiLmpwZWdcIjogXCJpbWFnZS9qcGVnXCIsXG4gIFwiLmdpZlwiOiBcImltYWdlL2dpZlwiLFxuICBcIi53ZWJwXCI6IFwiaW1hZ2Uvd2VicFwiLFxuICBcIi5zdmdcIjogXCJpbWFnZS9zdmcreG1sXCIsXG4gIFwiLmljb1wiOiBcImltYWdlL3gtaWNvblwiLFxufTtcbmlwY01haW4uaGFuZGxlKFxuICBcImNvZGV4cHA6cmVhZC10d2Vhay1hc3NldFwiLFxuICAoX2UsIHR3ZWFrRGlyOiBzdHJpbmcsIHJlbFBhdGg6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZzID0gcmVxdWlyZShcIm5vZGU6ZnNcIikgYXMgdHlwZW9mIGltcG9ydChcIm5vZGU6ZnNcIik7XG4gICAgY29uc3QgZGlyID0gcmVzb2x2ZSh0d2Vha0Rpcik7XG4gICAgaWYgKCFpc1BhdGhJbnNpZGUoVFdFQUtTX0RJUiwgZGlyKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwidHdlYWtEaXIgb3V0c2lkZSB0d2Vha3MgZGlyXCIpO1xuICAgIH1cbiAgICBjb25zdCBmdWxsID0gcmVzb2x2ZShkaXIsIHJlbFBhdGgpO1xuICAgIGlmICghaXNQYXRoSW5zaWRlKGRpciwgZnVsbCkgfHwgZnVsbCA9PT0gZGlyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJwYXRoIHRyYXZlcnNhbFwiKTtcbiAgICB9XG4gICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKGZ1bGwpO1xuICAgIGlmIChzdGF0LnNpemUgPiBBU1NFVF9NQVhfQllURVMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXNzZXQgdG9vIGxhcmdlICgke3N0YXQuc2l6ZX0gPiAke0FTU0VUX01BWF9CWVRFU30pYCk7XG4gICAgfVxuICAgIGNvbnN0IGV4dCA9IGZ1bGwuc2xpY2UoZnVsbC5sYXN0SW5kZXhPZihcIi5cIikpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgbWltZSA9IE1JTUVfQllfRVhUW2V4dF0gPz8gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIjtcbiAgICBjb25zdCBidWYgPSBmcy5yZWFkRmlsZVN5bmMoZnVsbCk7XG4gICAgcmV0dXJuIGBkYXRhOiR7bWltZX07YmFzZTY0LCR7YnVmLnRvU3RyaW5nKFwiYmFzZTY0XCIpfWA7XG4gIH0sXG4pO1xuXG4vLyBTYW5kYm94ZWQgcHJlbG9hZCBjYW4ndCB3cml0ZSBsb2dzIHRvIGRpc2s7IGZvcndhcmQgdG8gdXMgdmlhIElQQy5cbmlwY01haW4ub24oXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsIChfZSwgbGV2ZWw6IFwiaW5mb1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCIsIG1zZzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGx2bCA9IGxldmVsID09PSBcImVycm9yXCIgfHwgbGV2ZWwgPT09IFwid2FyblwiID8gbGV2ZWwgOiBcImluZm9cIjtcbiAgdHJ5IHtcbiAgICBhcHBlbmRDYXBwZWRMb2coam9pbihMT0dfRElSLCBcInByZWxvYWQubG9nXCIpLCBgWyR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfV0gWyR7bHZsfV0gJHttc2d9XFxuYCk7XG4gIH0gY2F0Y2gge31cbn0pO1xuXG4vLyBTYW5kYm94LXNhZmUgZmlsZXN5c3RlbSBvcHMgZm9yIHJlbmRlcmVyLXNjb3BlIHR3ZWFrcy4gRWFjaCB0d2VhayBnZXRzXG4vLyBhIHNhbmRib3hlZCBkaXIgdW5kZXIgdXNlclJvb3QvdHdlYWstZGF0YS88aWQ+LiBSZW5kZXJlciBzaWRlIGNhbGxzIHRoZXNlXG4vLyBvdmVyIElQQyBpbnN0ZWFkIG9mIHVzaW5nIE5vZGUgZnMgZGlyZWN0bHkuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6dHdlYWstZnNcIiwgKF9lLCBvcDogc3RyaW5nLCBpZDogc3RyaW5nLCBwOiBzdHJpbmcsIGM/OiBzdHJpbmcpID0+IHtcbiAgaWYgKCEvXlthLXpBLVowLTkuXy1dKyQvLnRlc3QoaWQpKSB0aHJvdyBuZXcgRXJyb3IoXCJiYWQgdHdlYWsgaWRcIik7XG4gIGNvbnN0IGRpciA9IGpvaW4odXNlclJvb3QhLCBcInR3ZWFrLWRhdGFcIiwgaWQpO1xuICBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgY29uc3QgZnVsbCA9IHJlc29sdmUoZGlyLCBwKTtcbiAgaWYgKCFpc1BhdGhJbnNpZGUoZGlyLCBmdWxsKSB8fCBmdWxsID09PSBkaXIpIHRocm93IG5ldyBFcnJvcihcInBhdGggdHJhdmVyc2FsXCIpO1xuICBjb25zdCBmcyA9IHJlcXVpcmUoXCJub2RlOmZzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJub2RlOmZzXCIpO1xuICBzd2l0Y2ggKG9wKSB7XG4gICAgY2FzZSBcInJlYWRcIjogcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhmdWxsLCBcInV0ZjhcIik7XG4gICAgY2FzZSBcIndyaXRlXCI6IHJldHVybiBmcy53cml0ZUZpbGVTeW5jKGZ1bGwsIGMgPz8gXCJcIiwgXCJ1dGY4XCIpO1xuICAgIGNhc2UgXCJleGlzdHNcIjogcmV0dXJuIGZzLmV4aXN0c1N5bmMoZnVsbCk7XG4gICAgY2FzZSBcImRhdGFEaXJcIjogcmV0dXJuIGRpcjtcbiAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gb3A6ICR7b3B9YCk7XG4gIH1cbn0pO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6dXNlci1wYXRoc1wiLCAoKSA9PiAoe1xuICB1c2VyUm9vdCxcbiAgcnVudGltZURpcixcbiAgdHdlYWtzRGlyOiBUV0VBS1NfRElSLFxuICBsb2dEaXI6IExPR19ESVIsXG59KSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpjb2RleC1ydW50aW1lLWluZm9cIiwgKCkgPT4gY3VycmVudFJ1bnRpbWVJbmZvKCkpO1xuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvZGV4LXJ1bnRpbWUtY2FwYWJpbGl0aWVzXCIsICgpID0+IGN1cnJlbnRSdW50aW1lQ2FwYWJpbGl0aWVzKCkpO1xuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvZGV4LWNkcC1zdGF0dXNcIiwgKCkgPT4gZ2V0Q2RwU3RhdHVzKCkpO1xuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvZGV4LWNkcC10YXJnZXRzXCIsICgpID0+IGxpc3RDZHBUYXJnZXRzKCkpO1xuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvZGV4LXdpbmRvdy1jcmVhdGVcIiwgKF9lLCBvcHRzOiBDb2RleENyZWF0ZVdpbmRvd09wdGlvbnMpID0+IHtcbiAgcmV0dXJuIGNyZWF0ZUNvZGV4V2luZG93KG9wdHMpO1xufSk7XG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6Y29kZXgtd2luZG93LXByaW1hcnlcIiwgKCkgPT4gZ2V0UHJpbWFyeUNvZGV4V2luZG93UmVmKCkpO1xuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvZGV4LXdpbmRvdy1mb2N1c1wiLCAoX2UsIHdpbmRvd0lkOiBudW1iZXIpID0+IGZvY3VzQ29kZXhXaW5kb3cod2luZG93SWQpKTtcbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpjb2RleC13aW5kb3ctc2hvd1wiLCAoX2UsIHdpbmRvd0lkOiBudW1iZXIpID0+IHNob3dDb2RleFdpbmRvdyh3aW5kb3dJZCkpO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpjb2RleC12aWV3LWNyZWF0ZVwiLFxuICBhc3luYyAoX2UsIHR3ZWFrSWQ6IHN0cmluZywgb3B0aW9uczogQ29kZXhWaWV3Q3JlYXRlT3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHR3ZWFrID0gYXNzZXJ0VHdlYWtWaWV3UGVybWlzc2lvbkZvcklkKHR3ZWFrSWQpO1xuICAgIGNvbnN0IHJlZiA9IGF3YWl0IGNyZWF0ZU93bFZpZXcoeyBpZDogdHdlYWsubWFuaWZlc3QuaWQsIGRpcjogdHdlYWsuZGlyIH0sIG9wdGlvbnMpO1xuICAgIHJldHVybiB7XG4gICAgICBpZDogcmVmLmlkLFxuICAgICAgd2ViQ29udGVudHNJZDogcmVmLndlYkNvbnRlbnRzSWQsXG4gICAgICBwYXJlbnRXaW5kb3dJZDogcmVmLnBhcmVudFdpbmRvd0lkLFxuICAgIH07XG4gIH0sXG4pO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpjb2RleC12aWV3LWNhbGxcIixcbiAgKF9lLCB0d2Vha0lkOiBzdHJpbmcsIHZpZXdJZDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgYXJnPzogdW5rbm93biwgYXJnMj86IHVua25vd24pID0+IHtcbiAgICBhc3NlcnRUd2Vha1ZpZXdQZXJtaXNzaW9uRm9ySWQodHdlYWtJZCk7XG4gICAgcmV0dXJuIGNhbGxPd2xWaWV3KHR3ZWFrSWQsIHZpZXdJZCwgbWV0aG9kLCBhcmcsIGFyZzIpO1xuICB9LFxuKTtcbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpjb2RleC12aWV3LWRpc3Bvc2UtdHdlYWtcIiwgKF9lLCB0d2Vha0lkOiBzdHJpbmcpID0+IHtcbiAgYXNzZXJ0VHdlYWtJZCh0d2Vha0lkKTtcbiAgZGlzcG9zZU93bFZpZXdzRm9yVHdlYWsodHdlYWtJZCk7XG59KTtcbmlwY01haW4uaGFuZGxlKFxuICBcImNvZGV4cHA6bmF0aXZlLWxvYWQtbW9kdWxlXCIsXG4gIChfZSwgdHdlYWtJZDogc3RyaW5nLCBvcHRpb25zOiBOYXRpdmVNb2R1bGVMb2FkT3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHJlZiA9IG5hdGl2ZUJyaWRnZS5sb2FkTW9kdWxlKHR3ZWFrQ29udGV4dCh0d2Vha0lkLCBcIm5hdGl2ZS1tb2R1bGVcIiksIG9wdGlvbnMpO1xuICAgIHJldHVybiB7IGlkOiByZWYuaWQsIGtpbmQ6IHJlZi5raW5kIH07XG4gIH0sXG4pO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpuYXRpdmUtbW9kdWxlLXJlcXVlc3RcIixcbiAgKF9lLCB0d2Vha0lkOiBzdHJpbmcsIG1vZHVsZUlkOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBwYXlsb2FkPzogdW5rbm93biwgdGltZW91dE1zPzogbnVtYmVyKSA9PiB7XG4gICAgYXNzZXJ0VHdlYWtQZXJtaXNzaW9uRm9ySWQodHdlYWtJZCwgXCJuYXRpdmUtbW9kdWxlXCIpO1xuICAgIHJldHVybiBuYXRpdmVCcmlkZ2UucmVxdWVzdE1vZHVsZSh0d2Vha0lkLCBtb2R1bGVJZCwgbWV0aG9kLCBwYXlsb2FkLCB0aW1lb3V0TXMpO1xuICB9LFxuKTtcbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpuYXRpdmUtbW9kdWxlLWRpc3Bvc2VcIiwgKF9lLCB0d2Vha0lkOiBzdHJpbmcsIG1vZHVsZUlkOiBzdHJpbmcpID0+IHtcbiAgYXNzZXJ0VHdlYWtQZXJtaXNzaW9uRm9ySWQodHdlYWtJZCwgXCJuYXRpdmUtbW9kdWxlXCIpO1xuICByZXR1cm4gbmF0aXZlQnJpZGdlLmRpc3Bvc2VNb2R1bGUodHdlYWtJZCwgbW9kdWxlSWQpO1xufSk7XG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6bmF0aXZlLWRpc3Bvc2UtdHdlYWtcIiwgKF9lLCB0d2Vha0lkOiBzdHJpbmcpID0+IHtcbiAgYXNzZXJ0VHdlYWtJZCh0d2Vha0lkKTtcbiAgbmF0aXZlQnJpZGdlLmRpc3Bvc2VUd2Vhayh0d2Vha0lkKTtcbn0pO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpuYXRpdmUtY3JlYXRlLXBhbmVsXCIsXG4gIGFzeW5jIChfZSwgdHdlYWtJZDogc3RyaW5nLCBvcHRpb25zOiBOYXRpdmVQYW5lbENyZWF0ZU9wdGlvbnMpID0+IHtcbiAgICBjb25zdCByZWYgPSBhd2FpdCBuYXRpdmVCcmlkZ2UuY3JlYXRlUGFuZWwodHdlYWtDb250ZXh0KHR3ZWFrSWQsIFwibmF0aXZlLXZpZXdcIiksIG9wdGlvbnMpO1xuICAgIHJldHVybiB7IGlkOiByZWYuaWQsIHdpbmRvd0lkOiByZWYud2luZG93SWQgfTtcbiAgfSxcbik7XG5pcGNNYWluLmhhbmRsZShcbiAgXCJjb2RleHBwOm5hdGl2ZS1hdHRhY2gtdmlld1wiLFxuICBhc3luYyAoX2UsIHR3ZWFrSWQ6IHN0cmluZywgb3B0aW9uczogTmF0aXZlVmlld0F0dGFjaE9wdGlvbnMpID0+IHtcbiAgICBjb25zdCByZWYgPSBhd2FpdCBuYXRpdmVCcmlkZ2UuYXR0YWNoVmlldyh0d2Vha0NvbnRleHQodHdlYWtJZCwgXCJuYXRpdmUtdmlld1wiKSwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHsgaWQ6IHJlZi5pZCB9O1xuICB9LFxuKTtcbmlwY01haW4uaGFuZGxlKFxuICBcImNvZGV4cHA6bmF0aXZlLWluc3RhbmNlLWNhbGxcIixcbiAgYXN5bmMgKF9lLCB0d2Vha0lkOiBzdHJpbmcsIGtpbmQ6IFwicGFuZWxcIiB8IFwidmlld1wiLCBpbnN0YW5jZUlkOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBhcmc/OiB1bmtub3duKSA9PiB7XG4gICAgYXNzZXJ0VHdlYWtQZXJtaXNzaW9uRm9ySWQodHdlYWtJZCwgXCJuYXRpdmUtdmlld1wiKTtcbiAgICByZXR1cm4gbmF0aXZlQnJpZGdlLmNhbGxJbnN0YW5jZSh0d2Vha0lkLCBraW5kLCBpbnN0YW5jZUlkLCBtZXRob2QsIGFyZyk7XG4gIH0sXG4pO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpuYXRpdmUtbGF1bmNoLWhlbHBlclwiLFxuICAoX2UsIHR3ZWFrSWQ6IHN0cmluZywgb3B0aW9uczogTmF0aXZlSGVscGVyTGF1bmNoT3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHJlZiA9IG5hdGl2ZUJyaWRnZS5sYXVuY2hIZWxwZXIodHdlYWtDb250ZXh0KHR3ZWFrSWQsIFwibmF0aXZlLWhlbHBlclwiKSwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHsgaWQ6IHJlZi5pZCwgcGlkOiByZWYucGlkIH07XG4gIH0sXG4pO1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpuYXRpdmUtaGVscGVyLWNhbGxcIixcbiAgKF9lLCB0d2Vha0lkOiBzdHJpbmcsIGhlbHBlcklkOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBwYXlsb2FkPzogdW5rbm93biwgdGltZW91dE1zPzogbnVtYmVyKSA9PiB7XG4gICAgYXNzZXJ0VHdlYWtQZXJtaXNzaW9uRm9ySWQodHdlYWtJZCwgXCJuYXRpdmUtaGVscGVyXCIpO1xuICAgIHJldHVybiBuYXRpdmVCcmlkZ2UuY2FsbEhlbHBlcih0d2Vha0lkLCBoZWxwZXJJZCwgbWV0aG9kLCBwYXlsb2FkLCB0aW1lb3V0TXMpO1xuICB9LFxuKTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJldmVhbFwiLCAoX2UsIHA6IHN0cmluZykgPT4ge1xuICBzaGVsbC5vcGVuUGF0aChwKS5jYXRjaCgoKSA9PiB7fSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgKF9lLCB1cmw6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHVybCk7XG4gIGlmIChwYXJzZWQucHJvdG9jb2wgIT09IFwiaHR0cHM6XCIgfHwgcGFyc2VkLmhvc3RuYW1lICE9PSBcImdpdGh1Yi5jb21cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm9ubHkgZ2l0aHViLmNvbSBsaW5rcyBjYW4gYmUgb3BlbmVkIGZyb20gdHdlYWsgbWV0YWRhdGFcIik7XG4gIH1cbiAgc2hlbGwub3BlbkV4dGVybmFsKHBhcnNlZC50b1N0cmluZygpKS5jYXRjaCgoKSA9PiB7fSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvcHktdGV4dFwiLCAoX2UsIHRleHQ6IHN0cmluZykgPT4ge1xuICBjbGlwYm9hcmQud3JpdGVUZXh0KFN0cmluZyh0ZXh0KSk7XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbi8vIE1hbnVhbCBmb3JjZS1yZWxvYWQgdHJpZ2dlciBmcm9tIHRoZSByZW5kZXJlciAoZS5nLiB0aGUgXCJGb3JjZSBSZWxvYWRcIlxuLy8gYnV0dG9uIG9uIG91ciBpbmplY3RlZCBUd2Vha3MgcGFnZSkuIEJ5cGFzc2VzIHRoZSB3YXRjaGVyIGRlYm91bmNlLlxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJlbG9hZC10d2Vha3NcIiwgKCkgPT4ge1xuICByZWxvYWRUd2Vha3MoXCJtYW51YWxcIiwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbiAgcmV0dXJuIHsgYXQ6IERhdGUubm93KCksIGNvdW50OiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQubGVuZ3RoIH07XG59KTtcblxuLy8gNC4gRmlsZXN5c3RlbSB3YXRjaGVyIFx1MjE5MiBkZWJvdW5jZWQgcmVsb2FkICsgYnJvYWRjYXN0LlxuLy8gICAgV2Ugd2F0Y2ggdGhlIHR3ZWFrcyBkaXIgZm9yIGFueSBjaGFuZ2UuIE9uIHRoZSBmaXJzdCB0aWNrIG9mIGluYWN0aXZpdHlcbi8vICAgIHdlIHN0b3AgbWFpbi1zaWRlIHR3ZWFrcywgY2xlYXIgdGhlaXIgY2FjaGVkIG1vZHVsZXMsIHJlLWRpc2NvdmVyLCB0aGVuXG4vLyAgICByZXN0YXJ0IGFuZCBicm9hZGNhc3QgYGNvZGV4cHA6dHdlYWtzLWNoYW5nZWRgIHRvIGV2ZXJ5IHJlbmRlcmVyIHNvIGl0XG4vLyAgICBjYW4gcmUtaW5pdCBpdHMgaG9zdC5cbmNvbnN0IFJFTE9BRF9ERUJPVU5DRV9NUyA9IDI1MDtcbmxldCByZWxvYWRUaW1lcjogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcbmZ1bmN0aW9uIHNjaGVkdWxlUmVsb2FkKHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChyZWxvYWRUaW1lcikgY2xlYXJUaW1lb3V0KHJlbG9hZFRpbWVyKTtcbiAgcmVsb2FkVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICByZWxvYWRUaW1lciA9IG51bGw7XG4gICAgcmVsb2FkVHdlYWtzKHJlYXNvbiwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbiAgfSwgUkVMT0FEX0RFQk9VTkNFX01TKTtcbn1cblxudHJ5IHtcbiAgY29uc3Qgd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKFRXRUFLU19ESVIsIHtcbiAgICBpZ25vcmVJbml0aWFsOiB0cnVlLFxuICAgIC8vIFdhaXQgZm9yIGZpbGVzIHRvIHNldHRsZSBiZWZvcmUgdHJpZ2dlcmluZyBcdTIwMTQgZ3VhcmRzIGFnYWluc3QgcGFydGlhbGx5XG4gICAgLy8gd3JpdHRlbiB0d2VhayBmaWxlcyBkdXJpbmcgZWRpdG9yIHNhdmVzIC8gZ2l0IGNoZWNrb3V0cy5cbiAgICBhd2FpdFdyaXRlRmluaXNoOiB7IHN0YWJpbGl0eVRocmVzaG9sZDogMTUwLCBwb2xsSW50ZXJ2YWw6IDUwIH0sXG4gICAgLy8gQXZvaWQgZWF0aW5nIENQVSBvbiBodWdlIG5vZGVfbW9kdWxlcyB0cmVlcyBpbnNpZGUgdHdlYWsgZm9sZGVycy5cbiAgICBpZ25vcmVkOiAocCkgPT4gcC5pbmNsdWRlcyhgJHtUV0VBS1NfRElSfS9gKSAmJiAvXFwvbm9kZV9tb2R1bGVzXFwvLy50ZXN0KHApLFxuICB9KTtcbiAgd2F0Y2hlci5vbihcImFsbFwiLCAoZXZlbnQsIHBhdGgpID0+IHNjaGVkdWxlUmVsb2FkKGAke2V2ZW50fSAke3BhdGh9YCkpO1xuICB3YXRjaGVyLm9uKFwiZXJyb3JcIiwgKGUpID0+IGxvZyhcIndhcm5cIiwgXCJ3YXRjaGVyIGVycm9yOlwiLCBlKSk7XG4gIGxvZyhcImluZm9cIiwgXCJ3YXRjaGluZ1wiLCBUV0VBS1NfRElSKTtcbiAgYXBwLm9uKFwid2lsbC1xdWl0XCIsICgpID0+IHdhdGNoZXIuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSkpO1xufSBjYXRjaCAoZSkge1xuICBsb2coXCJlcnJvclwiLCBcImZhaWxlZCB0byBzdGFydCB3YXRjaGVyOlwiLCBlKTtcbn1cblxuLy8gLS0tIGhlbHBlcnMgLS0tXG5cbmZ1bmN0aW9uIGxvYWRBbGxNYWluVHdlYWtzKCk6IHZvaWQge1xuICB0cnkge1xuICAgIHR3ZWFrU3RhdGUuZGlzY292ZXJlZCA9IGRpc2NvdmVyVHdlYWtzKFRXRUFLU19ESVIpO1xuICAgIGxvZyhcbiAgICAgIFwiaW5mb1wiLFxuICAgICAgYGRpc2NvdmVyZWQgJHt0d2Vha1N0YXRlLmRpc2NvdmVyZWQubGVuZ3RofSB0d2VhayhzKTpgLFxuICAgICAgdHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLm1hcCgodCkgPT4gdC5tYW5pZmVzdC5pZCkuam9pbihcIiwgXCIpLFxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJlcnJvclwiLCBcInR3ZWFrIGRpc2NvdmVyeSBmYWlsZWQ6XCIsIGUpO1xuICAgIHR3ZWFrU3RhdGUuZGlzY292ZXJlZCA9IFtdO1xuICB9XG5cbiAgc3luY01jcFNlcnZlcnNGcm9tRW5hYmxlZFR3ZWFrcygpO1xuXG4gIGZvciAoY29uc3QgdCBvZiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQpIHtcbiAgICBpZiAoIWlzTWFpblByb2Nlc3NUd2Vha1Njb3BlKHQubWFuaWZlc3Quc2NvcGUpKSBjb250aW51ZTtcbiAgICBpZiAoIWlzVHdlYWtFbmFibGVkKHQubWFuaWZlc3QuaWQpKSB7XG4gICAgICBsb2coXCJpbmZvXCIsIGBza2lwcGluZyBkaXNhYmxlZCBtYWluIHR3ZWFrOiAke3QubWFuaWZlc3QuaWR9YCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1vZCA9IHJlcXVpcmUodC5lbnRyeSk7XG4gICAgICBjb25zdCB0d2VhayA9IG1vZC5kZWZhdWx0ID8/IG1vZDtcbiAgICAgIGlmICh0eXBlb2YgdHdlYWs/LnN0YXJ0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IGNyZWF0ZURpc2tTdG9yYWdlKHVzZXJSb290ISwgdC5tYW5pZmVzdC5pZCk7XG4gICAgICAgIHR3ZWFrLnN0YXJ0KHtcbiAgICAgICAgICBtYW5pZmVzdDogdC5tYW5pZmVzdCxcbiAgICAgICAgICBwcm9jZXNzOiBcIm1haW5cIixcbiAgICAgICAgICBsb2c6IG1ha2VMb2dnZXIodC5tYW5pZmVzdC5pZCksXG4gICAgICAgICAgc3RvcmFnZSxcbiAgICAgICAgICBpcGM6IG1ha2VNYWluSXBjKHQubWFuaWZlc3QuaWQpLFxuICAgICAgICAgIGZzOiBtYWtlTWFpbkZzKHQubWFuaWZlc3QuaWQpLFxuICAgICAgICAgIGNvZGV4OiBtYWtlQ29kZXhBcGkodCksXG4gICAgICAgIH0pO1xuICAgICAgICB0d2Vha1N0YXRlLmxvYWRlZE1haW4uc2V0KHQubWFuaWZlc3QuaWQsIHtcbiAgICAgICAgICBzdG9wOiB0d2Vhay5zdG9wLFxuICAgICAgICAgIHN0b3JhZ2UsXG4gICAgICAgIH0pO1xuICAgICAgICBsb2coXCJpbmZvXCIsIGBzdGFydGVkIG1haW4gdHdlYWs6ICR7dC5tYW5pZmVzdC5pZH1gKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2coXCJlcnJvclwiLCBgdHdlYWsgJHt0Lm1hbmlmZXN0LmlkfSBmYWlsZWQgdG8gc3RhcnQ6YCwgZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHN5bmNNY3BTZXJ2ZXJzRnJvbUVuYWJsZWRUd2Vha3MoKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3luY01hbmFnZWRNY3BTZXJ2ZXJzKHtcbiAgICAgIGNvbmZpZ1BhdGg6IENPREVYX0NPTkZJR19GSUxFLFxuICAgICAgdHdlYWtzOiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQuZmlsdGVyKCh0KSA9PiBpc1R3ZWFrRW5hYmxlZCh0Lm1hbmlmZXN0LmlkKSksXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jaGFuZ2VkKSB7XG4gICAgICBsb2coXCJpbmZvXCIsIGBzeW5jZWQgQ29kZXggTUNQIGNvbmZpZzogJHtyZXN1bHQuc2VydmVyTmFtZXMuam9pbihcIiwgXCIpIHx8IFwibm9uZVwifWApO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LnNraXBwZWRTZXJ2ZXJOYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICBsb2coXG4gICAgICAgIFwiaW5mb1wiLFxuICAgICAgICBgc2tpcHBlZCBDaGF0R1BUKysgbWFuYWdlZCBNQ1Agc2VydmVyKHMpIGFscmVhZHkgY29uZmlndXJlZCBieSB1c2VyOiAke3Jlc3VsdC5za2lwcGVkU2VydmVyTmFtZXMuam9pbihcIiwgXCIpfWAsXG4gICAgICApO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGxvZyhcIndhcm5cIiwgXCJmYWlsZWQgdG8gc3luYyBDb2RleCBNQ1AgY29uZmlnOlwiLCBlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdG9wQWxsTWFpblR3ZWFrcygpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbaWQsIHRdIG9mIHR3ZWFrU3RhdGUubG9hZGVkTWFpbikge1xuICAgIHRyeSB7XG4gICAgICB0LnN0b3A/LigpO1xuICAgICAgdC5zdG9yYWdlLmZsdXNoKCk7XG4gICAgICBsb2coXCJpbmZvXCIsIGBzdG9wcGVkIG1haW4gdHdlYWs6ICR7aWR9YCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nKFwid2FyblwiLCBgc3RvcCBmYWlsZWQgZm9yICR7aWR9OmAsIGUpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBuYXRpdmVCcmlkZ2UuZGlzcG9zZVR3ZWFrKGlkKTtcbiAgICAgIGRpc3Bvc2VPd2xWaWV3c0ZvclR3ZWFrKGlkKTtcbiAgICB9XG4gIH1cbiAgdHdlYWtTdGF0ZS5sb2FkZWRNYWluLmNsZWFyKCk7XG59XG5cbmZ1bmN0aW9uIGNsZWFyVHdlYWtNb2R1bGVDYWNoZSgpOiB2b2lkIHtcbiAgY29uc3Qgcm9vdFNldCA9IG5ldyBTZXQ8c3RyaW5nPihbVFdFQUtTX0RJUiwgc2FmZVJlYWxwYXRoKFRXRUFLU19ESVIpXSk7XG4gIGNvbnN0IGVudHJ5U2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgdHdlYWsgb2YgdHdlYWtTdGF0ZS5kaXNjb3ZlcmVkKSB7XG4gICAgcm9vdFNldC5hZGQodHdlYWsuZGlyKTtcbiAgICByb290U2V0LmFkZChzYWZlUmVhbHBhdGgodHdlYWsuZGlyKSk7XG4gICAgZW50cnlTZXQuYWRkKHR3ZWFrLmVudHJ5KTtcbiAgICBlbnRyeVNldC5hZGQoc2FmZVJlYWxwYXRoKHR3ZWFrLmVudHJ5KSk7XG4gIH1cblxuICBjb25zdCByb290cyA9IFsuLi5yb290U2V0XTtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMocmVxdWlyZS5jYWNoZSkpIHtcbiAgICBjb25zdCByZWFsS2V5ID0gc2FmZVJlYWxwYXRoKGtleSk7XG4gICAgY29uc3QgaXNUd2Vha01vZHVsZSA9XG4gICAgICBlbnRyeVNldC5oYXMoa2V5KSB8fFxuICAgICAgZW50cnlTZXQuaGFzKHJlYWxLZXkpIHx8XG4gICAgICByb290cy5zb21lKChyb290KSA9PiBpc1BhdGhJbnNpZGUocm9vdCwga2V5KSB8fCBpc1BhdGhJbnNpZGUocm9vdCwgcmVhbEtleSkpO1xuICAgIGlmIChpc1R3ZWFrTW9kdWxlKSBkZWxldGUgcmVxdWlyZS5jYWNoZVtrZXldO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhZmVSZWFscGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVhbHBhdGhTeW5jKGZpbGVQYXRoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZpbGVQYXRoO1xuICB9XG59XG5cbmNvbnN0IFVQREFURV9DSEVDS19JTlRFUlZBTF9NUyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XG5jb25zdCBWRVJTSU9OX1JFID0gL152PyhcXGQrKVxcLihcXGQrKVxcLihcXGQrKSg/OlstK10uKik/JC87XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUNoYXRncHRQbHVzUGx1c1VwZGF0ZUNoZWNrKGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPENoYXRncHRQbHVzUGx1c1VwZGF0ZUNoZWNrPiB7XG4gIGNvbnN0IHN0YXRlID0gcmVhZFN0YXRlKCk7XG4gIGNvbnN0IGNhY2hlZCA9IHN0YXRlLmNoYXRncHRQbHVzUGx1cz8udXBkYXRlQ2hlY2s7XG4gIGNvbnN0IGNoYW5uZWwgPSBzdGF0ZS5jaGF0Z3B0UGx1c1BsdXM/LnVwZGF0ZUNoYW5uZWwgPz8gXCJzdGFibGVcIjtcbiAgY29uc3QgcmVwbyA9IHN0YXRlLmNoYXRncHRQbHVzUGx1cz8udXBkYXRlUmVwbyA/PyBDSEFUR1BUX1BMVVNQTFVTX1JFUE87XG4gIGlmIChcbiAgICAhZm9yY2UgJiZcbiAgICBjYWNoZWQgJiZcbiAgICBjYWNoZWQuY3VycmVudFZlcnNpb24gPT09IENIQVRHUFRfUExVU1BMVVNfVkVSU0lPTiAmJlxuICAgIERhdGUubm93KCkgLSBEYXRlLnBhcnNlKGNhY2hlZC5jaGVja2VkQXQpIDwgVVBEQVRFX0NIRUNLX0lOVEVSVkFMX01TXG4gICkge1xuICAgIHJldHVybiBjYWNoZWQ7XG4gIH1cblxuICBjb25zdCByZWxlYXNlID0gYXdhaXQgZmV0Y2hMYXRlc3RSZWxlYXNlKHJlcG8sIENIQVRHUFRfUExVU1BMVVNfVkVSU0lPTiwgY2hhbm5lbCA9PT0gXCJwcmVyZWxlYXNlXCIpO1xuICBjb25zdCBsYXRlc3RWZXJzaW9uID0gcmVsZWFzZS5sYXRlc3RUYWcgPyBub3JtYWxpemVWZXJzaW9uKHJlbGVhc2UubGF0ZXN0VGFnKSA6IG51bGw7XG4gIGNvbnN0IGNoZWNrOiBDaGF0Z3B0UGx1c1BsdXNVcGRhdGVDaGVjayA9IHtcbiAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBjdXJyZW50VmVyc2lvbjogQ0hBVEdQVF9QTFVTUExVU19WRVJTSU9OLFxuICAgIGxhdGVzdFZlcnNpb24sXG4gICAgcmVsZWFzZVVybDogcmVsZWFzZS5yZWxlYXNlVXJsID8/IGBodHRwczovL2dpdGh1Yi5jb20vJHtyZXBvfS9yZWxlYXNlc2AsXG4gICAgcmVsZWFzZU5vdGVzOiByZWxlYXNlLnJlbGVhc2VOb3RlcyxcbiAgICB1cGRhdGVBdmFpbGFibGU6IGxhdGVzdFZlcnNpb25cbiAgICAgID8gY29tcGFyZVZlcnNpb25zKG5vcm1hbGl6ZVZlcnNpb24obGF0ZXN0VmVyc2lvbiksIENIQVRHUFRfUExVU1BMVVNfVkVSU0lPTikgPiAwXG4gICAgICA6IGZhbHNlLFxuICAgIC4uLihyZWxlYXNlLmVycm9yID8geyBlcnJvcjogcmVsZWFzZS5lcnJvciB9IDoge30pLFxuICB9O1xuICBzdGF0ZS5jaGF0Z3B0UGx1c1BsdXMgPz89IHt9O1xuICBzdGF0ZS5jaGF0Z3B0UGx1c1BsdXMudXBkYXRlQ2hlY2sgPSBjaGVjaztcbiAgd3JpdGVTdGF0ZShzdGF0ZSk7XG4gIHJldHVybiBjaGVjaztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlVHdlYWtVcGRhdGVDaGVjayh0OiBEaXNjb3ZlcmVkVHdlYWspOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgaWQgPSB0Lm1hbmlmZXN0LmlkO1xuICBjb25zdCByZXBvID0gdC5tYW5pZmVzdC5naXRodWJSZXBvO1xuICBjb25zdCBzdGF0ZSA9IHJlYWRTdGF0ZSgpO1xuICBjb25zdCBjYWNoZWQgPSBzdGF0ZS50d2Vha1VwZGF0ZUNoZWNrcz8uW2lkXTtcbiAgaWYgKFxuICAgIGNhY2hlZCAmJlxuICAgIGNhY2hlZC5yZXBvID09PSByZXBvICYmXG4gICAgY2FjaGVkLmN1cnJlbnRWZXJzaW9uID09PSB0Lm1hbmlmZXN0LnZlcnNpb24gJiZcbiAgICBEYXRlLm5vdygpIC0gRGF0ZS5wYXJzZShjYWNoZWQuY2hlY2tlZEF0KSA8IFVQREFURV9DSEVDS19JTlRFUlZBTF9NU1xuICApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBuZXh0ID0gYXdhaXQgZmV0Y2hMYXRlc3RSZWxlYXNlKHJlcG8sIHQubWFuaWZlc3QudmVyc2lvbik7XG4gIGNvbnN0IGxhdGVzdFZlcnNpb24gPSBuZXh0LmxhdGVzdFRhZyA/IG5vcm1hbGl6ZVZlcnNpb24obmV4dC5sYXRlc3RUYWcpIDogbnVsbDtcbiAgY29uc3QgY2hlY2s6IFR3ZWFrVXBkYXRlQ2hlY2sgPSB7XG4gICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgcmVwbyxcbiAgICBjdXJyZW50VmVyc2lvbjogdC5tYW5pZmVzdC52ZXJzaW9uLFxuICAgIGxhdGVzdFZlcnNpb24sXG4gICAgbGF0ZXN0VGFnOiBuZXh0LmxhdGVzdFRhZyxcbiAgICByZWxlYXNlVXJsOiBuZXh0LnJlbGVhc2VVcmwsXG4gICAgdXBkYXRlQXZhaWxhYmxlOiBsYXRlc3RWZXJzaW9uXG4gICAgICA/IGNvbXBhcmVWZXJzaW9ucyhsYXRlc3RWZXJzaW9uLCBub3JtYWxpemVWZXJzaW9uKHQubWFuaWZlc3QudmVyc2lvbikpID4gMFxuICAgICAgOiBmYWxzZSxcbiAgICAuLi4obmV4dC5lcnJvciA/IHsgZXJyb3I6IG5leHQuZXJyb3IgfSA6IHt9KSxcbiAgfTtcbiAgc3RhdGUudHdlYWtVcGRhdGVDaGVja3MgPz89IHt9O1xuICBzdGF0ZS50d2Vha1VwZGF0ZUNoZWNrc1tpZF0gPSBjaGVjaztcbiAgd3JpdGVTdGF0ZShzdGF0ZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoTGF0ZXN0UmVsZWFzZShcbiAgcmVwbzogc3RyaW5nLFxuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nLFxuICBpbmNsdWRlUHJlcmVsZWFzZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx7IGxhdGVzdFRhZzogc3RyaW5nIHwgbnVsbDsgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDsgcmVsZWFzZU5vdGVzOiBzdHJpbmcgfCBudWxsOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDgwMDApO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbmRwb2ludCA9IGluY2x1ZGVQcmVyZWxlYXNlID8gXCJyZWxlYXNlcz9wZXJfcGFnZT0yMFwiIDogXCJyZWxlYXNlcy9sYXRlc3RcIjtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zLyR7cmVwb30vJHtlbmRwb2ludH1gLCB7XG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIranNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBgY2hhdGdwdC1wbHVzcGx1cy8ke2N1cnJlbnRWZXJzaW9ufWAsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KTtcbiAgICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIHsgbGF0ZXN0VGFnOiBudWxsLCByZWxlYXNlVXJsOiBudWxsLCByZWxlYXNlTm90ZXM6IG51bGwsIGVycm9yOiBcIm5vIEdpdEh1YiByZWxlYXNlIGZvdW5kXCIgfTtcbiAgICAgIH1cbiAgICAgIGlmICghcmVzLm9rKSB7XG4gICAgICAgIHJldHVybiB7IGxhdGVzdFRhZzogbnVsbCwgcmVsZWFzZVVybDogbnVsbCwgcmVsZWFzZU5vdGVzOiBudWxsLCBlcnJvcjogYEdpdEh1YiByZXR1cm5lZCAke3Jlcy5zdGF0dXN9YCB9O1xuICAgICAgfVxuICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCkgYXMgeyB0YWdfbmFtZT86IHN0cmluZzsgaHRtbF91cmw/OiBzdHJpbmc7IGJvZHk/OiBzdHJpbmc7IGRyYWZ0PzogYm9vbGVhbiB9IHwgQXJyYXk8eyB0YWdfbmFtZT86IHN0cmluZzsgaHRtbF91cmw/OiBzdHJpbmc7IGJvZHk/OiBzdHJpbmc7IGRyYWZ0PzogYm9vbGVhbiB9PjtcbiAgICAgIGNvbnN0IGJvZHkgPSBBcnJheS5pc0FycmF5KGpzb24pID8ganNvbi5maW5kKChyZWxlYXNlKSA9PiAhcmVsZWFzZS5kcmFmdCkgOiBqc29uO1xuICAgICAgaWYgKCFib2R5KSB7XG4gICAgICAgIHJldHVybiB7IGxhdGVzdFRhZzogbnVsbCwgcmVsZWFzZVVybDogbnVsbCwgcmVsZWFzZU5vdGVzOiBudWxsLCBlcnJvcjogXCJubyBHaXRIdWIgcmVsZWFzZSBmb3VuZFwiIH07XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBsYXRlc3RUYWc6IGJvZHkudGFnX25hbWUgPz8gbnVsbCxcbiAgICAgICAgcmVsZWFzZVVybDogYm9keS5odG1sX3VybCA/PyBgaHR0cHM6Ly9naXRodWIuY29tLyR7cmVwb30vcmVsZWFzZXNgLFxuICAgICAgICByZWxlYXNlTm90ZXM6IGJvZHkuYm9keSA/PyBudWxsLFxuICAgICAgfTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7XG4gICAgICBsYXRlc3RUYWc6IG51bGwsXG4gICAgICByZWxlYXNlVXJsOiBudWxsLFxuICAgICAgcmVsZWFzZU5vdGVzOiBudWxsLFxuICAgICAgZXJyb3I6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSxcbiAgICB9O1xuICB9XG59XG5cbmludGVyZmFjZSBUd2Vha1N0b3JlRmV0Y2hSZXN1bHQge1xuICByZWdpc3RyeTogVHdlYWtTdG9yZVJlZ2lzdHJ5O1xuICBmZXRjaGVkQXQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFN0b3JlSW5zdGFsbE1ldGFkYXRhIHtcbiAgcmVwbzogc3RyaW5nO1xuICBhcHByb3ZlZENvbW1pdFNoYTogc3RyaW5nO1xuICBpbnN0YWxsZWRBdDogc3RyaW5nO1xuICBzdG9yZUluZGV4VXJsOiBzdHJpbmc7XG4gIGZpbGVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuaW50ZXJmYWNlIFN0b3JlRW50cnlQbGF0Zm9ybUNvbXBhdGliaWxpdHkge1xuICBjdXJyZW50OiBOb2RlSlMuUGxhdGZvcm07XG4gIHN1cHBvcnRlZDogVHdlYWtTdG9yZVBsYXRmb3JtW10gfCBudWxsO1xuICBjb21wYXRpYmxlOiBib29sZWFuO1xuICByZWFzb246IHN0cmluZyB8IG51bGw7XG59XG5cbmludGVyZmFjZSBTdG9yZUVudHJ5UnVudGltZUNvbXBhdGliaWxpdHkge1xuICBjdXJyZW50OiBzdHJpbmc7XG4gIHJlcXVpcmVkOiBzdHJpbmcgfCBudWxsO1xuICBjb21wYXRpYmxlOiBib29sZWFuO1xuICByZWFzb246IHN0cmluZyB8IG51bGw7XG59XG5cbmNsYXNzIFN0b3JlVHdlYWtNb2RpZmllZEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih0d2Vha05hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgYCR7dHdlYWtOYW1lfSBoYXMgbG9jYWwgc291cmNlIGNoYW5nZXMsIHNvIENoYXRHUFQrKyBjYW4ndCBhdXRvLXVwZGF0ZSBpdC4gUmV2ZXJ0IHlvdXIgbG9jYWwgY2hhbmdlcyBvciByZWluc3RhbGwgdGhlIHR3ZWFrIG1hbnVhbGx5LmAsXG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSBcIlN0b3JlVHdlYWtNb2RpZmllZEVycm9yXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eShlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogU3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eSB7XG4gIGNvbnN0IHN1cHBvcnRlZCA9IGVudHJ5LnBsYXRmb3JtcyA/PyBudWxsO1xuICBjb25zdCBjb21wYXRpYmxlID0gIXN1cHBvcnRlZCB8fCBzdXBwb3J0ZWQuaW5jbHVkZXMocHJvY2Vzcy5wbGF0Zm9ybSBhcyBUd2Vha1N0b3JlUGxhdGZvcm0pO1xuICByZXR1cm4ge1xuICAgIGN1cnJlbnQ6IHByb2Nlc3MucGxhdGZvcm0sXG4gICAgc3VwcG9ydGVkLFxuICAgIGNvbXBhdGlibGUsXG4gICAgcmVhc29uOiBjb21wYXRpYmxlID8gbnVsbCA6IGAke2VudHJ5Lm1hbmlmZXN0Lm5hbWV9IGlzIG9ubHkgYXZhaWxhYmxlIG9uICR7Zm9ybWF0U3RvcmVQbGF0Zm9ybXMoc3VwcG9ydGVkKX0uYCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0U3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJsZShlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogdm9pZCB7XG4gIGNvbnN0IHBsYXRmb3JtID0gc3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eShlbnRyeSk7XG4gIGlmICghcGxhdGZvcm0uY29tcGF0aWJsZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihwbGF0Zm9ybS5yZWFzb24gPz8gYCR7ZW50cnkubWFuaWZlc3QubmFtZX0gaXMgbm90IGF2YWlsYWJsZSBvbiB0aGlzIHBsYXRmb3JtLmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0b3JlRW50cnlSdW50aW1lQ29tcGF0aWJpbGl0eShlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogU3RvcmVFbnRyeVJ1bnRpbWVDb21wYXRpYmlsaXR5IHtcbiAgY29uc3QgcmVxdWlyZWQgPSBjbGVhbk1pblJ1bnRpbWUoZW50cnkubWFuaWZlc3QubWluUnVudGltZSk7XG4gIGNvbnN0IGNvbXBhdGlibGUgPSAhcmVxdWlyZWQgfHwgY29tcGFyZVZlcnNpb25zKENIQVRHUFRfUExVU1BMVVNfVkVSU0lPTiwgcmVxdWlyZWQpID49IDA7XG4gIHJldHVybiB7XG4gICAgY3VycmVudDogQ0hBVEdQVF9QTFVTUExVU19WRVJTSU9OLFxuICAgIHJlcXVpcmVkLFxuICAgIGNvbXBhdGlibGUsXG4gICAgcmVhc29uOiBjb21wYXRpYmxlIHx8ICFyZXF1aXJlZFxuICAgICAgPyBudWxsXG4gICAgICA6IGAke2VudHJ5Lm1hbmlmZXN0Lm5hbWV9IHJlcXVpcmVzIENoYXRHUFQrKyAke3JlcXVpcmVkfSBvciBuZXdlci5gLFxuICB9O1xufVxuXG5mdW5jdGlvbiBhc3NlcnRTdG9yZUVudHJ5UnVudGltZUNvbXBhdGlibGUoZW50cnk6IFR3ZWFrU3RvcmVFbnRyeSk6IHZvaWQge1xuICBjb25zdCBydW50aW1lID0gc3RvcmVFbnRyeVJ1bnRpbWVDb21wYXRpYmlsaXR5KGVudHJ5KTtcbiAgaWYgKCFydW50aW1lLmNvbXBhdGlibGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IocnVudGltZS5yZWFzb24gPz8gYCR7ZW50cnkubWFuaWZlc3QubmFtZX0gcmVxdWlyZXMgYSBuZXdlciBDaGF0R1BUKysgcnVudGltZS5gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhbk1pblJ1bnRpbWUodmFsdWU6IHVua25vd24pOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHZlcnNpb24gPSBub3JtYWxpemVWZXJzaW9uKHZhbHVlLnJlcGxhY2UoL14+PT9cXHMqLywgXCJcIikpO1xuICByZXR1cm4gVkVSU0lPTl9SRS50ZXN0KHZlcnNpb24pID8gdmVyc2lvbiA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFN0b3JlUGxhdGZvcm1zKHBsYXRmb3JtczogVHdlYWtTdG9yZVBsYXRmb3JtW10gfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFwbGF0Zm9ybXMgfHwgcGxhdGZvcm1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwic3VwcG9ydGVkIHBsYXRmb3Jtc1wiO1xuICByZXR1cm4gcGxhdGZvcm1zLm1hcCgocGxhdGZvcm0pID0+IHtcbiAgICBpZiAocGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHJldHVybiBcIm1hY09TXCI7XG4gICAgaWYgKHBsYXRmb3JtID09PSBcIndpbjMyXCIpIHJldHVybiBcIldpbmRvd3NcIjtcbiAgICByZXR1cm4gXCJMaW51eFwiO1xuICB9KS5qb2luKFwiLCBcIik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoVHdlYWtTdG9yZVJlZ2lzdHJ5KCk6IFByb21pc2U8VHdlYWtTdG9yZUZldGNoUmVzdWx0PiB7XG4gIGNvbnN0IGZldGNoZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFRXRUFLX1NUT1JFX0lOREVYX1VSTCwge1xuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IGBjaGF0Z3B0LXBsdXNwbHVzLyR7Q0hBVEdQVF9QTFVTUExVU19WRVJTSU9OfWAsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KTtcbiAgICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYHN0b3JlIHJldHVybmVkICR7cmVzLnN0YXR1c31gKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJlZ2lzdHJ5OiBub3JtYWxpemVTdG9yZVJlZ2lzdHJ5KGF3YWl0IHJlcy5qc29uKCkpLFxuICAgICAgICBmZXRjaGVkQXQsXG4gICAgICB9O1xuICAgIH0gZmluYWxseSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc3QgZXJyb3IgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKFN0cmluZyhlKSk7XG4gICAgbG9nKFwid2FyblwiLCBcImZhaWxlZCB0byBmZXRjaCB0d2VhayBzdG9yZSByZWdpc3RyeTpcIiwgZXJyb3IubWVzc2FnZSk7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5zdGFsbFN0b3JlVHdlYWsoZW50cnk6IFR3ZWFrU3RvcmVFbnRyeSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB1cmwgPSBzdG9yZUFyY2hpdmVVcmwoZW50cnkpO1xuICBjb25zdCB3b3JrID0gbWtkdGVtcFN5bmMoam9pbih0bXBkaXIoKSwgXCJjb2RleHBwLXN0b3JlLXR3ZWFrLVwiKSk7XG4gIGNvbnN0IGFyY2hpdmUgPSBqb2luKHdvcmssIFwic291cmNlLnRhci5nelwiKTtcbiAgY29uc3QgZXh0cmFjdERpciA9IGpvaW4od29yaywgXCJleHRyYWN0XCIpO1xuICBjb25zdCB0YXJnZXQgPSBqb2luKFRXRUFLU19ESVIsIGVudHJ5LmlkKTtcbiAgY29uc3Qgc3RhZ2VkVGFyZ2V0ID0gam9pbih3b3JrLCBcInN0YWdlZFwiLCBlbnRyeS5pZCk7XG5cbiAgdHJ5IHtcbiAgICBsb2coXCJpbmZvXCIsIGBpbnN0YWxsaW5nIHN0b3JlIHR3ZWFrICR7ZW50cnkuaWR9IGZyb20gJHtlbnRyeS5yZXBvfUAke2VudHJ5LmFwcHJvdmVkQ29tbWl0U2hhfWApO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogYGNoYXRncHQtcGx1c3BsdXMvJHtDSEFUR1BUX1BMVVNQTFVTX1ZFUlNJT059YCB9LFxuICAgICAgcmVkaXJlY3Q6IFwiZm9sbG93XCIsXG4gICAgfSk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgZG93bmxvYWQgZmFpbGVkOiAke3Jlcy5zdGF0dXN9YCk7XG4gICAgY29uc3QgYnl0ZXMgPSBCdWZmZXIuZnJvbShhd2FpdCByZXMuYXJyYXlCdWZmZXIoKSk7XG4gICAgd3JpdGVGaWxlU3luYyhhcmNoaXZlLCBieXRlcyk7XG4gICAgbWtkaXJTeW5jKGV4dHJhY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGV4dHJhY3RUYXJBcmNoaXZlKGFyY2hpdmUsIGV4dHJhY3REaXIpO1xuICAgIGNvbnN0IHNvdXJjZSA9IGZpbmRUd2Vha1Jvb3QoZXh0cmFjdERpcik7XG4gICAgaWYgKCFzb3VyY2UpIHRocm93IG5ldyBFcnJvcihcImRvd25sb2FkZWQgYXJjaGl2ZSBkaWQgbm90IGNvbnRhaW4gbWFuaWZlc3QuanNvblwiKTtcbiAgICB2YWxpZGF0ZVN0b3JlVHdlYWtTb3VyY2UoZW50cnksIHNvdXJjZSk7XG4gICAgcm1TeW5jKHN0YWdlZFRhcmdldCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgIGNvcHlUd2Vha1NvdXJjZShzb3VyY2UsIHN0YWdlZFRhcmdldCk7XG4gICAgY29uc3Qgc3RhZ2VkRmlsZXMgPSBoYXNoVHdlYWtTb3VyY2Uoc3RhZ2VkVGFyZ2V0KTtcbiAgICB3cml0ZUZpbGVTeW5jKFxuICAgICAgam9pbihzdGFnZWRUYXJnZXQsIFwiLmNvZGV4cHAtc3RvcmUuanNvblwiKSxcbiAgICAgIEpTT04uc3RyaW5naWZ5KFxuICAgICAgICB7XG4gICAgICAgICAgcmVwbzogZW50cnkucmVwbyxcbiAgICAgICAgICBhcHByb3ZlZENvbW1pdFNoYTogZW50cnkuYXBwcm92ZWRDb21taXRTaGEsXG4gICAgICAgICAgaW5zdGFsbGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICBzdG9yZUluZGV4VXJsOiBUV0VBS19TVE9SRV9JTkRFWF9VUkwsXG4gICAgICAgICAgZmlsZXM6IHN0YWdlZEZpbGVzLFxuICAgICAgICB9LFxuICAgICAgICBudWxsLFxuICAgICAgICAyLFxuICAgICAgKSxcbiAgICApO1xuICAgIGF3YWl0IGFzc2VydFN0b3JlVHdlYWtDbGVhbkZvckF1dG9VcGRhdGUoZW50cnksIHRhcmdldCwgd29yayk7XG4gICAgcm1TeW5jKHRhcmdldCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgIGNwU3luYyhzdGFnZWRUYXJnZXQsIHRhcmdldCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gZmluYWxseSB7XG4gICAgcm1TeW5jKHdvcmssIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBwcmVwYXJlVHdlYWtTdG9yZVN1Ym1pc3Npb24ocmVwb0lucHV0OiBzdHJpbmcpOiBQcm9taXNlPFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbj4ge1xuICBjb25zdCByZXBvID0gbm9ybWFsaXplR2l0SHViUmVwbyhyZXBvSW5wdXQpO1xuICBjb25zdCByZXBvSW5mbyA9IGF3YWl0IGZldGNoR2l0aHViSnNvbjx7IGRlZmF1bHRfYnJhbmNoPzogc3RyaW5nIH0+KGBodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zLyR7cmVwb31gKTtcbiAgY29uc3QgZGVmYXVsdEJyYW5jaCA9IHJlcG9JbmZvLmRlZmF1bHRfYnJhbmNoO1xuICBpZiAoIWRlZmF1bHRCcmFuY2gpIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlc29sdmUgZGVmYXVsdCBicmFuY2ggZm9yICR7cmVwb31gKTtcblxuICBjb25zdCBjb21taXQgPSBhd2FpdCBmZXRjaEdpdGh1Ykpzb248e1xuICAgIHNoYT86IHN0cmluZztcbiAgICBodG1sX3VybD86IHN0cmluZztcbiAgfT4oYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvJHtyZXBvfS9jb21taXRzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGRlZmF1bHRCcmFuY2gpfWApO1xuICBpZiAoIWNvbW1pdC5zaGEpIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlc29sdmUgY3VycmVudCBjb21taXQgZm9yICR7cmVwb31gKTtcblxuICBjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGZldGNoTWFuaWZlc3RBdENvbW1pdChyZXBvLCBjb21taXQuc2hhKS5jYXRjaCgoZSkgPT4ge1xuICAgIGxvZyhcIndhcm5cIiwgYGNvdWxkIG5vdCByZWFkIG1hbmlmZXN0IGZvciBzdG9yZSBzdWJtaXNzaW9uICR7cmVwb31AJHtjb21taXQuc2hhfTpgLCBlKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHJlcG8sXG4gICAgZGVmYXVsdEJyYW5jaCxcbiAgICBjb21taXRTaGE6IGNvbW1pdC5zaGEsXG4gICAgY29tbWl0VXJsOiBjb21taXQuaHRtbF91cmwgPz8gYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3JlcG99L2NvbW1pdC8ke2NvbW1pdC5zaGF9YCxcbiAgICBtYW5pZmVzdDogbWFuaWZlc3RcbiAgICAgID8ge1xuICAgICAgICAgIGlkOiB0eXBlb2YgbWFuaWZlc3QuaWQgPT09IFwic3RyaW5nXCIgPyBtYW5pZmVzdC5pZCA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBuYW1lOiB0eXBlb2YgbWFuaWZlc3QubmFtZSA9PT0gXCJzdHJpbmdcIiA/IG1hbmlmZXN0Lm5hbWUgOiB1bmRlZmluZWQsXG4gICAgICAgICAgdmVyc2lvbjogdHlwZW9mIG1hbmlmZXN0LnZlcnNpb24gPT09IFwic3RyaW5nXCIgPyBtYW5pZmVzdC52ZXJzaW9uIDogdW5kZWZpbmVkLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiB0eXBlb2YgbWFuaWZlc3QuZGVzY3JpcHRpb24gPT09IFwic3RyaW5nXCIgPyBtYW5pZmVzdC5kZXNjcmlwdGlvbiA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBpY29uVXJsOiB0eXBlb2YgbWFuaWZlc3QuaWNvblVybCA9PT0gXCJzdHJpbmdcIiA/IG1hbmlmZXN0Lmljb25VcmwgOiB1bmRlZmluZWQsXG4gICAgICAgIH1cbiAgICAgIDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaEdpdGh1Ykpzb248VD4odXJsOiBzdHJpbmcpOiBQcm9taXNlPFQ+IHtcbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA4MDAwKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi92bmQuZ2l0aHViK2pzb25cIixcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IGBjaGF0Z3B0LXBsdXNwbHVzLyR7Q0hBVEdQVF9QTFVTUExVU19WRVJTSU9OfWAsXG4gICAgICB9LFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBHaXRIdWIgcmV0dXJuZWQgJHtyZXMuc3RhdHVzfWApO1xuICAgIHJldHVybiBhd2FpdCByZXMuanNvbigpIGFzIFQ7XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoTWFuaWZlc3RBdENvbW1pdChyZXBvOiBzdHJpbmcsIGNvbW1pdFNoYTogc3RyaW5nKTogUHJvbWlzZTxQYXJ0aWFsPFR3ZWFrTWFuaWZlc3Q+PiB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vJHtyZXBvfS8ke2NvbW1pdFNoYX0vbWFuaWZlc3QuanNvbmAsIHtcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwiVXNlci1BZ2VudFwiOiBgY2hhdGdwdC1wbHVzcGx1cy8ke0NIQVRHUFRfUExVU1BMVVNfVkVSU0lPTn1gLFxuICAgIH0sXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBtYW5pZmVzdCBmZXRjaCByZXR1cm5lZCAke3Jlcy5zdGF0dXN9YCk7XG4gIHJldHVybiBhd2FpdCByZXMuanNvbigpIGFzIFBhcnRpYWw8VHdlYWtNYW5pZmVzdD47XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RUYXJBcmNoaXZlKGFyY2hpdmU6IHN0cmluZywgdGFyZ2V0RGlyOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgcmVzdWx0ID0gc3Bhd25TeW5jKFwidGFyXCIsIFtcIi14emZcIiwgYXJjaGl2ZSwgXCItQ1wiLCB0YXJnZXREaXJdLCB7XG4gICAgZW5jb2Rpbmc6IFwidXRmOFwiLFxuICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgfSk7XG4gIGlmIChyZXN1bHQuc3RhdHVzICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0YXIgZXh0cmFjdGlvbiBmYWlsZWQ6ICR7cmVzdWx0LnN0ZGVyciB8fCByZXN1bHQuc3Rkb3V0IHx8IHJlc3VsdC5zdGF0dXN9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVTdG9yZVR3ZWFrU291cmNlKGVudHJ5OiBUd2Vha1N0b3JlRW50cnksIHNvdXJjZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IG1hbmlmZXN0UGF0aCA9IGpvaW4oc291cmNlLCBcIm1hbmlmZXN0Lmpzb25cIik7XG4gIGNvbnN0IG1hbmlmZXN0ID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMobWFuaWZlc3RQYXRoLCBcInV0ZjhcIikpIGFzIFR3ZWFrTWFuaWZlc3Q7XG4gIGlmIChtYW5pZmVzdC5pZCAhPT0gZW50cnkubWFuaWZlc3QuaWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGRvd25sb2FkZWQgdHdlYWsgaWQgJHttYW5pZmVzdC5pZH0gZG9lcyBub3QgbWF0Y2ggYXBwcm92ZWQgaWQgJHtlbnRyeS5tYW5pZmVzdC5pZH1gKTtcbiAgfVxuICBpZiAobWFuaWZlc3QuZ2l0aHViUmVwbyAhPT0gZW50cnkucmVwbykge1xuICAgIHRocm93IG5ldyBFcnJvcihgZG93bmxvYWRlZCB0d2VhayByZXBvICR7bWFuaWZlc3QuZ2l0aHViUmVwb30gZG9lcyBub3QgbWF0Y2ggYXBwcm92ZWQgcmVwbyAke2VudHJ5LnJlcG99YCk7XG4gIH1cbiAgaWYgKG1hbmlmZXN0LnZlcnNpb24gIT09IGVudHJ5Lm1hbmlmZXN0LnZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGRvd25sb2FkZWQgdHdlYWsgdmVyc2lvbiAke21hbmlmZXN0LnZlcnNpb259IGRvZXMgbm90IG1hdGNoIGFwcHJvdmVkIHZlcnNpb24gJHtlbnRyeS5tYW5pZmVzdC52ZXJzaW9ufWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRUd2Vha1Jvb3QoZGlyOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFleGlzdHNTeW5jKGRpcikpIHJldHVybiBudWxsO1xuICBpZiAoZXhpc3RzU3luYyhqb2luKGRpciwgXCJtYW5pZmVzdC5qc29uXCIpKSkgcmV0dXJuIGRpcjtcbiAgZm9yIChjb25zdCBuYW1lIG9mIHJlYWRkaXJTeW5jKGRpcikpIHtcbiAgICBjb25zdCBjaGlsZCA9IGpvaW4oZGlyLCBuYW1lKTtcbiAgICB0cnkge1xuICAgICAgaWYgKCFzdGF0U3luYyhjaGlsZCkuaXNEaXJlY3RvcnkoKSkgY29udGludWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZm91bmQgPSBmaW5kVHdlYWtSb290KGNoaWxkKTtcbiAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY29weVR3ZWFrU291cmNlKHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZyk6IHZvaWQge1xuICBjcFN5bmMoc291cmNlLCB0YXJnZXQsIHtcbiAgICByZWN1cnNpdmU6IHRydWUsXG4gICAgZmlsdGVyOiAoc3JjKSA9PiAhLyhefFsvXFxcXF0pKD86XFwuZ2l0fG5vZGVfbW9kdWxlcykoPzpbL1xcXFxdfCQpLy50ZXN0KHNyYyksXG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhc3NlcnRTdG9yZVR3ZWFrQ2xlYW5Gb3JBdXRvVXBkYXRlKFxuICBlbnRyeTogVHdlYWtTdG9yZUVudHJ5LFxuICB0YXJnZXQ6IHN0cmluZyxcbiAgd29yazogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghZXhpc3RzU3luYyh0YXJnZXQpKSByZXR1cm47XG4gIGNvbnN0IG1ldGFkYXRhID0gcmVhZFN0b3JlSW5zdGFsbE1ldGFkYXRhKHRhcmdldCk7XG4gIGlmICghbWV0YWRhdGEpIHJldHVybjtcbiAgaWYgKG1ldGFkYXRhLnJlcG8gIT09IGVudHJ5LnJlcG8pIHtcbiAgICB0aHJvdyBuZXcgU3RvcmVUd2Vha01vZGlmaWVkRXJyb3IoZW50cnkubWFuaWZlc3QubmFtZSk7XG4gIH1cbiAgY29uc3QgY3VycmVudEZpbGVzID0gaGFzaFR3ZWFrU291cmNlKHRhcmdldCk7XG4gIGNvbnN0IGJhc2VsaW5lRmlsZXMgPSBtZXRhZGF0YS5maWxlcyA/PyBhd2FpdCBmZXRjaEJhc2VsaW5lU3RvcmVUd2Vha0hhc2hlcyhtZXRhZGF0YSwgd29yayk7XG4gIGlmICghc2FtZUZpbGVIYXNoZXMoY3VycmVudEZpbGVzLCBiYXNlbGluZUZpbGVzKSkge1xuICAgIHRocm93IG5ldyBTdG9yZVR3ZWFrTW9kaWZpZWRFcnJvcihlbnRyeS5tYW5pZmVzdC5uYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkU3RvcmVJbnN0YWxsTWV0YWRhdGEodGFyZ2V0OiBzdHJpbmcpOiBTdG9yZUluc3RhbGxNZXRhZGF0YSB8IG51bGwge1xuICBjb25zdCBtZXRhZGF0YVBhdGggPSBqb2luKHRhcmdldCwgXCIuY29kZXhwcC1zdG9yZS5qc29uXCIpO1xuICBpZiAoIWV4aXN0c1N5bmMobWV0YWRhdGFQYXRoKSkgcmV0dXJuIG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMobWV0YWRhdGFQYXRoLCBcInV0ZjhcIikpIGFzIFBhcnRpYWw8U3RvcmVJbnN0YWxsTWV0YWRhdGE+O1xuICAgIGlmICh0eXBlb2YgcGFyc2VkLnJlcG8gIT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHBhcnNlZC5hcHByb3ZlZENvbW1pdFNoYSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlcG86IHBhcnNlZC5yZXBvLFxuICAgICAgYXBwcm92ZWRDb21taXRTaGE6IHBhcnNlZC5hcHByb3ZlZENvbW1pdFNoYSxcbiAgICAgIGluc3RhbGxlZEF0OiB0eXBlb2YgcGFyc2VkLmluc3RhbGxlZEF0ID09PSBcInN0cmluZ1wiID8gcGFyc2VkLmluc3RhbGxlZEF0IDogXCJcIixcbiAgICAgIHN0b3JlSW5kZXhVcmw6IHR5cGVvZiBwYXJzZWQuc3RvcmVJbmRleFVybCA9PT0gXCJzdHJpbmdcIiA/IHBhcnNlZC5zdG9yZUluZGV4VXJsIDogXCJcIixcbiAgICAgIGZpbGVzOiBpc0hhc2hSZWNvcmQocGFyc2VkLmZpbGVzKSA/IHBhcnNlZC5maWxlcyA6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaEJhc2VsaW5lU3RvcmVUd2Vha0hhc2hlcyhcbiAgbWV0YWRhdGE6IFN0b3JlSW5zdGFsbE1ldGFkYXRhLFxuICB3b3JrOiBzdHJpbmcsXG4pOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIHN0cmluZz4+IHtcbiAgY29uc3QgYmFzZWxpbmVEaXIgPSBqb2luKHdvcmssIFwiYmFzZWxpbmVcIik7XG4gIGNvbnN0IGFyY2hpdmUgPSBqb2luKHdvcmssIFwiYmFzZWxpbmUudGFyLmd6XCIpO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9jb2RlbG9hZC5naXRodWIuY29tLyR7bWV0YWRhdGEucmVwb30vdGFyLmd6LyR7bWV0YWRhdGEuYXBwcm92ZWRDb21taXRTaGF9YCwge1xuICAgIGhlYWRlcnM6IHsgXCJVc2VyLUFnZW50XCI6IGBjaGF0Z3B0LXBsdXNwbHVzLyR7Q0hBVEdQVF9QTFVTUExVU19WRVJTSU9OfWAgfSxcbiAgICByZWRpcmVjdDogXCJmb2xsb3dcIixcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCB2ZXJpZnkgbG9jYWwgdHdlYWsgY2hhbmdlcyBiZWZvcmUgdXBkYXRlOiAke3Jlcy5zdGF0dXN9YCk7XG4gIHdyaXRlRmlsZVN5bmMoYXJjaGl2ZSwgQnVmZmVyLmZyb20oYXdhaXQgcmVzLmFycmF5QnVmZmVyKCkpKTtcbiAgbWtkaXJTeW5jKGJhc2VsaW5lRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgZXh0cmFjdFRhckFyY2hpdmUoYXJjaGl2ZSwgYmFzZWxpbmVEaXIpO1xuICBjb25zdCBzb3VyY2UgPSBmaW5kVHdlYWtSb290KGJhc2VsaW5lRGlyKTtcbiAgaWYgKCFzb3VyY2UpIHRocm93IG5ldyBFcnJvcihcIkNvdWxkIG5vdCB2ZXJpZnkgbG9jYWwgdHdlYWsgY2hhbmdlcyBiZWZvcmUgdXBkYXRlOiBiYXNlbGluZSBtYW5pZmVzdCBtaXNzaW5nXCIpO1xuICByZXR1cm4gaGFzaFR3ZWFrU291cmNlKHNvdXJjZSk7XG59XG5cbmZ1bmN0aW9uIGhhc2hUd2Vha1NvdXJjZShyb290OiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgY29uc3Qgb3V0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGNvbGxlY3RUd2Vha0ZpbGVIYXNoZXMocm9vdCwgcm9vdCwgb3V0KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gY29sbGVjdFR3ZWFrRmlsZUhhc2hlcyhyb290OiBzdHJpbmcsIGRpcjogc3RyaW5nLCBvdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBuYW1lIG9mIHJlYWRkaXJTeW5jKGRpcikuc29ydCgpKSB7XG4gICAgaWYgKG5hbWUgPT09IFwiLmdpdFwiIHx8IG5hbWUgPT09IFwibm9kZV9tb2R1bGVzXCIgfHwgbmFtZSA9PT0gXCIuY29kZXhwcC1zdG9yZS5qc29uXCIpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGZ1bGwgPSBqb2luKGRpciwgbmFtZSk7XG4gICAgY29uc3QgcmVsID0gcmVsYXRpdmUocm9vdCwgZnVsbCkuc3BsaXQoXCJcXFxcXCIpLmpvaW4oXCIvXCIpO1xuICAgIGNvbnN0IHN0YXQgPSBzdGF0U3luYyhmdWxsKTtcbiAgICBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBjb2xsZWN0VHdlYWtGaWxlSGFzaGVzKHJvb3QsIGZ1bGwsIG91dCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFzdGF0LmlzRmlsZSgpKSBjb250aW51ZTtcbiAgICBvdXRbcmVsXSA9IGNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJlYWRGaWxlU3luYyhmdWxsKSkuZGlnZXN0KFwiaGV4XCIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhbWVGaWxlSGFzaGVzKGE6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIGI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBib29sZWFuIHtcbiAgY29uc3QgYWsgPSBPYmplY3Qua2V5cyhhKS5zb3J0KCk7XG4gIGNvbnN0IGJrID0gT2JqZWN0LmtleXMoYikuc29ydCgpO1xuICBpZiAoYWsubGVuZ3RoICE9PSBiay5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhay5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGFrW2ldO1xuICAgIGlmIChrZXkgIT09IGJrW2ldIHx8IGFba2V5XSAhPT0gYltrZXldKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGlzSGFzaFJlY29yZCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuZXZlcnkoKHYpID0+IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVmVyc2lvbih2OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdi50cmltKCkucmVwbGFjZSgvXnYvaSwgXCJcIik7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVWZXJzaW9ucyhhOiBzdHJpbmcsIGI6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IGF2ID0gVkVSU0lPTl9SRS5leGVjKGEpO1xuICBjb25zdCBidiA9IFZFUlNJT05fUkUuZXhlYyhiKTtcbiAgaWYgKCFhdiB8fCAhYnYpIHJldHVybiAwO1xuICBmb3IgKGxldCBpID0gMTsgaSA8PSAzOyBpKyspIHtcbiAgICBjb25zdCBkaWZmID0gTnVtYmVyKGF2W2ldKSAtIE51bWJlcihidltpXSk7XG4gICAgaWYgKGRpZmYgIT09IDApIHJldHVybiBkaWZmO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG5mdW5jdGlvbiBmYWxsYmFja1NvdXJjZVJvb3QoKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgam9pbihob21lZGlyKCksIFwiLmNoYXRncHQtcGx1c3BsdXNcIiwgXCJzb3VyY2VcIiksXG4gICAgam9pbihob21lZGlyKCksIFwiLmNvZGV4LXBsdXNwbHVzXCIsIFwic291cmNlXCIpLFxuICAgIGpvaW4odXNlclJvb3QhLCBcInNvdXJjZVwiKSxcbiAgXTtcbiAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xuICAgIGlmIChleGlzdHNTeW5jKGpvaW4oY2FuZGlkYXRlLCBcInBhY2thZ2VzXCIsIFwiaW5zdGFsbGVyXCIsIFwiZGlzdFwiLCBcImNsaS5qc1wiKSkpIHJldHVybiBjYW5kaWRhdGU7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlSW5zdGFsbGF0aW9uU291cmNlKHNvdXJjZVJvb3Q6IHN0cmluZyB8IG51bGwpOiBJbnN0YWxsYXRpb25Tb3VyY2Uge1xuICBpZiAoIXNvdXJjZVJvb3QpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogXCJ1bmtub3duXCIsXG4gICAgICBsYWJlbDogXCJVbmtub3duXCIsXG4gICAgICBkZXRhaWw6IFwiQ2hhdEdQVCsrIHNvdXJjZSBsb2NhdGlvbiBpcyBub3QgcmVjb3JkZWQgeWV0LlwiLFxuICAgIH07XG4gIH1cbiAgY29uc3Qgbm9ybWFsaXplZCA9IHNvdXJjZVJvb3QucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XG4gIGlmIChleGlzdHNTeW5jKGpvaW4oc291cmNlUm9vdCwgXCJzdGFuZGFsb25lLmpzb25cIikpKSB7XG4gICAgcmV0dXJuIHsga2luZDogXCJzdGFuZGFsb25lLXBhY2thZ2VcIiwgbGFiZWw6IFwiU3RhbmRhbG9uZSBcdTVCODlcdTg4QzVcdTUzMDVcIiwgZGV0YWlsOiBzb3VyY2VSb290IH07XG4gIH1cbiAgaWYgKC9cXC8oPzpIb21lYnJld3xob21lYnJldylcXC9DZWxsYXJcXC8oPzpjaGF0Z3B0cGx1c3BsdXN8Y29kZXhwbHVzcGx1cylcXC8vLnRlc3Qobm9ybWFsaXplZCkpIHtcbiAgICByZXR1cm4geyBraW5kOiBcImhvbWVicmV3XCIsIGxhYmVsOiBcIkhvbWVicmV3XCIsIGRldGFpbDogc291cmNlUm9vdCB9O1xuICB9XG4gIGlmIChleGlzdHNTeW5jKGpvaW4oc291cmNlUm9vdCwgXCIuZ2l0XCIpKSkge1xuICAgIHJldHVybiB7IGtpbmQ6IFwibG9jYWwtZGV2XCIsIGxhYmVsOiBcIkxvY2FsIGRldmVsb3BtZW50IGNoZWNrb3V0XCIsIGRldGFpbDogc291cmNlUm9vdCB9O1xuICB9XG4gIGlmIChub3JtYWxpemVkLmVuZHNXaXRoKFwiLy5jaGF0Z3B0LXBsdXNwbHVzL3NvdXJjZVwiKSB8fCBub3JtYWxpemVkLmluY2x1ZGVzKFwiLy5jaGF0Z3B0LXBsdXNwbHVzL3NvdXJjZS9cIikgfHxcbiAgICBub3JtYWxpemVkLmVuZHNXaXRoKFwiLy5jb2RleC1wbHVzcGx1cy9zb3VyY2VcIikgfHwgbm9ybWFsaXplZC5pbmNsdWRlcyhcIi8uY29kZXgtcGx1c3BsdXMvc291cmNlL1wiKSkge1xuICAgIHJldHVybiB7IGtpbmQ6IFwiZ2l0aHViLXNvdXJjZVwiLCBsYWJlbDogXCJHaXRIdWIgc291cmNlIGluc3RhbGxlclwiLCBkZXRhaWw6IHNvdXJjZVJvb3QgfTtcbiAgfVxuICBpZiAoZXhpc3RzU3luYyhqb2luKHNvdXJjZVJvb3QsIFwicGFja2FnZS5qc29uXCIpKSkge1xuICAgIHJldHVybiB7IGtpbmQ6IFwic291cmNlLWFyY2hpdmVcIiwgbGFiZWw6IFwiU291cmNlIGFyY2hpdmVcIiwgZGV0YWlsOiBzb3VyY2VSb290IH07XG4gIH1cbiAgcmV0dXJuIHsga2luZDogXCJ1bmtub3duXCIsIGxhYmVsOiBcIlVua25vd25cIiwgZGV0YWlsOiBzb3VyY2VSb290IH07XG59XG5cbmZ1bmN0aW9uIHN0YXJ0SW5zdGFsbGVkQ2xpKGNsaTogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IHZvaWQge1xuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiAmJiBzdGFydEluc3RhbGxlZENsaVdpdGhMYXVuY2hkKGNsaSwgYXJncykpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgY2hpbGQgPSBzcGF3bihwcm9jZXNzLmV4ZWNQYXRoLCBbY2xpLCAuLi5hcmdzXSwge1xuICAgIGN3ZDogcmVzb2x2ZShkaXJuYW1lKGNsaSksIFwiLi5cIiwgXCIuLlwiLCBcIi4uXCIpLFxuICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQ0hBVEdQVF9QTFVTUExVU19NQU5VQUxfVVBEQVRFOiBcIjFcIiB9LFxuICAgIGRldGFjaGVkOiB0cnVlLFxuICAgIHN0ZGlvOiBcImlnbm9yZVwiLFxuICB9KTtcbiAgY2hpbGQudW5yZWYoKTtcbn1cblxuZnVuY3Rpb24gc3RhcnRJbnN0YWxsZWRDbGlXaXRoTGF1bmNoZChjbGk6IHN0cmluZywgYXJnczogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgY29uc3QgbGFiZWwgPSBgY29tLmNoYXRncHRwbHVzcGx1cy5wYXRjaC1oZWxwZXIuJHtwcm9jZXNzLnBpZH0uJHtEYXRlLm5vdygpfWA7XG4gIGNvbnN0IGNsZWFudXAgPSBgbGF1bmNoY3RsIHJlbW92ZSAke2xhYmVsfSA+L2Rldi9udWxsIDI+JjEgfHwgbGF1bmNoY3RsIGJvb3RvdXQgZ3VpLyQoaWQgLXUpLyR7bGFiZWx9ID4vZGV2L251bGwgMj4mMSB8fCB0cnVlYDtcbiAgY29uc3QgY29tbWFuZCA9IFtcbiAgICBgdHJhcCAke3NoZWxsUXVvdGUoY2xlYW51cCl9IEVYSVRgLFxuICAgIGBjZCAke3NoZWxsUXVvdGUocmVzb2x2ZShkaXJuYW1lKGNsaSksIFwiLi5cIiwgXCIuLlwiLCBcIi4uXCIpKX1gLFxuICAgIGBDSEFUR1BUX1BMVVNQTFVTX01BTlVBTF9VUERBVEU9MSAke1twcm9jZXNzLmV4ZWNQYXRoLCBjbGksIC4uLmFyZ3NdLm1hcChzaGVsbFF1b3RlKS5qb2luKFwiIFwiKX1gLFxuICBdLmpvaW4oXCIgJiYgXCIpO1xuICBjb25zdCByZXN1bHQgPSBzcGF3blN5bmMoXG4gICAgXCJsYXVuY2hjdGxcIixcbiAgICBbXG4gICAgICBcInN1Ym1pdFwiLFxuICAgICAgXCItbFwiLFxuICAgICAgbGFiZWwsXG4gICAgICBcIi0tXCIsXG4gICAgICBcIi9iaW4vc2hcIixcbiAgICAgIFwiLWNcIixcbiAgICAgIGAke2NvbW1hbmR9IHx8IHRydWVgLFxuICAgIF0sXG4gICAge1xuICAgICAgZW5jb2Rpbmc6IFwidXRmOFwiLFxuICAgICAgc3RkaW86IFwiaWdub3JlXCIsXG4gICAgfSxcbiAgKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDApIHJldHVybiB0cnVlO1xuICBsb2coXCJ3YXJuXCIsIGBsYXVuY2hjdGwgc3VibWl0IGZhaWxlZCBmb3IgQ2hhdEdQVCsrIHBhdGNoIGhlbHBlcjogJHtyZXN1bHQuZXJyb3I/Lm1lc3NhZ2UgPz8gcmVzdWx0LnN0YXR1c31gKTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBzaGVsbFF1b3RlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCcke3ZhbHVlLnJlcGxhY2UoLycvZywgYCdcXFxcJydgKX0nYDtcbn1cblxuZnVuY3Rpb24gbWFya1NlbGZVcGRhdGVTdGFydGVkKHNvdXJjZVJvb3Q6IHN0cmluZyk6IFNlbGZVcGRhdGVTdGF0ZSB7XG4gIGNvbnN0IGNvbmZpZyA9IHJlYWRTdGF0ZSgpLmNoYXRncHRQbHVzUGx1cztcbiAgY29uc3QgY2hhbm5lbCA9IGNvbmZpZz8udXBkYXRlQ2hhbm5lbCA/PyBcInN0YWJsZVwiO1xuICBjb25zdCBzdGF0ZTogU2VsZlVwZGF0ZVN0YXRlID0ge1xuICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIHN0YXR1czogXCJjaGVja2luZ1wiLFxuICAgIGN1cnJlbnRWZXJzaW9uOiBDSEFUR1BUX1BMVVNQTFVTX1ZFUlNJT04sXG4gICAgbGF0ZXN0VmVyc2lvbjogbnVsbCxcbiAgICB0YXJnZXRSZWY6IGNvbmZpZz8udXBkYXRlQ2hhbm5lbCA9PT0gXCJjdXN0b21cIiA/IGNvbmZpZy51cGRhdGVSZWYgPz8gbnVsbCA6IG51bGwsXG4gICAgcmVsZWFzZVVybDogbnVsbCxcbiAgICByZXBvOiBjb25maWc/LnVwZGF0ZVJlcG8gPz8gQ0hBVEdQVF9QTFVTUExVU19SRVBPLFxuICAgIGNoYW5uZWwsXG4gICAgc291cmNlUm9vdCxcbiAgICBpbnN0YWxsYXRpb25Tb3VyY2U6IGRlc2NyaWJlSW5zdGFsbGF0aW9uU291cmNlKHNvdXJjZVJvb3QpLFxuICB9O1xuICB3cml0ZVNlbGZVcGRhdGVTdGF0ZShzdGF0ZSk7XG4gIHJldHVybiBzdGF0ZTtcbn1cblxuZnVuY3Rpb24gYnJvYWRjYXN0UmVsb2FkKCk6IHZvaWQge1xuICBjb25zdCBwYXlsb2FkID0ge1xuICAgIGF0OiBEYXRlLm5vdygpLFxuICAgIHR3ZWFrczogdHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLm1hcCgodCkgPT4gdC5tYW5pZmVzdC5pZCksXG4gIH07XG4gIGZvciAoY29uc3Qgd2Mgb2Ygd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSkge1xuICAgIHRyeSB7XG4gICAgICB3Yy5zZW5kKFwiY29kZXhwcDp0d2Vha3MtY2hhbmdlZFwiLCBwYXlsb2FkKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2coXCJ3YXJuXCIsIFwiYnJvYWRjYXN0IHNlbmQgZmFpbGVkOlwiLCBlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFrZUxvZ2dlcihzY29wZTogc3RyaW5nKSB7XG4gIHJldHVybiB7XG4gICAgZGVidWc6ICguLi5hOiB1bmtub3duW10pID0+IGxvZyhcImluZm9cIiwgYFske3Njb3BlfV1gLCAuLi5hKSxcbiAgICBpbmZvOiAoLi4uYTogdW5rbm93bltdKSA9PiBsb2coXCJpbmZvXCIsIGBbJHtzY29wZX1dYCwgLi4uYSksXG4gICAgd2FybjogKC4uLmE6IHVua25vd25bXSkgPT4gbG9nKFwid2FyblwiLCBgWyR7c2NvcGV9XWAsIC4uLmEpLFxuICAgIGVycm9yOiAoLi4uYTogdW5rbm93bltdKSA9PiBsb2coXCJlcnJvclwiLCBgWyR7c2NvcGV9XWAsIC4uLmEpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBtYWtlTWFpbklwYyhpZDogc3RyaW5nKSB7XG4gIGNvbnN0IGNoID0gKGM6IHN0cmluZykgPT4gYGNvZGV4cHA6JHtpZH06JHtjfWA7XG4gIHJldHVybiB7XG4gICAgb246IChjOiBzdHJpbmcsIGg6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpID0+IHtcbiAgICAgIGNvbnN0IHdyYXBwZWQgPSAoX2U6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gaCguLi5hcmdzKTtcbiAgICAgIGlwY01haW4ub24oY2goYyksIHdyYXBwZWQpO1xuICAgICAgcmV0dXJuICgpID0+IGlwY01haW4ucmVtb3ZlTGlzdGVuZXIoY2goYyksIHdyYXBwZWQgYXMgbmV2ZXIpO1xuICAgIH0sXG4gICAgc2VuZDogKF9jOiBzdHJpbmcpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImlwYy5zZW5kIGlzIHJlbmRlcmVyXHUyMTkybWFpbjsgbWFpbiBzaWRlIHVzZXMgaGFuZGxlL29uXCIpO1xuICAgIH0sXG4gICAgaW52b2tlOiAoX2M6IHN0cmluZykgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaXBjLmludm9rZSBpcyByZW5kZXJlclx1MjE5Mm1haW47IG1haW4gc2lkZSB1c2VzIGhhbmRsZVwiKTtcbiAgICB9LFxuICAgIGhhbmRsZTogKGM6IHN0cmluZywgaGFuZGxlcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93bikgPT4ge1xuICAgICAgaXBjTWFpbi5oYW5kbGUoY2goYyksIChfZTogdW5rbm93biwgLi4uYXJnczogdW5rbm93bltdKSA9PiBoYW5kbGVyKC4uLmFyZ3MpKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBtYWtlTWFpbkZzKGlkOiBzdHJpbmcpIHtcbiAgY29uc3QgZGlyID0gam9pbih1c2VyUm9vdCEsIFwidHdlYWstZGF0YVwiLCBpZCk7XG4gIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBjb25zdCBmcyA9IHJlcXVpcmUoXCJub2RlOmZzL3Byb21pc2VzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJub2RlOmZzL3Byb21pc2VzXCIpO1xuICByZXR1cm4ge1xuICAgIGRhdGFEaXI6IGRpcixcbiAgICByZWFkOiAocDogc3RyaW5nKSA9PiBmcy5yZWFkRmlsZShqb2luKGRpciwgcCksIFwidXRmOFwiKSxcbiAgICB3cml0ZTogKHA6IHN0cmluZywgYzogc3RyaW5nKSA9PiBmcy53cml0ZUZpbGUoam9pbihkaXIsIHApLCBjLCBcInV0ZjhcIiksXG4gICAgZXhpc3RzOiBhc3luYyAocDogc3RyaW5nKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5hY2Nlc3Moam9pbihkaXIsIHApKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRSdW50aW1lSW5mbygpOiBDb2RleFJ1bnRpbWVJbmZvIHtcbiAgY29uc3QgaW5zdGFsbGVyU3RhdGUgPSByZWFkSW5zdGFsbGVyU3RhdGUoKTtcbiAgcmV0dXJuIGdldFJ1bnRpbWVJbmZvKHtcbiAgICB1c2VyUm9vdDogdXNlclJvb3QhLFxuICAgIHJ1bnRpbWVEaXI6IHJ1bnRpbWVEaXIhLFxuICAgIGNvZGV4VmVyc2lvbjogaW5zdGFsbGVyU3RhdGU/LmNvZGV4VmVyc2lvbiA/PyBudWxsLFxuICAgIGNoYW5uZWw6IG51bGwsXG4gICAgZ2V0V2luZG93U2VydmljZXM6IGdldENvZGV4V2luZG93U2VydmljZXMsXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50UnVudGltZUNhcGFiaWxpdGllcygpOiBDb2RleFJ1bnRpbWVDYXBhYmlsaXRpZXMge1xuICBjb25zdCBpbnN0YWxsZXJTdGF0ZSA9IHJlYWRJbnN0YWxsZXJTdGF0ZSgpO1xuICByZXR1cm4gZ2V0UnVudGltZUNhcGFiaWxpdGllcyh7XG4gICAgdXNlclJvb3Q6IHVzZXJSb290ISxcbiAgICBydW50aW1lRGlyOiBydW50aW1lRGlyISxcbiAgICBjb2RleFZlcnNpb246IGluc3RhbGxlclN0YXRlPy5jb2RleFZlcnNpb24gPz8gbnVsbCxcbiAgICBjaGFubmVsOiBudWxsLFxuICAgIGdldFdpbmRvd1NlcnZpY2VzOiBnZXRDb2RleFdpbmRvd1NlcnZpY2VzLFxuICAgIGdldE5hdGl2ZUNhcGFiaWxpdGllczogKCkgPT4gbmF0aXZlQnJpZGdlLmdldENhcGFiaWxpdGllcygpLFxuICAgIGdldFZpZXdDYXBhYmlsaXRpZXM6ICgpID0+IGdldE93bFZpZXdDYXBhYmlsaXRpZXMoKSxcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHR3ZWFrQ29udGV4dCh0d2Vha0lkOiBzdHJpbmcsIHBlcm1pc3Npb24/OiBUd2Vha1Blcm1pc3Npb24pOiBOYXRpdmVUd2Vha0NvbnRleHQge1xuICBjb25zdCB0d2VhayA9IHBlcm1pc3Npb25cbiAgICA/IGFzc2VydFR3ZWFrUGVybWlzc2lvbkZvcklkKHR3ZWFrSWQsIHBlcm1pc3Npb24pXG4gICAgOiB0d2Vha0J5SWQodHdlYWtJZCk7XG4gIHJldHVybiB7IGlkOiB0d2Vhay5tYW5pZmVzdC5pZCwgZGlyOiB0d2Vhay5kaXIgfTtcbn1cblxuZnVuY3Rpb24gdHdlYWtCeUlkKHR3ZWFrSWQ6IHN0cmluZyk6IERpc2NvdmVyZWRUd2VhayB7XG4gIGFzc2VydFR3ZWFrSWQodHdlYWtJZCk7XG4gIGNvbnN0IHR3ZWFrID0gdHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLmZpbmQoKGl0ZW0pID0+IGl0ZW0ubWFuaWZlc3QuaWQgPT09IHR3ZWFrSWQpO1xuICBpZiAoIXR3ZWFrKSB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gdHdlYWs6ICR7dHdlYWtJZH1gKTtcbiAgaWYgKCFpc1R3ZWFrRW5hYmxlZCh0d2Vha0lkKSkgdGhyb3cgbmV3IEVycm9yKGB0d2VhayBpcyBkaXNhYmxlZDogJHt0d2Vha0lkfWApO1xuICByZXR1cm4gdHdlYWs7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFR3ZWFrUGVybWlzc2lvbkZvcklkKHR3ZWFrSWQ6IHN0cmluZywgcGVybWlzc2lvbjogVHdlYWtQZXJtaXNzaW9uKTogRGlzY292ZXJlZFR3ZWFrIHtcbiAgY29uc3QgdHdlYWsgPSB0d2Vha0J5SWQodHdlYWtJZCk7XG4gIGFzc2VydFR3ZWFrUGVybWlzc2lvbih0d2VhaywgcGVybWlzc2lvbik7XG4gIHJldHVybiB0d2Vhaztcbn1cblxuZnVuY3Rpb24gYXNzZXJ0VHdlYWtWaWV3UGVybWlzc2lvbkZvcklkKHR3ZWFrSWQ6IHN0cmluZyk6IERpc2NvdmVyZWRUd2VhayB7XG4gIGNvbnN0IHR3ZWFrID0gdHdlYWtCeUlkKHR3ZWFrSWQpO1xuICBhc3NlcnRUd2Vha1ZpZXdQZXJtaXNzaW9uKHR3ZWFrKTtcbiAgcmV0dXJuIHR3ZWFrO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRUd2Vha1Blcm1pc3Npb24odHdlYWs6IERpc2NvdmVyZWRUd2VhaywgcGVybWlzc2lvbjogVHdlYWtQZXJtaXNzaW9uKTogdm9pZCB7XG4gIGlmICh0d2Vhay5tYW5pZmVzdC5wZXJtaXNzaW9ucz8uaW5jbHVkZXMocGVybWlzc2lvbikpIHJldHVybjtcbiAgdGhyb3cgbmV3IEVycm9yKGB0d2VhayAke3R3ZWFrLm1hbmlmZXN0LmlkfSBtdXN0IGRlY2xhcmUgJHtwZXJtaXNzaW9ufSBwZXJtaXNzaW9uYCk7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFR3ZWFrVmlld1Blcm1pc3Npb24odHdlYWs6IERpc2NvdmVyZWRUd2Vhayk6IHZvaWQge1xuICBpZiAoXG4gICAgdHdlYWsubWFuaWZlc3QucGVybWlzc2lvbnM/LmluY2x1ZGVzKFwiY29kZXgtdmlld3NcIikgfHxcbiAgICB0d2Vhay5tYW5pZmVzdC5wZXJtaXNzaW9ucz8uaW5jbHVkZXMoXCJjb2RleC52aWV3c1wiKVxuICApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGB0d2VhayAke3R3ZWFrLm1hbmlmZXN0LmlkfSBtdXN0IGRlY2xhcmUgY29kZXgtdmlld3MgcGVybWlzc2lvbmApO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRUd2Vha0lkKHR3ZWFrSWQ6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIS9eW2EtekEtWjAtOS5fLV0rJC8udGVzdCh0d2Vha0lkKSkgdGhyb3cgbmV3IEVycm9yKFwiYmFkIHR3ZWFrIGlkXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRQcmltYXJ5Q29kZXhXaW5kb3coKTogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwge1xuICBjb25zdCBzZXJ2aWNlcyA9IGdldENvZGV4V2luZG93U2VydmljZXMoKTtcbiAgY29uc3QgZnJvbVNlcnZpY2VzID0gdHlwZW9mIHNlcnZpY2VzPy5nZXRQcmltYXJ5V2luZG93ID09PSBcImZ1bmN0aW9uXCJcbiAgICA/IHNlcnZpY2VzLmdldFByaW1hcnlXaW5kb3coXCJsb2NhbFwiKVxuICAgIDogbnVsbDtcbiAgaWYgKGZyb21TZXJ2aWNlcyAmJiAhZnJvbVNlcnZpY2VzLmlzRGVzdHJveWVkKCkpIHJldHVybiBmcm9tU2VydmljZXM7XG4gIGNvbnN0IGZyb21NYW5hZ2VyID0gdHlwZW9mIHNlcnZpY2VzPy53aW5kb3dNYW5hZ2VyPy5nZXRQcmltYXJ5V2luZG93ID09PSBcImZ1bmN0aW9uXCJcbiAgICA/IHNlcnZpY2VzLndpbmRvd01hbmFnZXIuZ2V0UHJpbWFyeVdpbmRvdy5jYWxsKHNlcnZpY2VzLndpbmRvd01hbmFnZXIpXG4gICAgOiBudWxsO1xuICBpZiAoZnJvbU1hbmFnZXIgJiYgIWZyb21NYW5hZ2VyLmlzRGVzdHJveWVkKCkpIHJldHVybiBmcm9tTWFuYWdlcjtcbiAgY29uc3QgZm9jdXNlZCA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICBpZiAoZm9jdXNlZCAmJiAhZm9jdXNlZC5pc0Rlc3Ryb3llZCgpKSByZXR1cm4gZm9jdXNlZDtcbiAgcmV0dXJuIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmZpbmQoKHdpbikgPT4gIXdpbi5pc0Rlc3Ryb3llZCgpKSA/PyBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRQcmltYXJ5Q29kZXhXaW5kb3dSZWYoKTogQ29kZXhXaW5kb3dSZWYgfCBudWxsIHtcbiAgY29uc3Qgd2luID0gZ2V0UHJpbWFyeUNvZGV4V2luZG93KCk7XG4gIGlmICghd2luIHx8IHdpbi5pc0Rlc3Ryb3llZCgpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHsgd2luZG93SWQ6IHdpbi5pZCwgd2ViQ29udGVudHNJZDogd2luLndlYkNvbnRlbnRzLmlkIH07XG59XG5cbmZ1bmN0aW9uIGZvY3VzQ29kZXhXaW5kb3cod2luZG93SWQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmZyb21JZCh3aW5kb3dJZCk7XG4gIGlmICghd2luIHx8IHdpbi5pc0Rlc3Ryb3llZCgpKSByZXR1cm4gZmFsc2U7XG4gIGlmICh3aW4uaXNNaW5pbWl6ZWQoKSkgd2luLnJlc3RvcmUoKTtcbiAgd2luLnNob3coKTtcbiAgd2luLmZvY3VzKCk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBzaG93Q29kZXhXaW5kb3cod2luZG93SWQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmZyb21JZCh3aW5kb3dJZCk7XG4gIGlmICghd2luIHx8IHdpbi5pc0Rlc3Ryb3llZCgpKSByZXR1cm4gZmFsc2U7XG4gIHdpbi5zaG93KCk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRPd2xWaWV3Q2FwYWJpbGl0aWVzKCk6IENvZGV4UnVudGltZUNhcGFiaWxpdGllc1tcInZpZXdzXCJdIHtcbiAgY29uc3QgcGFyZW50ID0gZ2V0UHJpbWFyeUNvZGV4V2luZG93KCkgPz8gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gIGNvbnN0IGNvbnRlbnRWaWV3ID0gYXNSZWNvcmQocGFyZW50KT8uY29udGVudFZpZXc7XG4gIGxldCBzYW1wbGVWaWV3OiBFbGVjdHJvbi5Ccm93c2VyVmlldyB8IG51bGwgPSBudWxsO1xuICB0cnkge1xuICAgIHNhbXBsZVZpZXcgPSBuZXcgQnJvd3NlclZpZXcoeyB3ZWJQcmVmZXJlbmNlczogeyBzYW5kYm94OiB0cnVlIH0gfSk7XG4gIH0gY2F0Y2gge31cbiAgY29uc3Qgd2ViQ29udGVudHNWaWV3ID0gYXNSZWNvcmQoc2FtcGxlVmlldyk/LndlYkNvbnRlbnRzVmlldztcbiAgY29uc3QgcHJpdmF0ZVZpZXdUcmVlID0gdHlwZW9mIGFzUmVjb3JkKGNvbnRlbnRWaWV3KT8uYWRkQ2hpbGRWaWV3ID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICB0eXBlb2YgYXNSZWNvcmQoY29udGVudFZpZXcpPy5yZW1vdmVDaGlsZFZpZXcgPT09IFwiZnVuY3Rpb25cIjtcbiAgY29uc3Qgd2ViQ29udGVudHNWaWV3QXZhaWxhYmxlID0gQm9vbGVhbih3ZWJDb250ZW50c1ZpZXcpICYmXG4gICAgdHlwZW9mIGFzUmVjb3JkKHdlYkNvbnRlbnRzVmlldyk/LnNldEJvdW5kcyA9PT0gXCJmdW5jdGlvblwiO1xuICBjb25zdCBwcml2YXRlQXR0YWNoID0gcHJpdmF0ZVZpZXdUcmVlICYmIHdlYkNvbnRlbnRzVmlld0F2YWlsYWJsZTtcbiAgY29uc3QgYnJvd3NlclZpZXdGYWxsYmFjayA9IHR5cGVvZiBhc1JlY29yZChwYXJlbnQpPy5hZGRCcm93c2VyVmlldyA9PT0gXCJmdW5jdGlvblwiO1xuICB0cnkge1xuICAgIGlmIChzYW1wbGVWaWV3ICYmICFzYW1wbGVWaWV3LndlYkNvbnRlbnRzLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgIHNhbXBsZVZpZXcud2ViQ29udGVudHMuY2xvc2UoeyB3YWl0Rm9yQmVmb3JlVW5sb2FkOiBmYWxzZSB9KTtcbiAgICB9XG4gIH0gY2F0Y2gge31cbiAgcmV0dXJuIHtcbiAgICBjcmVhdGU6IHByaXZhdGVBdHRhY2ggfHwgYnJvd3NlclZpZXdGYWxsYmFjayxcbiAgICBwcml2YXRlVmlld1RyZWU6IHByaXZhdGVBdHRhY2gsXG4gICAgd2ViQ29udGVudHNWaWV3OiB3ZWJDb250ZW50c1ZpZXdBdmFpbGFibGUsXG4gICAgYnJvd3NlclZpZXdGYWxsYmFjayxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlT3dsVmlldyhcbiAgY3R4OiBOYXRpdmVUd2Vha0NvbnRleHQsXG4gIG9wdHM6IENvZGV4Vmlld0NyZWF0ZU9wdGlvbnMsXG4pOiBQcm9taXNlPENvZGV4Vmlld1JlZj4ge1xuICBjb25zdCBpZCA9IGFzc2VydEJyaWRnZUlkKG9wdHMuaWQgPz8gcmFuZG9tVVVJRCgpLCBcIkNvZGV4IHZpZXcgaWRcIik7XG4gIGNvbnN0IGtleSA9IG93bFZpZXdLZXkoY3R4LmlkLCBpZCk7XG4gIGlmIChvd2xWaWV3cy5oYXMoa2V5KSkgdGhyb3cgbmV3IEVycm9yKGBDb2RleCB2aWV3IGFscmVhZHkgZXhpc3RzOiAke2N0eC5pZH06JHtpZH1gKTtcblxuICBjb25zdCBwYXJlbnQgPSB0eXBlb2Ygb3B0cy5wYXJlbnRXaW5kb3dJZCA9PT0gXCJudW1iZXJcIlxuICAgID8gQnJvd3NlcldpbmRvdy5mcm9tSWQob3B0cy5wYXJlbnRXaW5kb3dJZClcbiAgICA6IGdldFByaW1hcnlDb2RleFdpbmRvdygpO1xuICBpZiAoIXBhcmVudCB8fCBpc1dpbmRvd0Rlc3Ryb3llZChwYXJlbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ29kZXggdmlldyBuZWVkcyBhbiBhY3RpdmUgcGFyZW50IHdpbmRvd1wiKTtcbiAgfVxuXG4gIGNvbnN0IHNlcnZpY2VzID0gZ2V0Q29kZXhXaW5kb3dTZXJ2aWNlcygpO1xuICBjb25zdCB3aW5kb3dNYW5hZ2VyID0gc2VydmljZXM/LndpbmRvd01hbmFnZXI7XG4gIGNvbnN0IHJvdXRlID0gb3B0cy5yb3V0ZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IG5vcm1hbGl6ZUNvZGV4Um91dGUob3B0cy5yb3V0ZSk7XG4gIGNvbnN0IGhvc3RJZCA9IG9wdHMuaG9zdElkIHx8IFwibG9jYWxcIjtcbiAgY29uc3QgdmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IG9wdHMucmVnaXN0ZXJXaXRoQ29kZXggPT09IGZhbHNlID8gdW5kZWZpbmVkIDogd2luZG93TWFuYWdlcj8ub3B0aW9ucz8ucHJlbG9hZFBhdGgsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgbm9kZUludGVncmF0aW9uOiBmYWxzZSxcbiAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgZGV2VG9vbHM6IHdpbmRvd01hbmFnZXI/Lm9wdGlvbnM/LmFsbG93RGV2dG9vbHMsXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKG9wdHMuYmFja2dyb3VuZENvbG9yKSB7XG4gICAgY2FsbE9iamVjdE1ldGhvZCh2aWV3LCBcInNldEJhY2tncm91bmRDb2xvclwiLCBbb3B0cy5iYWNrZ3JvdW5kQ29sb3JdKTtcbiAgICBjYWxsT2JqZWN0TWV0aG9kKGFzUmVjb3JkKHZpZXcpPy53ZWJDb250ZW50c1ZpZXcsIFwic2V0QmFja2dyb3VuZENvbG9yXCIsIFtvcHRzLmJhY2tncm91bmRDb2xvcl0pO1xuICB9XG5cbiAgY29uc3QgbWFuYWdlZDogTWFuYWdlZE93bFZpZXcgPSB7XG4gICAga2V5LFxuICAgIHR3ZWFrSWQ6IGN0eC5pZCxcbiAgICBpZCxcbiAgICB2aWV3LFxuICAgIHBhcmVudFdpbmRvd0lkOiB3aW5kb3dJZEZvcihwYXJlbnQpLFxuICAgIGF0dGFjaE1vZGU6IG51bGwsXG4gICAgZGlzcG9zZUJpbmRpbmdzOiBbXSxcbiAgICBkaXNwb3NlZDogZmFsc2UsXG4gIH07XG4gIG93bFZpZXdzLnNldChrZXksIG1hbmFnZWQpO1xuXG4gIHRyeSB7XG4gICAgaWYgKHJvdXRlICE9PSBudWxsICYmIG9wdHMucmVnaXN0ZXJXaXRoQ29kZXggIT09IGZhbHNlICYmIHdpbmRvd01hbmFnZXI/LnJlZ2lzdGVyV2luZG93KSB7XG4gICAgICBjb25zdCBhcHBlYXJhbmNlID0gb3B0cy5hcHBlYXJhbmNlIHx8IFwic2Vjb25kYXJ5XCI7XG4gICAgICBjb25zdCB3aW5kb3dMaWtlID0gbWFrZVdpbmRvd0xpa2VGb3JWaWV3KHZpZXcpO1xuICAgICAgd2luZG93TWFuYWdlci5yZWdpc3RlcldpbmRvdyh3aW5kb3dMaWtlLCBob3N0SWQsIGZhbHNlLCBhcHBlYXJhbmNlKTtcbiAgICAgIHNlcnZpY2VzPy5nZXRDb250ZXh0Py4oaG9zdElkKT8ucmVnaXN0ZXJXaW5kb3c/Lih3aW5kb3dMaWtlKTtcbiAgICB9XG5cbiAgICBhdHRhY2hPd2xWaWV3KG1hbmFnZWQsIHBhcmVudCk7XG4gICAgaWYgKG9wdHMuYm91bmRzKSBzZXRPd2xWaWV3Qm91bmRzKG1hbmFnZWQsIG9wdHMuYm91bmRzKTtcbiAgICBpZiAob3B0cy52aXNpYmxlID09PSBmYWxzZSkgc2V0T3dsVmlld1Zpc2libGUobWFuYWdlZCwgZmFsc2UpO1xuXG4gICAgaWYgKHJvdXRlICE9PSBudWxsKSB7XG4gICAgICBhd2FpdCB2aWV3LndlYkNvbnRlbnRzLmxvYWRVUkwoY29kZXhBcHBVcmwocm91dGUsIGhvc3RJZCkpO1xuICAgIH0gZWxzZSBpZiAob3B0cy51cmwpIHtcbiAgICAgIGF3YWl0IHZpZXcud2ViQ29udGVudHMubG9hZFVSTChub3JtYWxpemVPd2xWaWV3VXJsKG9wdHMudXJsKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHZpZXcud2ViQ29udGVudHMubG9hZFVSTChcImFib3V0OmJsYW5rXCIpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGRpc3Bvc2VPd2xWaWV3KG1hbmFnZWQpO1xuICAgIHRocm93IGU7XG4gIH1cblxuICBsb2coXCJpbmZvXCIsIGBjcmVhdGVkIE93bCB2aWV3ICR7Y3R4LmlkfToke2lkfWAsIHtcbiAgICBwYXJlbnRXaW5kb3dJZDogbWFuYWdlZC5wYXJlbnRXaW5kb3dJZCxcbiAgICB3ZWJDb250ZW50c0lkOiB2aWV3LndlYkNvbnRlbnRzLmlkLFxuICAgIGF0dGFjaE1vZGU6IG1hbmFnZWQuYXR0YWNoTW9kZSxcbiAgfSk7XG4gIHJldHVybiBvd2xWaWV3UmVmKG1hbmFnZWQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjYWxsT3dsVmlldyhcbiAgdHdlYWtJZDogc3RyaW5nLFxuICBpZDogc3RyaW5nLFxuICBtZXRob2Q6IHN0cmluZyxcbiAgYXJnPzogdW5rbm93bixcbiAgYXJnMj86IHVua25vd24sXG4pOiBQcm9taXNlPHVua25vd24+IHtcbiAgY29uc3QgdmlldyA9IG93bFZpZXdGb3IodHdlYWtJZCwgaWQpO1xuICBpZiAobWV0aG9kID09PSBcInNldEJvdW5kc1wiKSByZXR1cm4gc2V0T3dsVmlld0JvdW5kcyh2aWV3LCBhcmcgYXMgRWxlY3Ryb24uUmVjdGFuZ2xlKTtcbiAgaWYgKG1ldGhvZCA9PT0gXCJzZXRWaXNpYmxlXCIpIHJldHVybiBzZXRPd2xWaWV3VmlzaWJsZSh2aWV3LCBCb29sZWFuKGFyZykpO1xuICBpZiAobWV0aG9kID09PSBcImJyaW5nVG9Gcm9udFwiKSByZXR1cm4gYnJpbmdPd2xWaWV3VG9Gcm9udCh2aWV3KTtcbiAgaWYgKG1ldGhvZCA9PT0gXCJsb2FkUm91dGVcIikge1xuICAgIGNvbnN0IHJvdXRlID0gbm9ybWFsaXplQ29kZXhSb3V0ZShTdHJpbmcoYXJnKSk7XG4gICAgY29uc3QgaG9zdElkID0gdHlwZW9mIGFyZzIgPT09IFwic3RyaW5nXCIgJiYgYXJnMiA/IGFyZzIgOiBcImxvY2FsXCI7XG4gICAgcmV0dXJuIHZpZXcudmlldy53ZWJDb250ZW50cy5sb2FkVVJMKGNvZGV4QXBwVXJsKHJvdXRlLCBob3N0SWQpKTtcbiAgfVxuICBpZiAobWV0aG9kID09PSBcImxvYWRVcmxcIikgcmV0dXJuIHZpZXcudmlldy53ZWJDb250ZW50cy5sb2FkVVJMKG5vcm1hbGl6ZU93bFZpZXdVcmwoU3RyaW5nKGFyZykpKTtcbiAgaWYgKG1ldGhvZCA9PT0gXCJkaXNwb3NlXCIpIHJldHVybiBkaXNwb3NlT3dsVmlld0J5SWQodHdlYWtJZCwgaWQpO1xuICB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gQ29kZXggdmlldyBtZXRob2Q6ICR7bWV0aG9kfWApO1xufVxuXG5mdW5jdGlvbiBvd2xWaWV3UmVmKHZpZXc6IE1hbmFnZWRPd2xWaWV3KTogQ29kZXhWaWV3UmVmIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdmlldy5pZCxcbiAgICB3ZWJDb250ZW50c0lkOiB2aWV3LnZpZXcud2ViQ29udGVudHMuaWQsXG4gICAgcGFyZW50V2luZG93SWQ6IHZpZXcucGFyZW50V2luZG93SWQsXG4gICAgc2V0Qm91bmRzOiAoYm91bmRzKSA9PiBQcm9taXNlLnJlc29sdmUoc2V0T3dsVmlld0JvdW5kcyh2aWV3LCBib3VuZHMpKSxcbiAgICBzZXRWaXNpYmxlOiAodmlzaWJsZSkgPT4gUHJvbWlzZS5yZXNvbHZlKHNldE93bFZpZXdWaXNpYmxlKHZpZXcsIHZpc2libGUpKSxcbiAgICBicmluZ1RvRnJvbnQ6ICgpID0+IFByb21pc2UucmVzb2x2ZShicmluZ093bFZpZXdUb0Zyb250KHZpZXcpKSxcbiAgICBsb2FkUm91dGU6IChyb3V0ZSwgaG9zdElkKSA9PiB2aWV3LnZpZXcud2ViQ29udGVudHMubG9hZFVSTChjb2RleEFwcFVybChub3JtYWxpemVDb2RleFJvdXRlKHJvdXRlKSwgaG9zdElkIHx8IFwibG9jYWxcIikpLnRoZW4oKCkgPT4ge30pLFxuICAgIGxvYWRVcmw6ICh1cmwpID0+IHZpZXcudmlldy53ZWJDb250ZW50cy5sb2FkVVJMKG5vcm1hbGl6ZU93bFZpZXdVcmwodXJsKSkudGhlbigoKSA9PiB7fSksXG4gICAgZGlzcG9zZTogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKGRpc3Bvc2VPd2xWaWV3QnlJZCh2aWV3LnR3ZWFrSWQsIHZpZXcuaWQpKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXR0YWNoT3dsVmlldyh2aWV3OiBNYW5hZ2VkT3dsVmlldywgcGFyZW50OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93KTogdm9pZCB7XG4gIGNvbnN0IGNvbnRlbnRWaWV3ID0gYXNSZWNvcmQocGFyZW50KT8uY29udGVudFZpZXc7XG4gIGNvbnN0IHdlYkNvbnRlbnRzVmlldyA9IGFzUmVjb3JkKHZpZXcudmlldyk/LndlYkNvbnRlbnRzVmlldztcbiAgaWYgKHR5cGVvZiBhc1JlY29yZChwYXJlbnQpPy5hZGRCcm93c2VyVmlldyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2FsbE9iamVjdE1ldGhvZChwYXJlbnQsIFwiYWRkQnJvd3NlclZpZXdcIiwgW3ZpZXcudmlld10pO1xuICAgIHZpZXcuYXR0YWNoTW9kZSA9IFwiYnJvd3NlclZpZXdcIjtcbiAgfSBlbHNlIGlmIChcbiAgICB0eXBlb2YgYXNSZWNvcmQoY29udGVudFZpZXcpPy5hZGRDaGlsZFZpZXcgPT09IFwiZnVuY3Rpb25cIiAmJlxuICAgIHdlYkNvbnRlbnRzVmlld1xuICApIHtcbiAgICB0cnkge1xuICAgICAgYWRkT3dsQ2hpbGRWaWV3KHBhcmVudCwgdmlldy52aWV3KTtcbiAgICAgIHZpZXcuYXR0YWNoTW9kZSA9IFwiY29udGVudFZpZXdcIjtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2coXCJ3YXJuXCIsIFwiT3dsIGNvbnRlbnRWaWV3IGF0dGFjaG1lbnQgZmFpbGVkOyBmYWxsaW5nIGJhY2sgdG8gQnJvd3NlclZpZXdcIiwge1xuICAgICAgICB0d2Vha0lkOiB2aWV3LnR3ZWFrSWQsXG4gICAgICAgIHZpZXdJZDogdmlldy5pZCxcbiAgICAgICAgZXJyb3I6IFN0cmluZyhlKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBpZiAoIXZpZXcuYXR0YWNoTW9kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk93bCB2aWV3IGF0dGFjaG1lbnQgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGlzIENvZGV4IHdpbmRvd1wiKTtcbiAgfVxuXG4gIGNvbnN0IGRpc3Bvc2UgPSAoKSA9PiBkaXNwb3NlT3dsVmlld0J5SWQodmlldy50d2Vha0lkLCB2aWV3LmlkKTtcbiAgYmluZFdpbmRvd0V2ZW50KHBhcmVudCwgdmlldywgXCJjbG9zZWRcIiwgZGlzcG9zZSk7XG4gIGJpbmRXaW5kb3dFdmVudChwYXJlbnQsIHZpZXcsIFwiY2xvc2VcIiwgZGlzcG9zZSk7XG59XG5cbmZ1bmN0aW9uIGJyaW5nT3dsVmlld1RvRnJvbnQodmlldzogTWFuYWdlZE93bFZpZXcpOiB2b2lkIHtcbiAgaWYgKHZpZXcuZGlzcG9zZWQpIHJldHVybjtcbiAgY29uc3QgcGFyZW50ID0gdmlldy5wYXJlbnRXaW5kb3dJZCA9PT0gbnVsbCA/IG51bGwgOiBCcm93c2VyV2luZG93LmZyb21JZCh2aWV3LnBhcmVudFdpbmRvd0lkKTtcbiAgaWYgKCFwYXJlbnQgfHwgaXNXaW5kb3dEZXN0cm95ZWQocGFyZW50KSkgcmV0dXJuO1xuICBjb25zdCBjb250ZW50VmlldyA9IGFzUmVjb3JkKHBhcmVudCk/LmNvbnRlbnRWaWV3O1xuICBjb25zdCB3ZWJDb250ZW50c1ZpZXcgPSBhc1JlY29yZCh2aWV3LnZpZXcpPy53ZWJDb250ZW50c1ZpZXc7XG4gIGlmICh2aWV3LmF0dGFjaE1vZGUgPT09IFwiY29udGVudFZpZXdcIiAmJiB3ZWJDb250ZW50c1ZpZXcpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKHR5cGVvZiBhc1JlY29yZChwYXJlbnQpPy5zZXRUb3BCcm93c2VyVmlldyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGNhbGxPYmplY3RNZXRob2QocGFyZW50LCBcInNldFRvcEJyb3dzZXJWaWV3XCIsIFt2aWV3LnZpZXddKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxPYmplY3RNZXRob2QoY29udGVudFZpZXcsIFwiYWRkQ2hpbGRWaWV3XCIsIFt3ZWJDb250ZW50c1ZpZXddKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2coXCJ3YXJuXCIsIFwiT3dsIGNvbnRlbnRWaWV3IGJyaW5nLXRvLWZyb250IGZhaWxlZFwiLCB7XG4gICAgICAgIHR3ZWFrSWQ6IHZpZXcudHdlYWtJZCxcbiAgICAgICAgdmlld0lkOiB2aWV3LmlkLFxuICAgICAgICBlcnJvcjogU3RyaW5nKGUpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2YgYXNSZWNvcmQocGFyZW50KT8uc2V0VG9wQnJvd3NlclZpZXcgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNhbGxPYmplY3RNZXRob2QocGFyZW50LCBcInNldFRvcEJyb3dzZXJWaWV3XCIsIFt2aWV3LnZpZXddKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRPd2xWaWV3Qm91bmRzKHZpZXc6IE1hbmFnZWRPd2xWaWV3LCBib3VuZHM6IEVsZWN0cm9uLlJlY3RhbmdsZSk6IHZvaWQge1xuICBhc3NlcnRCb3VuZHMoYm91bmRzKTtcbiAgY2FsbE9iamVjdE1ldGhvZCh2aWV3LnZpZXcsIFwic2V0Qm91bmRzXCIsIFtib3VuZHNdKTtcbiAgY2FsbE9iamVjdE1ldGhvZChhc1JlY29yZCh2aWV3LnZpZXcpPy53ZWJDb250ZW50c1ZpZXcsIFwic2V0Qm91bmRzXCIsIFtib3VuZHNdKTtcbn1cblxuZnVuY3Rpb24gc2V0T3dsVmlld1Zpc2libGUodmlldzogTWFuYWdlZE93bFZpZXcsIHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY2FsbE9iamVjdE1ldGhvZChhc1JlY29yZCh2aWV3LnZpZXcpPy53ZWJDb250ZW50c1ZpZXcsIFwic2V0VmlzaWJsZVwiLCBbdmlzaWJsZV0pO1xufVxuXG5mdW5jdGlvbiBkaXNwb3NlT3dsVmlld0J5SWQodHdlYWtJZDogc3RyaW5nLCBpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHZpZXcgPSBvd2xWaWV3cy5nZXQob3dsVmlld0tleSh0d2Vha0lkLCBpZCkpO1xuICBpZiAoIXZpZXcpIHJldHVybjtcbiAgZGlzcG9zZU93bFZpZXcodmlldyk7XG59XG5cbmZ1bmN0aW9uIGRpc3Bvc2VPd2xWaWV3c0ZvclR3ZWFrKHR3ZWFrSWQ6IHN0cmluZyk6IHZvaWQge1xuICBmb3IgKGNvbnN0IHZpZXcgb2YgWy4uLm93bFZpZXdzLnZhbHVlcygpXSkge1xuICAgIGlmICh2aWV3LnR3ZWFrSWQgPT09IHR3ZWFrSWQpIGRpc3Bvc2VPd2xWaWV3KHZpZXcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRpc3Bvc2VBbGxPd2xWaWV3cygpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB2aWV3IG9mIFsuLi5vd2xWaWV3cy52YWx1ZXMoKV0pIGRpc3Bvc2VPd2xWaWV3KHZpZXcpO1xufVxuXG5mdW5jdGlvbiBkaXNwb3NlT3dsVmlldyh2aWV3OiBNYW5hZ2VkT3dsVmlldyk6IHZvaWQge1xuICBpZiAodmlldy5kaXNwb3NlZCkgcmV0dXJuO1xuICB2aWV3LmRpc3Bvc2VkID0gdHJ1ZTtcbiAgb3dsVmlld3MuZGVsZXRlKHZpZXcua2V5KTtcbiAgZm9yIChjb25zdCBkaXNwb3NlIG9mIHZpZXcuZGlzcG9zZUJpbmRpbmdzLnNwbGljZSgwKSkge1xuICAgIHRyeSB7XG4gICAgICBkaXNwb3NlKCk7XG4gICAgfSBjYXRjaCB7fVxuICB9XG4gIGNvbnN0IHBhcmVudCA9IHZpZXcucGFyZW50V2luZG93SWQgPT09IG51bGwgPyBudWxsIDogQnJvd3NlcldpbmRvdy5mcm9tSWQodmlldy5wYXJlbnRXaW5kb3dJZCk7XG4gIGlmIChwYXJlbnQgJiYgIWlzV2luZG93RGVzdHJveWVkKHBhcmVudCkpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKHZpZXcuYXR0YWNoTW9kZSA9PT0gXCJjb250ZW50Vmlld1wiKSB7XG4gICAgICAgIHJlbW92ZU93bENoaWxkVmlldyhwYXJlbnQsIHZpZXcudmlldyk7XG4gICAgICB9IGVsc2UgaWYgKHZpZXcuYXR0YWNoTW9kZSA9PT0gXCJicm93c2VyVmlld1wiKSB7XG4gICAgICAgIGNhbGxPYmplY3RNZXRob2QocGFyZW50LCBcInJlbW92ZUJyb3dzZXJWaWV3XCIsIFt2aWV3LnZpZXddKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2coXCJ3YXJuXCIsIFwiT3dsIHZpZXcgZGV0YWNoIGZhaWxlZCBkdXJpbmcgZGlzcG9zZVwiLCB7XG4gICAgICAgIHR3ZWFrSWQ6IHZpZXcudHdlYWtJZCxcbiAgICAgICAgdmlld0lkOiB2aWV3LmlkLFxuICAgICAgICBlcnJvcjogU3RyaW5nKGUpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHRyeSB7XG4gICAgaWYgKCF2aWV3LnZpZXcud2ViQ29udGVudHMuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgdmlldy52aWV3LndlYkNvbnRlbnRzLmNsb3NlKHsgd2FpdEZvckJlZm9yZVVubG9hZDogZmFsc2UgfSk7XG4gICAgfVxuICB9IGNhdGNoIHt9XG59XG5cbmZ1bmN0aW9uIG93bFZpZXdGb3IodHdlYWtJZDogc3RyaW5nLCBpZDogc3RyaW5nKTogTWFuYWdlZE93bFZpZXcge1xuICBjb25zdCB2aWV3ID0gb3dsVmlld3MuZ2V0KG93bFZpZXdLZXkodHdlYWtJZCwgaWQpKTtcbiAgaWYgKCF2aWV3IHx8IHZpZXcuZGlzcG9zZWQpIHRocm93IG5ldyBFcnJvcihgQ29kZXggdmlldyBpcyBub3QgbG9hZGVkOiAke3R3ZWFrSWR9OiR7aWR9YCk7XG4gIHJldHVybiB2aWV3O1xufVxuXG5mdW5jdGlvbiBvd2xWaWV3S2V5KHR3ZWFrSWQ6IHN0cmluZywgdmlld0lkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7dHdlYWtJZH06JHt2aWV3SWR9YDtcbn1cblxuZnVuY3Rpb24gYWRkT3dsQ2hpbGRWaWV3KHBhcmVudDogRWxlY3Ryb24uQnJvd3NlcldpbmRvdywgY2hpbGQ6IEVsZWN0cm9uLkJyb3dzZXJWaWV3KTogdm9pZCB7XG4gIGNvbnN0IG93bmVyV2luZG93ID0gYXNSZWNvcmQoY2hpbGQpPy5vd25lcldpbmRvdztcbiAgaWYgKG93bmVyV2luZG93ICYmIG93bmVyV2luZG93ICE9PSBwYXJlbnQpIHtcbiAgICBjYWxsT2JqZWN0TWV0aG9kKG93bmVyV2luZG93LCBcInJlbW92ZUJyb3dzZXJWaWV3XCIsIFtjaGlsZF0pO1xuICB9XG5cbiAgY2FsbE9iamVjdE1ldGhvZChhc1JlY29yZChwYXJlbnQpPy5jb250ZW50VmlldywgXCJhZGRDaGlsZFZpZXdcIiwgW2FzUmVjb3JkKGNoaWxkKT8ud2ViQ29udGVudHNWaWV3XSk7XG4gIHRyeSB7XG4gICAgKGNoaWxkIGFzIHVua25vd24gYXMgeyBvd25lcldpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfSkub3duZXJXaW5kb3cgPSBwYXJlbnQ7XG4gIH0gY2F0Y2gge31cbiAgY2FsbE9iamVjdE1ldGhvZChhc1JlY29yZChjaGlsZC53ZWJDb250ZW50cyksIFwiX3NldE93bmVyV2luZG93XCIsIFtwYXJlbnRdKTtcblxuICBjb25zdCBicm93c2VyVmlld3MgPSBhc1JlY29yZChwYXJlbnQpPy5fYnJvd3NlclZpZXdzO1xuICBpZiAoQXJyYXkuaXNBcnJheShicm93c2VyVmlld3MpICYmICFicm93c2VyVmlld3MuaW5jbHVkZXMoY2hpbGQpKSB7XG4gICAgYnJvd3NlclZpZXdzLnB1c2goY2hpbGQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU93bENoaWxkVmlldyhwYXJlbnQ6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3csIGNoaWxkOiBFbGVjdHJvbi5Ccm93c2VyVmlldyk6IHZvaWQge1xuICBjYWxsT2JqZWN0TWV0aG9kKGFzUmVjb3JkKHBhcmVudCk/LmNvbnRlbnRWaWV3LCBcInJlbW92ZUNoaWxkVmlld1wiLCBbYXNSZWNvcmQoY2hpbGQpPy53ZWJDb250ZW50c1ZpZXddKTtcbiAgdHJ5IHtcbiAgICAoY2hpbGQgYXMgdW5rbm93biBhcyB7IG93bmVyV2luZG93OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB9KS5vd25lcldpbmRvdyA9IG51bGw7XG4gIH0gY2F0Y2gge31cblxuICBjb25zdCBicm93c2VyVmlld3MgPSBhc1JlY29yZChwYXJlbnQpPy5fYnJvd3NlclZpZXdzO1xuICBpZiAoQXJyYXkuaXNBcnJheShicm93c2VyVmlld3MpKSB7XG4gICAgY29uc3QgaW5kZXggPSBicm93c2VyVmlld3MuaW5kZXhPZihjaGlsZCk7XG4gICAgaWYgKGluZGV4ID49IDApIGJyb3dzZXJWaWV3cy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUNvZGV4QnJvd3NlclZpZXcob3B0czogQ29kZXhDcmVhdGVWaWV3T3B0aW9ucyk6IFByb21pc2U8dW5rbm93bj4ge1xuICBjb25zdCBzZXJ2aWNlcyA9IGdldENvZGV4V2luZG93U2VydmljZXMoKTtcbiAgY29uc3Qgd2luZG93TWFuYWdlciA9IHNlcnZpY2VzPy53aW5kb3dNYW5hZ2VyO1xuICBpZiAoIXNlcnZpY2VzIHx8ICF3aW5kb3dNYW5hZ2VyPy5yZWdpc3RlcldpbmRvdykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiQ29kZXggZW1iZWRkZWQgdmlldyBzZXJ2aWNlcyBhcmUgbm90IGF2YWlsYWJsZS4gUmVpbnN0YWxsIENoYXRHUFQrKyAxLjAuMCBvciBsYXRlci5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3Qgcm91dGUgPSBub3JtYWxpemVDb2RleFJvdXRlKG9wdHMucm91dGUpO1xuICBjb25zdCBob3N0SWQgPSBvcHRzLmhvc3RJZCB8fCBcImxvY2FsXCI7XG4gIGNvbnN0IGFwcGVhcmFuY2UgPSBvcHRzLmFwcGVhcmFuY2UgfHwgXCJzZWNvbmRhcnlcIjtcbiAgY29uc3QgdmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHdpbmRvd01hbmFnZXIub3B0aW9ucz8ucHJlbG9hZFBhdGgsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgbm9kZUludGVncmF0aW9uOiBmYWxzZSxcbiAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgZGV2VG9vbHM6IHdpbmRvd01hbmFnZXIub3B0aW9ucz8uYWxsb3dEZXZ0b29scyxcbiAgICB9LFxuICB9KTtcbiAgY29uc3Qgd2luZG93TGlrZSA9IG1ha2VXaW5kb3dMaWtlRm9yVmlldyh2aWV3KTtcbiAgd2luZG93TWFuYWdlci5yZWdpc3RlcldpbmRvdyh3aW5kb3dMaWtlLCBob3N0SWQsIGZhbHNlLCBhcHBlYXJhbmNlKTtcbiAgc2VydmljZXMuZ2V0Q29udGV4dD8uKGhvc3RJZCk/LnJlZ2lzdGVyV2luZG93Py4od2luZG93TGlrZSk7XG4gIGF3YWl0IHZpZXcud2ViQ29udGVudHMubG9hZFVSTChjb2RleEFwcFVybChyb3V0ZSwgaG9zdElkKSk7XG4gIHJldHVybiB2aWV3O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVDb2RleFdpbmRvdyhvcHRzOiBDb2RleENyZWF0ZVdpbmRvd09wdGlvbnMpOiBQcm9taXNlPENvZGV4V2luZG93UmVmPiB7XG4gIGNvbnN0IHNlcnZpY2VzID0gZ2V0Q29kZXhXaW5kb3dTZXJ2aWNlcygpO1xuICBpZiAoIXNlcnZpY2VzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJDb2RleCB3aW5kb3cgc2VydmljZXMgYXJlIG5vdCBhdmFpbGFibGUuIFJlaW5zdGFsbCBDaGF0R1BUKysgMS4wLjAgb3IgbGF0ZXIuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHJvdXRlID0gbm9ybWFsaXplQ29kZXhSb3V0ZShvcHRzLnJvdXRlKTtcbiAgY29uc3QgaG9zdElkID0gb3B0cy5ob3N0SWQgfHwgXCJsb2NhbFwiO1xuICBjb25zdCBwYXJlbnQgPSB0eXBlb2Ygb3B0cy5wYXJlbnRXaW5kb3dJZCA9PT0gXCJudW1iZXJcIlxuICAgID8gQnJvd3NlcldpbmRvdy5mcm9tSWQob3B0cy5wYXJlbnRXaW5kb3dJZClcbiAgICA6IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICBjb25zdCBjcmVhdGVXaW5kb3cgPSBzZXJ2aWNlcy53aW5kb3dNYW5hZ2VyPy5jcmVhdGVXaW5kb3c7XG5cbiAgbGV0IHdpbjogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQ7XG4gIGlmICh0eXBlb2YgY3JlYXRlV2luZG93ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB3aW4gPSBhd2FpdCBjcmVhdGVXaW5kb3cuY2FsbChzZXJ2aWNlcy53aW5kb3dNYW5hZ2VyLCB7XG4gICAgICBpbml0aWFsUm91dGU6IHJvdXRlLFxuICAgICAgaG9zdElkLFxuICAgICAgc2hvdzogb3B0cy5zaG93ICE9PSBmYWxzZSxcbiAgICAgIGFwcGVhcmFuY2U6IG9wdHMuYXBwZWFyYW5jZSB8fCBcInNlY29uZGFyeVwiLFxuICAgICAgcGFyZW50LFxuICAgIH0pO1xuICB9IGVsc2UgaWYgKGhvc3RJZCA9PT0gXCJsb2NhbFwiICYmIHR5cGVvZiBzZXJ2aWNlcy5jcmVhdGVGcmVzaFdpbmRvdyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgd2luID0gYXdhaXQgc2VydmljZXMuY3JlYXRlRnJlc2hXaW5kb3cocm91dGUpO1xuICB9IGVsc2UgaWYgKGhvc3RJZCA9PT0gXCJsb2NhbFwiICYmIHR5cGVvZiBzZXJ2aWNlcy5jcmVhdGVGcmVzaExvY2FsV2luZG93ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB3aW4gPSBhd2FpdCBzZXJ2aWNlcy5jcmVhdGVGcmVzaExvY2FsV2luZG93KHJvdXRlKTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygc2VydmljZXMuZW5zdXJlSG9zdFdpbmRvdyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgd2luID0gYXdhaXQgc2VydmljZXMuZW5zdXJlSG9zdFdpbmRvdyhob3N0SWQpO1xuICB9XG5cbiAgaWYgKCF3aW4gfHwgd2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2RleCBkaWQgbm90IHJldHVybiBhIHdpbmRvdyBmb3IgdGhlIHJlcXVlc3RlZCByb3V0ZVwiKTtcbiAgfVxuXG4gIGlmIChvcHRzLmJvdW5kcykge1xuICAgIHdpbi5zZXRCb3VuZHMob3B0cy5ib3VuZHMpO1xuICB9XG4gIGlmIChwYXJlbnQgJiYgIXBhcmVudC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdpbi5zZXRQYXJlbnRXaW5kb3cocGFyZW50KTtcbiAgICB9IGNhdGNoIHt9XG4gIH1cbiAgaWYgKG9wdHMuc2hvdyAhPT0gZmFsc2UpIHtcbiAgICB3aW4uc2hvdygpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB3aW5kb3dJZDogd2luLmlkLFxuICAgIHdlYkNvbnRlbnRzSWQ6IHdpbi53ZWJDb250ZW50cy5pZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWFrZUNvZGV4QXBpKHR3ZWFrOiBEaXNjb3ZlcmVkVHdlYWspIHtcbiAgY29uc3QgY3R4ID0gKCk6IE5hdGl2ZVR3ZWFrQ29udGV4dCA9PiAoeyBpZDogdHdlYWsubWFuaWZlc3QuaWQsIGRpcjogdHdlYWsuZGlyIH0pO1xuICByZXR1cm4ge1xuICAgIHJ1bnRpbWU6IHtcbiAgICAgIGdldEluZm86IGFzeW5jICgpID0+IGN1cnJlbnRSdW50aW1lSW5mbygpLFxuICAgICAgZ2V0Q2FwYWJpbGl0aWVzOiBhc3luYyAoKSA9PiBjdXJyZW50UnVudGltZUNhcGFiaWxpdGllcygpLFxuICAgIH0sXG4gICAgd2luZG93czoge1xuICAgICAgY3JlYXRlOiBjcmVhdGVDb2RleFdpbmRvdyxcbiAgICAgIGdldFByaW1hcnk6IGFzeW5jICgpID0+IGdldFByaW1hcnlDb2RleFdpbmRvd1JlZigpLFxuICAgICAgZm9jdXM6IGFzeW5jICh3aW5kb3dJZDogbnVtYmVyKSA9PiBmb2N1c0NvZGV4V2luZG93KHdpbmRvd0lkKSxcbiAgICAgIHNob3c6IGFzeW5jICh3aW5kb3dJZDogbnVtYmVyKSA9PiBzaG93Q29kZXhXaW5kb3cod2luZG93SWQpLFxuICAgIH0sXG4gICAgdmlld3M6IHtcbiAgICAgIGNyZWF0ZTogYXN5bmMgKG9wdGlvbnM6IENvZGV4Vmlld0NyZWF0ZU9wdGlvbnMpID0+IHtcbiAgICAgICAgYXNzZXJ0VHdlYWtWaWV3UGVybWlzc2lvbih0d2Vhayk7XG4gICAgICAgIHJldHVybiBjcmVhdGVPd2xWaWV3KGN0eCgpLCBvcHRpb25zKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjZHA6IHtcbiAgICAgIGdldFN0YXR1czogYXN5bmMgKCkgPT4gZ2V0Q2RwU3RhdHVzKCksXG4gICAgICBsaXN0VGFyZ2V0czogYXN5bmMgKCkgPT4gbGlzdENkcFRhcmdldHMoKSxcbiAgICB9LFxuICAgIG5hdGl2ZToge1xuICAgICAgbG9hZE1vZHVsZTogYXN5bmMgKG9wdGlvbnM6IE5hdGl2ZU1vZHVsZUxvYWRPcHRpb25zKSA9PiB7XG4gICAgICAgIGFzc2VydFR3ZWFrUGVybWlzc2lvbih0d2VhaywgXCJuYXRpdmUtbW9kdWxlXCIpO1xuICAgICAgICByZXR1cm4gbmF0aXZlQnJpZGdlLmxvYWRNb2R1bGUoY3R4KCksIG9wdGlvbnMpO1xuICAgICAgfSxcbiAgICAgIGNyZWF0ZVBhbmVsOiBhc3luYyAob3B0aW9uczogTmF0aXZlUGFuZWxDcmVhdGVPcHRpb25zKSA9PiB7XG4gICAgICAgIGFzc2VydFR3ZWFrUGVybWlzc2lvbih0d2VhaywgXCJuYXRpdmUtdmlld1wiKTtcbiAgICAgICAgcmV0dXJuIG5hdGl2ZUJyaWRnZS5jcmVhdGVQYW5lbChjdHgoKSwgb3B0aW9ucyk7XG4gICAgICB9LFxuICAgICAgYXR0YWNoVmlldzogYXN5bmMgKG9wdGlvbnM6IE5hdGl2ZVZpZXdBdHRhY2hPcHRpb25zKSA9PiB7XG4gICAgICAgIGFzc2VydFR3ZWFrUGVybWlzc2lvbih0d2VhaywgXCJuYXRpdmUtdmlld1wiKTtcbiAgICAgICAgcmV0dXJuIG5hdGl2ZUJyaWRnZS5hdHRhY2hWaWV3KGN0eCgpLCBvcHRpb25zKTtcbiAgICAgIH0sXG4gICAgICBsYXVuY2hIZWxwZXI6IGFzeW5jIChvcHRpb25zOiBOYXRpdmVIZWxwZXJMYXVuY2hPcHRpb25zKSA9PiB7XG4gICAgICAgIGFzc2VydFR3ZWFrUGVybWlzc2lvbih0d2VhaywgXCJuYXRpdmUtaGVscGVyXCIpO1xuICAgICAgICByZXR1cm4gbmF0aXZlQnJpZGdlLmxhdW5jaEhlbHBlcihjdHgoKSwgb3B0aW9ucyk7XG4gICAgICB9LFxuICAgIH0sXG4gICAgY3JlYXRlQnJvd3NlclZpZXc6IGNyZWF0ZUNvZGV4QnJvd3NlclZpZXcsXG4gICAgY3JlYXRlV2luZG93OiBjcmVhdGVDb2RleFdpbmRvdyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWFrZVdpbmRvd0xpa2VGb3JWaWV3KHZpZXc6IEVsZWN0cm9uLkJyb3dzZXJWaWV3KTogQ29kZXhXaW5kb3dMaWtlIHtcbiAgY29uc3Qgdmlld0JvdW5kcyA9ICgpID0+IHZpZXcuZ2V0Qm91bmRzKCk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHZpZXcud2ViQ29udGVudHMuaWQsXG4gICAgd2ViQ29udGVudHM6IHZpZXcud2ViQ29udGVudHMsXG4gICAgb246IChldmVudDogXCJjbG9zZWRcIiwgbGlzdGVuZXI6ICgpID0+IHZvaWQpID0+IHtcbiAgICAgIGlmIChldmVudCA9PT0gXCJjbG9zZWRcIikge1xuICAgICAgICB2aWV3LndlYkNvbnRlbnRzLm9uY2UoXCJkZXN0cm95ZWRcIiwgbGlzdGVuZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmlldy53ZWJDb250ZW50cy5vbihldmVudCwgbGlzdGVuZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZpZXc7XG4gICAgfSxcbiAgICBvbmNlOiAoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpID0+IHtcbiAgICAgIHZpZXcud2ViQ29udGVudHMub25jZShldmVudCBhcyBcImRlc3Ryb3llZFwiLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIG9mZjogKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKSA9PiB7XG4gICAgICB2aWV3LndlYkNvbnRlbnRzLm9mZihldmVudCBhcyBcImRlc3Ryb3llZFwiLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIHJlbW92ZUxpc3RlbmVyOiAoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpID0+IHtcbiAgICAgIHZpZXcud2ViQ29udGVudHMucmVtb3ZlTGlzdGVuZXIoZXZlbnQgYXMgXCJkZXN0cm95ZWRcIiwgbGlzdGVuZXIpO1xuICAgICAgcmV0dXJuIHZpZXc7XG4gICAgfSxcbiAgICBpc0Rlc3Ryb3llZDogKCkgPT4gdmlldy53ZWJDb250ZW50cy5pc0Rlc3Ryb3llZCgpLFxuICAgIGlzRm9jdXNlZDogKCkgPT4gdmlldy53ZWJDb250ZW50cy5pc0ZvY3VzZWQoKSxcbiAgICBmb2N1czogKCkgPT4gdmlldy53ZWJDb250ZW50cy5mb2N1cygpLFxuICAgIHNob3c6ICgpID0+IHt9LFxuICAgIGhpZGU6ICgpID0+IHt9LFxuICAgIGdldEJvdW5kczogdmlld0JvdW5kcyxcbiAgICBnZXRDb250ZW50Qm91bmRzOiB2aWV3Qm91bmRzLFxuICAgIGdldFNpemU6ICgpID0+IHtcbiAgICAgIGNvbnN0IGIgPSB2aWV3Qm91bmRzKCk7XG4gICAgICByZXR1cm4gW2Iud2lkdGgsIGIuaGVpZ2h0XTtcbiAgICB9LFxuICAgIGdldENvbnRlbnRTaXplOiAoKSA9PiB7XG4gICAgICBjb25zdCBiID0gdmlld0JvdW5kcygpO1xuICAgICAgcmV0dXJuIFtiLndpZHRoLCBiLmhlaWdodF07XG4gICAgfSxcbiAgICBzZXRUaXRsZTogKCkgPT4ge30sXG4gICAgZ2V0VGl0bGU6ICgpID0+IFwiXCIsXG4gICAgc2V0UmVwcmVzZW50ZWRGaWxlbmFtZTogKCkgPT4ge30sXG4gICAgc2V0RG9jdW1lbnRFZGl0ZWQ6ICgpID0+IHt9LFxuICAgIHNldFdpbmRvd0J1dHRvblZpc2liaWxpdHk6ICgpID0+IHt9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb2RleEFwcFVybChyb3V0ZTogc3RyaW5nLCBob3N0SWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwoXCJhcHA6Ly8tL2luZGV4Lmh0bWxcIik7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwiaG9zdElkXCIsIGhvc3RJZCk7XG4gIGlmIChyb3V0ZSAhPT0gXCIvXCIpIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwiaW5pdGlhbFJvdXRlXCIsIHJvdXRlKTtcbiAgcmV0dXJuIHVybC50b1N0cmluZygpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVPd2xWaWV3VXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB1cmwgIT09IFwic3RyaW5nXCIgfHwgdXJsLmluY2x1ZGVzKFwiXFxuXCIpIHx8IHVybC5pbmNsdWRlcyhcIlxcclwiKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk93bCB2aWV3IFVSTCBtdXN0IGJlIGEgc3RyaW5nIHdpdGhvdXQgY29udHJvbCBjaGFyYWN0ZXJzXCIpO1xuICB9XG4gIGNvbnN0IHBhcnNlZCA9IG5ldyBVUkwodXJsKTtcbiAgaWYgKCFbXCJodHRwOlwiLCBcImh0dHBzOlwiLCBcImFwcDpcIiwgXCJmaWxlOlwiLCBcImRhdGE6XCIsIFwiYWJvdXQ6XCJdLmluY2x1ZGVzKHBhcnNlZC5wcm90b2NvbCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuc3VwcG9ydGVkIE93bCB2aWV3IFVSTCBwcm90b2NvbDogJHtwYXJzZWQucHJvdG9jb2x9YCk7XG4gIH1cbiAgcmV0dXJuIHBhcnNlZC50b1N0cmluZygpO1xufVxuXG5mdW5jdGlvbiBnZXRDb2RleFdpbmRvd1NlcnZpY2VzKCk6IENvZGV4V2luZG93U2VydmljZXMgfCBudWxsIHtcbiAgY29uc3Qgc2VydmljZXMgPSAoZ2xvYmFsVGhpcyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtDT0RFWF9XSU5ET1dfU0VSVklDRVNfS0VZXTtcbiAgcmV0dXJuIHNlcnZpY2VzICYmIHR5cGVvZiBzZXJ2aWNlcyA9PT0gXCJvYmplY3RcIiA/IChzZXJ2aWNlcyBhcyBDb2RleFdpbmRvd1NlcnZpY2VzKSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvZGV4Um91dGUocm91dGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2Ygcm91dGUgIT09IFwic3RyaW5nXCIgfHwgIXJvdXRlLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ29kZXggcm91dGUgbXVzdCBiZSBhbiBhYnNvbHV0ZSBhcHAgcm91dGVcIik7XG4gIH1cbiAgaWYgKHJvdXRlLmluY2x1ZGVzKFwiOi8vXCIpIHx8IHJvdXRlLmluY2x1ZGVzKFwiXFxuXCIpIHx8IHJvdXRlLmluY2x1ZGVzKFwiXFxyXCIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ29kZXggcm91dGUgbXVzdCBub3QgaW5jbHVkZSBhIHByb3RvY29sIG9yIGNvbnRyb2wgY2hhcmFjdGVyc1wiKTtcbiAgfVxuICByZXR1cm4gcm91dGU7XG59XG5cbmZ1bmN0aW9uIGFzUmVjb3JkKHZhbHVlOiB1bmtub3duKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsIHtcbiAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiA/IHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IDogbnVsbDtcbn1cblxuZnVuY3Rpb24gY2FsbE9iamVjdE1ldGhvZCh0YXJnZXQ6IHVua25vd24sIG1ldGhvZDogc3RyaW5nLCBhcmdzOiB1bmtub3duW10pOiB1bmtub3duIHtcbiAgY29uc3QgZm4gPSBhc1JlY29yZCh0YXJnZXQpPy5bbWV0aG9kXTtcbiAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gdW5kZWZpbmVkO1xuICByZXR1cm4gZm4uYXBwbHkodGFyZ2V0LCBhcmdzKTtcbn1cblxuZnVuY3Rpb24gaXNXaW5kb3dEZXN0cm95ZWQod2luOiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICBpZiAoIXdpbikgcmV0dXJuIHRydWU7XG4gIGNvbnN0IGZuID0gYXNSZWNvcmQod2luKT8uaXNEZXN0cm95ZWQ7XG4gIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGZhbHNlO1xuICB0cnkge1xuICAgIHJldHVybiBCb29sZWFuKGZuLmNhbGwod2luKSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdpbmRvd0lkRm9yKHdpbjogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgaWQgPSBhc1JlY29yZCh3aW4pPy5pZDtcbiAgcmV0dXJuIHR5cGVvZiBpZCA9PT0gXCJudW1iZXJcIiA/IGlkIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gYmluZFdpbmRvd0V2ZW50KFxuICB3aW46IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3csXG4gIHZpZXc6IE1hbmFnZWRPd2xWaWV3LFxuICBldmVudDogc3RyaW5nLFxuICBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCxcbik6IHZvaWQge1xuICBjb25zdCBvbiA9IGFzUmVjb3JkKHdpbik/Lm9uO1xuICBjb25zdCBvZmYgPSBhc1JlY29yZCh3aW4pPy5vZmY7XG4gIGlmICh0eXBlb2Ygb24gIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuICBvbi5jYWxsKHdpbiwgZXZlbnQsIGxpc3RlbmVyKTtcbiAgdmlldy5kaXNwb3NlQmluZGluZ3MucHVzaCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBvZmYgPT09IFwiZnVuY3Rpb25cIikgb2ZmLmNhbGwod2luLCBldmVudCwgbGlzdGVuZXIpO1xuICAgIGVsc2UgY2FsbE9iamVjdE1ldGhvZCh3aW4sIFwicmVtb3ZlTGlzdGVuZXJcIiwgW2V2ZW50LCBsaXN0ZW5lcl0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0QnJpZGdlSWQodmFsdWU6IHN0cmluZywgbGFiZWw6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIgfHwgIS9eW2EtekEtWjAtOS5fLV0rJC8udGVzdCh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bGFiZWx9IG1heSBvbmx5IGNvbnRhaW4gbGV0dGVycywgbnVtYmVycywgZG90cywgdW5kZXJzY29yZXMsIGFuZCBkYXNoZXNgKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGFzc2VydEJvdW5kcyhib3VuZHM6IEVsZWN0cm9uLlJlY3RhbmdsZSk6IHZvaWQge1xuICBjb25zdCB2YWx1ZXMgPSBbYm91bmRzPy54LCBib3VuZHM/LnksIGJvdW5kcz8ud2lkdGgsIGJvdW5kcz8uaGVpZ2h0XTtcbiAgaWYgKCF2YWx1ZXMuZXZlcnkoKHZhbHVlKSA9PiB0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJib3VuZHMgbXVzdCBjb250YWluIGZpbml0ZSB4LCB5LCB3aWR0aCwgYW5kIGhlaWdodCBudW1iZXJzXCIpO1xuICB9XG4gIGlmIChib3VuZHMud2lkdGggPCAwIHx8IGJvdW5kcy5oZWlnaHQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiYm91bmRzIHdpZHRoIGFuZCBoZWlnaHQgbXVzdCBiZSBub24tbmVnYXRpdmVcIik7XG4gIH1cbn1cblxuLy8gVG91Y2ggQnJvd3NlcldpbmRvdyB0byBrZWVwIGl0cyBpbXBvcnQgXHUyMDE0IG9sZGVyIEVsZWN0cm9uIGxpbnQgcnVsZXMuXG52b2lkIEJyb3dzZXJXaW5kb3c7XG4iLCAiLyohIGNob2tpZGFyIC0gTUlUIExpY2Vuc2UgKGMpIDIwMTIgUGF1bCBNaWxsZXIgKHBhdWxtaWxsci5jb20pICovXG5pbXBvcnQgeyBzdGF0IGFzIHN0YXRjYiB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IHN0YXQsIHJlYWRkaXIgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0ICogYXMgc3lzUGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHJlYWRkaXJwIH0gZnJvbSAncmVhZGRpcnAnO1xuaW1wb3J0IHsgTm9kZUZzSGFuZGxlciwgRVZFTlRTIGFzIEVWLCBpc1dpbmRvd3MsIGlzSUJNaSwgRU1QVFlfRk4sIFNUUl9DTE9TRSwgU1RSX0VORCwgfSBmcm9tICcuL2hhbmRsZXIuanMnO1xuY29uc3QgU0xBU0ggPSAnLyc7XG5jb25zdCBTTEFTSF9TTEFTSCA9ICcvLyc7XG5jb25zdCBPTkVfRE9UID0gJy4nO1xuY29uc3QgVFdPX0RPVFMgPSAnLi4nO1xuY29uc3QgU1RSSU5HX1RZUEUgPSAnc3RyaW5nJztcbmNvbnN0IEJBQ0tfU0xBU0hfUkUgPSAvXFxcXC9nO1xuY29uc3QgRE9VQkxFX1NMQVNIX1JFID0gL1xcL1xcLy87XG5jb25zdCBET1RfUkUgPSAvXFwuLipcXC4oc3dbcHhdKSR8fiR8XFwuc3VibC4qXFwudG1wLztcbmNvbnN0IFJFUExBQ0VSX1JFID0gL15cXC5bL1xcXFxdLztcbmZ1bmN0aW9uIGFycmlmeShpdGVtKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtIDogW2l0ZW1dO1xufVxuY29uc3QgaXNNYXRjaGVyT2JqZWN0ID0gKG1hdGNoZXIpID0+IHR5cGVvZiBtYXRjaGVyID09PSAnb2JqZWN0JyAmJiBtYXRjaGVyICE9PSBudWxsICYmICEobWF0Y2hlciBpbnN0YW5jZW9mIFJlZ0V4cCk7XG5mdW5jdGlvbiBjcmVhdGVQYXR0ZXJuKG1hdGNoZXIpIHtcbiAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiBtYXRjaGVyO1xuICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiAoc3RyaW5nKSA9PiBtYXRjaGVyID09PSBzdHJpbmc7XG4gICAgaWYgKG1hdGNoZXIgaW5zdGFuY2VvZiBSZWdFeHApXG4gICAgICAgIHJldHVybiAoc3RyaW5nKSA9PiBtYXRjaGVyLnRlc3Qoc3RyaW5nKTtcbiAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09ICdvYmplY3QnICYmIG1hdGNoZXIgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIChzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChtYXRjaGVyLnBhdGggPT09IHN0cmluZylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChtYXRjaGVyLnJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aXZlID0gc3lzUGF0aC5yZWxhdGl2ZShtYXRjaGVyLnBhdGgsIHN0cmluZyk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhcmVsYXRpdmUuc3RhcnRzV2l0aCgnLi4nKSAmJiAhc3lzUGF0aC5pc0Fic29sdXRlKHJlbGF0aXZlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IGZhbHNlO1xufVxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aChwYXRoKSB7XG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdHJpbmcgZXhwZWN0ZWQnKTtcbiAgICBwYXRoID0gc3lzUGF0aC5ub3JtYWxpemUocGF0aCk7XG4gICAgcGF0aCA9IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGxldCBwcmVwZW5kID0gZmFsc2U7XG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLy8nKSlcbiAgICAgICAgcHJlcGVuZCA9IHRydWU7XG4gICAgY29uc3QgRE9VQkxFX1NMQVNIX1JFID0gL1xcL1xcLy87XG4gICAgd2hpbGUgKHBhdGgubWF0Y2goRE9VQkxFX1NMQVNIX1JFKSlcbiAgICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZShET1VCTEVfU0xBU0hfUkUsICcvJyk7XG4gICAgaWYgKHByZXBlbmQpXG4gICAgICAgIHBhdGggPSAnLycgKyBwYXRoO1xuICAgIHJldHVybiBwYXRoO1xufVxuZnVuY3Rpb24gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZywgc3RhdHMpIHtcbiAgICBjb25zdCBwYXRoID0gbm9ybWFsaXplUGF0aCh0ZXN0U3RyaW5nKTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcGF0dGVybnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBwYXR0ZXJuc1tpbmRleF07XG4gICAgICAgIGlmIChwYXR0ZXJuKHBhdGgsIHN0YXRzKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gYW55bWF0Y2gobWF0Y2hlcnMsIHRlc3RTdHJpbmcpIHtcbiAgICBpZiAobWF0Y2hlcnMgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdhbnltYXRjaDogc3BlY2lmeSBmaXJzdCBhcmd1bWVudCcpO1xuICAgIH1cbiAgICAvLyBFYXJseSBjYWNoZSBmb3IgbWF0Y2hlcnMuXG4gICAgY29uc3QgbWF0Y2hlcnNBcnJheSA9IGFycmlmeShtYXRjaGVycyk7XG4gICAgY29uc3QgcGF0dGVybnMgPSBtYXRjaGVyc0FycmF5Lm1hcCgobWF0Y2hlcikgPT4gY3JlYXRlUGF0dGVybihtYXRjaGVyKSk7XG4gICAgaWYgKHRlc3RTdHJpbmcgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gKHRlc3RTdHJpbmcsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZywgc3RhdHMpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZyk7XG59XG5jb25zdCB1bmlmeVBhdGhzID0gKHBhdGhzXykgPT4ge1xuICAgIGNvbnN0IHBhdGhzID0gYXJyaWZ5KHBhdGhzXykuZmxhdCgpO1xuICAgIGlmICghcGF0aHMuZXZlcnkoKHApID0+IHR5cGVvZiBwID09PSBTVFJJTkdfVFlQRSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm9uLXN0cmluZyBwcm92aWRlZCBhcyB3YXRjaCBwYXRoOiAke3BhdGhzfWApO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aHMubWFwKG5vcm1hbGl6ZVBhdGhUb1VuaXgpO1xufTtcbi8vIElmIFNMQVNIX1NMQVNIIG9jY3VycyBhdCB0aGUgYmVnaW5uaW5nIG9mIHBhdGgsIGl0IGlzIG5vdCByZXBsYWNlZFxuLy8gICAgIGJlY2F1c2UgXCIvL1N0b3JhZ2VQQy9Ecml2ZVBvb2wvTW92aWVzXCIgaXMgYSB2YWxpZCBuZXR3b3JrIHBhdGhcbmNvbnN0IHRvVW5peCA9IChzdHJpbmcpID0+IHtcbiAgICBsZXQgc3RyID0gc3RyaW5nLnJlcGxhY2UoQkFDS19TTEFTSF9SRSwgU0xBU0gpO1xuICAgIGxldCBwcmVwZW5kID0gZmFsc2U7XG4gICAgaWYgKHN0ci5zdGFydHNXaXRoKFNMQVNIX1NMQVNIKSkge1xuICAgICAgICBwcmVwZW5kID0gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHN0ci5tYXRjaChET1VCTEVfU0xBU0hfUkUpKSB7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKERPVUJMRV9TTEFTSF9SRSwgU0xBU0gpO1xuICAgIH1cbiAgICBpZiAocHJlcGVuZCkge1xuICAgICAgICBzdHIgPSBTTEFTSCArIHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbn07XG4vLyBPdXIgdmVyc2lvbiBvZiB1cGF0aC5ub3JtYWxpemVcbi8vIFRPRE86IHRoaXMgaXMgbm90IGVxdWFsIHRvIHBhdGgtbm9ybWFsaXplIG1vZHVsZSAtIGludmVzdGlnYXRlIHdoeVxuY29uc3Qgbm9ybWFsaXplUGF0aFRvVW5peCA9IChwYXRoKSA9PiB0b1VuaXgoc3lzUGF0aC5ub3JtYWxpemUodG9Vbml4KHBhdGgpKSk7XG4vLyBUT0RPOiByZWZhY3RvclxuY29uc3Qgbm9ybWFsaXplSWdub3JlZCA9IChjd2QgPSAnJykgPT4gKHBhdGgpID0+IHtcbiAgICBpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBub3JtYWxpemVQYXRoVG9Vbml4KHN5c1BhdGguaXNBYnNvbHV0ZShwYXRoKSA/IHBhdGggOiBzeXNQYXRoLmpvaW4oY3dkLCBwYXRoKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG59O1xuY29uc3QgZ2V0QWJzb2x1dGVQYXRoID0gKHBhdGgsIGN3ZCkgPT4ge1xuICAgIGlmIChzeXNQYXRoLmlzQWJzb2x1dGUocGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxuICAgIHJldHVybiBzeXNQYXRoLmpvaW4oY3dkLCBwYXRoKTtcbn07XG5jb25zdCBFTVBUWV9TRVQgPSBPYmplY3QuZnJlZXplKG5ldyBTZXQoKSk7XG4vKipcbiAqIERpcmVjdG9yeSBlbnRyeS5cbiAqL1xuY2xhc3MgRGlyRW50cnkge1xuICAgIGNvbnN0cnVjdG9yKGRpciwgcmVtb3ZlV2F0Y2hlcikge1xuICAgICAgICB0aGlzLnBhdGggPSBkaXI7XG4gICAgICAgIHRoaXMuX3JlbW92ZVdhdGNoZXIgPSByZW1vdmVXYXRjaGVyO1xuICAgICAgICB0aGlzLml0ZW1zID0gbmV3IFNldCgpO1xuICAgIH1cbiAgICBhZGQoaXRlbSkge1xuICAgICAgICBjb25zdCB7IGl0ZW1zIH0gPSB0aGlzO1xuICAgICAgICBpZiAoIWl0ZW1zKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAoaXRlbSAhPT0gT05FX0RPVCAmJiBpdGVtICE9PSBUV09fRE9UUylcbiAgICAgICAgICAgIGl0ZW1zLmFkZChpdGVtKTtcbiAgICB9XG4gICAgYXN5bmMgcmVtb3ZlKGl0ZW0pIHtcbiAgICAgICAgY29uc3QgeyBpdGVtcyB9ID0gdGhpcztcbiAgICAgICAgaWYgKCFpdGVtcylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgaXRlbXMuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBpZiAoaXRlbXMuc2l6ZSA+IDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IGRpciA9IHRoaXMucGF0aDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHJlYWRkaXIoZGlyKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcmVtb3ZlV2F0Y2hlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZVdhdGNoZXIoc3lzUGF0aC5kaXJuYW1lKGRpciksIHN5c1BhdGguYmFzZW5hbWUoZGlyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaGFzKGl0ZW0pIHtcbiAgICAgICAgY29uc3QgeyBpdGVtcyB9ID0gdGhpcztcbiAgICAgICAgaWYgKCFpdGVtcylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGl0ZW1zLmhhcyhpdGVtKTtcbiAgICB9XG4gICAgZ2V0Q2hpbGRyZW4oKSB7XG4gICAgICAgIGNvbnN0IHsgaXRlbXMgfSA9IHRoaXM7XG4gICAgICAgIGlmICghaXRlbXMpXG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIHJldHVybiBbLi4uaXRlbXMudmFsdWVzKCldO1xuICAgIH1cbiAgICBkaXNwb3NlKCkge1xuICAgICAgICB0aGlzLml0ZW1zLmNsZWFyKCk7XG4gICAgICAgIHRoaXMucGF0aCA9ICcnO1xuICAgICAgICB0aGlzLl9yZW1vdmVXYXRjaGVyID0gRU1QVFlfRk47XG4gICAgICAgIHRoaXMuaXRlbXMgPSBFTVBUWV9TRVQ7XG4gICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gICAgfVxufVxuY29uc3QgU1RBVF9NRVRIT0RfRiA9ICdzdGF0JztcbmNvbnN0IFNUQVRfTUVUSE9EX0wgPSAnbHN0YXQnO1xuZXhwb3J0IGNsYXNzIFdhdGNoSGVscGVyIHtcbiAgICBjb25zdHJ1Y3RvcihwYXRoLCBmb2xsb3csIGZzdykge1xuICAgICAgICB0aGlzLmZzdyA9IGZzdztcbiAgICAgICAgY29uc3Qgd2F0Y2hQYXRoID0gcGF0aDtcbiAgICAgICAgdGhpcy5wYXRoID0gcGF0aCA9IHBhdGgucmVwbGFjZShSRVBMQUNFUl9SRSwgJycpO1xuICAgICAgICB0aGlzLndhdGNoUGF0aCA9IHdhdGNoUGF0aDtcbiAgICAgICAgdGhpcy5mdWxsV2F0Y2hQYXRoID0gc3lzUGF0aC5yZXNvbHZlKHdhdGNoUGF0aCk7XG4gICAgICAgIHRoaXMuZGlyUGFydHMgPSBbXTtcbiAgICAgICAgdGhpcy5kaXJQYXJ0cy5mb3JFYWNoKChwYXJ0cykgPT4ge1xuICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpXG4gICAgICAgICAgICAgICAgcGFydHMucG9wKCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmZvbGxvd1N5bWxpbmtzID0gZm9sbG93O1xuICAgICAgICB0aGlzLnN0YXRNZXRob2QgPSBmb2xsb3cgPyBTVEFUX01FVEhPRF9GIDogU1RBVF9NRVRIT0RfTDtcbiAgICB9XG4gICAgZW50cnlQYXRoKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiBzeXNQYXRoLmpvaW4odGhpcy53YXRjaFBhdGgsIHN5c1BhdGgucmVsYXRpdmUodGhpcy53YXRjaFBhdGgsIGVudHJ5LmZ1bGxQYXRoKSk7XG4gICAgfVxuICAgIGZpbHRlclBhdGgoZW50cnkpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0cyB9ID0gZW50cnk7XG4gICAgICAgIGlmIChzdGF0cyAmJiBzdGF0cy5pc1N5bWJvbGljTGluaygpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyRGlyKGVudHJ5KTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gdGhpcy5lbnRyeVBhdGgoZW50cnkpO1xuICAgICAgICAvLyBUT0RPOiB3aGF0IGlmIHN0YXRzIGlzIHVuZGVmaW5lZD8gcmVtb3ZlICFcbiAgICAgICAgcmV0dXJuIHRoaXMuZnN3Ll9pc250SWdub3JlZChyZXNvbHZlZFBhdGgsIHN0YXRzKSAmJiB0aGlzLmZzdy5faGFzUmVhZFBlcm1pc3Npb25zKHN0YXRzKTtcbiAgICB9XG4gICAgZmlsdGVyRGlyKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZzdy5faXNudElnbm9yZWQodGhpcy5lbnRyeVBhdGgoZW50cnkpLCBlbnRyeS5zdGF0cyk7XG4gICAgfVxufVxuLyoqXG4gKiBXYXRjaGVzIGZpbGVzICYgZGlyZWN0b3JpZXMgZm9yIGNoYW5nZXMuIEVtaXR0ZWQgZXZlbnRzOlxuICogYGFkZGAsIGBhZGREaXJgLCBgY2hhbmdlYCwgYHVubGlua2AsIGB1bmxpbmtEaXJgLCBgYWxsYCwgYGVycm9yYFxuICpcbiAqICAgICBuZXcgRlNXYXRjaGVyKClcbiAqICAgICAgIC5hZGQoZGlyZWN0b3JpZXMpXG4gKiAgICAgICAub24oJ2FkZCcsIHBhdGggPT4gbG9nKCdGaWxlJywgcGF0aCwgJ3dhcyBhZGRlZCcpKVxuICovXG5leHBvcnQgY2xhc3MgRlNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICAvLyBOb3QgaW5kZW50aW5nIG1ldGhvZHMgZm9yIGhpc3Rvcnkgc2FrZTsgZm9yIG5vdy5cbiAgICBjb25zdHJ1Y3Rvcihfb3B0cyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuY2xvc2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fdGhyb3R0bGVkID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9zeW1saW5rUGF0aHMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3dhdGNoZWQgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3BlbmRpbmdXcml0ZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3BlbmRpbmdVbmxpbmtzID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLl9yZWFkeUNvdW50ID0gMDtcbiAgICAgICAgdGhpcy5fcmVhZHlFbWl0dGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGF3ZiA9IF9vcHRzLmF3YWl0V3JpdGVGaW5pc2g7XG4gICAgICAgIGNvbnN0IERFRl9BV0YgPSB7IHN0YWJpbGl0eVRocmVzaG9sZDogMjAwMCwgcG9sbEludGVydmFsOiAxMDAgfTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC8vIERlZmF1bHRzXG4gICAgICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLFxuICAgICAgICAgICAgaWdub3JlSW5pdGlhbDogZmFsc2UsXG4gICAgICAgICAgICBpZ25vcmVQZXJtaXNzaW9uRXJyb3JzOiBmYWxzZSxcbiAgICAgICAgICAgIGludGVydmFsOiAxMDAsXG4gICAgICAgICAgICBiaW5hcnlJbnRlcnZhbDogMzAwLFxuICAgICAgICAgICAgZm9sbG93U3ltbGlua3M6IHRydWUsXG4gICAgICAgICAgICB1c2VQb2xsaW5nOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHVzZUFzeW5jOiBmYWxzZSxcbiAgICAgICAgICAgIGF0b21pYzogdHJ1ZSwgLy8gTk9URTogb3ZlcndyaXR0ZW4gbGF0ZXIgKGRlcGVuZHMgb24gdXNlUG9sbGluZylcbiAgICAgICAgICAgIC4uLl9vcHRzLFxuICAgICAgICAgICAgLy8gQ2hhbmdlIGZvcm1hdFxuICAgICAgICAgICAgaWdub3JlZDogX29wdHMuaWdub3JlZCA/IGFycmlmeShfb3B0cy5pZ25vcmVkKSA6IGFycmlmeShbXSksXG4gICAgICAgICAgICBhd2FpdFdyaXRlRmluaXNoOiBhd2YgPT09IHRydWUgPyBERUZfQVdGIDogdHlwZW9mIGF3ZiA9PT0gJ29iamVjdCcgPyB7IC4uLkRFRl9BV0YsIC4uLmF3ZiB9IDogZmFsc2UsXG4gICAgICAgIH07XG4gICAgICAgIC8vIEFsd2F5cyBkZWZhdWx0IHRvIHBvbGxpbmcgb24gSUJNIGkgYmVjYXVzZSBmcy53YXRjaCgpIGlzIG5vdCBhdmFpbGFibGUgb24gSUJNIGkuXG4gICAgICAgIGlmIChpc0lCTWkpXG4gICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAvLyBFZGl0b3IgYXRvbWljIHdyaXRlIG5vcm1hbGl6YXRpb24gZW5hYmxlZCBieSBkZWZhdWx0IHdpdGggZnMud2F0Y2hcbiAgICAgICAgaWYgKG9wdHMuYXRvbWljID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICBvcHRzLmF0b21pYyA9ICFvcHRzLnVzZVBvbGxpbmc7XG4gICAgICAgIC8vIG9wdHMuYXRvbWljID0gdHlwZW9mIF9vcHRzLmF0b21pYyA9PT0gJ251bWJlcicgPyBfb3B0cy5hdG9taWMgOiAxMDA7XG4gICAgICAgIC8vIEdsb2JhbCBvdmVycmlkZS4gVXNlZnVsIGZvciBkZXZlbG9wZXJzLCB3aG8gbmVlZCB0byBmb3JjZSBwb2xsaW5nIGZvciBhbGxcbiAgICAgICAgLy8gaW5zdGFuY2VzIG9mIGNob2tpZGFyLCByZWdhcmRsZXNzIG9mIHVzYWdlIC8gZGVwZW5kZW5jeSBkZXB0aFxuICAgICAgICBjb25zdCBlbnZQb2xsID0gcHJvY2Vzcy5lbnYuQ0hPS0lEQVJfVVNFUE9MTElORztcbiAgICAgICAgaWYgKGVudlBvbGwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgZW52TG93ZXIgPSBlbnZQb2xsLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAoZW52TG93ZXIgPT09ICdmYWxzZScgfHwgZW52TG93ZXIgPT09ICcwJylcbiAgICAgICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGVsc2UgaWYgKGVudkxvd2VyID09PSAndHJ1ZScgfHwgZW52TG93ZXIgPT09ICcxJylcbiAgICAgICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIG9wdHMudXNlUG9sbGluZyA9ICEhZW52TG93ZXI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW52SW50ZXJ2YWwgPSBwcm9jZXNzLmVudi5DSE9LSURBUl9JTlRFUlZBTDtcbiAgICAgICAgaWYgKGVudkludGVydmFsKVxuICAgICAgICAgICAgb3B0cy5pbnRlcnZhbCA9IE51bWJlci5wYXJzZUludChlbnZJbnRlcnZhbCwgMTApO1xuICAgICAgICAvLyBUaGlzIGlzIGRvbmUgdG8gZW1pdCByZWFkeSBvbmx5IG9uY2UsIGJ1dCBlYWNoICdhZGQnIHdpbGwgaW5jcmVhc2UgdGhhdD9cbiAgICAgICAgbGV0IHJlYWR5Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9lbWl0UmVhZHkgPSAoKSA9PiB7XG4gICAgICAgICAgICByZWFkeUNhbGxzKys7XG4gICAgICAgICAgICBpZiAocmVhZHlDYWxscyA+PSB0aGlzLl9yZWFkeUNvdW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdFJlYWR5ID0gRU1QVFlfRk47XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVhZHlFbWl0dGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyB1c2UgcHJvY2Vzcy5uZXh0VGljayB0byBhbGxvdyB0aW1lIGZvciBsaXN0ZW5lciB0byBiZSBib3VuZFxuICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KEVWLlJFQURZKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2VtaXRSYXcgPSAoLi4uYXJncykgPT4gdGhpcy5lbWl0KEVWLlJBVywgLi4uYXJncyk7XG4gICAgICAgIHRoaXMuX2JvdW5kUmVtb3ZlID0gdGhpcy5fcmVtb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdHM7XG4gICAgICAgIHRoaXMuX25vZGVGc0hhbmRsZXIgPSBuZXcgTm9kZUZzSGFuZGxlcih0aGlzKTtcbiAgICAgICAgLy8gWW91XHUyMDE5cmUgZnJvemVuIHdoZW4geW91ciBoZWFydFx1MjAxOXMgbm90IG9wZW4uXG4gICAgICAgIE9iamVjdC5mcmVlemUob3B0cyk7XG4gICAgfVxuICAgIF9hZGRJZ25vcmVkUGF0aChtYXRjaGVyKSB7XG4gICAgICAgIGlmIChpc01hdGNoZXJPYmplY3QobWF0Y2hlcikpIHtcbiAgICAgICAgICAgIC8vIHJldHVybiBlYXJseSBpZiB3ZSBhbHJlYWR5IGhhdmUgYSBkZWVwbHkgZXF1YWwgbWF0Y2hlciBvYmplY3RcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWdub3JlZCBvZiB0aGlzLl9pZ25vcmVkUGF0aHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNNYXRjaGVyT2JqZWN0KGlnbm9yZWQpICYmXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQucGF0aCA9PT0gbWF0Y2hlci5wYXRoICYmXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQucmVjdXJzaXZlID09PSBtYXRjaGVyLnJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocy5hZGQobWF0Y2hlcik7XG4gICAgfVxuICAgIF9yZW1vdmVJZ25vcmVkUGF0aChtYXRjaGVyKSB7XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocy5kZWxldGUobWF0Y2hlcik7XG4gICAgICAgIC8vIG5vdyBmaW5kIGFueSBtYXRjaGVyIG9iamVjdHMgd2l0aCB0aGUgbWF0Y2hlciBhcyBwYXRoXG4gICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWdub3JlZCBvZiB0aGlzLl9pZ25vcmVkUGF0aHMpIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPICg0MzA4MWopOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQuXG4gICAgICAgICAgICAgICAgLy8gcHJvYmFibHkganVzdCBtYWtlIGEgYHRoaXMuX2lnbm9yZWREaXJlY3Rvcmllc2Agb3Igc29tZVxuICAgICAgICAgICAgICAgIC8vIHN1Y2ggdGhpbmcuXG4gICAgICAgICAgICAgICAgaWYgKGlzTWF0Y2hlck9iamVjdChpZ25vcmVkKSAmJiBpZ25vcmVkLnBhdGggPT09IG1hdGNoZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faWdub3JlZFBhdGhzLmRlbGV0ZShpZ25vcmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gUHVibGljIG1ldGhvZHNcbiAgICAvKipcbiAgICAgKiBBZGRzIHBhdGhzIHRvIGJlIHdhdGNoZWQgb24gYW4gZXhpc3RpbmcgRlNXYXRjaGVyIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSBwYXRoc18gZmlsZSBvciBmaWxlIGxpc3QuIE90aGVyIGFyZ3VtZW50cyBhcmUgdW51c2VkXG4gICAgICovXG4gICAgYWRkKHBhdGhzXywgX29yaWdBZGQsIF9pbnRlcm5hbCkge1xuICAgICAgICBjb25zdCB7IGN3ZCB9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgICB0aGlzLmNsb3NlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jbG9zZVByb21pc2UgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBwYXRocyA9IHVuaWZ5UGF0aHMocGF0aHNfKTtcbiAgICAgICAgaWYgKGN3ZCkge1xuICAgICAgICAgICAgcGF0aHMgPSBwYXRocy5tYXAoKHBhdGgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhYnNQYXRoID0gZ2V0QWJzb2x1dGVQYXRoKHBhdGgsIGN3ZCk7XG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgYHBhdGhgIGluc3RlYWQgb2YgYGFic1BhdGhgIGJlY2F1c2UgdGhlIGN3ZCBwb3J0aW9uIGNhbid0IGJlIGEgZ2xvYlxuICAgICAgICAgICAgICAgIHJldHVybiBhYnNQYXRoO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlSWdub3JlZFBhdGgocGF0aCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeUNvdW50KVxuICAgICAgICAgICAgdGhpcy5fcmVhZHlDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuX3JlYWR5Q291bnQgKz0gcGF0aHMubGVuZ3RoO1xuICAgICAgICBQcm9taXNlLmFsbChwYXRocy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuX25vZGVGc0hhbmRsZXIuX2FkZFRvTm9kZUZzKHBhdGgsICFfaW50ZXJuYWwsIHVuZGVmaW5lZCwgMCwgX29yaWdBZGQpO1xuICAgICAgICAgICAgaWYgKHJlcylcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0UmVhZHkoKTtcbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0pKS50aGVuKChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkKHN5c1BhdGguZGlybmFtZShpdGVtKSwgc3lzUGF0aC5iYXNlbmFtZShfb3JpZ0FkZCB8fCBpdGVtKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZSB3YXRjaGVycyBvciBzdGFydCBpZ25vcmluZyBldmVudHMgZnJvbSBzcGVjaWZpZWQgcGF0aHMuXG4gICAgICovXG4gICAgdW53YXRjaChwYXRoc18pIHtcbiAgICAgICAgaWYgKHRoaXMuY2xvc2VkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gdW5pZnlQYXRocyhwYXRoc18pO1xuICAgICAgICBjb25zdCB7IGN3ZCB9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBwYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRvIGFic29sdXRlIHBhdGggdW5sZXNzIHJlbGF0aXZlIHBhdGggYWxyZWFkeSBtYXRjaGVzXG4gICAgICAgICAgICBpZiAoIXN5c1BhdGguaXNBYnNvbHV0ZShwYXRoKSAmJiAhdGhpcy5fY2xvc2Vycy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoY3dkKVxuICAgICAgICAgICAgICAgICAgICBwYXRoID0gc3lzUGF0aC5qb2luKGN3ZCwgcGF0aCk7XG4gICAgICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGgucmVzb2x2ZShwYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2Nsb3NlUGF0aChwYXRoKTtcbiAgICAgICAgICAgIHRoaXMuX2FkZElnbm9yZWRQYXRoKHBhdGgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3dhdGNoZWQuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkSWdub3JlZFBhdGgoe1xuICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICByZWN1cnNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZXNldCB0aGUgY2FjaGVkIHVzZXJJZ25vcmVkIGFueW1hdGNoIGZuXG4gICAgICAgICAgICAvLyB0byBtYWtlIGlnbm9yZWRQYXRocyBjaGFuZ2VzIGVmZmVjdGl2ZVxuICAgICAgICAgICAgdGhpcy5fdXNlcklnbm9yZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xvc2Ugd2F0Y2hlcnMgYW5kIHJlbW92ZSBhbGwgbGlzdGVuZXJzIGZyb20gd2F0Y2hlZCBwYXRocy5cbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2Nsb3NlUHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgICAgIC8vIE1lbW9yeSBtYW5hZ2VtZW50LlxuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgICBjb25zdCBjbG9zZXJzID0gW107XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuZm9yRWFjaCgoY2xvc2VyTGlzdCkgPT4gY2xvc2VyTGlzdC5mb3JFYWNoKChjbG9zZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb21pc2UgPSBjbG9zZXIoKTtcbiAgICAgICAgICAgIGlmIChwcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSlcbiAgICAgICAgICAgICAgICBjbG9zZXJzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgdGhpcy5fc3RyZWFtcy5mb3JFYWNoKChzdHJlYW0pID0+IHN0cmVhbS5kZXN0cm95KCkpO1xuICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fcmVhZHlDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuX3JlYWR5RW1pdHRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl93YXRjaGVkLmZvckVhY2goKGRpcmVudCkgPT4gZGlyZW50LmRpc3Bvc2UoKSk7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fd2F0Y2hlZC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zLmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX3N5bWxpbmtQYXRocy5jbGVhcigpO1xuICAgICAgICB0aGlzLl90aHJvdHRsZWQuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fY2xvc2VQcm9taXNlID0gY2xvc2Vycy5sZW5ndGhcbiAgICAgICAgICAgID8gUHJvbWlzZS5hbGwoY2xvc2VycykudGhlbigoKSA9PiB1bmRlZmluZWQpXG4gICAgICAgICAgICA6IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xvc2VQcm9taXNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBFeHBvc2UgbGlzdCBvZiB3YXRjaGVkIHBhdGhzXG4gICAgICogQHJldHVybnMgZm9yIGNoYWluaW5nXG4gICAgICovXG4gICAgZ2V0V2F0Y2hlZCgpIHtcbiAgICAgICAgY29uc3Qgd2F0Y2hMaXN0ID0ge307XG4gICAgICAgIHRoaXMuX3dhdGNoZWQuZm9yRWFjaCgoZW50cnksIGRpcikgPT4ge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5vcHRpb25zLmN3ZCA/IHN5c1BhdGgucmVsYXRpdmUodGhpcy5vcHRpb25zLmN3ZCwgZGlyKSA6IGRpcjtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0ga2V5IHx8IE9ORV9ET1Q7XG4gICAgICAgICAgICB3YXRjaExpc3RbaW5kZXhdID0gZW50cnkuZ2V0Q2hpbGRyZW4oKS5zb3J0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gd2F0Y2hMaXN0O1xuICAgIH1cbiAgICBlbWl0V2l0aEFsbChldmVudCwgYXJncykge1xuICAgICAgICB0aGlzLmVtaXQoZXZlbnQsIC4uLmFyZ3MpO1xuICAgICAgICBpZiAoZXZlbnQgIT09IEVWLkVSUk9SKVxuICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkFMTCwgZXZlbnQsIC4uLmFyZ3MpO1xuICAgIH1cbiAgICAvLyBDb21tb24gaGVscGVyc1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tXG4gICAgLyoqXG4gICAgICogTm9ybWFsaXplIGFuZCBlbWl0IGV2ZW50cy5cbiAgICAgKiBDYWxsaW5nIF9lbWl0IERPRVMgTk9UIE1FQU4gZW1pdCgpIHdvdWxkIGJlIGNhbGxlZCFcbiAgICAgKiBAcGFyYW0gZXZlbnQgVHlwZSBvZiBldmVudFxuICAgICAqIEBwYXJhbSBwYXRoIEZpbGUgb3IgZGlyZWN0b3J5IHBhdGhcbiAgICAgKiBAcGFyYW0gc3RhdHMgYXJndW1lbnRzIHRvIGJlIHBhc3NlZCB3aXRoIGV2ZW50XG4gICAgICogQHJldHVybnMgdGhlIGVycm9yIGlmIGRlZmluZWQsIG90aGVyd2lzZSB0aGUgdmFsdWUgb2YgdGhlIEZTV2F0Y2hlciBpbnN0YW5jZSdzIGBjbG9zZWRgIGZsYWdcbiAgICAgKi9cbiAgICBhc3luYyBfZW1pdChldmVudCwgcGF0aCwgc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2xvc2VkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBvcHRzID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBpZiAoaXNXaW5kb3dzKVxuICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGgubm9ybWFsaXplKHBhdGgpO1xuICAgICAgICBpZiAob3B0cy5jd2QpXG4gICAgICAgICAgICBwYXRoID0gc3lzUGF0aC5yZWxhdGl2ZShvcHRzLmN3ZCwgcGF0aCk7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBbcGF0aF07XG4gICAgICAgIGlmIChzdGF0cyAhPSBudWxsKVxuICAgICAgICAgICAgYXJncy5wdXNoKHN0YXRzKTtcbiAgICAgICAgY29uc3QgYXdmID0gb3B0cy5hd2FpdFdyaXRlRmluaXNoO1xuICAgICAgICBsZXQgcHc7XG4gICAgICAgIGlmIChhd2YgJiYgKHB3ID0gdGhpcy5fcGVuZGluZ1dyaXRlcy5nZXQocGF0aCkpKSB7XG4gICAgICAgICAgICBwdy5sYXN0Q2hhbmdlID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRzLmF0b21pYykge1xuICAgICAgICAgICAgaWYgKGV2ZW50ID09PSBFVi5VTkxJTkspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wZW5kaW5nVW5saW5rcy5zZXQocGF0aCwgW2V2ZW50LCAuLi5hcmdzXSk7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3BlbmRpbmdVbmxpbmtzLmZvckVhY2goKGVudHJ5LCBwYXRoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoLi4uZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkFMTCwgLi4uZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcGVuZGluZ1VubGlua3MuZGVsZXRlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LCB0eXBlb2Ygb3B0cy5hdG9taWMgPT09ICdudW1iZXInID8gb3B0cy5hdG9taWMgOiAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGV2ZW50ID09PSBFVi5BREQgJiYgdGhpcy5fcGVuZGluZ1VubGlua3MuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQgPSBFVi5DSEFOR0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGVuZGluZ1VubGlua3MuZGVsZXRlKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChhd2YgJiYgKGV2ZW50ID09PSBFVi5BREQgfHwgZXZlbnQgPT09IEVWLkNIQU5HRSkgJiYgdGhpcy5fcmVhZHlFbWl0dGVkKSB7XG4gICAgICAgICAgICBjb25zdCBhd2ZFbWl0ID0gKGVyciwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gRVYuRVJST1I7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3NbMF0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFdpdGhBbGwoZXZlbnQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBzdGF0cyBkb2Vzbid0IGV4aXN0IHRoZSBmaWxlIG11c3QgaGF2ZSBiZWVuIGRlbGV0ZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJnc1sxXSA9IHN0YXRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKHN0YXRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRXaXRoQWxsKGV2ZW50LCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5fYXdhaXRXcml0ZUZpbmlzaChwYXRoLCBhd2Yuc3RhYmlsaXR5VGhyZXNob2xkLCBldmVudCwgYXdmRW1pdCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQgPT09IEVWLkNIQU5HRSkge1xuICAgICAgICAgICAgY29uc3QgaXNUaHJvdHRsZWQgPSAhdGhpcy5fdGhyb3R0bGUoRVYuQ0hBTkdFLCBwYXRoLCA1MCk7XG4gICAgICAgICAgICBpZiAoaXNUaHJvdHRsZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMuYWx3YXlzU3RhdCAmJlxuICAgICAgICAgICAgc3RhdHMgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgKGV2ZW50ID09PSBFVi5BREQgfHwgZXZlbnQgPT09IEVWLkFERF9ESVIgfHwgZXZlbnQgPT09IEVWLkNIQU5HRSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gb3B0cy5jd2QgPyBzeXNQYXRoLmpvaW4ob3B0cy5jd2QsIHBhdGgpIDogcGF0aDtcbiAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBzdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTdXBwcmVzcyBldmVudCB3aGVuIGZzX3N0YXQgZmFpbHMsIHRvIGF2b2lkIHNlbmRpbmcgdW5kZWZpbmVkICdzdGF0J1xuICAgICAgICAgICAgaWYgKCFzdGF0cyB8fCB0aGlzLmNsb3NlZClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBhcmdzLnB1c2goc3RhdHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW1pdFdpdGhBbGwoZXZlbnQsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29tbW9uIGhhbmRsZXIgZm9yIGVycm9yc1xuICAgICAqIEByZXR1cm5zIFRoZSBlcnJvciBpZiBkZWZpbmVkLCBvdGhlcndpc2UgdGhlIHZhbHVlIG9mIHRoZSBGU1dhdGNoZXIgaW5zdGFuY2UncyBgY2xvc2VkYCBmbGFnXG4gICAgICovXG4gICAgX2hhbmRsZUVycm9yKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBlcnJvciAmJiBlcnJvci5jb2RlO1xuICAgICAgICBpZiAoZXJyb3IgJiZcbiAgICAgICAgICAgIGNvZGUgIT09ICdFTk9FTlQnICYmXG4gICAgICAgICAgICBjb2RlICE9PSAnRU5PVERJUicgJiZcbiAgICAgICAgICAgICghdGhpcy5vcHRpb25zLmlnbm9yZVBlcm1pc3Npb25FcnJvcnMgfHwgKGNvZGUgIT09ICdFUEVSTScgJiYgY29kZSAhPT0gJ0VBQ0NFUycpKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkVSUk9SLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVycm9yIHx8IHRoaXMuY2xvc2VkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgdXRpbGl0eSBmb3IgdGhyb3R0bGluZ1xuICAgICAqIEBwYXJhbSBhY3Rpb25UeXBlIHR5cGUgYmVpbmcgdGhyb3R0bGVkXG4gICAgICogQHBhcmFtIHBhdGggYmVpbmcgYWN0ZWQgdXBvblxuICAgICAqIEBwYXJhbSB0aW1lb3V0IGR1cmF0aW9uIG9mIHRpbWUgdG8gc3VwcHJlc3MgZHVwbGljYXRlIGFjdGlvbnNcbiAgICAgKiBAcmV0dXJucyB0cmFja2luZyBvYmplY3Qgb3IgZmFsc2UgaWYgYWN0aW9uIHNob3VsZCBiZSBzdXBwcmVzc2VkXG4gICAgICovXG4gICAgX3Rocm90dGxlKGFjdGlvblR5cGUsIHBhdGgsIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl90aHJvdHRsZWQuaGFzKGFjdGlvblR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl90aHJvdHRsZWQuc2V0KGFjdGlvblR5cGUsIG5ldyBNYXAoKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5fdGhyb3R0bGVkLmdldChhY3Rpb25UeXBlKTtcbiAgICAgICAgaWYgKCFhY3Rpb24pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgdGhyb3R0bGUnKTtcbiAgICAgICAgY29uc3QgYWN0aW9uUGF0aCA9IGFjdGlvbi5nZXQocGF0aCk7XG4gICAgICAgIGlmIChhY3Rpb25QYXRoKSB7XG4gICAgICAgICAgICBhY3Rpb25QYXRoLmNvdW50Kys7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByZWZlci1jb25zdFxuICAgICAgICBsZXQgdGltZW91dE9iamVjdDtcbiAgICAgICAgY29uc3QgY2xlYXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gYWN0aW9uLmdldChwYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gaXRlbSA/IGl0ZW0uY291bnQgOiAwO1xuICAgICAgICAgICAgYWN0aW9uLmRlbGV0ZShwYXRoKTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0T2JqZWN0KTtcbiAgICAgICAgICAgIGlmIChpdGVtKVxuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChpdGVtLnRpbWVvdXRPYmplY3QpO1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgICAgICB9O1xuICAgICAgICB0aW1lb3V0T2JqZWN0ID0gc2V0VGltZW91dChjbGVhciwgdGltZW91dCk7XG4gICAgICAgIGNvbnN0IHRociA9IHsgdGltZW91dE9iamVjdCwgY2xlYXIsIGNvdW50OiAwIH07XG4gICAgICAgIGFjdGlvbi5zZXQocGF0aCwgdGhyKTtcbiAgICAgICAgcmV0dXJuIHRocjtcbiAgICB9XG4gICAgX2luY3JSZWFkeUNvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVhZHlDb3VudCsrO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBd2FpdHMgd3JpdGUgb3BlcmF0aW9uIHRvIGZpbmlzaC5cbiAgICAgKiBQb2xscyBhIG5ld2x5IGNyZWF0ZWQgZmlsZSBmb3Igc2l6ZSB2YXJpYXRpb25zLiBXaGVuIGZpbGVzIHNpemUgZG9lcyBub3QgY2hhbmdlIGZvciAndGhyZXNob2xkJyBtaWxsaXNlY29uZHMgY2FsbHMgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHBhdGggYmVpbmcgYWN0ZWQgdXBvblxuICAgICAqIEBwYXJhbSB0aHJlc2hvbGQgVGltZSBpbiBtaWxsaXNlY29uZHMgYSBmaWxlIHNpemUgbXVzdCBiZSBmaXhlZCBiZWZvcmUgYWNrbm93bGVkZ2luZyB3cml0ZSBPUCBpcyBmaW5pc2hlZFxuICAgICAqIEBwYXJhbSBldmVudFxuICAgICAqIEBwYXJhbSBhd2ZFbWl0IENhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIHJlYWR5IGZvciBldmVudCB0byBiZSBlbWl0dGVkLlxuICAgICAqL1xuICAgIF9hd2FpdFdyaXRlRmluaXNoKHBhdGgsIHRocmVzaG9sZCwgZXZlbnQsIGF3ZkVtaXQpIHtcbiAgICAgICAgY29uc3QgYXdmID0gdGhpcy5vcHRpb25zLmF3YWl0V3JpdGVGaW5pc2g7XG4gICAgICAgIGlmICh0eXBlb2YgYXdmICE9PSAnb2JqZWN0JylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgcG9sbEludGVydmFsID0gYXdmLnBvbGxJbnRlcnZhbDtcbiAgICAgICAgbGV0IHRpbWVvdXRIYW5kbGVyO1xuICAgICAgICBsZXQgZnVsbFBhdGggPSBwYXRoO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmN3ZCAmJiAhc3lzUGF0aC5pc0Fic29sdXRlKHBhdGgpKSB7XG4gICAgICAgICAgICBmdWxsUGF0aCA9IHN5c1BhdGguam9pbih0aGlzLm9wdGlvbnMuY3dkLCBwYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBjb25zdCB3cml0ZXMgPSB0aGlzLl9wZW5kaW5nV3JpdGVzO1xuICAgICAgICBmdW5jdGlvbiBhd2FpdFdyaXRlRmluaXNoRm4ocHJldlN0YXQpIHtcbiAgICAgICAgICAgIHN0YXRjYihmdWxsUGF0aCwgKGVyciwgY3VyU3RhdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIgfHwgIXdyaXRlcy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyciAmJiBlcnIuY29kZSAhPT0gJ0VOT0VOVCcpXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2ZFbWl0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgbm93ID0gTnVtYmVyKG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgICAgIGlmIChwcmV2U3RhdCAmJiBjdXJTdGF0LnNpemUgIT09IHByZXZTdGF0LnNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVzLmdldChwYXRoKS5sYXN0Q2hhbmdlID0gbm93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwdyA9IHdyaXRlcy5nZXQocGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGYgPSBub3cgLSBwdy5sYXN0Q2hhbmdlO1xuICAgICAgICAgICAgICAgIGlmIChkZiA+PSB0aHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVzLmRlbGV0ZShwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdmRW1pdCh1bmRlZmluZWQsIGN1clN0YXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dEhhbmRsZXIgPSBzZXRUaW1lb3V0KGF3YWl0V3JpdGVGaW5pc2hGbiwgcG9sbEludGVydmFsLCBjdXJTdGF0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXdyaXRlcy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgIHdyaXRlcy5zZXQocGF0aCwge1xuICAgICAgICAgICAgICAgIGxhc3RDaGFuZ2U6IG5vdyxcbiAgICAgICAgICAgICAgICBjYW5jZWxXYWl0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlcy5kZWxldGUocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBldmVudDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aW1lb3V0SGFuZGxlciA9IHNldFRpbWVvdXQoYXdhaXRXcml0ZUZpbmlzaEZuLCBwb2xsSW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgd2hldGhlciB1c2VyIGhhcyBhc2tlZCB0byBpZ25vcmUgdGhpcyBwYXRoLlxuICAgICAqL1xuICAgIF9pc0lnbm9yZWQocGF0aCwgc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdG9taWMgJiYgRE9UX1JFLnRlc3QocGF0aCkpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKCF0aGlzLl91c2VySWdub3JlZCkge1xuICAgICAgICAgICAgY29uc3QgeyBjd2QgfSA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgICAgIGNvbnN0IGlnbiA9IHRoaXMub3B0aW9ucy5pZ25vcmVkO1xuICAgICAgICAgICAgY29uc3QgaWdub3JlZCA9IChpZ24gfHwgW10pLm1hcChub3JtYWxpemVJZ25vcmVkKGN3ZCkpO1xuICAgICAgICAgICAgY29uc3QgaWdub3JlZFBhdGhzID0gWy4uLnRoaXMuX2lnbm9yZWRQYXRoc107XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gWy4uLmlnbm9yZWRQYXRocy5tYXAobm9ybWFsaXplSWdub3JlZChjd2QpKSwgLi4uaWdub3JlZF07XG4gICAgICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IGFueW1hdGNoKGxpc3QsIHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZXJJZ25vcmVkKHBhdGgsIHN0YXRzKTtcbiAgICB9XG4gICAgX2lzbnRJZ25vcmVkKHBhdGgsIHN0YXQpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLl9pc0lnbm9yZWQocGF0aCwgc3RhdCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGEgc2V0IG9mIGNvbW1vbiBoZWxwZXJzIGFuZCBwcm9wZXJ0aWVzIHJlbGF0aW5nIHRvIHN5bWxpbmsgaGFuZGxpbmcuXG4gICAgICogQHBhcmFtIHBhdGggZmlsZSBvciBkaXJlY3RvcnkgcGF0dGVybiBiZWluZyB3YXRjaGVkXG4gICAgICovXG4gICAgX2dldFdhdGNoSGVscGVycyhwYXRoKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2F0Y2hIZWxwZXIocGF0aCwgdGhpcy5vcHRpb25zLmZvbGxvd1N5bWxpbmtzLCB0aGlzKTtcbiAgICB9XG4gICAgLy8gRGlyZWN0b3J5IGhlbHBlcnNcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGRpcmVjdG9yeSB0cmFja2luZyBvYmplY3RzXG4gICAgICogQHBhcmFtIGRpcmVjdG9yeSBwYXRoIG9mIHRoZSBkaXJlY3RvcnlcbiAgICAgKi9cbiAgICBfZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGlyID0gc3lzUGF0aC5yZXNvbHZlKGRpcmVjdG9yeSk7XG4gICAgICAgIGlmICghdGhpcy5fd2F0Y2hlZC5oYXMoZGlyKSlcbiAgICAgICAgICAgIHRoaXMuX3dhdGNoZWQuc2V0KGRpciwgbmV3IERpckVudHJ5KGRpciwgdGhpcy5fYm91bmRSZW1vdmUpKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dhdGNoZWQuZ2V0KGRpcik7XG4gICAgfVxuICAgIC8vIEZpbGUgaGVscGVyc1xuICAgIC8vIC0tLS0tLS0tLS0tLVxuICAgIC8qKlxuICAgICAqIENoZWNrIGZvciByZWFkIHBlcm1pc3Npb25zOiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTE3ODE0MDQvMTM1ODQwNVxuICAgICAqL1xuICAgIF9oYXNSZWFkUGVybWlzc2lvbnMoc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5pZ25vcmVQZXJtaXNzaW9uRXJyb3JzKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiBCb29sZWFuKE51bWJlcihzdGF0cy5tb2RlKSAmIDBvNDAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSGFuZGxlcyBlbWl0dGluZyB1bmxpbmsgZXZlbnRzIGZvclxuICAgICAqIGZpbGVzIGFuZCBkaXJlY3RvcmllcywgYW5kIHZpYSByZWN1cnNpb24sIGZvclxuICAgICAqIGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aXRoaW4gZGlyZWN0b3JpZXMgdGhhdCBhcmUgdW5saW5rZWRcbiAgICAgKiBAcGFyYW0gZGlyZWN0b3J5IHdpdGhpbiB3aGljaCB0aGUgZm9sbG93aW5nIGl0ZW0gaXMgbG9jYXRlZFxuICAgICAqIEBwYXJhbSBpdGVtICAgICAgYmFzZSBwYXRoIG9mIGl0ZW0vZGlyZWN0b3J5XG4gICAgICovXG4gICAgX3JlbW92ZShkaXJlY3RvcnksIGl0ZW0sIGlzRGlyZWN0b3J5KSB7XG4gICAgICAgIC8vIGlmIHdoYXQgaXMgYmVpbmcgZGVsZXRlZCBpcyBhIGRpcmVjdG9yeSwgZ2V0IHRoYXQgZGlyZWN0b3J5J3MgcGF0aHNcbiAgICAgICAgLy8gZm9yIHJlY3Vyc2l2ZSBkZWxldGluZyBhbmQgY2xlYW5pbmcgb2Ygd2F0Y2hlZCBvYmplY3RcbiAgICAgICAgLy8gaWYgaXQgaXMgbm90IGEgZGlyZWN0b3J5LCBuZXN0ZWREaXJlY3RvcnlDaGlsZHJlbiB3aWxsIGJlIGVtcHR5IGFycmF5XG4gICAgICAgIGNvbnN0IHBhdGggPSBzeXNQYXRoLmpvaW4oZGlyZWN0b3J5LCBpdGVtKTtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBzeXNQYXRoLnJlc29sdmUocGF0aCk7XG4gICAgICAgIGlzRGlyZWN0b3J5ID1cbiAgICAgICAgICAgIGlzRGlyZWN0b3J5ICE9IG51bGwgPyBpc0RpcmVjdG9yeSA6IHRoaXMuX3dhdGNoZWQuaGFzKHBhdGgpIHx8IHRoaXMuX3dhdGNoZWQuaGFzKGZ1bGxQYXRoKTtcbiAgICAgICAgLy8gcHJldmVudCBkdXBsaWNhdGUgaGFuZGxpbmcgaW4gY2FzZSBvZiBhcnJpdmluZyBoZXJlIG5lYXJseSBzaW11bHRhbmVvdXNseVxuICAgICAgICAvLyB2aWEgbXVsdGlwbGUgcGF0aHMgKHN1Y2ggYXMgX2hhbmRsZUZpbGUgYW5kIF9oYW5kbGVEaXIpXG4gICAgICAgIGlmICghdGhpcy5fdGhyb3R0bGUoJ3JlbW92ZScsIHBhdGgsIDEwMCkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIC8vIGlmIHRoZSBvbmx5IHdhdGNoZWQgZmlsZSBpcyByZW1vdmVkLCB3YXRjaCBmb3IgaXRzIHJldHVyblxuICAgICAgICBpZiAoIWlzRGlyZWN0b3J5ICYmIHRoaXMuX3dhdGNoZWQuc2l6ZSA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5hZGQoZGlyZWN0b3J5LCBpdGVtLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIHdpbGwgY3JlYXRlIGEgbmV3IGVudHJ5IGluIHRoZSB3YXRjaGVkIG9iamVjdCBpbiBlaXRoZXIgY2FzZVxuICAgICAgICAvLyBzbyB3ZSBnb3QgdG8gZG8gdGhlIGRpcmVjdG9yeSBjaGVjayBiZWZvcmVoYW5kXG4gICAgICAgIGNvbnN0IHdwID0gdGhpcy5fZ2V0V2F0Y2hlZERpcihwYXRoKTtcbiAgICAgICAgY29uc3QgbmVzdGVkRGlyZWN0b3J5Q2hpbGRyZW4gPSB3cC5nZXRDaGlsZHJlbigpO1xuICAgICAgICAvLyBSZWN1cnNpdmVseSByZW1vdmUgY2hpbGRyZW4gZGlyZWN0b3JpZXMgLyBmaWxlcy5cbiAgICAgICAgbmVzdGVkRGlyZWN0b3J5Q2hpbGRyZW4uZm9yRWFjaCgobmVzdGVkKSA9PiB0aGlzLl9yZW1vdmUocGF0aCwgbmVzdGVkKSk7XG4gICAgICAgIC8vIENoZWNrIGlmIGl0ZW0gd2FzIG9uIHRoZSB3YXRjaGVkIGxpc3QgYW5kIHJlbW92ZSBpdFxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRXYXRjaGVkRGlyKGRpcmVjdG9yeSk7XG4gICAgICAgIGNvbnN0IHdhc1RyYWNrZWQgPSBwYXJlbnQuaGFzKGl0ZW0pO1xuICAgICAgICBwYXJlbnQucmVtb3ZlKGl0ZW0pO1xuICAgICAgICAvLyBGaXhlcyBpc3N1ZSAjMTA0MiAtPiBSZWxhdGl2ZSBwYXRocyB3ZXJlIGRldGVjdGVkIGFuZCBhZGRlZCBhcyBzeW1saW5rc1xuICAgICAgICAvLyAoaHR0cHM6Ly9naXRodWIuY29tL3BhdWxtaWxsci9jaG9raWRhci9ibG9iL2UxNzUzZGRiYzk1NzFiZGMzM2I0YTRhZjE3MmQ1MmNiNmU2MTFjMTAvbGliL25vZGVmcy1oYW5kbGVyLmpzI0w2MTIpLFxuICAgICAgICAvLyBidXQgbmV2ZXIgcmVtb3ZlZCBmcm9tIHRoZSBtYXAgaW4gY2FzZSB0aGUgcGF0aCB3YXMgZGVsZXRlZC5cbiAgICAgICAgLy8gVGhpcyBsZWFkcyB0byBhbiBpbmNvcnJlY3Qgc3RhdGUgaWYgdGhlIHBhdGggd2FzIHJlY3JlYXRlZDpcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BhdWxtaWxsci9jaG9raWRhci9ibG9iL2UxNzUzZGRiYzk1NzFiZGMzM2I0YTRhZjE3MmQ1MmNiNmU2MTFjMTAvbGliL25vZGVmcy1oYW5kbGVyLmpzI0w1NTNcbiAgICAgICAgaWYgKHRoaXMuX3N5bWxpbmtQYXRocy5oYXMoZnVsbFBhdGgpKSB7XG4gICAgICAgICAgICB0aGlzLl9zeW1saW5rUGF0aHMuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB3ZSB3YWl0IGZvciB0aGlzIGZpbGUgdG8gYmUgZnVsbHkgd3JpdHRlbiwgY2FuY2VsIHRoZSB3YWl0LlxuICAgICAgICBsZXQgcmVsUGF0aCA9IHBhdGg7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY3dkKVxuICAgICAgICAgICAgcmVsUGF0aCA9IHN5c1BhdGgucmVsYXRpdmUodGhpcy5vcHRpb25zLmN3ZCwgcGF0aCk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXdhaXRXcml0ZUZpbmlzaCAmJiB0aGlzLl9wZW5kaW5nV3JpdGVzLmhhcyhyZWxQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLl9wZW5kaW5nV3JpdGVzLmdldChyZWxQYXRoKS5jYW5jZWxXYWl0KCk7XG4gICAgICAgICAgICBpZiAoZXZlbnQgPT09IEVWLkFERClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIEVudHJ5IHdpbGwgZWl0aGVyIGJlIGEgZGlyZWN0b3J5IHRoYXQganVzdCBnb3QgcmVtb3ZlZFxuICAgICAgICAvLyBvciBhIGJvZ3VzIGVudHJ5IHRvIGEgZmlsZSwgaW4gZWl0aGVyIGNhc2Ugd2UgaGF2ZSB0byByZW1vdmUgaXRcbiAgICAgICAgdGhpcy5fd2F0Y2hlZC5kZWxldGUocGF0aCk7XG4gICAgICAgIHRoaXMuX3dhdGNoZWQuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgY29uc3QgZXZlbnROYW1lID0gaXNEaXJlY3RvcnkgPyBFVi5VTkxJTktfRElSIDogRVYuVU5MSU5LO1xuICAgICAgICBpZiAod2FzVHJhY2tlZCAmJiAhdGhpcy5faXNJZ25vcmVkKHBhdGgpKVxuICAgICAgICAgICAgdGhpcy5fZW1pdChldmVudE5hbWUsIHBhdGgpO1xuICAgICAgICAvLyBBdm9pZCBjb25mbGljdHMgaWYgd2UgbGF0ZXIgY3JlYXRlIGFub3RoZXIgZmlsZSB3aXRoIHRoZSBzYW1lIG5hbWVcbiAgICAgICAgdGhpcy5fY2xvc2VQYXRoKHBhdGgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgYWxsIHdhdGNoZXJzIGZvciBhIHBhdGhcbiAgICAgKi9cbiAgICBfY2xvc2VQYXRoKHBhdGgpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VGaWxlKHBhdGgpO1xuICAgICAgICBjb25zdCBkaXIgPSBzeXNQYXRoLmRpcm5hbWUocGF0aCk7XG4gICAgICAgIHRoaXMuX2dldFdhdGNoZWREaXIoZGlyKS5yZW1vdmUoc3lzUGF0aC5iYXNlbmFtZShwYXRoKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENsb3NlcyBvbmx5IGZpbGUtc3BlY2lmaWMgd2F0Y2hlcnNcbiAgICAgKi9cbiAgICBfY2xvc2VGaWxlKHBhdGgpIHtcbiAgICAgICAgY29uc3QgY2xvc2VycyA9IHRoaXMuX2Nsb3NlcnMuZ2V0KHBhdGgpO1xuICAgICAgICBpZiAoIWNsb3NlcnMpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNsb3NlcnMuZm9yRWFjaCgoY2xvc2VyKSA9PiBjbG9zZXIoKSk7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuZGVsZXRlKHBhdGgpO1xuICAgIH1cbiAgICBfYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpIHtcbiAgICAgICAgaWYgKCFjbG9zZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBsaXN0ID0gdGhpcy5fY2xvc2Vycy5nZXQocGF0aCk7XG4gICAgICAgIGlmICghbGlzdCkge1xuICAgICAgICAgICAgbGlzdCA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fY2xvc2Vycy5zZXQocGF0aCwgbGlzdCk7XG4gICAgICAgIH1cbiAgICAgICAgbGlzdC5wdXNoKGNsb3Nlcik7XG4gICAgfVxuICAgIF9yZWFkZGlycChyb290LCBvcHRzKSB7XG4gICAgICAgIGlmICh0aGlzLmNsb3NlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgdHlwZTogRVYuQUxMLCBhbHdheXNTdGF0OiB0cnVlLCBsc3RhdDogdHJ1ZSwgLi4ub3B0cywgZGVwdGg6IDAgfTtcbiAgICAgICAgbGV0IHN0cmVhbSA9IHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zLmFkZChzdHJlYW0pO1xuICAgICAgICBzdHJlYW0ub25jZShTVFJfQ0xPU0UsICgpID0+IHtcbiAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgICAgIHN0cmVhbS5vbmNlKFNUUl9FTkQsICgpID0+IHtcbiAgICAgICAgICAgIGlmIChzdHJlYW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdHJlYW1zLmRlbGV0ZShzdHJlYW0pO1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBzdHJlYW07XG4gICAgfVxufVxuLyoqXG4gKiBJbnN0YW50aWF0ZXMgd2F0Y2hlciB3aXRoIHBhdGhzIHRvIGJlIHRyYWNrZWQuXG4gKiBAcGFyYW0gcGF0aHMgZmlsZSAvIGRpcmVjdG9yeSBwYXRoc1xuICogQHBhcmFtIG9wdGlvbnMgb3B0cywgc3VjaCBhcyBgYXRvbWljYCwgYGF3YWl0V3JpdGVGaW5pc2hgLCBgaWdub3JlZGAsIGFuZCBvdGhlcnNcbiAqIEByZXR1cm5zIGFuIGluc3RhbmNlIG9mIEZTV2F0Y2hlciBmb3IgY2hhaW5pbmcuXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgd2F0Y2hlciA9IHdhdGNoKCcuJykub24oJ2FsbCcsIChldmVudCwgcGF0aCkgPT4geyBjb25zb2xlLmxvZyhldmVudCwgcGF0aCk7IH0pO1xuICogd2F0Y2goJy4nLCB7IGF0b21pYzogdHJ1ZSwgYXdhaXRXcml0ZUZpbmlzaDogdHJ1ZSwgaWdub3JlZDogKGYsIHN0YXRzKSA9PiBzdGF0cz8uaXNGaWxlKCkgJiYgIWYuZW5kc1dpdGgoJy5qcycpIH0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaChwYXRocywgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIob3B0aW9ucyk7XG4gICAgd2F0Y2hlci5hZGQocGF0aHMpO1xuICAgIHJldHVybiB3YXRjaGVyO1xufVxuZXhwb3J0IGRlZmF1bHQgeyB3YXRjaCwgRlNXYXRjaGVyIH07XG4iLCAiaW1wb3J0IHsgc3RhdCwgbHN0YXQsIHJlYWRkaXIsIHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gJ25vZGU6c3RyZWFtJztcbmltcG9ydCB7IHJlc29sdmUgYXMgcHJlc29sdmUsIHJlbGF0aXZlIGFzIHByZWxhdGl2ZSwgam9pbiBhcyBwam9pbiwgc2VwIGFzIHBzZXAgfSBmcm9tICdub2RlOnBhdGgnO1xuZXhwb3J0IGNvbnN0IEVudHJ5VHlwZXMgPSB7XG4gICAgRklMRV9UWVBFOiAnZmlsZXMnLFxuICAgIERJUl9UWVBFOiAnZGlyZWN0b3JpZXMnLFxuICAgIEZJTEVfRElSX1RZUEU6ICdmaWxlc19kaXJlY3RvcmllcycsXG4gICAgRVZFUllUSElOR19UWVBFOiAnYWxsJyxcbn07XG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICByb290OiAnLicsXG4gICAgZmlsZUZpbHRlcjogKF9lbnRyeUluZm8pID0+IHRydWUsXG4gICAgZGlyZWN0b3J5RmlsdGVyOiAoX2VudHJ5SW5mbykgPT4gdHJ1ZSxcbiAgICB0eXBlOiBFbnRyeVR5cGVzLkZJTEVfVFlQRSxcbiAgICBsc3RhdDogZmFsc2UsXG4gICAgZGVwdGg6IDIxNDc0ODM2NDgsXG4gICAgYWx3YXlzU3RhdDogZmFsc2UsXG4gICAgaGlnaFdhdGVyTWFyazogNDA5Nixcbn07XG5PYmplY3QuZnJlZXplKGRlZmF1bHRPcHRpb25zKTtcbmNvbnN0IFJFQ1VSU0lWRV9FUlJPUl9DT0RFID0gJ1JFQURESVJQX1JFQ1VSU0lWRV9FUlJPUic7XG5jb25zdCBOT1JNQUxfRkxPV19FUlJPUlMgPSBuZXcgU2V0KFsnRU5PRU5UJywgJ0VQRVJNJywgJ0VBQ0NFUycsICdFTE9PUCcsIFJFQ1VSU0lWRV9FUlJPUl9DT0RFXSk7XG5jb25zdCBBTExfVFlQRVMgPSBbXG4gICAgRW50cnlUeXBlcy5ESVJfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG4gICAgRW50cnlUeXBlcy5GSUxFX1RZUEUsXG5dO1xuY29uc3QgRElSX1RZUEVTID0gbmV3IFNldChbXG4gICAgRW50cnlUeXBlcy5ESVJfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG5dKTtcbmNvbnN0IEZJTEVfVFlQRVMgPSBuZXcgU2V0KFtcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG4gICAgRW50cnlUeXBlcy5GSUxFX1RZUEUsXG5dKTtcbmNvbnN0IGlzTm9ybWFsRmxvd0Vycm9yID0gKGVycm9yKSA9PiBOT1JNQUxfRkxPV19FUlJPUlMuaGFzKGVycm9yLmNvZGUpO1xuY29uc3Qgd2FudEJpZ2ludEZzU3RhdHMgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xuY29uc3QgZW1wdHlGbiA9IChfZW50cnlJbmZvKSA9PiB0cnVlO1xuY29uc3Qgbm9ybWFsaXplRmlsdGVyID0gKGZpbHRlcikgPT4ge1xuICAgIGlmIChmaWx0ZXIgPT09IHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuIGVtcHR5Rm47XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiBmaWx0ZXI7XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGZsID0gZmlsdGVyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIChlbnRyeSkgPT4gZW50cnkuYmFzZW5hbWUgPT09IGZsO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIGNvbnN0IHRySXRlbXMgPSBmaWx0ZXIubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSk7XG4gICAgICAgIHJldHVybiAoZW50cnkpID0+IHRySXRlbXMuc29tZSgoZikgPT4gZW50cnkuYmFzZW5hbWUgPT09IGYpO1xuICAgIH1cbiAgICByZXR1cm4gZW1wdHlGbjtcbn07XG4vKiogUmVhZGFibGUgcmVhZGRpciBzdHJlYW0sIGVtaXR0aW5nIG5ldyBmaWxlcyBhcyB0aGV5J3JlIGJlaW5nIGxpc3RlZC4gKi9cbmV4cG9ydCBjbGFzcyBSZWFkZGlycFN0cmVhbSBleHRlbmRzIFJlYWRhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoe1xuICAgICAgICAgICAgb2JqZWN0TW9kZTogdHJ1ZSxcbiAgICAgICAgICAgIGF1dG9EZXN0cm95OiB0cnVlLFxuICAgICAgICAgICAgaGlnaFdhdGVyTWFyazogb3B0aW9ucy5oaWdoV2F0ZXJNYXJrLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHsgLi4uZGVmYXVsdE9wdGlvbnMsIC4uLm9wdGlvbnMgfTtcbiAgICAgICAgY29uc3QgeyByb290LCB0eXBlIH0gPSBvcHRzO1xuICAgICAgICB0aGlzLl9maWxlRmlsdGVyID0gbm9ybWFsaXplRmlsdGVyKG9wdHMuZmlsZUZpbHRlcik7XG4gICAgICAgIHRoaXMuX2RpcmVjdG9yeUZpbHRlciA9IG5vcm1hbGl6ZUZpbHRlcihvcHRzLmRpcmVjdG9yeUZpbHRlcik7XG4gICAgICAgIGNvbnN0IHN0YXRNZXRob2QgPSBvcHRzLmxzdGF0ID8gbHN0YXQgOiBzdGF0O1xuICAgICAgICAvLyBVc2UgYmlnaW50IHN0YXRzIGlmIGl0J3Mgd2luZG93cyBhbmQgc3RhdCgpIHN1cHBvcnRzIG9wdGlvbnMgKG5vZGUgMTArKS5cbiAgICAgICAgaWYgKHdhbnRCaWdpbnRGc1N0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ID0gKHBhdGgpID0+IHN0YXRNZXRob2QocGF0aCwgeyBiaWdpbnQ6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ID0gc3RhdE1ldGhvZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9tYXhEZXB0aCA9IG9wdHMuZGVwdGggPz8gZGVmYXVsdE9wdGlvbnMuZGVwdGg7XG4gICAgICAgIHRoaXMuX3dhbnRzRGlyID0gdHlwZSA/IERJUl9UWVBFUy5oYXModHlwZSkgOiBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2FudHNGaWxlID0gdHlwZSA/IEZJTEVfVFlQRVMuaGFzKHR5cGUpIDogZmFsc2U7XG4gICAgICAgIHRoaXMuX3dhbnRzRXZlcnl0aGluZyA9IHR5cGUgPT09IEVudHJ5VHlwZXMuRVZFUllUSElOR19UWVBFO1xuICAgICAgICB0aGlzLl9yb290ID0gcHJlc29sdmUocm9vdCk7XG4gICAgICAgIHRoaXMuX2lzRGlyZW50ID0gIW9wdHMuYWx3YXlzU3RhdDtcbiAgICAgICAgdGhpcy5fc3RhdHNQcm9wID0gdGhpcy5faXNEaXJlbnQgPyAnZGlyZW50JyA6ICdzdGF0cyc7XG4gICAgICAgIHRoaXMuX3JkT3B0aW9ucyA9IHsgZW5jb2Rpbmc6ICd1dGY4Jywgd2l0aEZpbGVUeXBlczogdGhpcy5faXNEaXJlbnQgfTtcbiAgICAgICAgLy8gTGF1bmNoIHN0cmVhbSB3aXRoIG9uZSBwYXJlbnQsIHRoZSByb290IGRpci5cbiAgICAgICAgdGhpcy5wYXJlbnRzID0gW3RoaXMuX2V4cGxvcmVEaXIocm9vdCwgMSldO1xuICAgICAgICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGFzeW5jIF9yZWFkKGJhdGNoKSB7XG4gICAgICAgIGlmICh0aGlzLnJlYWRpbmcpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMucmVhZGluZyA9IHRydWU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3aGlsZSAoIXRoaXMuZGVzdHJveWVkICYmIGJhdGNoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhciA9IHRoaXMucGFyZW50O1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbCA9IHBhciAmJiBwYXIuZmlsZXM7XG4gICAgICAgICAgICAgICAgaWYgKGZpbCAmJiBmaWwubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHBhdGgsIGRlcHRoIH0gPSBwYXI7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNsaWNlID0gZmlsLnNwbGljZSgwLCBiYXRjaCkubWFwKChkaXJlbnQpID0+IHRoaXMuX2Zvcm1hdEVudHJ5KGRpcmVudCwgcGF0aCkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhd2FpdGVkID0gYXdhaXQgUHJvbWlzZS5hbGwoc2xpY2UpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZW50cnkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlUeXBlID0gYXdhaXQgdGhpcy5fZ2V0RW50cnlUeXBlKGVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRyeVR5cGUgPT09ICdkaXJlY3RvcnknICYmIHRoaXMuX2RpcmVjdG9yeUZpbHRlcihlbnRyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVwdGggPD0gdGhpcy5fbWF4RGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRzLnB1c2godGhpcy5fZXhwbG9yZURpcihlbnRyeS5mdWxsUGF0aCwgZGVwdGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl93YW50c0Rpcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnB1c2goZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYXRjaC0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKChlbnRyeVR5cGUgPT09ICdmaWxlJyB8fCB0aGlzLl9pbmNsdWRlQXNGaWxlKGVudHJ5KSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9maWxlRmlsdGVyKGVudHJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl93YW50c0ZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wdXNoKGVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmF0Y2gtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMucGFyZW50cy5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGFyZW50ID0gYXdhaXQgcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIF9leHBsb3JlRGlyKHBhdGgsIGRlcHRoKSB7XG4gICAgICAgIGxldCBmaWxlcztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbGVzID0gYXdhaXQgcmVhZGRpcihwYXRoLCB0aGlzLl9yZE9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5fb25FcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgZmlsZXMsIGRlcHRoLCBwYXRoIH07XG4gICAgfVxuICAgIGFzeW5jIF9mb3JtYXRFbnRyeShkaXJlbnQsIHBhdGgpIHtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBjb25zdCBiYXNlbmFtZSA9IHRoaXMuX2lzRGlyZW50ID8gZGlyZW50Lm5hbWUgOiBkaXJlbnQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHByZXNvbHZlKHBqb2luKHBhdGgsIGJhc2VuYW1lKSk7XG4gICAgICAgICAgICBlbnRyeSA9IHsgcGF0aDogcHJlbGF0aXZlKHRoaXMuX3Jvb3QsIGZ1bGxQYXRoKSwgZnVsbFBhdGgsIGJhc2VuYW1lIH07XG4gICAgICAgICAgICBlbnRyeVt0aGlzLl9zdGF0c1Byb3BdID0gdGhpcy5faXNEaXJlbnQgPyBkaXJlbnQgOiBhd2FpdCB0aGlzLl9zdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLl9vbkVycm9yKGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVudHJ5O1xuICAgIH1cbiAgICBfb25FcnJvcihlcnIpIHtcbiAgICAgICAgaWYgKGlzTm9ybWFsRmxvd0Vycm9yKGVycikgJiYgIXRoaXMuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3dhcm4nLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95KGVycik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgX2dldEVudHJ5VHlwZShlbnRyeSkge1xuICAgICAgICAvLyBlbnRyeSBtYXkgYmUgdW5kZWZpbmVkLCBiZWNhdXNlIGEgd2FybmluZyBvciBhbiBlcnJvciB3ZXJlIGVtaXR0ZWRcbiAgICAgICAgLy8gYW5kIHRoZSBzdGF0c1Byb3AgaXMgdW5kZWZpbmVkXG4gICAgICAgIGlmICghZW50cnkgJiYgdGhpcy5fc3RhdHNQcm9wIGluIGVudHJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhdHMgPSBlbnRyeVt0aGlzLl9zdGF0c1Byb3BdO1xuICAgICAgICBpZiAoc3RhdHMuaXNGaWxlKCkpXG4gICAgICAgICAgICByZXR1cm4gJ2ZpbGUnO1xuICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgIHJldHVybiAnZGlyZWN0b3J5JztcbiAgICAgICAgaWYgKHN0YXRzICYmIHN0YXRzLmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGwgPSBlbnRyeS5mdWxsUGF0aDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnlSZWFsUGF0aCA9IGF3YWl0IHJlYWxwYXRoKGZ1bGwpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5UmVhbFBhdGhTdGF0cyA9IGF3YWl0IGxzdGF0KGVudHJ5UmVhbFBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeVJlYWxQYXRoU3RhdHMuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdmaWxlJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5UmVhbFBhdGhTdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbiA9IGVudHJ5UmVhbFBhdGgubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnVsbC5zdGFydHNXaXRoKGVudHJ5UmVhbFBhdGgpICYmIGZ1bGwuc3Vic3RyKGxlbiwgMSkgPT09IHBzZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3Vyc2l2ZUVycm9yID0gbmV3IEVycm9yKGBDaXJjdWxhciBzeW1saW5rIGRldGVjdGVkOiBcIiR7ZnVsbH1cIiBwb2ludHMgdG8gXCIke2VudHJ5UmVhbFBhdGh9XCJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZUVycm9yLmNvZGUgPSBSRUNVUlNJVkVfRVJST1JfQ09ERTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9vbkVycm9yKHJlY3Vyc2l2ZUVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2RpcmVjdG9yeSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb25FcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIF9pbmNsdWRlQXNGaWxlKGVudHJ5KSB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gZW50cnkgJiYgZW50cnlbdGhpcy5fc3RhdHNQcm9wXTtcbiAgICAgICAgcmV0dXJuIHN0YXRzICYmIHRoaXMuX3dhbnRzRXZlcnl0aGluZyAmJiAhc3RhdHMuaXNEaXJlY3RvcnkoKTtcbiAgICB9XG59XG4vKipcbiAqIFN0cmVhbWluZyB2ZXJzaW9uOiBSZWFkcyBhbGwgZmlsZXMgYW5kIGRpcmVjdG9yaWVzIGluIGdpdmVuIHJvb3QgcmVjdXJzaXZlbHkuXG4gKiBDb25zdW1lcyB+Y29uc3RhbnQgc21hbGwgYW1vdW50IG9mIFJBTS5cbiAqIEBwYXJhbSByb290IFJvb3QgZGlyZWN0b3J5XG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRvIHNwZWNpZnkgcm9vdCAoc3RhcnQgZGlyZWN0b3J5KSwgZmlsdGVycyBhbmQgcmVjdXJzaW9uIGRlcHRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkZGlycChyb290LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgbGV0IHR5cGUgPSBvcHRpb25zLmVudHJ5VHlwZSB8fCBvcHRpb25zLnR5cGU7XG4gICAgaWYgKHR5cGUgPT09ICdib3RoJylcbiAgICAgICAgdHlwZSA9IEVudHJ5VHlwZXMuRklMRV9ESVJfVFlQRTsgLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHlcbiAgICBpZiAodHlwZSlcbiAgICAgICAgb3B0aW9ucy50eXBlID0gdHlwZTtcbiAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZWFkZGlycDogcm9vdCBhcmd1bWVudCBpcyByZXF1aXJlZC4gVXNhZ2U6IHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpJyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiByb290ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWFkZGlycDogcm9vdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLiBVc2FnZTogcmVhZGRpcnAocm9vdCwgb3B0aW9ucyknKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSAmJiAhQUxMX1RZUEVTLmluY2x1ZGVzKHR5cGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgcmVhZGRpcnA6IEludmFsaWQgdHlwZSBwYXNzZWQuIFVzZSBvbmUgb2YgJHtBTExfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICB9XG4gICAgb3B0aW9ucy5yb290ID0gcm9vdDtcbiAgICByZXR1cm4gbmV3IFJlYWRkaXJwU3RyZWFtKG9wdGlvbnMpO1xufVxuLyoqXG4gKiBQcm9taXNlIHZlcnNpb246IFJlYWRzIGFsbCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgaW4gZ2l2ZW4gcm9vdCByZWN1cnNpdmVseS5cbiAqIENvbXBhcmVkIHRvIHN0cmVhbWluZyB2ZXJzaW9uLCB3aWxsIGNvbnN1bWUgYSBsb3Qgb2YgUkFNIGUuZy4gd2hlbiAxIG1pbGxpb24gZmlsZXMgYXJlIGxpc3RlZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIHBhdGhzIGFuZCB0aGVpciBlbnRyeSBpbmZvc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpcnBQcm9taXNlKHJvb3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gW107XG4gICAgICAgIHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpXG4gICAgICAgICAgICAub24oJ2RhdGEnLCAoZW50cnkpID0+IGZpbGVzLnB1c2goZW50cnkpKVxuICAgICAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKGZpbGVzKSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCAoZXJyb3IpID0+IHJlamVjdChlcnJvcikpO1xuICAgIH0pO1xufVxuZXhwb3J0IGRlZmF1bHQgcmVhZGRpcnA7XG4iLCAiaW1wb3J0IHsgd2F0Y2hGaWxlLCB1bndhdGNoRmlsZSwgd2F0Y2ggYXMgZnNfd2F0Y2ggfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBvcGVuLCBzdGF0LCBsc3RhdCwgcmVhbHBhdGggYXMgZnNyZWFscGF0aCB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHN5c1BhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB0eXBlIGFzIG9zVHlwZSB9IGZyb20gJ29zJztcbmV4cG9ydCBjb25zdCBTVFJfREFUQSA9ICdkYXRhJztcbmV4cG9ydCBjb25zdCBTVFJfRU5EID0gJ2VuZCc7XG5leHBvcnQgY29uc3QgU1RSX0NMT1NFID0gJ2Nsb3NlJztcbmV4cG9ydCBjb25zdCBFTVBUWV9GTiA9ICgpID0+IHsgfTtcbmV4cG9ydCBjb25zdCBJREVOVElUWV9GTiA9ICh2YWwpID0+IHZhbDtcbmNvbnN0IHBsID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbmV4cG9ydCBjb25zdCBpc1dpbmRvd3MgPSBwbCA9PT0gJ3dpbjMyJztcbmV4cG9ydCBjb25zdCBpc01hY29zID0gcGwgPT09ICdkYXJ3aW4nO1xuZXhwb3J0IGNvbnN0IGlzTGludXggPSBwbCA9PT0gJ2xpbnV4JztcbmV4cG9ydCBjb25zdCBpc0ZyZWVCU0QgPSBwbCA9PT0gJ2ZyZWVic2QnO1xuZXhwb3J0IGNvbnN0IGlzSUJNaSA9IG9zVHlwZSgpID09PSAnT1M0MDAnO1xuZXhwb3J0IGNvbnN0IEVWRU5UUyA9IHtcbiAgICBBTEw6ICdhbGwnLFxuICAgIFJFQURZOiAncmVhZHknLFxuICAgIEFERDogJ2FkZCcsXG4gICAgQ0hBTkdFOiAnY2hhbmdlJyxcbiAgICBBRERfRElSOiAnYWRkRGlyJyxcbiAgICBVTkxJTks6ICd1bmxpbmsnLFxuICAgIFVOTElOS19ESVI6ICd1bmxpbmtEaXInLFxuICAgIFJBVzogJ3JhdycsXG4gICAgRVJST1I6ICdlcnJvcicsXG59O1xuY29uc3QgRVYgPSBFVkVOVFM7XG5jb25zdCBUSFJPVFRMRV9NT0RFX1dBVENIID0gJ3dhdGNoJztcbmNvbnN0IHN0YXRNZXRob2RzID0geyBsc3RhdCwgc3RhdCB9O1xuY29uc3QgS0VZX0xJU1RFTkVSUyA9ICdsaXN0ZW5lcnMnO1xuY29uc3QgS0VZX0VSUiA9ICdlcnJIYW5kbGVycyc7XG5jb25zdCBLRVlfUkFXID0gJ3Jhd0VtaXR0ZXJzJztcbmNvbnN0IEhBTkRMRVJfS0VZUyA9IFtLRVlfTElTVEVORVJTLCBLRVlfRVJSLCBLRVlfUkFXXTtcbi8vIHByZXR0aWVyLWlnbm9yZVxuY29uc3QgYmluYXJ5RXh0ZW5zaW9ucyA9IG5ldyBTZXQoW1xuICAgICczZG0nLCAnM2RzJywgJzNnMicsICczZ3AnLCAnN3onLCAnYScsICdhYWMnLCAnYWRwJywgJ2FmZGVzaWduJywgJ2FmcGhvdG8nLCAnYWZwdWInLCAnYWknLFxuICAgICdhaWYnLCAnYWlmZicsICdhbHonLCAnYXBlJywgJ2FwaycsICdhcHBpbWFnZScsICdhcicsICdhcmonLCAnYXNmJywgJ2F1JywgJ2F2aScsXG4gICAgJ2JhaycsICdiYW1sJywgJ2JoJywgJ2JpbicsICdiaycsICdibXAnLCAnYnRpZicsICdiejInLCAnYnppcDInLFxuICAgICdjYWInLCAnY2FmJywgJ2NnbScsICdjbGFzcycsICdjbXgnLCAnY3BpbycsICdjcjInLCAnY3VyJywgJ2RhdCcsICdkY20nLCAnZGViJywgJ2RleCcsICdkanZ1JyxcbiAgICAnZGxsJywgJ2RtZycsICdkbmcnLCAnZG9jJywgJ2RvY20nLCAnZG9jeCcsICdkb3QnLCAnZG90bScsICdkcmEnLCAnRFNfU3RvcmUnLCAnZHNrJywgJ2R0cycsXG4gICAgJ2R0c2hkJywgJ2R2YicsICdkd2cnLCAnZHhmJyxcbiAgICAnZWNlbHA0ODAwJywgJ2VjZWxwNzQ3MCcsICdlY2VscDk2MDAnLCAnZWdnJywgJ2VvbCcsICdlb3QnLCAnZXB1YicsICdleGUnLFxuICAgICdmNHYnLCAnZmJzJywgJ2ZoJywgJ2ZsYScsICdmbGFjJywgJ2ZsYXRwYWsnLCAnZmxpJywgJ2ZsdicsICdmcHgnLCAnZnN0JywgJ2Z2dCcsXG4gICAgJ2czJywgJ2doJywgJ2dpZicsICdncmFmZmxlJywgJ2d6JywgJ2d6aXAnLFxuICAgICdoMjYxJywgJ2gyNjMnLCAnaDI2NCcsICdpY25zJywgJ2ljbycsICdpZWYnLCAnaW1nJywgJ2lwYScsICdpc28nLFxuICAgICdqYXInLCAnanBlZycsICdqcGcnLCAnanBndicsICdqcG0nLCAnanhyJywgJ2tleScsICdrdHgnLFxuICAgICdsaGEnLCAnbGliJywgJ2x2cCcsICdseicsICdsemgnLCAnbHptYScsICdsem8nLFxuICAgICdtM3UnLCAnbTRhJywgJ200dicsICdtYXInLCAnbWRpJywgJ21odCcsICdtaWQnLCAnbWlkaScsICdtajInLCAnbWthJywgJ21rdicsICdtbXInLCAnbW5nJyxcbiAgICAnbW9iaScsICdtb3YnLCAnbW92aWUnLCAnbXAzJyxcbiAgICAnbXA0JywgJ21wNGEnLCAnbXBlZycsICdtcGcnLCAnbXBnYScsICdteHUnLFxuICAgICduZWYnLCAnbnB4JywgJ251bWJlcnMnLCAnbnVwa2cnLFxuICAgICdvJywgJ29kcCcsICdvZHMnLCAnb2R0JywgJ29nYScsICdvZ2cnLCAnb2d2JywgJ290ZicsICdvdHQnLFxuICAgICdwYWdlcycsICdwYm0nLCAncGN4JywgJ3BkYicsICdwZGYnLCAncGVhJywgJ3BnbScsICdwaWMnLCAncG5nJywgJ3BubScsICdwb3QnLCAncG90bScsXG4gICAgJ3BvdHgnLCAncHBhJywgJ3BwYW0nLFxuICAgICdwcG0nLCAncHBzJywgJ3Bwc20nLCAncHBzeCcsICdwcHQnLCAncHB0bScsICdwcHR4JywgJ3BzZCcsICdweWEnLCAncHljJywgJ3B5bycsICdweXYnLFxuICAgICdxdCcsXG4gICAgJ3JhcicsICdyYXMnLCAncmF3JywgJ3Jlc291cmNlcycsICdyZ2InLCAncmlwJywgJ3JsYycsICdybWYnLCAncm12YicsICdycG0nLCAncnRmJywgJ3J6JyxcbiAgICAnczNtJywgJ3M3eicsICdzY3B0JywgJ3NnaScsICdzaGFyJywgJ3NuYXAnLCAnc2lsJywgJ3NrZXRjaCcsICdzbGsnLCAnc212JywgJ3NuaycsICdzbycsXG4gICAgJ3N0bCcsICdzdW8nLCAnc3ViJywgJ3N3ZicsXG4gICAgJ3RhcicsICd0YnonLCAndGJ6MicsICd0Z2EnLCAndGd6JywgJ3RobXgnLCAndGlmJywgJ3RpZmYnLCAndGx6JywgJ3R0YycsICd0dGYnLCAndHh6JyxcbiAgICAndWRmJywgJ3V2aCcsICd1dmknLCAndXZtJywgJ3V2cCcsICd1dnMnLCAndXZ1JyxcbiAgICAndml2JywgJ3ZvYicsXG4gICAgJ3dhcicsICd3YXYnLCAnd2F4JywgJ3dibXAnLCAnd2RwJywgJ3dlYmEnLCAnd2VibScsICd3ZWJwJywgJ3dobCcsICd3aW0nLCAnd20nLCAnd21hJyxcbiAgICAnd212JywgJ3dteCcsICd3b2ZmJywgJ3dvZmYyJywgJ3dybScsICd3dngnLFxuICAgICd4Ym0nLCAneGlmJywgJ3hsYScsICd4bGFtJywgJ3hscycsICd4bHNiJywgJ3hsc20nLCAneGxzeCcsICd4bHQnLCAneGx0bScsICd4bHR4JywgJ3htJyxcbiAgICAneG1pbmQnLCAneHBpJywgJ3hwbScsICd4d2QnLCAneHonLFxuICAgICd6JywgJ3ppcCcsICd6aXB4Jyxcbl0pO1xuY29uc3QgaXNCaW5hcnlQYXRoID0gKGZpbGVQYXRoKSA9PiBiaW5hcnlFeHRlbnNpb25zLmhhcyhzeXNQYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpO1xuLy8gVE9ETzogZW1pdCBlcnJvcnMgcHJvcGVybHkuIEV4YW1wbGU6IEVNRklMRSBvbiBNYWNvcy5cbmNvbnN0IGZvcmVhY2ggPSAodmFsLCBmbikgPT4ge1xuICAgIGlmICh2YWwgaW5zdGFuY2VvZiBTZXQpIHtcbiAgICAgICAgdmFsLmZvckVhY2goZm4pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZm4odmFsKTtcbiAgICB9XG59O1xuY29uc3QgYWRkQW5kQ29udmVydCA9IChtYWluLCBwcm9wLCBpdGVtKSA9PiB7XG4gICAgbGV0IGNvbnRhaW5lciA9IG1haW5bcHJvcF07XG4gICAgaWYgKCEoY29udGFpbmVyIGluc3RhbmNlb2YgU2V0KSkge1xuICAgICAgICBtYWluW3Byb3BdID0gY29udGFpbmVyID0gbmV3IFNldChbY29udGFpbmVyXSk7XG4gICAgfVxuICAgIGNvbnRhaW5lci5hZGQoaXRlbSk7XG59O1xuY29uc3QgY2xlYXJJdGVtID0gKGNvbnQpID0+IChrZXkpID0+IHtcbiAgICBjb25zdCBzZXQgPSBjb250W2tleV07XG4gICAgaWYgKHNldCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICBzZXQuY2xlYXIoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGV0ZSBjb250W2tleV07XG4gICAgfVxufTtcbmNvbnN0IGRlbEZyb21TZXQgPSAobWFpbiwgcHJvcCwgaXRlbSkgPT4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IG1haW5bcHJvcF07XG4gICAgaWYgKGNvbnRhaW5lciBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICBjb250YWluZXIuZGVsZXRlKGl0ZW0pO1xuICAgIH1cbiAgICBlbHNlIGlmIChjb250YWluZXIgPT09IGl0ZW0pIHtcbiAgICAgICAgZGVsZXRlIG1haW5bcHJvcF07XG4gICAgfVxufTtcbmNvbnN0IGlzRW1wdHlTZXQgPSAodmFsKSA9PiAodmFsIGluc3RhbmNlb2YgU2V0ID8gdmFsLnNpemUgPT09IDAgOiAhdmFsKTtcbmNvbnN0IEZzV2F0Y2hJbnN0YW5jZXMgPSBuZXcgTWFwKCk7XG4vKipcbiAqIEluc3RhbnRpYXRlcyB0aGUgZnNfd2F0Y2ggaW50ZXJmYWNlXG4gKiBAcGFyYW0gcGF0aCB0byBiZSB3YXRjaGVkXG4gKiBAcGFyYW0gb3B0aW9ucyB0byBiZSBwYXNzZWQgdG8gZnNfd2F0Y2hcbiAqIEBwYXJhbSBsaXN0ZW5lciBtYWluIGV2ZW50IGhhbmRsZXJcbiAqIEBwYXJhbSBlcnJIYW5kbGVyIGVtaXRzIGluZm8gYWJvdXQgZXJyb3JzXG4gKiBAcGFyYW0gZW1pdFJhdyBlbWl0cyByYXcgZXZlbnQgZGF0YVxuICogQHJldHVybnMge05hdGl2ZUZzV2F0Y2hlcn1cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRnNXYXRjaEluc3RhbmNlKHBhdGgsIG9wdGlvbnMsIGxpc3RlbmVyLCBlcnJIYW5kbGVyLCBlbWl0UmF3KSB7XG4gICAgY29uc3QgaGFuZGxlRXZlbnQgPSAocmF3RXZlbnQsIGV2UGF0aCkgPT4ge1xuICAgICAgICBsaXN0ZW5lcihwYXRoKTtcbiAgICAgICAgZW1pdFJhdyhyYXdFdmVudCwgZXZQYXRoLCB7IHdhdGNoZWRQYXRoOiBwYXRoIH0pO1xuICAgICAgICAvLyBlbWl0IGJhc2VkIG9uIGV2ZW50cyBvY2N1cnJpbmcgZm9yIGZpbGVzIGZyb20gYSBkaXJlY3RvcnkncyB3YXRjaGVyIGluXG4gICAgICAgIC8vIGNhc2UgdGhlIGZpbGUncyB3YXRjaGVyIG1pc3NlcyBpdCAoYW5kIHJlbHkgb24gdGhyb3R0bGluZyB0byBkZS1kdXBlKVxuICAgICAgICBpZiAoZXZQYXRoICYmIHBhdGggIT09IGV2UGF0aCkge1xuICAgICAgICAgICAgZnNXYXRjaEJyb2FkY2FzdChzeXNQYXRoLnJlc29sdmUocGF0aCwgZXZQYXRoKSwgS0VZX0xJU1RFTkVSUywgc3lzUGF0aC5qb2luKHBhdGgsIGV2UGF0aCkpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZnNfd2F0Y2gocGF0aCwge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogb3B0aW9ucy5wZXJzaXN0ZW50LFxuICAgICAgICB9LCBoYW5kbGVFdmVudCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBlcnJIYW5kbGVyKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG4vKipcbiAqIEhlbHBlciBmb3IgcGFzc2luZyBmc193YXRjaCBldmVudCBkYXRhIHRvIGEgY29sbGVjdGlvbiBvZiBsaXN0ZW5lcnNcbiAqIEBwYXJhbSBmdWxsUGF0aCBhYnNvbHV0ZSBwYXRoIGJvdW5kIHRvIGZzX3dhdGNoIGluc3RhbmNlXG4gKi9cbmNvbnN0IGZzV2F0Y2hCcm9hZGNhc3QgPSAoZnVsbFBhdGgsIGxpc3RlbmVyVHlwZSwgdmFsMSwgdmFsMiwgdmFsMykgPT4ge1xuICAgIGNvbnN0IGNvbnQgPSBGc1dhdGNoSW5zdGFuY2VzLmdldChmdWxsUGF0aCk7XG4gICAgaWYgKCFjb250KVxuICAgICAgICByZXR1cm47XG4gICAgZm9yZWFjaChjb250W2xpc3RlbmVyVHlwZV0sIChsaXN0ZW5lcikgPT4ge1xuICAgICAgICBsaXN0ZW5lcih2YWwxLCB2YWwyLCB2YWwzKTtcbiAgICB9KTtcbn07XG4vKipcbiAqIEluc3RhbnRpYXRlcyB0aGUgZnNfd2F0Y2ggaW50ZXJmYWNlIG9yIGJpbmRzIGxpc3RlbmVyc1xuICogdG8gYW4gZXhpc3Rpbmcgb25lIGNvdmVyaW5nIHRoZSBzYW1lIGZpbGUgc3lzdGVtIGVudHJ5XG4gKiBAcGFyYW0gcGF0aFxuICogQHBhcmFtIGZ1bGxQYXRoIGFic29sdXRlIHBhdGhcbiAqIEBwYXJhbSBvcHRpb25zIHRvIGJlIHBhc3NlZCB0byBmc193YXRjaFxuICogQHBhcmFtIGhhbmRsZXJzIGNvbnRhaW5lciBmb3IgZXZlbnQgbGlzdGVuZXIgZnVuY3Rpb25zXG4gKi9cbmNvbnN0IHNldEZzV2F0Y2hMaXN0ZW5lciA9IChwYXRoLCBmdWxsUGF0aCwgb3B0aW9ucywgaGFuZGxlcnMpID0+IHtcbiAgICBjb25zdCB7IGxpc3RlbmVyLCBlcnJIYW5kbGVyLCByYXdFbWl0dGVyIH0gPSBoYW5kbGVycztcbiAgICBsZXQgY29udCA9IEZzV2F0Y2hJbnN0YW5jZXMuZ2V0KGZ1bGxQYXRoKTtcbiAgICBsZXQgd2F0Y2hlcjtcbiAgICBpZiAoIW9wdGlvbnMucGVyc2lzdGVudCkge1xuICAgICAgICB3YXRjaGVyID0gY3JlYXRlRnNXYXRjaEluc3RhbmNlKHBhdGgsIG9wdGlvbnMsIGxpc3RlbmVyLCBlcnJIYW5kbGVyLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKCF3YXRjaGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICByZXR1cm4gd2F0Y2hlci5jbG9zZS5iaW5kKHdhdGNoZXIpO1xuICAgIH1cbiAgICBpZiAoY29udCkge1xuICAgICAgICBhZGRBbmRDb252ZXJ0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgYWRkQW5kQ29udmVydChjb250LCBLRVlfRVJSLCBlcnJIYW5kbGVyKTtcbiAgICAgICAgYWRkQW5kQ29udmVydChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHdhdGNoZXIgPSBjcmVhdGVGc1dhdGNoSW5zdGFuY2UocGF0aCwgb3B0aW9ucywgZnNXYXRjaEJyb2FkY2FzdC5iaW5kKG51bGwsIGZ1bGxQYXRoLCBLRVlfTElTVEVORVJTKSwgZXJySGFuZGxlciwgLy8gbm8gbmVlZCB0byB1c2UgYnJvYWRjYXN0IGhlcmVcbiAgICAgICAgZnNXYXRjaEJyb2FkY2FzdC5iaW5kKG51bGwsIGZ1bGxQYXRoLCBLRVlfUkFXKSk7XG4gICAgICAgIGlmICghd2F0Y2hlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgd2F0Y2hlci5vbihFVi5FUlJPUiwgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm9hZGNhc3RFcnIgPSBmc1dhdGNoQnJvYWRjYXN0LmJpbmQobnVsbCwgZnVsbFBhdGgsIEtFWV9FUlIpO1xuICAgICAgICAgICAgaWYgKGNvbnQpXG4gICAgICAgICAgICAgICAgY29udC53YXRjaGVyVW51c2FibGUgPSB0cnVlOyAvLyBkb2N1bWVudGVkIHNpbmNlIE5vZGUgMTAuNC4xXG4gICAgICAgICAgICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzQzMzdcbiAgICAgICAgICAgIGlmIChpc1dpbmRvd3MgJiYgZXJyb3IuY29kZSA9PT0gJ0VQRVJNJykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZkID0gYXdhaXQgb3BlbihwYXRoLCAncicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmZC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICBicm9hZGNhc3RFcnIoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBicm9hZGNhc3RFcnIoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29udCA9IHtcbiAgICAgICAgICAgIGxpc3RlbmVyczogbGlzdGVuZXIsXG4gICAgICAgICAgICBlcnJIYW5kbGVyczogZXJySGFuZGxlcixcbiAgICAgICAgICAgIHJhd0VtaXR0ZXJzOiByYXdFbWl0dGVyLFxuICAgICAgICAgICAgd2F0Y2hlcixcbiAgICAgICAgfTtcbiAgICAgICAgRnNXYXRjaEluc3RhbmNlcy5zZXQoZnVsbFBhdGgsIGNvbnQpO1xuICAgIH1cbiAgICAvLyBjb25zdCBpbmRleCA9IGNvbnQubGlzdGVuZXJzLmluZGV4T2YobGlzdGVuZXIpO1xuICAgIC8vIHJlbW92ZXMgdGhpcyBpbnN0YW5jZSdzIGxpc3RlbmVycyBhbmQgY2xvc2VzIHRoZSB1bmRlcmx5aW5nIGZzX3dhdGNoXG4gICAgLy8gaW5zdGFuY2UgaWYgdGhlcmUgYXJlIG5vIG1vcmUgbGlzdGVuZXJzIGxlZnRcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBkZWxGcm9tU2V0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfRVJSLCBlcnJIYW5kbGVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKGlzRW1wdHlTZXQoY29udC5saXN0ZW5lcnMpKSB7XG4gICAgICAgICAgICAvLyBDaGVjayB0byBwcm90ZWN0IGFnYWluc3QgaXNzdWUgZ2gtNzMwLlxuICAgICAgICAgICAgLy8gaWYgKGNvbnQud2F0Y2hlclVudXNhYmxlKSB7XG4gICAgICAgICAgICBjb250LndhdGNoZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIEZzV2F0Y2hJbnN0YW5jZXMuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIEhBTkRMRVJfS0VZUy5mb3JFYWNoKGNsZWFySXRlbShjb250KSk7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb250LndhdGNoZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBPYmplY3QuZnJlZXplKGNvbnQpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4vLyBmc193YXRjaEZpbGUgaGVscGVyc1xuLy8gb2JqZWN0IHRvIGhvbGQgcGVyLXByb2Nlc3MgZnNfd2F0Y2hGaWxlIGluc3RhbmNlc1xuLy8gKG1heSBiZSBzaGFyZWQgYWNyb3NzIGNob2tpZGFyIEZTV2F0Y2hlciBpbnN0YW5jZXMpXG5jb25zdCBGc1dhdGNoRmlsZUluc3RhbmNlcyA9IG5ldyBNYXAoKTtcbi8qKlxuICogSW5zdGFudGlhdGVzIHRoZSBmc193YXRjaEZpbGUgaW50ZXJmYWNlIG9yIGJpbmRzIGxpc3RlbmVyc1xuICogdG8gYW4gZXhpc3Rpbmcgb25lIGNvdmVyaW5nIHRoZSBzYW1lIGZpbGUgc3lzdGVtIGVudHJ5XG4gKiBAcGFyYW0gcGF0aCB0byBiZSB3YXRjaGVkXG4gKiBAcGFyYW0gZnVsbFBhdGggYWJzb2x1dGUgcGF0aFxuICogQHBhcmFtIG9wdGlvbnMgb3B0aW9ucyB0byBiZSBwYXNzZWQgdG8gZnNfd2F0Y2hGaWxlXG4gKiBAcGFyYW0gaGFuZGxlcnMgY29udGFpbmVyIGZvciBldmVudCBsaXN0ZW5lciBmdW5jdGlvbnNcbiAqIEByZXR1cm5zIGNsb3NlclxuICovXG5jb25zdCBzZXRGc1dhdGNoRmlsZUxpc3RlbmVyID0gKHBhdGgsIGZ1bGxQYXRoLCBvcHRpb25zLCBoYW5kbGVycykgPT4ge1xuICAgIGNvbnN0IHsgbGlzdGVuZXIsIHJhd0VtaXR0ZXIgfSA9IGhhbmRsZXJzO1xuICAgIGxldCBjb250ID0gRnNXYXRjaEZpbGVJbnN0YW5jZXMuZ2V0KGZ1bGxQYXRoKTtcbiAgICAvLyBsZXQgbGlzdGVuZXJzID0gbmV3IFNldCgpO1xuICAgIC8vIGxldCByYXdFbWl0dGVycyA9IG5ldyBTZXQoKTtcbiAgICBjb25zdCBjb3B0cyA9IGNvbnQgJiYgY29udC5vcHRpb25zO1xuICAgIGlmIChjb3B0cyAmJiAoY29wdHMucGVyc2lzdGVudCA8IG9wdGlvbnMucGVyc2lzdGVudCB8fCBjb3B0cy5pbnRlcnZhbCA+IG9wdGlvbnMuaW50ZXJ2YWwpKSB7XG4gICAgICAgIC8vIFwiVXBncmFkZVwiIHRoZSB3YXRjaGVyIHRvIHBlcnNpc3RlbmNlIG9yIGEgcXVpY2tlciBpbnRlcnZhbC5cbiAgICAgICAgLy8gVGhpcyBjcmVhdGVzIHNvbWUgdW5saWtlbHkgZWRnZSBjYXNlIGlzc3VlcyBpZiB0aGUgdXNlciBtaXhlc1xuICAgICAgICAvLyBzZXR0aW5ncyBpbiBhIHZlcnkgd2VpcmQgd2F5LCBidXQgc29sdmluZyBmb3IgdGhvc2UgY2FzZXNcbiAgICAgICAgLy8gZG9lc24ndCBzZWVtIHdvcnRod2hpbGUgZm9yIHRoZSBhZGRlZCBjb21wbGV4aXR5LlxuICAgICAgICAvLyBsaXN0ZW5lcnMgPSBjb250Lmxpc3RlbmVycztcbiAgICAgICAgLy8gcmF3RW1pdHRlcnMgPSBjb250LnJhd0VtaXR0ZXJzO1xuICAgICAgICB1bndhdGNoRmlsZShmdWxsUGF0aCk7XG4gICAgICAgIGNvbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmIChjb250KSB7XG4gICAgICAgIGFkZEFuZENvbnZlcnQoY29udCwgS0VZX0xJU1RFTkVSUywgbGlzdGVuZXIpO1xuICAgICAgICBhZGRBbmRDb252ZXJ0KGNvbnQsIEtFWV9SQVcsIHJhd0VtaXR0ZXIpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyBsaXN0ZW5lcnMuYWRkKGxpc3RlbmVyKTtcbiAgICAgICAgLy8gcmF3RW1pdHRlcnMuYWRkKHJhd0VtaXR0ZXIpO1xuICAgICAgICBjb250ID0ge1xuICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcixcbiAgICAgICAgICAgIHJhd0VtaXR0ZXJzOiByYXdFbWl0dGVyLFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIHdhdGNoZXI6IHdhdGNoRmlsZShmdWxsUGF0aCwgb3B0aW9ucywgKGN1cnIsIHByZXYpID0+IHtcbiAgICAgICAgICAgICAgICBmb3JlYWNoKGNvbnQucmF3RW1pdHRlcnMsIChyYXdFbWl0dGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJhd0VtaXR0ZXIoRVYuQ0hBTkdFLCBmdWxsUGF0aCwgeyBjdXJyLCBwcmV2IH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJtdGltZSA9IGN1cnIubXRpbWVNcztcbiAgICAgICAgICAgICAgICBpZiAoY3Vyci5zaXplICE9PSBwcmV2LnNpemUgfHwgY3Vycm10aW1lID4gcHJldi5tdGltZU1zIHx8IGN1cnJtdGltZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3JlYWNoKGNvbnQubGlzdGVuZXJzLCAobGlzdGVuZXIpID0+IGxpc3RlbmVyKHBhdGgsIGN1cnIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfTtcbiAgICAgICAgRnNXYXRjaEZpbGVJbnN0YW5jZXMuc2V0KGZ1bGxQYXRoLCBjb250KTtcbiAgICB9XG4gICAgLy8gY29uc3QgaW5kZXggPSBjb250Lmxpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAvLyBSZW1vdmVzIHRoaXMgaW5zdGFuY2UncyBsaXN0ZW5lcnMgYW5kIGNsb3NlcyB0aGUgdW5kZXJseWluZyBmc193YXRjaEZpbGVcbiAgICAvLyBpbnN0YW5jZSBpZiB0aGVyZSBhcmUgbm8gbW9yZSBsaXN0ZW5lcnMgbGVmdC5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBkZWxGcm9tU2V0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKGlzRW1wdHlTZXQoY29udC5saXN0ZW5lcnMpKSB7XG4gICAgICAgICAgICBGc1dhdGNoRmlsZUluc3RhbmNlcy5kZWxldGUoZnVsbFBhdGgpO1xuICAgICAgICAgICAgdW53YXRjaEZpbGUoZnVsbFBhdGgpO1xuICAgICAgICAgICAgY29udC5vcHRpb25zID0gY29udC53YXRjaGVyID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgT2JqZWN0LmZyZWV6ZShjb250KTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuLyoqXG4gKiBAbWl4aW5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vZGVGc0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yKGZzVykge1xuICAgICAgICB0aGlzLmZzdyA9IGZzVztcbiAgICAgICAgdGhpcy5fYm91bmRIYW5kbGVFcnJvciA9IChlcnJvcikgPT4gZnNXLl9oYW5kbGVFcnJvcihlcnJvcik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdhdGNoIGZpbGUgZm9yIGNoYW5nZXMgd2l0aCBmc193YXRjaEZpbGUgb3IgZnNfd2F0Y2guXG4gICAgICogQHBhcmFtIHBhdGggdG8gZmlsZSBvciBkaXJcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXIgb24gZnMgY2hhbmdlXG4gICAgICogQHJldHVybnMgY2xvc2VyIGZvciB0aGUgd2F0Y2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIF93YXRjaFdpdGhOb2RlRnMocGF0aCwgbGlzdGVuZXIpIHtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHRoaXMuZnN3Lm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGRpcmVjdG9yeSA9IHN5c1BhdGguZGlybmFtZShwYXRoKTtcbiAgICAgICAgY29uc3QgYmFzZW5hbWUgPSBzeXNQYXRoLmJhc2VuYW1lKHBhdGgpO1xuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpO1xuICAgICAgICBwYXJlbnQuYWRkKGJhc2VuYW1lKTtcbiAgICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gc3lzUGF0aC5yZXNvbHZlKHBhdGgpO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogb3B0cy5wZXJzaXN0ZW50LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIWxpc3RlbmVyKVxuICAgICAgICAgICAgbGlzdGVuZXIgPSBFTVBUWV9GTjtcbiAgICAgICAgbGV0IGNsb3NlcjtcbiAgICAgICAgaWYgKG9wdHMudXNlUG9sbGluZykge1xuICAgICAgICAgICAgY29uc3QgZW5hYmxlQmluID0gb3B0cy5pbnRlcnZhbCAhPT0gb3B0cy5iaW5hcnlJbnRlcnZhbDtcbiAgICAgICAgICAgIG9wdGlvbnMuaW50ZXJ2YWwgPSBlbmFibGVCaW4gJiYgaXNCaW5hcnlQYXRoKGJhc2VuYW1lKSA/IG9wdHMuYmluYXJ5SW50ZXJ2YWwgOiBvcHRzLmludGVydmFsO1xuICAgICAgICAgICAgY2xvc2VyID0gc2V0RnNXYXRjaEZpbGVMaXN0ZW5lcihwYXRoLCBhYnNvbHV0ZVBhdGgsIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcixcbiAgICAgICAgICAgICAgICByYXdFbWl0dGVyOiB0aGlzLmZzdy5fZW1pdFJhdyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2xvc2VyID0gc2V0RnNXYXRjaExpc3RlbmVyKHBhdGgsIGFic29sdXRlUGF0aCwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLFxuICAgICAgICAgICAgICAgIGVyckhhbmRsZXI6IHRoaXMuX2JvdW5kSGFuZGxlRXJyb3IsXG4gICAgICAgICAgICAgICAgcmF3RW1pdHRlcjogdGhpcy5mc3cuX2VtaXRSYXcsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2xvc2VyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXYXRjaCBhIGZpbGUgYW5kIGVtaXQgYWRkIGV2ZW50IGlmIHdhcnJhbnRlZC5cbiAgICAgKiBAcmV0dXJucyBjbG9zZXIgZm9yIHRoZSB3YXRjaGVyIGluc3RhbmNlXG4gICAgICovXG4gICAgX2hhbmRsZUZpbGUoZmlsZSwgc3RhdHMsIGluaXRpYWxBZGQpIHtcbiAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRpcm5hbWUgPSBzeXNQYXRoLmRpcm5hbWUoZmlsZSk7XG4gICAgICAgIGNvbnN0IGJhc2VuYW1lID0gc3lzUGF0aC5iYXNlbmFtZShmaWxlKTtcbiAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5mc3cuX2dldFdhdGNoZWREaXIoZGlybmFtZSk7XG4gICAgICAgIC8vIHN0YXRzIGlzIGFsd2F5cyBwcmVzZW50XG4gICAgICAgIGxldCBwcmV2U3RhdHMgPSBzdGF0cztcbiAgICAgICAgLy8gaWYgdGhlIGZpbGUgaXMgYWxyZWFkeSBiZWluZyB3YXRjaGVkLCBkbyBub3RoaW5nXG4gICAgICAgIGlmIChwYXJlbnQuaGFzKGJhc2VuYW1lKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBhc3luYyAocGF0aCwgbmV3U3RhdHMpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5mc3cuX3Rocm90dGxlKFRIUk9UVExFX01PREVfV0FUQ0gsIGZpbGUsIDUpKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGlmICghbmV3U3RhdHMgfHwgbmV3U3RhdHMubXRpbWVNcyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1N0YXRzID0gYXdhaXQgc3RhdChmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgdGhhdCBjaGFuZ2UgZXZlbnQgd2FzIG5vdCBmaXJlZCBiZWNhdXNlIG9mIGNoYW5nZWQgb25seSBhY2Nlc3NUaW1lLlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdCA9IG5ld1N0YXRzLmF0aW1lTXM7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG10ID0gbmV3U3RhdHMubXRpbWVNcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhdCB8fCBhdCA8PSBtdCB8fCBtdCAhPT0gcHJldlN0YXRzLm10aW1lTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgZmlsZSwgbmV3U3RhdHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICgoaXNNYWNvcyB8fCBpc0xpbnV4IHx8IGlzRnJlZUJTRCkgJiYgcHJldlN0YXRzLmlubyAhPT0gbmV3U3RhdHMuaW5vKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fY2xvc2VGaWxlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldlN0YXRzID0gbmV3U3RhdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbG9zZXIgPSB0aGlzLl93YXRjaFdpdGhOb2RlRnMoZmlsZSwgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsb3NlcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldlN0YXRzID0gbmV3U3RhdHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpeCBpc3N1ZXMgd2hlcmUgbXRpbWUgaXMgbnVsbCBidXQgZmlsZSBpcyBzdGlsbCBwcmVzZW50XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9yZW1vdmUoZGlybmFtZSwgYmFzZW5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhZGQgaXMgYWJvdXQgdG8gYmUgZW1pdHRlZCBpZiBmaWxlIG5vdCBhbHJlYWR5IHRyYWNrZWQgaW4gcGFyZW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChwYXJlbnQuaGFzKGJhc2VuYW1lKSkge1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIHRoYXQgY2hhbmdlIGV2ZW50IHdhcyBub3QgZmlyZWQgYmVjYXVzZSBvZiBjaGFuZ2VkIG9ubHkgYWNjZXNzVGltZS5cbiAgICAgICAgICAgICAgICBjb25zdCBhdCA9IG5ld1N0YXRzLmF0aW1lTXM7XG4gICAgICAgICAgICAgICAgY29uc3QgbXQgPSBuZXdTdGF0cy5tdGltZU1zO1xuICAgICAgICAgICAgICAgIGlmICghYXQgfHwgYXQgPD0gbXQgfHwgbXQgIT09IHByZXZTdGF0cy5tdGltZU1zKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgZmlsZSwgbmV3U3RhdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcmV2U3RhdHMgPSBuZXdTdGF0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLy8ga2ljayBvZmYgdGhlIHdhdGNoZXJcbiAgICAgICAgY29uc3QgY2xvc2VyID0gdGhpcy5fd2F0Y2hXaXRoTm9kZUZzKGZpbGUsIGxpc3RlbmVyKTtcbiAgICAgICAgLy8gZW1pdCBhbiBhZGQgZXZlbnQgaWYgd2UncmUgc3VwcG9zZWQgdG9cbiAgICAgICAgaWYgKCEoaW5pdGlhbEFkZCAmJiB0aGlzLmZzdy5vcHRpb25zLmlnbm9yZUluaXRpYWwpICYmIHRoaXMuZnN3Ll9pc250SWdub3JlZChmaWxlKSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmZzdy5fdGhyb3R0bGUoRVYuQURELCBmaWxlLCAwKSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLmZzdy5fZW1pdChFVi5BREQsIGZpbGUsIHN0YXRzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2xvc2VyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgc3ltbGlua3MgZW5jb3VudGVyZWQgd2hpbGUgcmVhZGluZyBhIGRpci5cbiAgICAgKiBAcGFyYW0gZW50cnkgcmV0dXJuZWQgYnkgcmVhZGRpcnBcbiAgICAgKiBAcGFyYW0gZGlyZWN0b3J5IHBhdGggb2YgZGlyIGJlaW5nIHJlYWRcbiAgICAgKiBAcGFyYW0gcGF0aCBvZiB0aGlzIGl0ZW1cbiAgICAgKiBAcGFyYW0gaXRlbSBiYXNlbmFtZSBvZiB0aGlzIGl0ZW1cbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIG5vIG1vcmUgcHJvY2Vzc2luZyBpcyBuZWVkZWQgZm9yIHRoaXMgZW50cnkuXG4gICAgICovXG4gICAgYXN5bmMgX2hhbmRsZVN5bWxpbmsoZW50cnksIGRpcmVjdG9yeSwgcGF0aCwgaXRlbSkge1xuICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVsbCA9IGVudHJ5LmZ1bGxQYXRoO1xuICAgICAgICBjb25zdCBkaXIgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpO1xuICAgICAgICBpZiAoIXRoaXMuZnN3Lm9wdGlvbnMuZm9sbG93U3ltbGlua3MpIHtcbiAgICAgICAgICAgIC8vIHdhdGNoIHN5bWxpbmsgZGlyZWN0bHkgKGRvbid0IGZvbGxvdykgYW5kIGRldGVjdCBjaGFuZ2VzXG4gICAgICAgICAgICB0aGlzLmZzdy5faW5jclJlYWR5Q291bnQoKTtcbiAgICAgICAgICAgIGxldCBsaW5rUGF0aDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGlua1BhdGggPSBhd2FpdCBmc3JlYWxwYXRoKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fZW1pdFJlYWR5KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGlmIChkaXIuaGFzKGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuZ2V0KGZ1bGwpICE9PSBsaW5rUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChmdWxsLCBsaW5rUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgcGF0aCwgZW50cnkuc3RhdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRpci5hZGQoaXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5mc3cuX3N5bWxpbmtQYXRocy5zZXQoZnVsbCwgbGlua1BhdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkFERCwgcGF0aCwgZW50cnkuc3RhdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5mc3cuX2VtaXRSZWFkeSgpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZG9uJ3QgZm9sbG93IHRoZSBzYW1lIHN5bWxpbmsgbW9yZSB0aGFuIG9uY2VcbiAgICAgICAgaWYgKHRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuaGFzKGZ1bGwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChmdWxsLCB0cnVlKTtcbiAgICB9XG4gICAgX2hhbmRsZVJlYWQoZGlyZWN0b3J5LCBpbml0aWFsQWRkLCB3aCwgdGFyZ2V0LCBkaXIsIGRlcHRoLCB0aHJvdHRsZXIpIHtcbiAgICAgICAgLy8gTm9ybWFsaXplIHRoZSBkaXJlY3RvcnkgbmFtZSBvbiBXaW5kb3dzXG4gICAgICAgIGRpcmVjdG9yeSA9IHN5c1BhdGguam9pbihkaXJlY3RvcnksICcnKTtcbiAgICAgICAgdGhyb3R0bGVyID0gdGhpcy5mc3cuX3Rocm90dGxlKCdyZWFkZGlyJywgZGlyZWN0b3J5LCAxMDAwKTtcbiAgICAgICAgaWYgKCF0aHJvdHRsZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHByZXZpb3VzID0gdGhpcy5mc3cuX2dldFdhdGNoZWREaXIod2gucGF0aCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXcgU2V0KCk7XG4gICAgICAgIGxldCBzdHJlYW0gPSB0aGlzLmZzdy5fcmVhZGRpcnAoZGlyZWN0b3J5LCB7XG4gICAgICAgICAgICBmaWxlRmlsdGVyOiAoZW50cnkpID0+IHdoLmZpbHRlclBhdGgoZW50cnkpLFxuICAgICAgICAgICAgZGlyZWN0b3J5RmlsdGVyOiAoZW50cnkpID0+IHdoLmZpbHRlckRpcihlbnRyeSksXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIXN0cmVhbSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgc3RyZWFtXG4gICAgICAgICAgICAub24oU1RSX0RBVEEsIGFzeW5jIChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gZW50cnkucGF0aDtcbiAgICAgICAgICAgIGxldCBwYXRoID0gc3lzUGF0aC5qb2luKGRpcmVjdG9yeSwgaXRlbSk7XG4gICAgICAgICAgICBjdXJyZW50LmFkZChpdGVtKTtcbiAgICAgICAgICAgIGlmIChlbnRyeS5zdGF0cy5pc1N5bWJvbGljTGluaygpICYmXG4gICAgICAgICAgICAgICAgKGF3YWl0IHRoaXMuX2hhbmRsZVN5bWxpbmsoZW50cnksIGRpcmVjdG9yeSwgcGF0aCwgaXRlbSkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBGaWxlcyB0aGF0IHByZXNlbnQgaW4gY3VycmVudCBkaXJlY3Rvcnkgc25hcHNob3RcbiAgICAgICAgICAgIC8vIGJ1dCBhYnNlbnQgaW4gcHJldmlvdXMgYXJlIGFkZGVkIHRvIHdhdGNoIGxpc3QgYW5kXG4gICAgICAgICAgICAvLyBlbWl0IGBhZGRgIGV2ZW50LlxuICAgICAgICAgICAgaWYgKGl0ZW0gPT09IHRhcmdldCB8fCAoIXRhcmdldCAmJiAhcHJldmlvdXMuaGFzKGl0ZW0pKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9pbmNyUmVhZHlDb3VudCgpO1xuICAgICAgICAgICAgICAgIC8vIGVuc3VyZSByZWxhdGl2ZW5lc3Mgb2YgcGF0aCBpcyBwcmVzZXJ2ZWQgaW4gY2FzZSBvZiB3YXRjaGVyIHJldXNlXG4gICAgICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGguam9pbihkaXIsIHN5c1BhdGgucmVsYXRpdmUoZGlyLCBwYXRoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkVG9Ob2RlRnMocGF0aCwgaW5pdGlhbEFkZCwgd2gsIGRlcHRoICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgICAgICAub24oRVYuRVJST1IsIHRoaXMuX2JvdW5kSGFuZGxlRXJyb3IpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzdHJlYW0pXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgICAgICAgICAgc3RyZWFtLm9uY2UoU1RSX0VORCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHdhc1Rocm90dGxlZCA9IHRocm90dGxlciA/IHRocm90dGxlci5jbGVhcigpIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIC8vIEZpbGVzIHRoYXQgYWJzZW50IGluIGN1cnJlbnQgZGlyZWN0b3J5IHNuYXBzaG90XG4gICAgICAgICAgICAgICAgLy8gYnV0IHByZXNlbnQgaW4gcHJldmlvdXMgZW1pdCBgcmVtb3ZlYCBldmVudFxuICAgICAgICAgICAgICAgIC8vIGFuZCBhcmUgcmVtb3ZlZCBmcm9tIEB3YXRjaGVkW2RpcmVjdG9yeV0uXG4gICAgICAgICAgICAgICAgcHJldmlvdXNcbiAgICAgICAgICAgICAgICAgICAgLmdldENoaWxkcmVuKClcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbSAhPT0gZGlyZWN0b3J5ICYmICFjdXJyZW50LmhhcyhpdGVtKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fcmVtb3ZlKGRpcmVjdG9yeSwgaXRlbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3RyZWFtID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIC8vIG9uZSBtb3JlIHRpbWUgZm9yIGFueSBtaXNzZWQgaW4gY2FzZSBjaGFuZ2VzIGNhbWUgaW4gZXh0cmVtZWx5IHF1aWNrbHlcbiAgICAgICAgICAgICAgICBpZiAod2FzVGhyb3R0bGVkKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVSZWFkKGRpcmVjdG9yeSwgZmFsc2UsIHdoLCB0YXJnZXQsIGRpciwgZGVwdGgsIHRocm90dGxlcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgZGlyZWN0b3J5IHRvIGFkZCAvIHJlbW92ZSBmaWxlcyBmcm9tIGBAd2F0Y2hlZGAgbGlzdCBhbmQgcmUtcmVhZCBpdCBvbiBjaGFuZ2UuXG4gICAgICogQHBhcmFtIGRpciBmcyBwYXRoXG4gICAgICogQHBhcmFtIHN0YXRzXG4gICAgICogQHBhcmFtIGluaXRpYWxBZGRcbiAgICAgKiBAcGFyYW0gZGVwdGggcmVsYXRpdmUgdG8gdXNlci1zdXBwbGllZCBwYXRoXG4gICAgICogQHBhcmFtIHRhcmdldCBjaGlsZCBwYXRoIHRhcmdldGVkIGZvciB3YXRjaFxuICAgICAqIEBwYXJhbSB3aCBDb21tb24gd2F0Y2ggaGVscGVycyBmb3IgdGhpcyBwYXRoXG4gICAgICogQHBhcmFtIHJlYWxwYXRoXG4gICAgICogQHJldHVybnMgY2xvc2VyIGZvciB0aGUgd2F0Y2hlciBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBhc3luYyBfaGFuZGxlRGlyKGRpciwgc3RhdHMsIGluaXRpYWxBZGQsIGRlcHRoLCB0YXJnZXQsIHdoLCByZWFscGF0aCkge1xuICAgICAgICBjb25zdCBwYXJlbnREaXIgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihzeXNQYXRoLmRpcm5hbWUoZGlyKSk7XG4gICAgICAgIGNvbnN0IHRyYWNrZWQgPSBwYXJlbnREaXIuaGFzKHN5c1BhdGguYmFzZW5hbWUoZGlyKSk7XG4gICAgICAgIGlmICghKGluaXRpYWxBZGQgJiYgdGhpcy5mc3cub3B0aW9ucy5pZ25vcmVJbml0aWFsKSAmJiAhdGFyZ2V0ICYmICF0cmFja2VkKSB7XG4gICAgICAgICAgICB0aGlzLmZzdy5fZW1pdChFVi5BRERfRElSLCBkaXIsIHN0YXRzKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlbnN1cmUgZGlyIGlzIHRyYWNrZWQgKGhhcm1sZXNzIGlmIHJlZHVuZGFudClcbiAgICAgICAgcGFyZW50RGlyLmFkZChzeXNQYXRoLmJhc2VuYW1lKGRpcikpO1xuICAgICAgICB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXIpO1xuICAgICAgICBsZXQgdGhyb3R0bGVyO1xuICAgICAgICBsZXQgY2xvc2VyO1xuICAgICAgICBjb25zdCBvRGVwdGggPSB0aGlzLmZzdy5vcHRpb25zLmRlcHRoO1xuICAgICAgICBpZiAoKG9EZXB0aCA9PSBudWxsIHx8IGRlcHRoIDw9IG9EZXB0aCkgJiYgIXRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuaGFzKHJlYWxwYXRoKSkge1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9oYW5kbGVSZWFkKGRpciwgaW5pdGlhbEFkZCwgd2gsIHRhcmdldCwgZGlyLCBkZXB0aCwgdGhyb3R0bGVyKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbG9zZXIgPSB0aGlzLl93YXRjaFdpdGhOb2RlRnMoZGlyLCAoZGlyUGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBpZiBjdXJyZW50IGRpcmVjdG9yeSBpcyByZW1vdmVkLCBkbyBub3RoaW5nXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzICYmIHN0YXRzLm10aW1lTXMgPT09IDApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVSZWFkKGRpclBhdGgsIGZhbHNlLCB3aCwgdGFyZ2V0LCBkaXIsIGRlcHRoLCB0aHJvdHRsZXIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNsb3NlcjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSGFuZGxlIGFkZGVkIGZpbGUsIGRpcmVjdG9yeSwgb3IgZ2xvYiBwYXR0ZXJuLlxuICAgICAqIERlbGVnYXRlcyBjYWxsIHRvIF9oYW5kbGVGaWxlIC8gX2hhbmRsZURpciBhZnRlciBjaGVja3MuXG4gICAgICogQHBhcmFtIHBhdGggdG8gZmlsZSBvciBpclxuICAgICAqIEBwYXJhbSBpbml0aWFsQWRkIHdhcyB0aGUgZmlsZSBhZGRlZCBhdCB3YXRjaCBpbnN0YW50aWF0aW9uP1xuICAgICAqIEBwYXJhbSBwcmlvcldoIGRlcHRoIHJlbGF0aXZlIHRvIHVzZXItc3VwcGxpZWQgcGF0aFxuICAgICAqIEBwYXJhbSBkZXB0aCBDaGlsZCBwYXRoIGFjdHVhbGx5IHRhcmdldGVkIGZvciB3YXRjaFxuICAgICAqIEBwYXJhbSB0YXJnZXQgQ2hpbGQgcGF0aCBhY3R1YWxseSB0YXJnZXRlZCBmb3Igd2F0Y2hcbiAgICAgKi9cbiAgICBhc3luYyBfYWRkVG9Ob2RlRnMocGF0aCwgaW5pdGlhbEFkZCwgcHJpb3JXaCwgZGVwdGgsIHRhcmdldCkge1xuICAgICAgICBjb25zdCByZWFkeSA9IHRoaXMuZnN3Ll9lbWl0UmVhZHk7XG4gICAgICAgIGlmICh0aGlzLmZzdy5faXNJZ25vcmVkKHBhdGgpIHx8IHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgcmVhZHkoKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3aCA9IHRoaXMuZnN3Ll9nZXRXYXRjaEhlbHBlcnMocGF0aCk7XG4gICAgICAgIGlmIChwcmlvcldoKSB7XG4gICAgICAgICAgICB3aC5maWx0ZXJQYXRoID0gKGVudHJ5KSA9PiBwcmlvcldoLmZpbHRlclBhdGgoZW50cnkpO1xuICAgICAgICAgICAgd2guZmlsdGVyRGlyID0gKGVudHJ5KSA9PiBwcmlvcldoLmZpbHRlckRpcihlbnRyeSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXZhbHVhdGUgd2hhdCBpcyBhdCB0aGUgcGF0aCB3ZSdyZSBiZWluZyBhc2tlZCB0byB3YXRjaFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBzdGF0TWV0aG9kc1t3aC5zdGF0TWV0aG9kXSh3aC53YXRjaFBhdGgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBpZiAodGhpcy5mc3cuX2lzSWdub3JlZCh3aC53YXRjaFBhdGgsIHN0YXRzKSkge1xuICAgICAgICAgICAgICAgIHJlYWR5KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZm9sbG93ID0gdGhpcy5mc3cub3B0aW9ucy5mb2xsb3dTeW1saW5rcztcbiAgICAgICAgICAgIGxldCBjbG9zZXI7XG4gICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFic1BhdGggPSBzeXNQYXRoLnJlc29sdmUocGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGxvdyA/IGF3YWl0IGZzcmVhbHBhdGgocGF0aCkgOiBwYXRoO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjbG9zZXIgPSBhd2FpdCB0aGlzLl9oYW5kbGVEaXIod2gud2F0Y2hQYXRoLCBzdGF0cywgaW5pdGlhbEFkZCwgZGVwdGgsIHRhcmdldCwgd2gsIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAvLyBwcmVzZXJ2ZSB0aGlzIHN5bWxpbmsncyB0YXJnZXQgcGF0aFxuICAgICAgICAgICAgICAgIGlmIChhYnNQYXRoICE9PSB0YXJnZXRQYXRoICYmIHRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChhYnNQYXRoLCB0YXJnZXRQYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzdGF0cy5pc1N5bWJvbGljTGluaygpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGxvdyA/IGF3YWl0IGZzcmVhbHBhdGgocGF0aCkgOiBwYXRoO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBzeXNQYXRoLmRpcm5hbWUod2gud2F0Y2hQYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihwYXJlbnQpLmFkZCh3aC53YXRjaFBhdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkFERCwgd2gud2F0Y2hQYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgY2xvc2VyID0gYXdhaXQgdGhpcy5faGFuZGxlRGlyKHBhcmVudCwgc3RhdHMsIGluaXRpYWxBZGQsIGRlcHRoLCBwYXRoLCB3aCwgdGFyZ2V0UGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIC8vIHByZXNlcnZlIHRoaXMgc3ltbGluaydzIHRhcmdldCBwYXRoXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChzeXNQYXRoLnJlc29sdmUocGF0aCksIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsb3NlciA9IHRoaXMuX2hhbmRsZUZpbGUod2gud2F0Y2hQYXRoLCBzdGF0cywgaW5pdGlhbEFkZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkeSgpO1xuICAgICAgICAgICAgaWYgKGNsb3NlcilcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3Ll9oYW5kbGVFcnJvcihlcnJvcikpIHtcbiAgICAgICAgICAgICAgICByZWFkeSgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwgIi8qKlxuICogRGlzY292ZXIgdHdlYWtzIHVuZGVyIDx1c2VyUm9vdD4vdHdlYWtzLiBFYWNoIHR3ZWFrIGlzIGEgZGlyZWN0b3J5IHdpdGggYVxuICogbWFuaWZlc3QuanNvbiBhbmQgYW4gZW50cnkgc2NyaXB0LiBFbnRyeSByZXNvbHV0aW9uIGlzIG1hbmlmZXN0Lm1haW4gZmlyc3QsXG4gKiB0aGVuIGluZGV4LmpzLCBpbmRleC5tanMsIGFuZCBpbmRleC5janMuXG4gKlxuICogVGhlIG1hbmlmZXN0IGdhdGUgaXMgaW50ZW50aW9uYWxseSBzdHJpY3QuIEEgdHdlYWsgbXVzdCBpZGVudGlmeSBpdHMgR2l0SHViXG4gKiByZXBvc2l0b3J5IHNvIHRoZSBtYW5hZ2VyIGNhbiBjaGVjayByZWxlYXNlcyB3aXRob3V0IGdyYW50aW5nIHRoZSB0d2VhayBhblxuICogdXBkYXRlL2luc3RhbGwgY2hhbm5lbC4gVXBkYXRlIGNoZWNrcyBhcmUgYWR2aXNvcnkgb25seS5cbiAqL1xuaW1wb3J0IHsgcmVhZGRpclN5bmMsIHN0YXRTeW5jLCByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHsgVHdlYWtNYW5pZmVzdCB9IGZyb20gXCJAY2hhdGdwdC1wbHVzcGx1cy9zZGtcIjtcblxuZXhwb3J0IGludGVyZmFjZSBEaXNjb3ZlcmVkVHdlYWsge1xuICBkaXI6IHN0cmluZztcbiAgZW50cnk6IHN0cmluZztcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG59XG5cbmNvbnN0IEVOVFJZX0NBTkRJREFURVMgPSBbXCJpbmRleC5qc1wiLCBcImluZGV4LmNqc1wiLCBcImluZGV4Lm1qc1wiXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpc2NvdmVyVHdlYWtzKHR3ZWFrc0Rpcjogc3RyaW5nKTogRGlzY292ZXJlZFR3ZWFrW10ge1xuICBpZiAoIWV4aXN0c1N5bmModHdlYWtzRGlyKSkgcmV0dXJuIFtdO1xuICBjb25zdCBvdXQ6IERpc2NvdmVyZWRUd2Vha1tdID0gW107XG4gIGZvciAoY29uc3QgbmFtZSBvZiByZWFkZGlyU3luYyh0d2Vha3NEaXIpKSB7XG4gICAgY29uc3QgZGlyID0gam9pbih0d2Vha3NEaXIsIG5hbWUpO1xuICAgIGlmICghc3RhdFN5bmMoZGlyKS5pc0RpcmVjdG9yeSgpKSBjb250aW51ZTtcbiAgICBjb25zdCBtYW5pZmVzdFBhdGggPSBqb2luKGRpciwgXCJtYW5pZmVzdC5qc29uXCIpO1xuICAgIGlmICghZXhpc3RzU3luYyhtYW5pZmVzdFBhdGgpKSBjb250aW51ZTtcbiAgICBsZXQgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gICAgdHJ5IHtcbiAgICAgIG1hbmlmZXN0ID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMobWFuaWZlc3RQYXRoLCBcInV0ZjhcIikpIGFzIFR3ZWFrTWFuaWZlc3Q7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkTWFuaWZlc3QobWFuaWZlc3QpKSBjb250aW51ZTtcbiAgICBjb25zdCBlbnRyeSA9IHJlc29sdmVFbnRyeShkaXIsIG1hbmlmZXN0KTtcbiAgICBpZiAoIWVudHJ5KSBjb250aW51ZTtcbiAgICBvdXQucHVzaCh7IGRpciwgZW50cnksIG1hbmlmZXN0IH0pO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIGlzVmFsaWRNYW5pZmVzdChtOiBUd2Vha01hbmlmZXN0KTogYm9vbGVhbiB7XG4gIGlmICghbS5pZCB8fCAhbS5uYW1lIHx8ICFtLnZlcnNpb24gfHwgIW0uZ2l0aHViUmVwbykgcmV0dXJuIGZhbHNlO1xuICBpZiAoIS9eW2EtekEtWjAtOS5fLV0rXFwvW2EtekEtWjAtOS5fLV0rJC8udGVzdChtLmdpdGh1YlJlcG8pKSByZXR1cm4gZmFsc2U7XG4gIGlmIChtLnNjb3BlICYmICFbXCJyZW5kZXJlclwiLCBcIm1haW5cIiwgXCJib3RoXCJdLmluY2x1ZGVzKG0uc2NvcGUpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlRW50cnkoZGlyOiBzdHJpbmcsIG06IFR3ZWFrTWFuaWZlc3QpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKG0ubWFpbikge1xuICAgIGNvbnN0IHAgPSBqb2luKGRpciwgbS5tYWluKTtcbiAgICByZXR1cm4gZXhpc3RzU3luYyhwKSA/IHAgOiBudWxsO1xuICB9XG4gIGZvciAoY29uc3QgYyBvZiBFTlRSWV9DQU5ESURBVEVTKSB7XG4gICAgY29uc3QgcCA9IGpvaW4oZGlyLCBjKTtcbiAgICBpZiAoZXhpc3RzU3luYyhwKSkgcmV0dXJuIHA7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG4iLCAiLyoqXG4gKiBEaXNrLWJhY2tlZCBrZXkvdmFsdWUgc3RvcmFnZSBmb3IgbWFpbi1wcm9jZXNzIHR3ZWFrcy5cbiAqXG4gKiBFYWNoIHR3ZWFrIGdldHMgb25lIEpTT04gZmlsZSB1bmRlciBgPHVzZXJSb290Pi9zdG9yYWdlLzxpZD4uanNvbmAuXG4gKiBXcml0ZXMgYXJlIGRlYm91bmNlZCAoNTAgbXMpIGFuZCBhdG9taWMgKHdyaXRlIHRvIDxmaWxlPi50bXAgdGhlbiByZW5hbWUpLlxuICogUmVhZHMgYXJlIGVhZ2VyICsgY2FjaGVkIGluLW1lbW9yeTsgd2UgbG9hZCBvbiBmaXJzdCBhY2Nlc3MuXG4gKi9cbmltcG9ydCB7XG4gIGV4aXN0c1N5bmMsXG4gIG1rZGlyU3luYyxcbiAgcmVhZEZpbGVTeW5jLFxuICByZW5hbWVTeW5jLFxuICB3cml0ZUZpbGVTeW5jLFxufSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxuZXhwb3J0IGludGVyZmFjZSBEaXNrU3RvcmFnZSB7XG4gIGdldDxUPihrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlPzogVCk6IFQ7XG4gIHNldChrZXk6IHN0cmluZywgdmFsdWU6IHVua25vd24pOiB2b2lkO1xuICBkZWxldGUoa2V5OiBzdHJpbmcpOiB2b2lkO1xuICBhbGwoKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGZsdXNoKCk6IHZvaWQ7XG59XG5cbmNvbnN0IEZMVVNIX0RFTEFZX01TID0gNTA7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXNrU3RvcmFnZShyb290RGlyOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBEaXNrU3RvcmFnZSB7XG4gIGNvbnN0IGRpciA9IGpvaW4ocm9vdERpciwgXCJzdG9yYWdlXCIpO1xuICBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgY29uc3QgZmlsZSA9IGpvaW4oZGlyLCBgJHtzYW5pdGl6ZShpZCl9Lmpzb25gKTtcblxuICBsZXQgZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKGV4aXN0c1N5bmMoZmlsZSkpIHtcbiAgICB0cnkge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKGZpbGUsIFwidXRmOFwiKSkgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBDb3JydXB0IGZpbGUgXHUyMDE0IHN0YXJ0IGZyZXNoLCBidXQgZG9uJ3QgY2xvYmJlciB0aGUgb3JpZ2luYWwgdW50aWwgd2VcbiAgICAgIC8vIHN1Y2Nlc3NmdWxseSB3cml0ZSBhZ2Fpbi4gKE1vdmUgaXQgYXNpZGUgZm9yIGZvcmVuc2ljcy4pXG4gICAgICB0cnkge1xuICAgICAgICByZW5hbWVTeW5jKGZpbGUsIGAke2ZpbGV9LmNvcnJ1cHQtJHtEYXRlLm5vdygpfWApO1xuICAgICAgfSBjYXRjaCB7fVxuICAgICAgZGF0YSA9IHt9O1xuICAgIH1cbiAgfVxuXG4gIGxldCBkaXJ0eSA9IGZhbHNlO1xuICBsZXQgdGltZXI6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3Qgc2NoZWR1bGVGbHVzaCA9ICgpID0+IHtcbiAgICBkaXJ0eSA9IHRydWU7XG4gICAgaWYgKHRpbWVyKSByZXR1cm47XG4gICAgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgIGlmIChkaXJ0eSkgZmx1c2goKTtcbiAgICB9LCBGTFVTSF9ERUxBWV9NUyk7XG4gIH07XG5cbiAgY29uc3QgZmx1c2ggPSAoKTogdm9pZCA9PiB7XG4gICAgaWYgKCFkaXJ0eSkgcmV0dXJuO1xuICAgIGNvbnN0IHRtcCA9IGAke2ZpbGV9LnRtcGA7XG4gICAgdHJ5IHtcbiAgICAgIHdyaXRlRmlsZVN5bmModG1wLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSwgXCJ1dGY4XCIpO1xuICAgICAgcmVuYW1lU3luYyh0bXAsIGZpbGUpO1xuICAgICAgZGlydHkgPSBmYWxzZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBMZWF2ZSBkaXJ0eT10cnVlIHNvIGEgZnV0dXJlIGZsdXNoIHJldHJpZXMuXG4gICAgICBjb25zb2xlLmVycm9yKFwiW2NoYXRncHQtcGx1c3BsdXNdIHN0b3JhZ2UgZmx1c2ggZmFpbGVkOlwiLCBpZCwgZSk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgZ2V0OiA8VD4oazogc3RyaW5nLCBkPzogVCk6IFQgPT5cbiAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChkYXRhLCBrKSA/IChkYXRhW2tdIGFzIFQpIDogKGQgYXMgVCksXG4gICAgc2V0KGssIHYpIHtcbiAgICAgIGRhdGFba10gPSB2O1xuICAgICAgc2NoZWR1bGVGbHVzaCgpO1xuICAgIH0sXG4gICAgZGVsZXRlKGspIHtcbiAgICAgIGlmIChrIGluIGRhdGEpIHtcbiAgICAgICAgZGVsZXRlIGRhdGFba107XG4gICAgICAgIHNjaGVkdWxlRmx1c2goKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGFsbDogKCkgPT4gKHsgLi4uZGF0YSB9KSxcbiAgICBmbHVzaCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemUoaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIFR3ZWFrIGlkcyBhcmUgYXV0aG9yLWNvbnRyb2xsZWQ7IGNsYW1wIHRvIGEgc2FmZSBmaWxlbmFtZS5cbiAgcmV0dXJuIGlkLnJlcGxhY2UoL1teYS16QS1aMC05Ll9ALV0vZywgXCJfXCIpO1xufVxuIiwgImltcG9ydCB7IGV4aXN0c1N5bmMsIG1rZGlyU3luYywgcmVhZEZpbGVTeW5jLCB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGRpcm5hbWUsIGlzQWJzb2x1dGUsIHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgdHlwZSB7IFR3ZWFrTWNwU2VydmVyIH0gZnJvbSBcIkBjaGF0Z3B0LXBsdXNwbHVzL3Nka1wiO1xuXG5leHBvcnQgY29uc3QgTUNQX01BTkFHRURfU1RBUlQgPSBcIiMgQkVHSU4gQ0hBVEdQVCsrIE1BTkFHRUQgTUNQIFNFUlZFUlNcIjtcbmV4cG9ydCBjb25zdCBNQ1BfTUFOQUdFRF9FTkQgPSBcIiMgRU5EIENIQVRHUFQrKyBNQU5BR0VEIE1DUCBTRVJWRVJTXCI7XG4vKiogXHU2NUU3XHU3MjQ4XHU2ODA3XHU4QkIwXHVGRjA4djEuMC41IFx1NEU0Qlx1NTI0RFx1RkYwOVx1RkYwQ1x1NTQwQ1x1NkI2NVx1NjVGNlx1NEUwMFx1NUU3Nlx1NkUwNVx1NzQwNlx1RkYwQ1x1OTA3Rlx1NTE0RFx1NjVFN1x1NTc1N1x1NkI4Qlx1NzU1OVx1NTcyOCBDb2RleCBcdTkxNERcdTdGNkVcdTkxQ0NcdTMwMDIgKi9cbmV4cG9ydCBjb25zdCBMRUdBQ1lfTUNQX01BTkFHRURfU1RBUlQgPSBcIiMgQkVHSU4gQ09ERVgrKyBNQU5BR0VEIE1DUCBTRVJWRVJTXCI7XG5leHBvcnQgY29uc3QgTEVHQUNZX01DUF9NQU5BR0VEX0VORCA9IFwiIyBFTkQgQ09ERVgrKyBNQU5BR0VEIE1DUCBTRVJWRVJTXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWNwU3luY1R3ZWFrIHtcbiAgZGlyOiBzdHJpbmc7XG4gIG1hbmlmZXN0OiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICBtY3A/OiBUd2Vha01jcFNlcnZlcjtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdE1hbmFnZWRNY3BCbG9jayB7XG4gIGJsb2NrOiBzdHJpbmc7XG4gIHNlcnZlck5hbWVzOiBzdHJpbmdbXTtcbiAgc2tpcHBlZFNlcnZlck5hbWVzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNYW5hZ2VkTWNwU3luY1Jlc3VsdCBleHRlbmRzIEJ1aWx0TWFuYWdlZE1jcEJsb2NrIHtcbiAgY2hhbmdlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bmNNYW5hZ2VkTWNwU2VydmVycyh7XG4gIGNvbmZpZ1BhdGgsXG4gIHR3ZWFrcyxcbn06IHtcbiAgY29uZmlnUGF0aDogc3RyaW5nO1xuICB0d2Vha3M6IE1jcFN5bmNUd2Vha1tdO1xufSk6IE1hbmFnZWRNY3BTeW5jUmVzdWx0IHtcbiAgY29uc3QgY3VycmVudCA9IGV4aXN0c1N5bmMoY29uZmlnUGF0aCkgPyByZWFkRmlsZVN5bmMoY29uZmlnUGF0aCwgXCJ1dGY4XCIpIDogXCJcIjtcbiAgY29uc3QgYnVpbHQgPSBidWlsZE1hbmFnZWRNY3BCbG9jayh0d2Vha3MsIGN1cnJlbnQpO1xuICBjb25zdCBuZXh0ID0gbWVyZ2VNYW5hZ2VkTWNwQmxvY2soY3VycmVudCwgYnVpbHQuYmxvY2spO1xuXG4gIGlmIChuZXh0ICE9PSBjdXJyZW50KSB7XG4gICAgbWtkaXJTeW5jKGRpcm5hbWUoY29uZmlnUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIHdyaXRlRmlsZVN5bmMoY29uZmlnUGF0aCwgbmV4dCwgXCJ1dGY4XCIpO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4uYnVpbHQsIGNoYW5nZWQ6IG5leHQgIT09IGN1cnJlbnQgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWFuYWdlZE1jcEJsb2NrKFxuICB0d2Vha3M6IE1jcFN5bmNUd2Vha1tdLFxuICBleGlzdGluZ1RvbWwgPSBcIlwiLFxuKTogQnVpbHRNYW5hZ2VkTWNwQmxvY2sge1xuICBjb25zdCBtYW51YWxUb21sID0gc3RyaXBNYW5hZ2VkTWNwQmxvY2soZXhpc3RpbmdUb21sKTtcbiAgY29uc3QgbWFudWFsTmFtZXMgPSBmaW5kTWNwU2VydmVyTmFtZXMobWFudWFsVG9tbCk7XG4gIGNvbnN0IHVzZWROYW1lcyA9IG5ldyBTZXQobWFudWFsTmFtZXMpO1xuICBjb25zdCBzZXJ2ZXJOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgc2tpcHBlZFNlcnZlck5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBlbnRyaWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgdHdlYWsgb2YgdHdlYWtzKSB7XG4gICAgY29uc3QgbWNwID0gbm9ybWFsaXplTWNwU2VydmVyKHR3ZWFrLm1hbmlmZXN0Lm1jcCk7XG4gICAgaWYgKCFtY3ApIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgYmFzZU5hbWUgPSBtY3BTZXJ2ZXJOYW1lRnJvbVR3ZWFrSWQodHdlYWsubWFuaWZlc3QuaWQpO1xuICAgIGlmIChtYW51YWxOYW1lcy5oYXMoYmFzZU5hbWUpKSB7XG4gICAgICBza2lwcGVkU2VydmVyTmFtZXMucHVzaChiYXNlTmFtZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZXJOYW1lID0gcmVzZXJ2ZVVuaXF1ZU5hbWUoYmFzZU5hbWUsIHVzZWROYW1lcyk7XG4gICAgc2VydmVyTmFtZXMucHVzaChzZXJ2ZXJOYW1lKTtcbiAgICBlbnRyaWVzLnB1c2goZm9ybWF0TWNwU2VydmVyKHNlcnZlck5hbWUsIHR3ZWFrLmRpciwgbWNwKSk7XG4gIH1cblxuICBpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4geyBibG9jazogXCJcIiwgc2VydmVyTmFtZXMsIHNraXBwZWRTZXJ2ZXJOYW1lcyB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBibG9jazogW01DUF9NQU5BR0VEX1NUQVJULCAuLi5lbnRyaWVzLCBNQ1BfTUFOQUdFRF9FTkRdLmpvaW4oXCJcXG5cIiksXG4gICAgc2VydmVyTmFtZXMsXG4gICAgc2tpcHBlZFNlcnZlck5hbWVzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VNYW5hZ2VkTWNwQmxvY2soY3VycmVudFRvbWw6IHN0cmluZywgbWFuYWdlZEJsb2NrOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoXG4gICAgIW1hbmFnZWRCbG9jayAmJlxuICAgICFjdXJyZW50VG9tbC5pbmNsdWRlcyhNQ1BfTUFOQUdFRF9TVEFSVCkgJiZcbiAgICAhY3VycmVudFRvbWwuaW5jbHVkZXMoTEVHQUNZX01DUF9NQU5BR0VEX1NUQVJUKVxuICApIHtcbiAgICByZXR1cm4gY3VycmVudFRvbWw7XG4gIH1cbiAgY29uc3Qgc3RyaXBwZWQgPSBzdHJpcE1hbmFnZWRNY3BCbG9jayhjdXJyZW50VG9tbCkudHJpbUVuZCgpO1xuICBpZiAoIW1hbmFnZWRCbG9jaykgcmV0dXJuIHN0cmlwcGVkID8gYCR7c3RyaXBwZWR9XFxuYCA6IFwiXCI7XG4gIHJldHVybiBgJHtzdHJpcHBlZCA/IGAke3N0cmlwcGVkfVxcblxcbmAgOiBcIlwifSR7bWFuYWdlZEJsb2NrfVxcbmA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcE1hbmFnZWRNY3BCbG9jayh0b21sOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlZ0V4cChcbiAgICBgXFxcXG4/KD86JHtlc2NhcGVSZWdFeHAoTUNQX01BTkFHRURfU1RBUlQpfXwke2VzY2FwZVJlZ0V4cChMRUdBQ1lfTUNQX01BTkFHRURfU1RBUlQpfSlgICtcbiAgICAgIGBbXFxcXHNcXFxcU10qPyg/OiR7ZXNjYXBlUmVnRXhwKE1DUF9NQU5BR0VEX0VORCl9fCR7ZXNjYXBlUmVnRXhwKExFR0FDWV9NQ1BfTUFOQUdFRF9FTkQpfSlcXFxcbj9gLFxuICAgIFwiZ1wiLFxuICApO1xuICByZXR1cm4gdG9tbC5yZXBsYWNlKHBhdHRlcm4sIFwiXFxuXCIpLnJlcGxhY2UoL1xcbnszLH0vZywgXCJcXG5cXG5cIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtY3BTZXJ2ZXJOYW1lRnJvbVR3ZWFrSWQoaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdpdGhvdXRQdWJsaXNoZXIgPSBpZC5yZXBsYWNlKC9eY29cXC5iZW5uZXR0XFwuLywgXCJcIik7XG4gIGNvbnN0IHNsdWcgPSB3aXRob3V0UHVibGlzaGVyXG4gICAgLnJlcGxhY2UoL1teYS16QS1aMC05Xy1dKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCBcIlwiKVxuICAgIC50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gc2x1ZyB8fCBcInR3ZWFrLW1jcFwiO1xufVxuXG5mdW5jdGlvbiBmaW5kTWNwU2VydmVyTmFtZXModG9tbDogc3RyaW5nKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBuYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCB0YWJsZVBhdHRlcm4gPSAvXlxccypcXFttY3Bfc2VydmVyc1xcLihbXlxcXVxcc10rKVxcXVxccyokL2dtO1xuICBsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgobWF0Y2ggPSB0YWJsZVBhdHRlcm4uZXhlYyh0b21sKSkgIT09IG51bGwpIHtcbiAgICBuYW1lcy5hZGQodW5xdW90ZVRvbWxLZXkobWF0Y2hbMV0gPz8gXCJcIikpO1xuICB9XG4gIHJldHVybiBuYW1lcztcbn1cblxuZnVuY3Rpb24gcmVzZXJ2ZVVuaXF1ZU5hbWUoYmFzZU5hbWU6IHN0cmluZywgdXNlZE5hbWVzOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB7XG4gIGlmICghdXNlZE5hbWVzLmhhcyhiYXNlTmFtZSkpIHtcbiAgICB1c2VkTmFtZXMuYWRkKGJhc2VOYW1lKTtcbiAgICByZXR1cm4gYmFzZU5hbWU7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDI7IDsgaSArPSAxKSB7XG4gICAgY29uc3QgY2FuZGlkYXRlID0gYCR7YmFzZU5hbWV9LSR7aX1gO1xuICAgIGlmICghdXNlZE5hbWVzLmhhcyhjYW5kaWRhdGUpKSB7XG4gICAgICB1c2VkTmFtZXMuYWRkKGNhbmRpZGF0ZSk7XG4gICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVNY3BTZXJ2ZXIodmFsdWU6IFR3ZWFrTWNwU2VydmVyIHwgdW5kZWZpbmVkKTogVHdlYWtNY3BTZXJ2ZXIgfCBudWxsIHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUuY29tbWFuZCAhPT0gXCJzdHJpbmdcIiB8fCB2YWx1ZS5jb21tYW5kLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gIGlmICh2YWx1ZS5hcmdzICE9PSB1bmRlZmluZWQgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUuYXJncykpIHJldHVybiBudWxsO1xuICBpZiAodmFsdWUuYXJncz8uc29tZSgoYXJnKSA9PiB0eXBlb2YgYXJnICE9PSBcInN0cmluZ1wiKSkgcmV0dXJuIG51bGw7XG4gIGlmICh2YWx1ZS5lbnYgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICghdmFsdWUuZW52IHx8IHR5cGVvZiB2YWx1ZS5lbnYgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZS5lbnYpKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoT2JqZWN0LnZhbHVlcyh2YWx1ZS5lbnYpLnNvbWUoKGVudlZhbHVlKSA9PiB0eXBlb2YgZW52VmFsdWUgIT09IFwic3RyaW5nXCIpKSByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1jcFNlcnZlcihzZXJ2ZXJOYW1lOiBzdHJpbmcsIHR3ZWFrRGlyOiBzdHJpbmcsIG1jcDogVHdlYWtNY3BTZXJ2ZXIpOiBzdHJpbmcge1xuICBjb25zdCBsaW5lcyA9IFtcbiAgICBgW21jcF9zZXJ2ZXJzLiR7Zm9ybWF0VG9tbEtleShzZXJ2ZXJOYW1lKX1dYCxcbiAgICBgY29tbWFuZCA9ICR7Zm9ybWF0VG9tbFN0cmluZyhyZXNvbHZlQ29tbWFuZCh0d2Vha0RpciwgbWNwLmNvbW1hbmQpKX1gLFxuICBdO1xuXG4gIGlmIChtY3AuYXJncyAmJiBtY3AuYXJncy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaChgYXJncyA9ICR7Zm9ybWF0VG9tbFN0cmluZ0FycmF5KG1jcC5hcmdzLm1hcCgoYXJnKSA9PiByZXNvbHZlQXJnKHR3ZWFrRGlyLCBhcmcpKSl9YCk7XG4gIH1cblxuICBpZiAobWNwLmVudiAmJiBPYmplY3Qua2V5cyhtY3AuZW52KS5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaChgZW52ID0gJHtmb3JtYXRUb21sSW5saW5lVGFibGUobWNwLmVudil9YCk7XG4gIH1cblxuICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmQodHdlYWtEaXI6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKGlzQWJzb2x1dGUoY29tbWFuZCkgfHwgIWxvb2tzTGlrZVJlbGF0aXZlUGF0aChjb21tYW5kKSkgcmV0dXJuIGNvbW1hbmQ7XG4gIHJldHVybiByZXNvbHZlKHR3ZWFrRGlyLCBjb21tYW5kKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFyZyh0d2Vha0Rpcjogc3RyaW5nLCBhcmc6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChpc0Fic29sdXRlKGFyZykgfHwgYXJnLnN0YXJ0c1dpdGgoXCItXCIpKSByZXR1cm4gYXJnO1xuICBjb25zdCBjYW5kaWRhdGUgPSByZXNvbHZlKHR3ZWFrRGlyLCBhcmcpO1xuICByZXR1cm4gZXhpc3RzU3luYyhjYW5kaWRhdGUpID8gY2FuZGlkYXRlIDogYXJnO1xufVxuXG5mdW5jdGlvbiBsb29rc0xpa2VSZWxhdGl2ZVBhdGgodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFsdWUuc3RhcnRzV2l0aChcIi4vXCIpIHx8IHZhbHVlLnN0YXJ0c1dpdGgoXCIuLi9cIikgfHwgdmFsdWUuaW5jbHVkZXMoXCIvXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sU3RyaW5nQXJyYXkodmFsdWVzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBgWyR7dmFsdWVzLm1hcChmb3JtYXRUb21sU3RyaW5nKS5qb2luKFwiLCBcIil9XWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRvbWxJbmxpbmVUYWJsZShyZWNvcmQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBzdHJpbmcge1xuICByZXR1cm4gYHsgJHtPYmplY3QuZW50cmllcyhyZWNvcmQpXG4gICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBgJHtmb3JtYXRUb21sS2V5KGtleSl9ID0gJHtmb3JtYXRUb21sU3RyaW5nKHZhbHVlKX1gKVxuICAgIC5qb2luKFwiLCBcIil9IH1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sS2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIC9eW2EtekEtWjAtOV8tXSskLy50ZXN0KGtleSkgPyBrZXkgOiBmb3JtYXRUb21sU3RyaW5nKGtleSk7XG59XG5cbmZ1bmN0aW9uIHVucXVvdGVUb21sS2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFrZXkuc3RhcnRzV2l0aCgnXCInKSB8fCAha2V5LmVuZHNXaXRoKCdcIicpKSByZXR1cm4ga2V5O1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGtleSkgYXMgc3RyaW5nO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ga2V5O1xuICB9XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbn1cbiIsICJpbXBvcnQgeyBleGVjRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgaG9tZWRpciwgcGxhdGZvcm0gfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxudHlwZSBDaGVja1N0YXR1cyA9IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIG5hbWU6IHN0cmluZztcbiAgc3RhdHVzOiBDaGVja1N0YXR1cztcbiAgZGV0YWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2F0Y2hlckhlYWx0aCB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBzdGF0dXM6IENoZWNrU3RhdHVzO1xuICB0aXRsZTogc3RyaW5nO1xuICBzdW1tYXJ5OiBzdHJpbmc7XG4gIHdhdGNoZXI6IHN0cmluZztcbiAgY2hlY2tzOiBXYXRjaGVySGVhbHRoQ2hlY2tbXTtcbn1cblxuaW50ZXJmYWNlIEluc3RhbGxlclN0YXRlIHtcbiAgYXBwUm9vdD86IHN0cmluZztcbiAgdmVyc2lvbj86IHN0cmluZztcbiAgd2F0Y2hlcj86IFwibGF1bmNoZFwiIHwgXCJsb2dpbi1pdGVtXCIgfCBcInNjaGVkdWxlZC10YXNrXCIgfCBcInN5c3RlbWRcIiB8IFwibm9uZVwiO1xufVxuXG5pbnRlcmZhY2UgUnVudGltZUNvbmZpZyB7XG4gIGNoYXRncHRQbHVzUGx1cz86IHtcbiAgICBhdXRvVXBkYXRlPzogYm9vbGVhbjtcbiAgfTtcbiAgLyoqIFx1NjVFN1x1NzI0OFx1NjcyQ1x1OTE0RFx1N0Y2RVx1OTUyRVx1NTQwRFx1RkYwOHYxLjAuNSBcdTRFNEJcdTUyNERcdUZGMDlcdUZGMENcdThCRkJcdTUzRDZcdTY1RjZcdTUxN0NcdTVCQjlcdTMwMDIgKi9cbiAgY29kZXhQbHVzUGx1cz86IHtcbiAgICBhdXRvVXBkYXRlPzogYm9vbGVhbjtcbiAgfTtcbn1cblxuaW50ZXJmYWNlIFNlbGZVcGRhdGVTdGF0ZSB7XG4gIHN0YXR1cz86IFwiY2hlY2tpbmdcIiB8IFwidXAtdG8tZGF0ZVwiIHwgXCJ1cGRhdGVkXCIgfCBcImZhaWxlZFwiIHwgXCJkaXNhYmxlZFwiO1xuICBjb21wbGV0ZWRBdD86IHN0cmluZztcbiAgY2hlY2tlZEF0Pzogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uPzogc3RyaW5nIHwgbnVsbDtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmNvbnN0IExBVU5DSERfTEFCRUwgPSBcImNvbS5jaGF0Z3B0cGx1c3BsdXMud2F0Y2hlclwiO1xuY29uc3QgTEVHQUNZX0xBVU5DSERfTEFCRUwgPSBcImNvbS5jb2RleHBsdXNwbHVzLndhdGNoZXJcIjtcbmNvbnN0IFdBVENIRVJfTE9HID0gam9pbihob21lZGlyKCksIFwiTGlicmFyeVwiLCBcIkxvZ3NcIiwgXCJjaGF0Z3B0LXBsdXNwbHVzLXdhdGNoZXIubG9nXCIpO1xuY29uc3QgTEVHQUNZX1dBVENIRVJfTE9HID0gam9pbihob21lZGlyKCksIFwiTGlicmFyeVwiLCBcIkxvZ3NcIiwgXCJjb2RleC1wbHVzcGx1cy13YXRjaGVyLmxvZ1wiKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFdhdGNoZXJIZWFsdGgodXNlclJvb3Q6IHN0cmluZyk6IFdhdGNoZXJIZWFsdGgge1xuICBjb25zdCBjaGVja3M6IFdhdGNoZXJIZWFsdGhDaGVja1tdID0gW107XG4gIGNvbnN0IHN0YXRlID0gcmVhZEpzb248SW5zdGFsbGVyU3RhdGU+KGpvaW4odXNlclJvb3QsIFwic3RhdGUuanNvblwiKSk7XG4gIGNvbnN0IGNvbmZpZyA9IHJlYWRKc29uPFJ1bnRpbWVDb25maWc+KGpvaW4odXNlclJvb3QsIFwiY29uZmlnLmpzb25cIikpID8/IHt9O1xuICBjb25zdCBzZWxmVXBkYXRlID0gcmVhZEpzb248U2VsZlVwZGF0ZVN0YXRlPihqb2luKHVzZXJSb290LCBcInNlbGYtdXBkYXRlLXN0YXRlLmpzb25cIikpO1xuXG4gIGNoZWNrcy5wdXNoKHtcbiAgICBuYW1lOiBcIkluc3RhbGwgc3RhdGVcIixcbiAgICBzdGF0dXM6IHN0YXRlID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgIGRldGFpbDogc3RhdGUgPyBgQ2hhdEdQVCsrICR7c3RhdGUudmVyc2lvbiA/PyBcIih1bmtub3duIHZlcnNpb24pXCJ9YCA6IFwic3RhdGUuanNvbiBpcyBtaXNzaW5nXCIsXG4gIH0pO1xuXG4gIGlmICghc3RhdGUpIHJldHVybiBzdW1tYXJpemUoXCJub25lXCIsIGNoZWNrcyk7XG5cbiAgY29uc3QgYXV0b1VwZGF0ZSA9IGNvbmZpZy5jaGF0Z3B0UGx1c1BsdXM/LmF1dG9VcGRhdGUgIT09IGZhbHNlICYmIGNvbmZpZy5jb2RleFBsdXNQbHVzPy5hdXRvVXBkYXRlICE9PSBmYWxzZTtcbiAgY2hlY2tzLnB1c2goe1xuICAgIG5hbWU6IFwiQXV0b21hdGljIHJlZnJlc2hcIixcbiAgICBzdGF0dXM6IGF1dG9VcGRhdGUgPyBcIm9rXCIgOiBcIndhcm5cIixcbiAgICBkZXRhaWw6IGF1dG9VcGRhdGUgPyBcImVuYWJsZWRcIiA6IFwiZGlzYWJsZWQgaW4gQ2hhdEdQVCsrIGNvbmZpZ1wiLFxuICB9KTtcblxuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJXYXRjaGVyIGtpbmRcIixcbiAgICBzdGF0dXM6IHN0YXRlLndhdGNoZXIgJiYgc3RhdGUud2F0Y2hlciAhPT0gXCJub25lXCIgPyBcIm9rXCIgOiBcImVycm9yXCIsXG4gICAgZGV0YWlsOiBzdGF0ZS53YXRjaGVyID8/IFwibm9uZVwiLFxuICB9KTtcblxuICBpZiAoc2VsZlVwZGF0ZSkge1xuICAgIGNoZWNrcy5wdXNoKHNlbGZVcGRhdGVDaGVjayhzZWxmVXBkYXRlKSk7XG4gIH1cblxuICBjb25zdCBhcHBSb290ID0gc3RhdGUuYXBwUm9vdCA/PyBcIlwiO1xuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJDb2RleCBhcHBcIixcbiAgICBzdGF0dXM6IGFwcFJvb3QgJiYgZXhpc3RzU3luYyhhcHBSb290KSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICBkZXRhaWw6IGFwcFJvb3QgfHwgXCJtaXNzaW5nIGFwcFJvb3QgaW4gc3RhdGVcIixcbiAgfSk7XG5cbiAgc3dpdGNoIChwbGF0Zm9ybSgpKSB7XG4gICAgY2FzZSBcImRhcndpblwiOlxuICAgICAgY2hlY2tzLnB1c2goLi4uY2hlY2tMYXVuY2hkV2F0Y2hlcihhcHBSb290KSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwibGludXhcIjpcbiAgICAgIGNoZWNrcy5wdXNoKC4uLmNoZWNrU3lzdGVtZFdhdGNoZXIoYXBwUm9vdCkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcIndpbjMyXCI6XG4gICAgICBjaGVja3MucHVzaCguLi5jaGVja1NjaGVkdWxlZFRhc2tXYXRjaGVyKCkpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGNoZWNrcy5wdXNoKHtcbiAgICAgICAgbmFtZTogXCJQbGF0Zm9ybSB3YXRjaGVyXCIsXG4gICAgICAgIHN0YXR1czogXCJ3YXJuXCIsXG4gICAgICAgIGRldGFpbDogYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3BsYXRmb3JtKCl9YCxcbiAgICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHN1bW1hcml6ZShzdGF0ZS53YXRjaGVyID8/IFwibm9uZVwiLCBjaGVja3MpO1xufVxuXG5mdW5jdGlvbiBzZWxmVXBkYXRlQ2hlY2soc3RhdGU6IFNlbGZVcGRhdGVTdGF0ZSk6IFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIGNvbnN0IGF0ID0gc3RhdGUuY29tcGxldGVkQXQgPz8gc3RhdGUuY2hlY2tlZEF0ID8/IFwidW5rbm93biB0aW1lXCI7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwiZmFpbGVkXCIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogXCJsYXN0IENoYXRHUFQrKyB1cGRhdGVcIixcbiAgICAgIHN0YXR1czogXCJ3YXJuXCIsXG4gICAgICBkZXRhaWw6IHN0YXRlLmVycm9yID8gYGZhaWxlZCAke2F0fTogJHtzdGF0ZS5lcnJvcn1gIDogYGZhaWxlZCAke2F0fWAsXG4gICAgfTtcbiAgfVxuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcImRpc2FibGVkXCIpIHtcbiAgICByZXR1cm4geyBuYW1lOiBcImxhc3QgQ2hhdEdQVCsrIHVwZGF0ZVwiLCBzdGF0dXM6IFwid2FyblwiLCBkZXRhaWw6IGBza2lwcGVkICR7YXR9OiBhdXRvbWF0aWMgcmVmcmVzaCBkaXNhYmxlZGAgfTtcbiAgfVxuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcInVwZGF0ZWRcIikge1xuICAgIHJldHVybiB7IG5hbWU6IFwibGFzdCBDaGF0R1BUKysgdXBkYXRlXCIsIHN0YXR1czogXCJva1wiLCBkZXRhaWw6IGB1cGRhdGVkICR7YXR9IHRvICR7c3RhdGUubGF0ZXN0VmVyc2lvbiA/PyBcIm5ldyByZWxlYXNlXCJ9YCB9O1xuICB9XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwidXAtdG8tZGF0ZVwiKSB7XG4gICAgcmV0dXJuIHsgbmFtZTogXCJsYXN0IENoYXRHUFQrKyB1cGRhdGVcIiwgc3RhdHVzOiBcIm9rXCIsIGRldGFpbDogYHVwIHRvIGRhdGUgJHthdH1gIH07XG4gIH1cbiAgcmV0dXJuIHsgbmFtZTogXCJsYXN0IENoYXRHUFQrKyB1cGRhdGVcIiwgc3RhdHVzOiBcIndhcm5cIiwgZGV0YWlsOiBgY2hlY2tpbmcgc2luY2UgJHthdH1gIH07XG59XG5cbmZ1bmN0aW9uIGNoZWNrTGF1bmNoZFdhdGNoZXIoYXBwUm9vdDogc3RyaW5nKTogV2F0Y2hlckhlYWx0aENoZWNrW10ge1xuICBjb25zdCBjaGVja3M6IFdhdGNoZXJIZWFsdGhDaGVja1tdID0gW107XG4gIGNvbnN0IHBsaXN0UGF0aCA9IGpvaW4oaG9tZWRpcigpLCBcIkxpYnJhcnlcIiwgXCJMYXVuY2hBZ2VudHNcIiwgYCR7TEFVTkNIRF9MQUJFTH0ucGxpc3RgKTtcbiAgY29uc3QgcGxpc3QgPSBleGlzdHNTeW5jKHBsaXN0UGF0aCkgPyByZWFkRmlsZVNhZmUocGxpc3RQYXRoKSA6IFwiXCI7XG4gIGNvbnN0IGFzYXJQYXRoID0gYXBwUm9vdCA/IGpvaW4oYXBwUm9vdCwgXCJDb250ZW50c1wiLCBcIlJlc291cmNlc1wiLCBcImFwcC5hc2FyXCIpIDogXCJcIjtcblxuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJsYXVuY2hkIHBsaXN0XCIsXG4gICAgc3RhdHVzOiBwbGlzdCA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICBkZXRhaWw6IHBsaXN0UGF0aCxcbiAgfSk7XG5cbiAgaWYgKHBsaXN0KSB7XG4gICAgY2hlY2tzLnB1c2goe1xuICAgICAgbmFtZTogXCJsYXVuY2hkIGxhYmVsXCIsXG4gICAgICBzdGF0dXM6IHBsaXN0LmluY2x1ZGVzKExBVU5DSERfTEFCRUwpIHx8IHBsaXN0LmluY2x1ZGVzKExFR0FDWV9MQVVOQ0hEX0xBQkVMKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogTEFVTkNIRF9MQUJFTCxcbiAgICB9KTtcbiAgICBjaGVja3MucHVzaCh7XG4gICAgICBuYW1lOiBcImxhdW5jaGQgdHJpZ2dlclwiLFxuICAgICAgc3RhdHVzOiBhc2FyUGF0aCAmJiBwbGlzdC5pbmNsdWRlcyhhc2FyUGF0aCkgPyBcIm9rXCIgOiBcImVycm9yXCIsXG4gICAgICBkZXRhaWw6IGFzYXJQYXRoIHx8IFwibWlzc2luZyBhcHBSb290XCIsXG4gICAgfSk7XG4gICAgY2hlY2tzLnB1c2goe1xuICAgICAgbmFtZTogXCJ3YXRjaGVyIGNvbW1hbmRcIixcbiAgICAgIHN0YXR1czogKHBsaXN0LmluY2x1ZGVzKFwiQ0hBVEdQVF9QTFVTUExVU19XQVRDSEVSPTFcIikgfHwgcGxpc3QuaW5jbHVkZXMoXCJDT0RFWF9QTFVTUExVU19XQVRDSEVSPTFcIikpICYmXG4gICAgICAgIHBsaXN0LmluY2x1ZGVzKFwiIHVwZGF0ZSAtLXdhdGNoZXIgLS1xdWlldFwiKVxuICAgICAgICA/IFwib2tcIlxuICAgICAgICA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogY29tbWFuZFN1bW1hcnkocGxpc3QpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2xpUGF0aCA9IGV4dHJhY3RGaXJzdChwbGlzdCwgLycoW14nXSpwYWNrYWdlc1xcL2luc3RhbGxlclxcL2Rpc3RcXC9jbGlcXC5qcyknLyk7XG4gICAgaWYgKGNsaVBhdGgpIHtcbiAgICAgIGNoZWNrcy5wdXNoKHtcbiAgICAgICAgbmFtZTogXCJyZXBhaXIgQ0xJXCIsXG4gICAgICAgIHN0YXR1czogZXhpc3RzU3luYyhjbGlQYXRoKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgICAgZGV0YWlsOiBjbGlQYXRoLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbG9hZGVkID0gY29tbWFuZFN1Y2NlZWRzKFwibGF1bmNoY3RsXCIsIFtcImxpc3RcIiwgTEFVTkNIRF9MQUJFTF0pO1xuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJsYXVuY2hkIGxvYWRlZFwiLFxuICAgIHN0YXR1czogbG9hZGVkID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgIGRldGFpbDogbG9hZGVkID8gXCJzZXJ2aWNlIGlzIGxvYWRlZFwiIDogXCJsYXVuY2hjdGwgY2Fubm90IGZpbmQgdGhlIHdhdGNoZXJcIixcbiAgfSk7XG5cbiAgY2hlY2tzLnB1c2god2F0Y2hlckxvZ0NoZWNrKCkpO1xuICByZXR1cm4gY2hlY2tzO1xufVxuXG5mdW5jdGlvbiBjaGVja1N5c3RlbWRXYXRjaGVyKGFwcFJvb3Q6IHN0cmluZyk6IFdhdGNoZXJIZWFsdGhDaGVja1tdIHtcbiAgY29uc3QgZGlyID0gam9pbihob21lZGlyKCksIFwiLmNvbmZpZ1wiLCBcInN5c3RlbWRcIiwgXCJ1c2VyXCIpO1xuICBjb25zdCBzZXJ2aWNlID0gam9pbihkaXIsIFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLnNlcnZpY2VcIik7XG4gIGNvbnN0IHRpbWVyID0gam9pbihkaXIsIFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLnRpbWVyXCIpO1xuICBjb25zdCBwYXRoVW5pdCA9IGpvaW4oZGlyLCBcImNoYXRncHQtcGx1c3BsdXMtd2F0Y2hlci5wYXRoXCIpO1xuICBjb25zdCBleHBlY3RlZFBhdGggPSBhcHBSb290ID8gam9pbihhcHBSb290LCBcInJlc291cmNlc1wiLCBcImFwcC5hc2FyXCIpIDogXCJcIjtcbiAgY29uc3QgcGF0aEJvZHkgPSBleGlzdHNTeW5jKHBhdGhVbml0KSA/IHJlYWRGaWxlU2FmZShwYXRoVW5pdCkgOiBcIlwiO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgbmFtZTogXCJzeXN0ZW1kIHNlcnZpY2VcIixcbiAgICAgIHN0YXR1czogZXhpc3RzU3luYyhzZXJ2aWNlKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogc2VydmljZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6IFwic3lzdGVtZCB0aW1lclwiLFxuICAgICAgc3RhdHVzOiBleGlzdHNTeW5jKHRpbWVyKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogdGltZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiBcInN5c3RlbWQgcGF0aFwiLFxuICAgICAgc3RhdHVzOiBwYXRoQm9keSAmJiBleHBlY3RlZFBhdGggJiYgcGF0aEJvZHkuaW5jbHVkZXMoZXhwZWN0ZWRQYXRoKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogZXhwZWN0ZWRQYXRoIHx8IHBhdGhVbml0LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogXCJwYXRoIHVuaXQgYWN0aXZlXCIsXG4gICAgICBzdGF0dXM6IGNvbW1hbmRTdWNjZWVkcyhcInN5c3RlbWN0bFwiLCBbXCItLXVzZXJcIiwgXCJpcy1hY3RpdmVcIiwgXCItLXF1aWV0XCIsIFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLnBhdGhcIl0pID8gXCJva1wiIDogXCJ3YXJuXCIsXG4gICAgICBkZXRhaWw6IFwic3lzdGVtY3RsIC0tdXNlciBpcy1hY3RpdmUgY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLnBhdGhcIixcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6IFwidGltZXIgYWN0aXZlXCIsXG4gICAgICBzdGF0dXM6IGNvbW1hbmRTdWNjZWVkcyhcInN5c3RlbWN0bFwiLCBbXCItLXVzZXJcIiwgXCJpcy1hY3RpdmVcIiwgXCItLXF1aWV0XCIsIFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLnRpbWVyXCJdKSA/IFwib2tcIiA6IFwid2FyblwiLFxuICAgICAgZGV0YWlsOiBcInN5c3RlbWN0bCAtLXVzZXIgaXMtYWN0aXZlIGNoYXRncHQtcGx1c3BsdXMtd2F0Y2hlci50aW1lclwiLFxuICAgIH0sXG4gIF07XG59XG5cbmZ1bmN0aW9uIGNoZWNrU2NoZWR1bGVkVGFza1dhdGNoZXIoKTogV2F0Y2hlckhlYWx0aENoZWNrW10ge1xuICByZXR1cm4gW1xuICAgIHtcbiAgICAgIG5hbWU6IFwibG9nb24gdGFza1wiLFxuICAgICAgc3RhdHVzOiBjb21tYW5kU3VjY2VlZHMoXCJzY2h0YXNrcy5leGVcIiwgW1wiL1F1ZXJ5XCIsIFwiL1ROXCIsIFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyXCJdKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogXCJjaGF0Z3B0LXBsdXNwbHVzLXdhdGNoZXJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6IFwiaG91cmx5IHRhc2tcIixcbiAgICAgIHN0YXR1czogY29tbWFuZFN1Y2NlZWRzKFwic2NodGFza3MuZXhlXCIsIFtcIi9RdWVyeVwiLCBcIi9UTlwiLCBcImNoYXRncHQtcGx1c3BsdXMtd2F0Y2hlci1ob3VybHlcIl0pID8gXCJva1wiIDogXCJ3YXJuXCIsXG4gICAgICBkZXRhaWw6IFwiY2hhdGdwdC1wbHVzcGx1cy13YXRjaGVyLWhvdXJseVwiLFxuICAgIH0sXG4gIF07XG59XG5cbmZ1bmN0aW9uIHdhdGNoZXJMb2dDaGVjaygpOiBXYXRjaGVySGVhbHRoQ2hlY2sge1xuICBjb25zdCBsb2dQYXRoID0gZXhpc3RzU3luYyhXQVRDSEVSX0xPRykgPyBXQVRDSEVSX0xPRyA6IExFR0FDWV9XQVRDSEVSX0xPRztcbiAgaWYgKCFleGlzdHNTeW5jKGxvZ1BhdGgpKSB7XG4gICAgcmV0dXJuIHsgbmFtZTogXCJ3YXRjaGVyIGxvZ1wiLCBzdGF0dXM6IFwid2FyblwiLCBkZXRhaWw6IFwibm8gd2F0Y2hlciBsb2cgeWV0XCIgfTtcbiAgfVxuICBjb25zdCB0YWlsID0gcmVhZEZpbGVTYWZlKGxvZ1BhdGgpLnNwbGl0KC9cXHI/XFxuLykuc2xpY2UoLTQwKS5qb2luKFwiXFxuXCIpO1xuICByZXR1cm4gYW5hbHl6ZVdhdGNoZXJMb2dUYWlsKHRhaWwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVdhdGNoZXJMb2dUYWlsKHRhaWw6IHN0cmluZyk6IFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIGNvbnN0IGhhc0Vycm9yID0gL1x1MjcxNyAoPzpjaGF0Z3B0fGNvZGV4KS1wbHVzcGx1cyBmYWlsZWR8KD86Y2hhdGdwdHxjb2RleCktcGx1c3BsdXMgZmFpbGVkfGVycm9yfGZhaWxlZC9pLnRlc3QodGFpbCk7XG4gIGNvbnN0IG5lZWRzTWFudWFsUmVwYWlyID1cbiAgICBoYXNFcnJvciAmJlxuICAgIC9DYW5ub3Qgd3JpdGUgdG8gLipDb2RleC4qXFwuYXBwfEFwcCBNYW5hZ2VtZW50fGZpbGUgb3duZXJzaGlwfHN1ZG8gKD86Y2hhdGdwdHBsdXNwbHVzfGNvZGV4cGx1c3BsdXMpICg/Omluc3RhbGx8cmVwYWlyKXxFQUNDRVN8RVBFUk0vaS50ZXN0KHRhaWwpO1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwid2F0Y2hlciBsb2dcIixcbiAgICBzdGF0dXM6IGhhc0Vycm9yID8gXCJ3YXJuXCIgOiBcIm9rXCIsXG4gICAgZGV0YWlsOiBoYXNFcnJvclxuICAgICAgPyBuZWVkc01hbnVhbFJlcGFpclxuICAgICAgICA/IFwiYXV0by1yZXBhaXIgbmVlZHMgYXBwIHBlcm1pc3Npb25zOyBydW4gYGNoYXRncHRwbHVzcGx1cyByZXBhaXJgIGZyb20gVGVybWluYWxcIlxuICAgICAgICA6IFwicmVjZW50IHdhdGNoZXIgbG9nIGNvbnRhaW5zIGFuIGVycm9yXCJcbiAgICAgIDogV0FUQ0hFUl9MT0csXG4gIH07XG59XG5cbmZ1bmN0aW9uIHN1bW1hcml6ZSh3YXRjaGVyOiBzdHJpbmcsIGNoZWNrczogV2F0Y2hlckhlYWx0aENoZWNrW10pOiBXYXRjaGVySGVhbHRoIHtcbiAgY29uc3QgaGFzRXJyb3IgPSBjaGVja3Muc29tZSgoYykgPT4gYy5zdGF0dXMgPT09IFwiZXJyb3JcIik7XG4gIGNvbnN0IGhhc1dhcm4gPSBjaGVja3Muc29tZSgoYykgPT4gYy5zdGF0dXMgPT09IFwid2FyblwiKTtcbiAgY29uc3Qgc3RhdHVzOiBDaGVja1N0YXR1cyA9IGhhc0Vycm9yID8gXCJlcnJvclwiIDogaGFzV2FybiA/IFwid2FyblwiIDogXCJva1wiO1xuICBjb25zdCBmYWlsZWQgPSBjaGVja3MuZmlsdGVyKChjKSA9PiBjLnN0YXR1cyA9PT0gXCJlcnJvclwiKS5sZW5ndGg7XG4gIGNvbnN0IHdhcm5lZCA9IGNoZWNrcy5maWx0ZXIoKGMpID0+IGMuc3RhdHVzID09PSBcIndhcm5cIikubGVuZ3RoO1xuICBjb25zdCB0aXRsZSA9XG4gICAgc3RhdHVzID09PSBcIm9rXCJcbiAgICAgID8gXCJBdXRvLXJlcGFpciB3YXRjaGVyIGlzIHJlYWR5XCJcbiAgICAgIDogc3RhdHVzID09PSBcIndhcm5cIlxuICAgICAgICA/IFwiQXV0by1yZXBhaXIgd2F0Y2hlciBuZWVkcyByZXZpZXdcIlxuICAgICAgICA6IFwiQXV0by1yZXBhaXIgd2F0Y2hlciBpcyBub3QgcmVhZHlcIjtcbiAgY29uc3Qgc3VtbWFyeSA9XG4gICAgc3RhdHVzID09PSBcIm9rXCJcbiAgICAgID8gXCJDaGF0R1BUKysgc2hvdWxkIGF1dG9tYXRpY2FsbHkgcmVwYWlyIGl0c2VsZiBhZnRlciBDb2RleCB1cGRhdGVzLlwiXG4gICAgICA6IGAke2ZhaWxlZH0gZmFpbGluZyBjaGVjayhzKSwgJHt3YXJuZWR9IHdhcm5pbmcocykuYDtcblxuICByZXR1cm4ge1xuICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIHN0YXR1cyxcbiAgICB0aXRsZSxcbiAgICBzdW1tYXJ5LFxuICAgIHdhdGNoZXIsXG4gICAgY2hlY2tzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb21tYW5kU3VjY2VlZHMoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIGV4ZWNGaWxlU3luYyhjb21tYW5kLCBhcmdzLCB7IHN0ZGlvOiBcImlnbm9yZVwiLCB0aW1lb3V0OiA1XzAwMCB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1hbmRTdW1tYXJ5KHBsaXN0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBjb21tYW5kID0gZXh0cmFjdEZpcnN0KHBsaXN0LCAvPHN0cmluZz4oW148XSooPzp1cGRhdGUgLS13YXRjaGVyIC0tcXVpZXR8cmVwYWlyIC0tcXVpZXQpW148XSopPFxcL3N0cmluZz4vKTtcbiAgcmV0dXJuIGNvbW1hbmQgPyB1bmVzY2FwZVhtbChjb21tYW5kKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCkgOiBcIndhdGNoZXIgY29tbWFuZCBub3QgZm91bmRcIjtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEZpcnN0KHNvdXJjZTogc3RyaW5nLCBwYXR0ZXJuOiBSZWdFeHApOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIHNvdXJjZS5tYXRjaChwYXR0ZXJuKT8uWzFdID8/IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRKc29uPFQ+KHBhdGg6IHN0cmluZyk6IFQgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocGF0aCwgXCJ1dGY4XCIpKSBhcyBUO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkRmlsZVNhZmUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVhZEZpbGVTeW5jKHBhdGgsIFwidXRmOFwiKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW5lc2NhcGVYbWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mcXVvdDsvZywgXCJcXFwiXCIpXG4gICAgLnJlcGxhY2UoLyZhcG9zOy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJmx0Oy9nLCBcIjxcIilcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCBcIj5cIilcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpO1xufVxuIiwgImV4cG9ydCB0eXBlIFR3ZWFrU2NvcGUgPSBcInJlbmRlcmVyXCIgfCBcIm1haW5cIiB8IFwiYm90aFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbG9hZFR3ZWFrc0RlcHMge1xuICBsb2dJbmZvKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG4gIHN0b3BBbGxNYWluVHdlYWtzKCk6IHZvaWQ7XG4gIGNsZWFyVHdlYWtNb2R1bGVDYWNoZSgpOiB2b2lkO1xuICBsb2FkQWxsTWFpblR3ZWFrcygpOiB2b2lkO1xuICBicm9hZGNhc3RSZWxvYWQoKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTZXRUd2Vha0VuYWJsZWRBbmRSZWxvYWREZXBzIGV4dGVuZHMgUmVsb2FkVHdlYWtzRGVwcyB7XG4gIHNldFR3ZWFrRW5hYmxlZChpZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTWFpblByb2Nlc3NUd2Vha1Njb3BlKHNjb3BlOiBUd2Vha1Njb3BlIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gIHJldHVybiBzY29wZSAhPT0gXCJyZW5kZXJlclwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsb2FkVHdlYWtzKHJlYXNvbjogc3RyaW5nLCBkZXBzOiBSZWxvYWRUd2Vha3NEZXBzKTogdm9pZCB7XG4gIGRlcHMubG9nSW5mbyhgcmVsb2FkaW5nIHR3ZWFrcyAoJHtyZWFzb259KWApO1xuICBkZXBzLnN0b3BBbGxNYWluVHdlYWtzKCk7XG4gIGRlcHMuY2xlYXJUd2Vha01vZHVsZUNhY2hlKCk7XG4gIGRlcHMubG9hZEFsbE1haW5Ud2Vha3MoKTtcbiAgZGVwcy5icm9hZGNhc3RSZWxvYWQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFR3ZWFrRW5hYmxlZEFuZFJlbG9hZChcbiAgaWQ6IHN0cmluZyxcbiAgZW5hYmxlZDogdW5rbm93bixcbiAgZGVwczogU2V0VHdlYWtFbmFibGVkQW5kUmVsb2FkRGVwcyxcbik6IHRydWUge1xuICBjb25zdCBub3JtYWxpemVkRW5hYmxlZCA9ICEhZW5hYmxlZDtcbiAgZGVwcy5zZXRUd2Vha0VuYWJsZWQoaWQsIG5vcm1hbGl6ZWRFbmFibGVkKTtcbiAgZGVwcy5sb2dJbmZvKGB0d2VhayAke2lkfSBlbmFibGVkPSR7bm9ybWFsaXplZEVuYWJsZWR9YCk7XG4gIHJlbG9hZFR3ZWFrcyhcImVuYWJsZWQtdG9nZ2xlXCIsIGRlcHMpO1xuICByZXR1cm4gdHJ1ZTtcbn1cbiIsICJpbXBvcnQgeyBhcHBlbmRGaWxlU3luYywgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jLCBzdGF0U3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5cbmV4cG9ydCBjb25zdCBNQVhfTE9HX0JZVEVTID0gMTAgKiAxMDI0ICogMTAyNDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZENhcHBlZExvZyhwYXRoOiBzdHJpbmcsIGxpbmU6IHN0cmluZywgbWF4Qnl0ZXMgPSBNQVhfTE9HX0JZVEVTKTogdm9pZCB7XG4gIGNvbnN0IGluY29taW5nID0gQnVmZmVyLmZyb20obGluZSk7XG4gIGlmIChpbmNvbWluZy5ieXRlTGVuZ3RoID49IG1heEJ5dGVzKSB7XG4gICAgd3JpdGVGaWxlU3luYyhwYXRoLCBpbmNvbWluZy5zdWJhcnJheShpbmNvbWluZy5ieXRlTGVuZ3RoIC0gbWF4Qnl0ZXMpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChleGlzdHNTeW5jKHBhdGgpKSB7XG4gICAgICBjb25zdCBzaXplID0gc3RhdFN5bmMocGF0aCkuc2l6ZTtcbiAgICAgIGNvbnN0IGFsbG93ZWRFeGlzdGluZyA9IG1heEJ5dGVzIC0gaW5jb21pbmcuYnl0ZUxlbmd0aDtcbiAgICAgIGlmIChzaXplID4gYWxsb3dlZEV4aXN0aW5nKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gcmVhZEZpbGVTeW5jKHBhdGgpO1xuICAgICAgICB3cml0ZUZpbGVTeW5jKHBhdGgsIGV4aXN0aW5nLnN1YmFycmF5KE1hdGgubWF4KDAsIGV4aXN0aW5nLmJ5dGVMZW5ndGggLSBhbGxvd2VkRXhpc3RpbmcpKSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvLyBJZiB0cmltbWluZyBmYWlscywgc3RpbGwgdHJ5IHRvIGFwcGVuZCBiZWxvdzsgbG9nZ2luZyBtdXN0IGJlIGJlc3QtZWZmb3J0LlxuICB9XG5cbiAgYXBwZW5kRmlsZVN5bmMocGF0aCwgaW5jb21pbmcpO1xufVxuIiwgImltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdyB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHR5cGUge1xuICBDb2RleENkcFN0YXR1cyxcbiAgQ29kZXhDZHBUYXJnZXQsXG4gIENvZGV4UnVudGltZUNhcGFiaWxpdGllcyxcbiAgQ29kZXhSdW50aW1lSW5mbyxcbiAgQ29kZXhSdW50aW1lVHlwZSxcbn0gZnJvbSBcIkBjaGF0Z3B0LXBsdXNwbHVzL3Nka1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJ1bnRpbWVQcm9iZU9wdGlvbnMge1xuICB1c2VyUm9vdDogc3RyaW5nO1xuICBydW50aW1lRGlyOiBzdHJpbmc7XG4gIGNvZGV4VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgY2hhbm5lbDogc3RyaW5nIHwgbnVsbDtcbiAgZ2V0V2luZG93U2VydmljZXMoKTogdW5rbm93biB8IG51bGw7XG4gIGdldE5hdGl2ZUNhcGFiaWxpdGllcz8oKTogQ29kZXhSdW50aW1lQ2FwYWJpbGl0aWVzW1wibmF0aXZlXCJdO1xuICBnZXRWaWV3Q2FwYWJpbGl0aWVzPygpOiBDb2RleFJ1bnRpbWVDYXBhYmlsaXRpZXNbXCJ2aWV3c1wiXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFJ1bnRpbWVJbmZvKG9wdHM6IFJ1bnRpbWVQcm9iZU9wdGlvbnMpOiBDb2RleFJ1bnRpbWVJbmZvIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBkZXRlY3RSdW50aW1lVHlwZSgpLFxuICAgIGNvZGV4VmVyc2lvbjogb3B0cy5jb2RleFZlcnNpb24gPz8gc2FmZUFwcFZlcnNpb24oKSxcbiAgICBjaGFubmVsOiBvcHRzLmNoYW5uZWwsXG4gICAgYnVpbGRGbGF2b3I6IHNhZmVCdWlsZEZsYXZvcigpLFxuICAgIHVzZXNPd2xBcHBTaGVsbDogbnVsbCxcbiAgICBhcHBQYXRoOiBzYWZlQXBwUGF0aCgpLFxuICAgIHJlc291cmNlc1BhdGg6IHByb2Nlc3MucmVzb3VyY2VzUGF0aCA/PyBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UnVudGltZUNhcGFiaWxpdGllcyhvcHRzOiBSdW50aW1lUHJvYmVPcHRpb25zKTogQ29kZXhSdW50aW1lQ2FwYWJpbGl0aWVzIHtcbiAgY29uc3Qgc2VydmljZXMgPSBhc1JlY29yZChvcHRzLmdldFdpbmRvd1NlcnZpY2VzKCkpO1xuICBjb25zdCB3aW5kb3dNYW5hZ2VyID0gYXNSZWNvcmQoc2VydmljZXM/LndpbmRvd01hbmFnZXIpO1xuICBjb25zdCBjZHAgPSBnZXRDZHBTdGF0dXMoKTtcbiAgY29uc3QgbmF0aXZlID0gb3B0cy5nZXROYXRpdmVDYXBhYmlsaXRpZXM/LigpID8/IGRlZmF1bHROYXRpdmVDYXBhYmlsaXRpZXMoKTtcbiAgY29uc3Qgdmlld3MgPSBvcHRzLmdldFZpZXdDYXBhYmlsaXRpZXM/LigpID8/IGRlZmF1bHRWaWV3Q2FwYWJpbGl0aWVzKCk7XG4gIGNvbnN0IGNhbkNyZWF0ZVdpbmRvdyA9IHR5cGVvZiB3aW5kb3dNYW5hZ2VyPy5jcmVhdGVXaW5kb3cgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgIHR5cGVvZiBzZXJ2aWNlcz8uY3JlYXRlRnJlc2hXaW5kb3cgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgIHR5cGVvZiBzZXJ2aWNlcz8uY3JlYXRlRnJlc2hMb2NhbFdpbmRvdyA9PT0gXCJmdW5jdGlvblwiIHx8XG4gICAgdHlwZW9mIHNlcnZpY2VzPy5lbnN1cmVIb3N0V2luZG93ID09PSBcImZ1bmN0aW9uXCI7XG4gIHJldHVybiB7XG4gICAgd2luZG93czoge1xuICAgICAgY3JlYXRlOiBjYW5DcmVhdGVXaW5kb3csXG4gICAgICBmb2N1czogdHJ1ZSxcbiAgICAgIHByaW1hcnk6IHR5cGVvZiBzZXJ2aWNlcz8uZ2V0UHJpbWFyeVdpbmRvdyA9PT0gXCJmdW5jdGlvblwiIHx8XG4gICAgICAgIHR5cGVvZiB3aW5kb3dNYW5hZ2VyPy5nZXRQcmltYXJ5V2luZG93ID09PSBcImZ1bmN0aW9uXCIsXG4gICAgICBicm93c2VyVmlldzogdHlwZW9mIHdpbmRvd01hbmFnZXI/LnJlZ2lzdGVyV2luZG93ID09PSBcImZ1bmN0aW9uXCIsXG4gICAgfSxcbiAgICB2aWV3cyxcbiAgICBjZHA6IHtcbiAgICAgIHN1cHBvcnRlZDogdHJ1ZSxcbiAgICAgIGVuYWJsZWQ6IGNkcC5lbmFibGVkLFxuICAgICAgcG9ydDogY2RwLnBvcnQsXG4gICAgfSxcbiAgICBuYXRpdmUsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDZHBTdGF0dXMoKTogQ29kZXhDZHBTdGF0dXMge1xuICBjb25zdCBlbmFibGVkID0gcHJvY2Vzcy5lbnYuQ09ERVhQUF9SRU1PVEVfREVCVUcgPT09IFwiMVwiO1xuICBjb25zdCBwb3J0ID0gcGFyc2VDZHBQb3J0KHByb2Nlc3MuZW52LkNPREVYUFBfUkVNT1RFX0RFQlVHX1BPUlQpO1xuICByZXR1cm4ge1xuICAgIHN1cHBvcnRlZDogdHJ1ZSxcbiAgICBlbmFibGVkLFxuICAgIHBvcnQ6IGVuYWJsZWQgPyBwb3J0IDogbnVsbCxcbiAgICB1cmw6IGVuYWJsZWQgPyBgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9YCA6IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0Q2RwVGFyZ2V0cygpOiBQcm9taXNlPENvZGV4Q2RwVGFyZ2V0W10+IHtcbiAgY29uc3Qgc3RhdHVzID0gZ2V0Q2RwU3RhdHVzKCk7XG4gIGlmICghc3RhdHVzLmVuYWJsZWQgfHwgIXN0YXR1cy51cmwpIHJldHVybiBbXTtcbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMDAwKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtzdGF0dXMudXJsfS9qc29uYCwgeyBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgIGlmICghcmVzLm9rKSByZXR1cm4gW107XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHJlcy5qc29uKCkgYXMgdW5rbm93bjtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocm93cykpIHJldHVybiBbXTtcbiAgICByZXR1cm4gcm93c1xuICAgICAgLm1hcCgocm93KSA9PiBub3JtYWxpemVDZHBUYXJnZXQocm93KSlcbiAgICAgIC5maWx0ZXIoKHJvdyk6IHJvdyBpcyBDb2RleENkcFRhcmdldCA9PiByb3cgIT09IG51bGwpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRldGVjdFJ1bnRpbWVUeXBlKCk6IENvZGV4UnVudGltZVR5cGUge1xuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIikge1xuICAgIGNvbnN0IGFwcFJvb3QgPSBpbmZlck1hY0FwcFJvb3QoKTtcbiAgICBpZiAoYXBwUm9vdCAmJiBleGlzdHNTeW5jKGpvaW4oYXBwUm9vdCwgXCJDb250ZW50c1wiLCBcIkZyYW1ld29ya3NcIiwgXCJDb2RleCBGcmFtZXdvcmsuZnJhbWV3b3JrXCIpKSkge1xuICAgICAgcmV0dXJuIFwib3dsXCI7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGFwcFJvb3QgJiZcbiAgICAgIGV4aXN0c1N5bmMoam9pbihhcHBSb290LCBcIkNvbnRlbnRzXCIsIFwiRnJhbWV3b3Jrc1wiLCBcIkVsZWN0cm9uIEZyYW1ld29yay5mcmFtZXdvcmtcIikpXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJlbGVjdHJvblwiO1xuICAgIH1cbiAgICBpZiAocHJvY2Vzcy5yZXNvdXJjZXNQYXRoICYmIGV4aXN0c1N5bmMoam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsIFwiYXBwLmFzYXJcIikpKSB7XG4gICAgICByZXR1cm4gXCJlbGVjdHJvblwiO1xuICAgIH1cbiAgICByZXR1cm4gXCJ1bmtub3duXCI7XG4gIH1cbiAgcmV0dXJuIHByb2Nlc3MucmVzb3VyY2VzUGF0aCAmJiBleGlzdHNTeW5jKGpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCBcImFwcC5hc2FyXCIpKVxuICAgID8gXCJlbGVjdHJvblwiXG4gICAgOiBcInVua25vd25cIjtcbn1cblxuZnVuY3Rpb24gaW5mZXJNYWNBcHBSb290KCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBtYXJrZXIgPSBcIi5hcHAvQ29udGVudHMvTWFjT1MvXCI7XG4gIGNvbnN0IGlkeCA9IHByb2Nlc3MuZXhlY1BhdGguaW5kZXhPZihtYXJrZXIpO1xuICByZXR1cm4gaWR4ID49IDAgPyBwcm9jZXNzLmV4ZWNQYXRoLnNsaWNlKDAsIGlkeCArIFwiLmFwcFwiLmxlbmd0aCkgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBzYWZlQXBwVmVyc2lvbigpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXBwLmdldFZlcnNpb24oKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2FmZUFwcFBhdGgoKTogc3RyaW5nIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGFwcC5nZXRBcHBQYXRoKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBwcm9jZXNzLnJlc291cmNlc1BhdGggPyBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgXCJhcHAuYXNhclwiKSA6IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2FmZUJ1aWxkRmxhdm9yKCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBhcHBQYXRoID0gc2FmZUFwcFBhdGgoKTtcbiAgaWYgKCFhcHBQYXRoKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFyZW50ID0gZGlybmFtZShhcHBQYXRoKTtcbiAgaWYgKHBhcmVudC5pbmNsdWRlcyhcIk5pZ2h0bHlcIikpIHJldHVybiBcIm5pZ2h0bHlcIjtcbiAgcmV0dXJuIGFwcC5pc1BhY2thZ2VkID8gXCJwcm9kXCIgOiBcImRldlwiO1xufVxuXG5mdW5jdGlvbiBwYXJzZUNkcFBvcnQodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gIGNvbnN0IHBhcnNlZCA9IE51bWJlcih2YWx1ZSA/PyBcIjkyMjJcIik7XG4gIHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKHBhcnNlZCkgJiYgcGFyc2VkID4gMCAmJiBwYXJzZWQgPCA2NTUzNiA/IHBhcnNlZCA6IDkyMjI7XG59XG5cbmZ1bmN0aW9uIGhhc05hdGl2ZVdpbmRvd0hhbmRsZXMoKTogYm9vbGVhbiB7XG4gIGNvbnN0IGZvY3VzZWQgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgaWYgKGZvY3VzZWQgJiYgdHlwZW9mIGZvY3VzZWQuZ2V0TmF0aXZlV2luZG93SGFuZGxlID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB0cnVlO1xuICByZXR1cm4gdHlwZW9mIEJyb3dzZXJXaW5kb3cuZnJvbUlkID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHROYXRpdmVDYXBhYmlsaXRpZXMoKTogQ29kZXhSdW50aW1lQ2FwYWJpbGl0aWVzW1wibmF0aXZlXCJdIHtcbiAgcmV0dXJuIHtcbiAgICBpblByb2Nlc3NNb2R1bGVzOiB0cnVlLFxuICAgIHN3aWZ0TW9kdWxlczogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIixcbiAgICBhcHBLaXRFbWJlZGRpbmc6IGZhbHNlLFxuICAgIGNoaWxkV2luZG93T3ZlcmxheTogZmFsc2UsXG4gICAgZGlyZWN0Vmlld0F0dGFjaDogZmFsc2UsXG4gICAgbWV0YWxWaWV3czogZmFsc2UsXG4gICAgbmF0aXZlSG9zdDogZmFsc2UsXG4gICAgaGVscGVyczogdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZGVmYXVsdFZpZXdDYXBhYmlsaXRpZXMoKTogQ29kZXhSdW50aW1lQ2FwYWJpbGl0aWVzW1widmlld3NcIl0ge1xuICByZXR1cm4ge1xuICAgIGNyZWF0ZTogZmFsc2UsXG4gICAgcHJpdmF0ZVZpZXdUcmVlOiBmYWxzZSxcbiAgICB3ZWJDb250ZW50c1ZpZXc6IGZhbHNlLFxuICAgIGJyb3dzZXJWaWV3RmFsbGJhY2s6IHR5cGVvZiBCcm93c2VyV2luZG93LmZyb21JZCA9PT0gXCJmdW5jdGlvblwiLFxuICB9O1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDZHBUYXJnZXQocm93OiB1bmtub3duKTogQ29kZXhDZHBUYXJnZXQgfCBudWxsIHtcbiAgY29uc3QgdmFsdWUgPSBhc1JlY29yZChyb3cpO1xuICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZS5pZCAhPT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdmFsdWUudHlwZSAhPT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdmFsdWUudXJsICE9PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBpZDogdmFsdWUuaWQsXG4gICAgdHlwZTogdmFsdWUudHlwZSxcbiAgICB1cmw6IHZhbHVlLnVybCxcbiAgICAuLi4odHlwZW9mIHZhbHVlLnRpdGxlID09PSBcInN0cmluZ1wiID8geyB0aXRsZTogdmFsdWUudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4odHlwZW9mIHZhbHVlLndlYlNvY2tldERlYnVnZ2VyVXJsID09PSBcInN0cmluZ1wiXG4gICAgICA/IHsgd2ViU29ja2V0RGVidWdnZXJVcmw6IHZhbHVlLndlYlNvY2tldERlYnVnZ2VyVXJsIH1cbiAgICAgIDoge30pLFxuICB9O1xufVxuXG5mdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCB7XG4gIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgPyB2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA6IG51bGw7XG59XG4iLCAiaW1wb3J0IHsgQnJvd3NlcldpbmRvdyB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgc3Bhd24sIHR5cGUgQ2hpbGRQcm9jZXNzV2l0aG91dE51bGxTdHJlYW1zIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBjcmVhdGVJbnRlcmZhY2UgfSBmcm9tIFwibm9kZTpyZWFkbGluZVwiO1xuaW1wb3J0IHsgcmVzb2x2ZU5hdGl2ZVR3ZWFrUGF0aCB9IGZyb20gXCIuL25hdGl2ZS1wYXRoc1wiO1xuaW1wb3J0IHR5cGUge1xuICBDb2RleFJ1bnRpbWVDYXBhYmlsaXRpZXMsXG4gIE5hdGl2ZUhlbHBlckxhdW5jaE9wdGlvbnMsXG4gIE5hdGl2ZUhlbHBlclJlZixcbiAgTmF0aXZlTW9kdWxlS2luZCxcbiAgTmF0aXZlTW9kdWxlTG9hZE9wdGlvbnMsXG4gIE5hdGl2ZU1vZHVsZVJlZixcbiAgTmF0aXZlUGFuZWxDcmVhdGVPcHRpb25zLFxuICBOYXRpdmVQYW5lbFJlZixcbiAgTmF0aXZlVmlld0F0dGFjaE9wdGlvbnMsXG4gIE5hdGl2ZVZpZXdSZWYsXG59IGZyb20gXCJAY2hhdGdwdC1wbHVzcGx1cy9zZGtcIjtcblxuZXhwb3J0IGludGVyZmFjZSBOYXRpdmVUd2Vha0NvbnRleHQge1xuICBpZDogc3RyaW5nO1xuICBkaXI6IHN0cmluZztcbn1cblxudHlwZSBOYXRpdmVMb2cgPSAobGV2ZWw6IFwiaW5mb1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCIsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZDtcblxuZXhwb3J0IGludGVyZmFjZSBOYXRpdmVCcmlkZ2VPcHRpb25zIHtcbiAgbmF0aXZlSG9zdFBhdGg/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBMb2FkZWROYXRpdmVNb2R1bGUge1xuICBrZXk6IHN0cmluZztcbiAgdHdlYWtJZDogc3RyaW5nO1xuICBpZDogc3RyaW5nO1xuICBraW5kOiBOYXRpdmVNb2R1bGVLaW5kO1xuICBwYXRoOiBzdHJpbmc7XG4gIGV4cG9ydHM6IHVua25vd247XG59XG5cbmludGVyZmFjZSBOYXRpdmVJbnN0YW5jZSB7XG4gIGtleTogc3RyaW5nO1xuICB0d2Vha0lkOiBzdHJpbmc7XG4gIGlkOiBzdHJpbmc7XG4gIGtpbmQ6IFwicGFuZWxcIiB8IFwidmlld1wiO1xuICB2YWx1ZTogdW5rbm93bjtcbiAgcGFyZW50V2luZG93SWQ6IG51bWJlciB8IG51bGw7XG4gIHdpbmRvd0lkOiBudW1iZXIgfCBudWxsO1xuICBkaXNwb3NlQmluZGluZ3M6IEFycmF5PCgpID0+IHZvaWQ+O1xuICBkaXNwb3Npbmc6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBIZWxwZXJSZXF1ZXN0IHtcbiAgcmVzb2x2ZSh2YWx1ZTogdW5rbm93bik6IHZvaWQ7XG4gIHJlamVjdChlcnJvcjogRXJyb3IpOiB2b2lkO1xuICB0aW1lcjogTm9kZUpTLlRpbWVvdXQ7XG59XG5cbmludGVyZmFjZSBOYXRpdmVIZWxwZXJQcm9jZXNzIHtcbiAga2V5OiBzdHJpbmc7XG4gIHR3ZWFrSWQ6IHN0cmluZztcbiAgaWQ6IHN0cmluZztcbiAgY2hpbGQ6IENoaWxkUHJvY2Vzc1dpdGhvdXROdWxsU3RyZWFtcztcbiAgcGVuZGluZzogTWFwPHN0cmluZywgSGVscGVyUmVxdWVzdD47XG59XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVCcmlkZ2Uge1xuICBwcml2YXRlIG1vZHVsZXMgPSBuZXcgTWFwPHN0cmluZywgTG9hZGVkTmF0aXZlTW9kdWxlPigpO1xuICBwcml2YXRlIGluc3RhbmNlcyA9IG5ldyBNYXA8c3RyaW5nLCBOYXRpdmVJbnN0YW5jZT4oKTtcbiAgcHJpdmF0ZSBoZWxwZXJzID0gbmV3IE1hcDxzdHJpbmcsIE5hdGl2ZUhlbHBlclByb2Nlc3M+KCk7XG4gIHByaXZhdGUgbmF0aXZlSG9zdEV4cG9ydHM6IHVua25vd24gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYXRpdmVIb3N0TG9hZEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbG9nOiBOYXRpdmVMb2csXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBOYXRpdmVCcmlkZ2VPcHRpb25zID0ge30sXG4gICkge31cblxuICBnZXRDYXBhYmlsaXRpZXMoKTogQ29kZXhSdW50aW1lQ2FwYWJpbGl0aWVzW1wibmF0aXZlXCJdIHtcbiAgICBjb25zdCBob3N0ID0gdGhpcy5sb2FkTmF0aXZlSG9zdChmYWxzZSk7XG4gICAgY29uc3QgaG9zdENhcGFiaWxpdGllcyA9IGhvc3QgPyB0aGlzLnJlYWROYXRpdmVIb3N0Q2FwYWJpbGl0aWVzKGhvc3QpIDoge307XG4gICAgY29uc3QgbmF0aXZlSG9zdCA9IGhvc3QgIT09IG51bGw7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluUHJvY2Vzc01vZHVsZXM6IHRydWUsXG4gICAgICBzd2lmdE1vZHVsZXM6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIsXG4gICAgICBhcHBLaXRFbWJlZGRpbmc6IEJvb2xlYW4oaG9zdENhcGFiaWxpdGllcy5hcHBLaXRFbWJlZGRpbmcpLFxuICAgICAgY2hpbGRXaW5kb3dPdmVybGF5OiBCb29sZWFuKGhvc3RDYXBhYmlsaXRpZXMuY2hpbGRXaW5kb3dPdmVybGF5KSxcbiAgICAgIGRpcmVjdFZpZXdBdHRhY2g6IEJvb2xlYW4oaG9zdENhcGFiaWxpdGllcy5kaXJlY3RWaWV3QXR0YWNoKSxcbiAgICAgIG1ldGFsVmlld3M6IEJvb2xlYW4oaG9zdENhcGFiaWxpdGllcy5tZXRhbFZpZXdzKSxcbiAgICAgIG5hdGl2ZUhvc3QsXG4gICAgICBoZWxwZXJzOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBsb2FkTW9kdWxlKGN0eDogTmF0aXZlVHdlYWtDb250ZXh0LCBvcHRpb25zOiBOYXRpdmVNb2R1bGVMb2FkT3B0aW9ucyk6IE5hdGl2ZU1vZHVsZVJlZiB7XG4gICAgY29uc3QgaWQgPSBhc3NlcnRCcmlkZ2VJZChvcHRpb25zLmlkLCBcIm5hdGl2ZSBtb2R1bGUgaWRcIik7XG4gICAgY29uc3QgZnVsbFBhdGggPSByZXNvbHZlVHdlYWtQYXRoKGN0eCwgb3B0aW9ucy5wYXRoKTtcbiAgICBjb25zdCBraW5kID0gb3B0aW9ucy5raW5kID8/IGluZmVyTW9kdWxlS2luZChmdWxsUGF0aCk7XG5cbiAgICBpZiAoa2luZCAhPT0gXCJub2RlLWFkZG9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYCR7a2luZH0gbmF0aXZlIG1vZHVsZXMgbXVzdCBiZSBsb2FkZWQgdGhyb3VnaCBhIC5ub2RlIE9iamVjdGl2ZS1DKysgc2hpbSBpbiBDaGF0R1BUKysgMS4wLjBgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIWZ1bGxQYXRoLmVuZHNXaXRoKFwiLm5vZGVcIikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vZGUtYWRkb24gbmF0aXZlIG1vZHVsZXMgbXVzdCB1c2UgYSAubm9kZSBmaWxlXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGxvYWRlZCA9IHJlcXVpcmUoZnVsbFBhdGgpIGFzIHVua25vd247XG4gICAgY29uc3QgZXhwb3J0cyA9IHNlbGVjdEVudHJ5cG9pbnQobG9hZGVkLCBvcHRpb25zLmVudHJ5cG9pbnQpO1xuICAgIGNvbnN0IGtleSA9IG1vZHVsZUtleShjdHguaWQsIGlkKTtcbiAgICB0aGlzLm1vZHVsZXMuc2V0KGtleSwgeyBrZXksIHR3ZWFrSWQ6IGN0eC5pZCwgaWQsIGtpbmQsIHBhdGg6IGZ1bGxQYXRoLCBleHBvcnRzIH0pO1xuICAgIHRoaXMubG9nKFwiaW5mb1wiLCBgbG9hZGVkIG5hdGl2ZSBtb2R1bGUgJHtjdHguaWR9OiR7aWR9YCwgeyBraW5kLCBwYXRoOiBmdWxsUGF0aCB9KTtcbiAgICByZXR1cm4gdGhpcy5tb2R1bGVSZWYoY3R4LmlkLCBpZCwga2luZCk7XG4gIH1cblxuICBhc3luYyBjcmVhdGVQYW5lbChjdHg6IE5hdGl2ZVR3ZWFrQ29udGV4dCwgb3B0aW9uczogTmF0aXZlUGFuZWxDcmVhdGVPcHRpb25zKTogUHJvbWlzZTxOYXRpdmVQYW5lbFJlZj4ge1xuICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCB0aGlzLmNyZWF0ZU5hdGl2ZUluc3RhbmNlKGN0eCwgXCJwYW5lbFwiLCBvcHRpb25zLm1vZHVsZUlkLCBvcHRpb25zLmZhY3RvcnkgPz8gXCJjcmVhdGVQYW5lbFwiLCB7XG4gICAgICBwYXJlbnRXaW5kb3dJZDogb3B0aW9ucy5wYXJlbnRXaW5kb3dJZCxcbiAgICAgIGJvdW5kczogb3B0aW9ucy5ib3VuZHMsXG4gICAgICB0cmFuc3BhcmVudDogb3B0aW9ucy50cmFuc3BhcmVudCA9PT0gdHJ1ZSxcbiAgICAgIHBhc3N0aHJvdWdoTW91c2U6IG9wdGlvbnMucGFzc3Rocm91Z2hNb3VzZSA9PT0gdHJ1ZSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5wYW5lbFJlZihjcmVhdGVkKTtcbiAgfVxuXG4gIGFzeW5jIGF0dGFjaFZpZXcoY3R4OiBOYXRpdmVUd2Vha0NvbnRleHQsIG9wdGlvbnM6IE5hdGl2ZVZpZXdBdHRhY2hPcHRpb25zKTogUHJvbWlzZTxOYXRpdmVWaWV3UmVmPiB7XG4gICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHRoaXMuY3JlYXRlTmF0aXZlSW5zdGFuY2UoY3R4LCBcInZpZXdcIiwgb3B0aW9ucy5tb2R1bGVJZCwgb3B0aW9ucy5mYWN0b3J5ID8/IFwiYXR0YWNoVmlld1wiLCB7XG4gICAgICBwYXJlbnRXaW5kb3dJZDogb3B0aW9ucy5wYXJlbnRXaW5kb3dJZCxcbiAgICAgIGJvdW5kczogb3B0aW9ucy5ib3VuZHMsXG4gICAgICB6SW5kZXg6IG9wdGlvbnMuekluZGV4LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnZpZXdSZWYoY3JlYXRlZCk7XG4gIH1cblxuICBsYXVuY2hIZWxwZXIoY3R4OiBOYXRpdmVUd2Vha0NvbnRleHQsIG9wdGlvbnM6IE5hdGl2ZUhlbHBlckxhdW5jaE9wdGlvbnMpOiBOYXRpdmVIZWxwZXJSZWYge1xuICAgIGNvbnN0IGlkID0gYXNzZXJ0QnJpZGdlSWQob3B0aW9ucy5pZCwgXCJuYXRpdmUgaGVscGVyIGlkXCIpO1xuICAgIGlmICgob3B0aW9ucy50cmFuc3BvcnQgPz8gXCJzdGRpb1wiKSAhPT0gXCJzdGRpb1wiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJuYXRpdmUgaGVscGVycyBzdXBwb3J0IG9ubHkgc3RkaW8gdHJhbnNwb3J0IGluIENoYXRHUFQrKyAxLjAuMFwiKTtcbiAgICB9XG4gICAgaWYgKChvcHRpb25zLnJlc3RhcnQgPz8gXCJuZXZlclwiKSAhPT0gXCJuZXZlclwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJuYXRpdmUgaGVscGVyIHJlc3RhcnQgcG9saWNpZXMgYXJlIG5vdCBhdmFpbGFibGUgaW4gQ2hhdEdQVCsrIDEuMC4wXCIpO1xuICAgIH1cbiAgICBjb25zdCBleGVjdXRhYmxlID0gcmVzb2x2ZVR3ZWFrUGF0aChjdHgsIG9wdGlvbnMuZXhlY3V0YWJsZSk7XG4gICAgY29uc3QgYXJncyA9IG9wdGlvbnMuYXJncyA/PyBbXTtcbiAgICBjb25zdCBlbnYgPSB7IC4uLnByb2Nlc3MuZW52LCAuLi4ob3B0aW9ucy5lbnYgPz8ge30pIH07XG4gICAgY29uc3QgY2hpbGQgPSBzcGF3bihleGVjdXRhYmxlLCBhcmdzLCB7XG4gICAgICBjd2Q6IGN0eC5kaXIsXG4gICAgICBlbnYsXG4gICAgICBzdGRpbzogW1wicGlwZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICAgIH0pO1xuICAgIGNvbnN0IGtleSA9IGhlbHBlcktleShjdHguaWQsIGlkKTtcbiAgICBjb25zdCBoZWxwZXI6IE5hdGl2ZUhlbHBlclByb2Nlc3MgPSB7XG4gICAgICBrZXksXG4gICAgICB0d2Vha0lkOiBjdHguaWQsXG4gICAgICBpZCxcbiAgICAgIGNoaWxkLFxuICAgICAgcGVuZGluZzogbmV3IE1hcCgpLFxuICAgIH07XG4gICAgdGhpcy5oZWxwZXJzLnNldChrZXksIGhlbHBlcik7XG5cbiAgICBjb25zdCBzdGRvdXQgPSBjcmVhdGVJbnRlcmZhY2UoeyBpbnB1dDogY2hpbGQuc3Rkb3V0IH0pO1xuICAgIHN0ZG91dC5vbihcImxpbmVcIiwgKGxpbmUpID0+IHRoaXMuaGFuZGxlSGVscGVyTGluZShoZWxwZXIsIGxpbmUpKTtcbiAgICBjaGlsZC5zdGRlcnIub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xuICAgICAgdGhpcy5sb2coXCJ3YXJuXCIsIGBuYXRpdmUgaGVscGVyICR7Y3R4LmlkfToke2lkfSBzdGRlcnJgLCBTdHJpbmcoY2h1bmspKTtcbiAgICB9KTtcbiAgICBjaGlsZC5vbihcImV4aXRcIiwgKGNvZGUsIHNpZ25hbCkgPT4ge1xuICAgICAgdGhpcy5sb2coXCJpbmZvXCIsIGBuYXRpdmUgaGVscGVyICR7Y3R4LmlkfToke2lkfSBleGl0ZWRgLCB7IGNvZGUsIHNpZ25hbCB9KTtcbiAgICAgIHRoaXMuaGVscGVycy5kZWxldGUoa2V5KTtcbiAgICAgIGZvciAoY29uc3QgcmVxdWVzdCBvZiBoZWxwZXIucGVuZGluZy52YWx1ZXMoKSkge1xuICAgICAgICBjbGVhclRpbWVvdXQocmVxdWVzdC50aW1lcik7XG4gICAgICAgIHJlcXVlc3QucmVqZWN0KG5ldyBFcnJvcihgbmF0aXZlIGhlbHBlciBleGl0ZWQgYmVmb3JlIHJlc3BvbnNlYCkpO1xuICAgICAgfVxuICAgICAgaGVscGVyLnBlbmRpbmcuY2xlYXIoKTtcbiAgICB9KTtcbiAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgICAgdGhpcy5sb2coXCJlcnJvclwiLCBgbmF0aXZlIGhlbHBlciAke2N0eC5pZH06JHtpZH0gZmFpbGVkYCwgZXJyb3IpO1xuICAgICAgdGhpcy5oZWxwZXJzLmRlbGV0ZShrZXkpO1xuICAgICAgZm9yIChjb25zdCByZXF1ZXN0IG9mIGhlbHBlci5wZW5kaW5nLnZhbHVlcygpKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChyZXF1ZXN0LnRpbWVyKTtcbiAgICAgICAgcmVxdWVzdC5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgICAgaGVscGVyLnBlbmRpbmcuY2xlYXIoKTtcbiAgICB9KTtcblxuICAgIHRoaXMubG9nKFwiaW5mb1wiLCBgbGF1bmNoZWQgbmF0aXZlIGhlbHBlciAke2N0eC5pZH06JHtpZH1gLCB7IHBpZDogY2hpbGQucGlkLCBleGVjdXRhYmxlIH0pO1xuICAgIHJldHVybiB0aGlzLmhlbHBlclJlZihjdHguaWQsIGlkLCBjaGlsZC5waWQgPz8gLTEpO1xuICB9XG5cbiAgZGlzcG9zZVR3ZWFrKHR3ZWFrSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgW2tleSwgaW5zdGFuY2VdIG9mIFsuLi50aGlzLmluc3RhbmNlc10pIHtcbiAgICAgIGlmIChpbnN0YW5jZS50d2Vha0lkICE9PSB0d2Vha0lkKSBjb250aW51ZTtcbiAgICAgIHZvaWQgdGhpcy5kaXNwb3NlSW5zdGFuY2UoaW5zdGFuY2UpLmZpbmFsbHkoKCkgPT4gdGhpcy5pbnN0YW5jZXMuZGVsZXRlKGtleSkpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFtrZXksIGhlbHBlcl0gb2YgWy4uLnRoaXMuaGVscGVyc10pIHtcbiAgICAgIGlmIChoZWxwZXIudHdlYWtJZCAhPT0gdHdlYWtJZCkgY29udGludWU7XG4gICAgICB0aGlzLnN0b3BIZWxwZXIoaGVscGVyKTtcbiAgICAgIHRoaXMuaGVscGVycy5kZWxldGUoa2V5KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBba2V5LCBtb2RdIG9mIFsuLi50aGlzLm1vZHVsZXNdKSB7XG4gICAgICBpZiAobW9kLnR3ZWFrSWQgIT09IHR3ZWFrSWQpIGNvbnRpbnVlO1xuICAgICAgdm9pZCBjYWxsT3B0aW9uYWwobW9kLmV4cG9ydHMsIFwiZGlzcG9zZVwiLCBbXSk7XG4gICAgICB0aGlzLm1vZHVsZXMuZGVsZXRlKGtleSk7XG4gICAgfVxuICB9XG5cbiAgZGlzcG9zZUFsbCgpOiB2b2lkIHtcbiAgICBjb25zdCB0d2Vha0lkcyA9IG5ldyBTZXQoW1xuICAgICAgLi4uWy4uLnRoaXMubW9kdWxlcy52YWx1ZXMoKV0ubWFwKChpdGVtKSA9PiBpdGVtLnR3ZWFrSWQpLFxuICAgICAgLi4uWy4uLnRoaXMuaW5zdGFuY2VzLnZhbHVlcygpXS5tYXAoKGl0ZW0pID0+IGl0ZW0udHdlYWtJZCksXG4gICAgICAuLi5bLi4udGhpcy5oZWxwZXJzLnZhbHVlcygpXS5tYXAoKGl0ZW0pID0+IGl0ZW0udHdlYWtJZCksXG4gICAgXSk7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0d2Vha0lkcykgdGhpcy5kaXNwb3NlVHdlYWsoaWQpO1xuICB9XG5cbiAgYXN5bmMgY2FsbEluc3RhbmNlKFxuICAgIHR3ZWFrSWQ6IHN0cmluZyxcbiAgICBraW5kOiBcInBhbmVsXCIgfCBcInZpZXdcIixcbiAgICBpZDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZz86IHVua25vd24sXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmIChraW5kID09PSBcInBhbmVsXCIpIHtcbiAgICAgIGlmIChtZXRob2QgPT09IFwic2V0Qm91bmRzXCIpIHJldHVybiB0aGlzLmludm9rZUluc3RhbmNlKHR3ZWFrSWQsIGlkLCBcInNldEJvdW5kc1wiLCBbYXJnXSk7XG4gICAgICBpZiAobWV0aG9kID09PSBcInNob3dcIikgcmV0dXJuIHRoaXMuaW52b2tlSW5zdGFuY2UodHdlYWtJZCwgaWQsIFwic2hvd1wiLCBbXSk7XG4gICAgICBpZiAobWV0aG9kID09PSBcImhpZGVcIikgcmV0dXJuIHRoaXMuaW52b2tlSW5zdGFuY2UodHdlYWtJZCwgaWQsIFwiaGlkZVwiLCBbXSk7XG4gICAgICBpZiAobWV0aG9kID09PSBcImRpc3Bvc2VcIikgcmV0dXJuIHRoaXMuZGlzcG9zZUluc3RhbmNlQnlJZCh0d2Vha0lkLCBpZCk7XG4gICAgfVxuICAgIGlmIChraW5kID09PSBcInZpZXdcIikge1xuICAgICAgaWYgKG1ldGhvZCA9PT0gXCJzZXRCb3VuZHNcIikgcmV0dXJuIHRoaXMuaW52b2tlSW5zdGFuY2UodHdlYWtJZCwgaWQsIFwic2V0Qm91bmRzXCIsIFthcmddKTtcbiAgICAgIGlmIChtZXRob2QgPT09IFwic2V0VmlzaWJsZVwiKSByZXR1cm4gdGhpcy5pbnZva2VJbnN0YW5jZSh0d2Vha0lkLCBpZCwgXCJzZXRWaXNpYmxlXCIsIFthcmddKTtcbiAgICAgIGlmIChtZXRob2QgPT09IFwiZGlzcG9zZVwiKSByZXR1cm4gdGhpcy5kaXNwb3NlSW5zdGFuY2VCeUlkKHR3ZWFrSWQsIGlkKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmtub3duIG5hdGl2ZSAke2tpbmR9IG1ldGhvZDogJHttZXRob2R9YCk7XG4gIH1cblxuICBhc3luYyBjYWxsSGVscGVyKFxuICAgIHR3ZWFrSWQ6IHN0cmluZyxcbiAgICBoZWxwZXJJZDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIHBheWxvYWQ/OiB1bmtub3duLFxuICAgIHRpbWVvdXRNcz86IG51bWJlcixcbiAgKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgaWYgKG1ldGhvZCA9PT0gXCJzZW5kXCIpIHJldHVybiB0aGlzLnNlbmRIZWxwZXIodHdlYWtJZCwgaGVscGVySWQsIHBheWxvYWQpO1xuICAgIGlmIChtZXRob2QgPT09IFwicmVxdWVzdFwiKSByZXR1cm4gdGhpcy5yZXF1ZXN0SGVscGVyKHR3ZWFrSWQsIGhlbHBlcklkLCBwYXlsb2FkLCB0aW1lb3V0TXMpO1xuICAgIGlmIChtZXRob2QgPT09IFwic3RvcFwiKSByZXR1cm4gdGhpcy5zdG9wSGVscGVyQnlJZCh0d2Vha0lkLCBoZWxwZXJJZCk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmtub3duIG5hdGl2ZSBoZWxwZXIgbWV0aG9kOiAke21ldGhvZH1gKTtcbiAgfVxuXG4gIHByaXZhdGUgbW9kdWxlUmVmKHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZywga2luZCA9IHRoaXMubW9kdWxlRm9yKHR3ZWFrSWQsIGlkKS5raW5kKTogTmF0aXZlTW9kdWxlUmVmIHtcbiAgICByZXR1cm4ge1xuICAgICAgaWQsXG4gICAgICBraW5kLFxuICAgICAgcmVxdWVzdDogKG1ldGhvZCwgcGF5bG9hZCwgdGltZW91dE1zKSA9PlxuICAgICAgICB0aGlzLnJlcXVlc3RNb2R1bGUodHdlYWtJZCwgaWQsIG1ldGhvZCwgcGF5bG9hZCwgdGltZW91dE1zKSxcbiAgICAgIGRpc3Bvc2U6ICgpID0+IHRoaXMuZGlzcG9zZU1vZHVsZSh0d2Vha0lkLCBpZCksXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcGFuZWxSZWYoaW5zdGFuY2U6IE5hdGl2ZUluc3RhbmNlKTogTmF0aXZlUGFuZWxSZWYge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogaW5zdGFuY2UuaWQsXG4gICAgICB3aW5kb3dJZDogaW5zdGFuY2Uud2luZG93SWQsXG4gICAgICBzZXRCb3VuZHM6IChib3VuZHMpID0+IHRoaXMuaW52b2tlSW5zdGFuY2UoaW5zdGFuY2UudHdlYWtJZCwgaW5zdGFuY2UuaWQsIFwic2V0Qm91bmRzXCIsIFtib3VuZHNdKSxcbiAgICAgIHNob3c6ICgpID0+IHRoaXMuaW52b2tlSW5zdGFuY2UoaW5zdGFuY2UudHdlYWtJZCwgaW5zdGFuY2UuaWQsIFwic2hvd1wiLCBbXSksXG4gICAgICBoaWRlOiAoKSA9PiB0aGlzLmludm9rZUluc3RhbmNlKGluc3RhbmNlLnR3ZWFrSWQsIGluc3RhbmNlLmlkLCBcImhpZGVcIiwgW10pLFxuICAgICAgZGlzcG9zZTogKCkgPT4gdGhpcy5kaXNwb3NlSW5zdGFuY2VCeUlkKGluc3RhbmNlLnR3ZWFrSWQsIGluc3RhbmNlLmlkKSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSB2aWV3UmVmKGluc3RhbmNlOiBOYXRpdmVJbnN0YW5jZSk6IE5hdGl2ZVZpZXdSZWYge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogaW5zdGFuY2UuaWQsXG4gICAgICBzZXRCb3VuZHM6IChib3VuZHMpID0+IHRoaXMuaW52b2tlSW5zdGFuY2UoaW5zdGFuY2UudHdlYWtJZCwgaW5zdGFuY2UuaWQsIFwic2V0Qm91bmRzXCIsIFtib3VuZHNdKSxcbiAgICAgIHNldFZpc2libGU6ICh2aXNpYmxlKSA9PiB0aGlzLmludm9rZUluc3RhbmNlKGluc3RhbmNlLnR3ZWFrSWQsIGluc3RhbmNlLmlkLCBcInNldFZpc2libGVcIiwgW3Zpc2libGVdKSxcbiAgICAgIGRpc3Bvc2U6ICgpID0+IHRoaXMuZGlzcG9zZUluc3RhbmNlQnlJZChpbnN0YW5jZS50d2Vha0lkLCBpbnN0YW5jZS5pZCksXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgaGVscGVyUmVmKHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZywgcGlkOiBudW1iZXIpOiBOYXRpdmVIZWxwZXJSZWYge1xuICAgIHJldHVybiB7XG4gICAgICBpZCxcbiAgICAgIHBpZCxcbiAgICAgIHNlbmQ6IChtZXNzYWdlKSA9PiB0aGlzLnNlbmRIZWxwZXIodHdlYWtJZCwgaWQsIG1lc3NhZ2UpLFxuICAgICAgcmVxdWVzdDogKG1lc3NhZ2UsIHRpbWVvdXRNcykgPT4gdGhpcy5yZXF1ZXN0SGVscGVyKHR3ZWFrSWQsIGlkLCBtZXNzYWdlLCB0aW1lb3V0TXMpLFxuICAgICAgc3RvcDogKCkgPT4gdGhpcy5zdG9wSGVscGVyQnlJZCh0d2Vha0lkLCBpZCksXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHJlcXVlc3RNb2R1bGUoXG4gICAgdHdlYWtJZDogc3RyaW5nLFxuICAgIGlkOiBzdHJpbmcsXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgcGF5bG9hZD86IHVua25vd24sXG4gICAgX3RpbWVvdXRNcz86IG51bWJlcixcbiAgKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgY29uc3QgbW9kID0gdGhpcy5tb2R1bGVGb3IodHdlYWtJZCwgaWQpO1xuICAgIGNvbnN0IHRhcmdldCA9IGFzUmVjb3JkKG1vZC5leHBvcnRzKTtcbiAgICBjb25zdCBmbiA9IHRhcmdldD8ucmVxdWVzdDtcbiAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldHVybiBhd2FpdCBmbi5jYWxsKG1vZC5leHBvcnRzLCBtZXRob2QsIHBheWxvYWQpO1xuICAgIH1cbiAgICBjb25zdCBtZXRob2RGbiA9IHRhcmdldD8uW21ldGhvZF07XG4gICAgaWYgKHR5cGVvZiBtZXRob2RGbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICByZXR1cm4gYXdhaXQgbWV0aG9kRm4uY2FsbChtb2QuZXhwb3J0cywgcGF5bG9hZCk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgbmF0aXZlIG1vZHVsZSAke3R3ZWFrSWR9OiR7aWR9IGhhcyBubyByZXF1ZXN0KCkgb3IgJHttZXRob2R9KClgKTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2VNb2R1bGUodHdlYWtJZDogc3RyaW5nLCBpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qga2V5ID0gbW9kdWxlS2V5KHR3ZWFrSWQsIGlkKTtcbiAgICBjb25zdCBtb2QgPSB0aGlzLm1vZHVsZXMuZ2V0KGtleSk7XG4gICAgaWYgKCFtb2QpIHJldHVybjtcbiAgICBhd2FpdCBjYWxsT3B0aW9uYWwobW9kLmV4cG9ydHMsIFwiZGlzcG9zZVwiLCBbXSk7XG4gICAgdGhpcy5tb2R1bGVzLmRlbGV0ZShrZXkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVOYXRpdmVJbnN0YW5jZShcbiAgICBjdHg6IE5hdGl2ZVR3ZWFrQ29udGV4dCxcbiAgICBraW5kOiBcInBhbmVsXCIgfCBcInZpZXdcIixcbiAgICBtb2R1bGVJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIGZhY3Rvcnk6IHN0cmluZyxcbiAgICBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgKTogUHJvbWlzZTxOYXRpdmVJbnN0YW5jZT4ge1xuICAgIGNvbnN0IHRhcmdldCA9IG1vZHVsZUlkID8gdGhpcy5tb2R1bGVGb3IoY3R4LmlkLCBtb2R1bGVJZCkuZXhwb3J0cyA6IHRoaXMubG9hZE5hdGl2ZUhvc3QodHJ1ZSk7XG4gICAgY29uc3QgZm4gPSBhc1JlY29yZCh0YXJnZXQpPy5bZmFjdG9yeV07XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBjb25zdCBsYWJlbCA9IG1vZHVsZUlkID8gYG5hdGl2ZSBtb2R1bGUgJHtjdHguaWR9OiR7bW9kdWxlSWR9YCA6IFwiQ2hhdEdQVCsrIG5hdGl2ZSBob3N0XCI7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bGFiZWx9IGhhcyBubyBmYWN0b3J5ICR7ZmFjdG9yeX0oKWApO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmVudFdpbmRvdyA9IHR5cGVvZiBvcHRpb25zLnBhcmVudFdpbmRvd0lkID09PSBcIm51bWJlclwiXG4gICAgICA/IEJyb3dzZXJXaW5kb3cuZnJvbUlkKG9wdGlvbnMucGFyZW50V2luZG93SWQpXG4gICAgICA6IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICAgIGNvbnN0IHBhcmVudE5hdGl2ZUhhbmRsZSA9IG5hdGl2ZUhhbmRsZUZvcldpbmRvdyhwYXJlbnRXaW5kb3cpO1xuICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4uY2FsbCh0YXJnZXQsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBwYXJlbnRXaW5kb3dJZDogd2luZG93SWRGb3IocGFyZW50V2luZG93KSxcbiAgICAgIHBhcmVudFdlYkNvbnRlbnRzSWQ6IHdlYkNvbnRlbnRzSWRGb3IocGFyZW50V2luZG93KSxcbiAgICAgIHBhcmVudE5hdGl2ZUhhbmRsZSxcbiAgICB9KTtcbiAgICBjb25zdCBpZCA9IHR5cGVvZiBhc1JlY29yZCh2YWx1ZSk/LmlkID09PSBcInN0cmluZ1wiID8gU3RyaW5nKGFzUmVjb3JkKHZhbHVlKT8uaWQpIDogcmFuZG9tVVVJRCgpO1xuICAgIGNvbnN0IHdpbmRvd0lkID0gdHlwZW9mIGFzUmVjb3JkKHZhbHVlKT8ud2luZG93SWQgPT09IFwibnVtYmVyXCIgPyBOdW1iZXIoYXNSZWNvcmQodmFsdWUpPy53aW5kb3dJZCkgOiBudWxsO1xuICAgIGNvbnN0IGluc3RhbmNlOiBOYXRpdmVJbnN0YW5jZSA9IHtcbiAgICAgIGtleTogaW5zdGFuY2VLZXkoY3R4LmlkLCBpZCksXG4gICAgICB0d2Vha0lkOiBjdHguaWQsXG4gICAgICBpZCxcbiAgICAgIGtpbmQsXG4gICAgICB2YWx1ZSxcbiAgICAgIHBhcmVudFdpbmRvd0lkOiB3aW5kb3dJZEZvcihwYXJlbnRXaW5kb3cpLFxuICAgICAgd2luZG93SWQsXG4gICAgICBkaXNwb3NlQmluZGluZ3M6IFtdLFxuICAgICAgZGlzcG9zaW5nOiBmYWxzZSxcbiAgICB9O1xuICAgIHRoaXMuaW5zdGFuY2VzLnNldChpbnN0YW5jZS5rZXksIGluc3RhbmNlKTtcbiAgICBpZiAoY2FuQmluZFBhcmVudFdpbmRvdyhwYXJlbnRXaW5kb3cpKSB7XG4gICAgICB0aGlzLmJpbmRJbnN0YW5jZVRvUGFyZW50KGluc3RhbmNlLCBwYXJlbnRXaW5kb3cpO1xuICAgICAgdGhpcy5zeW5jUGFyZW50U3RhdGUoaW5zdGFuY2UsIHBhcmVudFdpbmRvdywgXCJjcmVhdGVkXCIpO1xuICAgIH1cbiAgICB0aGlzLmxvZyhcImluZm9cIiwgYGNyZWF0ZWQgbmF0aXZlICR7a2luZH0gJHtjdHguaWR9OiR7aWR9YCwge1xuICAgICAgbW9kdWxlSWQ6IG1vZHVsZUlkID8/IFwiY29kZXhwcC5uYXRpdmUtaG9zdFwiLFxuICAgICAgZmFjdG9yeSxcbiAgICAgIHdpbmRvd0lkLFxuICAgIH0pO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZE5hdGl2ZUhvc3QocmVxdWlyZWQ6IHRydWUpOiB1bmtub3duO1xuICBwcml2YXRlIGxvYWROYXRpdmVIb3N0KHJlcXVpcmVkOiBmYWxzZSk6IHVua25vd24gfCBudWxsO1xuICBwcml2YXRlIGxvYWROYXRpdmVIb3N0KHJlcXVpcmVkOiBib29sZWFuKTogdW5rbm93biB8IG51bGwge1xuICAgIGlmICh0aGlzLm5hdGl2ZUhvc3RFeHBvcnRzKSByZXR1cm4gdGhpcy5uYXRpdmVIb3N0RXhwb3J0cztcbiAgICBpZiAodGhpcy5uYXRpdmVIb3N0TG9hZEVycm9yICYmICFyZXF1aXJlZCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbmF0aXZlSG9zdFBhdGggPSB0aGlzLm9wdGlvbnMubmF0aXZlSG9zdFBhdGg7XG4gICAgaWYgKCFuYXRpdmVIb3N0UGF0aCB8fCAhZXhpc3RzU3luYyhuYXRpdmVIb3N0UGF0aCkpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiQ2hhdEdQVCsrIG5hdGl2ZSBob3N0IGlzIG5vdCBpbnN0YWxsZWRcIik7XG4gICAgICB0aGlzLm5hdGl2ZUhvc3RMb2FkRXJyb3IgPSBlcnJvcjtcbiAgICAgIGlmIChyZXF1aXJlZCkgdGhyb3cgZXJyb3I7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubmF0aXZlSG9zdEV4cG9ydHMgPSByZXF1aXJlKG5hdGl2ZUhvc3RQYXRoKSBhcyB1bmtub3duO1xuICAgICAgdGhpcy5uYXRpdmVIb3N0TG9hZEVycm9yID0gbnVsbDtcbiAgICAgIHRoaXMubG9nKFwiaW5mb1wiLCBcImxvYWRlZCBDaGF0R1BUKysgbmF0aXZlIGhvc3RcIiwgeyBwYXRoOiBuYXRpdmVIb3N0UGF0aCB9KTtcbiAgICAgIHJldHVybiB0aGlzLm5hdGl2ZUhvc3RFeHBvcnRzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLm5hdGl2ZUhvc3RMb2FkRXJyb3IgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSk7XG4gICAgICB0aGlzLmxvZyhcImVycm9yXCIsIFwiZmFpbGVkIHRvIGxvYWQgQ2hhdEdQVCsrIG5hdGl2ZSBob3N0XCIsIHRoaXMubmF0aXZlSG9zdExvYWRFcnJvcik7XG4gICAgICBpZiAocmVxdWlyZWQpIHRocm93IHRoaXMubmF0aXZlSG9zdExvYWRFcnJvcjtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZE5hdGl2ZUhvc3RDYXBhYmlsaXRpZXMoaG9zdDogdW5rbm93bik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgICBjb25zdCBnZXRDYXBhYmlsaXRpZXMgPSBhc1JlY29yZChob3N0KT8uZ2V0Q2FwYWJpbGl0aWVzO1xuICAgIGlmICh0eXBlb2YgZ2V0Q2FwYWJpbGl0aWVzICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7fTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY2FwYWJpbGl0aWVzID0gZ2V0Q2FwYWJpbGl0aWVzLmNhbGwoaG9zdCk7XG4gICAgICByZXR1cm4gYXNSZWNvcmQoY2FwYWJpbGl0aWVzKSA/PyB7fTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2coXCJ3YXJuXCIsIFwiQ2hhdEdQVCsrIG5hdGl2ZSBob3N0IGNhcGFiaWxpdHkgcHJvYmUgZmFpbGVkXCIsIGVycm9yKTtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGludm9rZUluc3RhbmNlKFxuICAgIHR3ZWFrSWQ6IHN0cmluZyxcbiAgICBpZDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZ3M6IHVua25vd25bXSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLmluc3RhbmNlRm9yKHR3ZWFrSWQsIGlkKTtcbiAgICBjb25zdCBmbiA9IGFzUmVjb3JkKGluc3RhbmNlLnZhbHVlKT8uW21ldGhvZF07XG4gICAgaWYgKHR5cGVvZiBmbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBhd2FpdCBmbi5hcHBseShpbnN0YW5jZS52YWx1ZSwgYXJncyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpbnN0YW5jZS53aW5kb3dJZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5mcm9tSWQoaW5zdGFuY2Uud2luZG93SWQpO1xuICAgICAgaWYgKHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJzZXRCb3VuZHNcIikgd2luLnNldEJvdW5kcyhhcmdzWzBdIGFzIEVsZWN0cm9uLlJlY3RhbmdsZSk7XG4gICAgICAgIGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJzaG93XCIpIHdpbi5zaG93KCk7XG4gICAgICAgIGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJoaWRlXCIpIHdpbi5oaWRlKCk7XG4gICAgICAgIGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJzZXRWaXNpYmxlXCIpIChhcmdzWzBdID8gd2luLnNob3coKSA6IHdpbi5oaWRlKCkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgbmF0aXZlICR7aW5zdGFuY2Uua2luZH0gJHt0d2Vha0lkfToke2lkfSBkb2VzIG5vdCBpbXBsZW1lbnQgJHttZXRob2R9KClgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZGlzcG9zZUluc3RhbmNlQnlJZCh0d2Vha0lkOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBrZXkgPSBpbnN0YW5jZUtleSh0d2Vha0lkLCBpZCk7XG4gICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLmluc3RhbmNlcy5nZXQoa2V5KTtcbiAgICBpZiAoIWluc3RhbmNlKSByZXR1cm47XG4gICAgYXdhaXQgdGhpcy5kaXNwb3NlSW5zdGFuY2UoaW5zdGFuY2UpO1xuICAgIHRoaXMuaW5zdGFuY2VzLmRlbGV0ZShrZXkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBkaXNwb3NlSW5zdGFuY2UoaW5zdGFuY2U6IE5hdGl2ZUluc3RhbmNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKGluc3RhbmNlLmRpc3Bvc2luZykgcmV0dXJuO1xuICAgIGluc3RhbmNlLmRpc3Bvc2luZyA9IHRydWU7XG4gICAgZm9yIChjb25zdCBkaXNwb3NlIG9mIGluc3RhbmNlLmRpc3Bvc2VCaW5kaW5ncy5zcGxpY2UoMCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRpc3Bvc2UoKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgYXdhaXQgY2FsbE9wdGlvbmFsKGluc3RhbmNlLnZhbHVlLCBcImRpc3Bvc2VcIiwgW10pO1xuICAgIGlmIChpbnN0YW5jZS53aW5kb3dJZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5mcm9tSWQoaW5zdGFuY2Uud2luZG93SWQpO1xuICAgICAgaWYgKHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpIHdpbi5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYmluZEluc3RhbmNlVG9QYXJlbnQoaW5zdGFuY2U6IE5hdGl2ZUluc3RhbmNlLCBwYXJlbnRXaW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cpOiB2b2lkIHtcbiAgICBjb25zdCBvbiA9IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgcGFyZW50V2luZG93Lm9uKGV2ZW50IGFzIG5ldmVyLCBsaXN0ZW5lciBhcyBuZXZlcik7XG4gICAgICBpbnN0YW5jZS5kaXNwb3NlQmluZGluZ3MucHVzaCgoKSA9PiBwYXJlbnRXaW5kb3cub2ZmKGV2ZW50IGFzIG5ldmVyLCBsaXN0ZW5lciBhcyBuZXZlcikpO1xuICAgIH07XG4gICAgY29uc3Qgc3luY0JvdW5kcyA9ICgpID0+IHRoaXMuc3luY1BhcmVudFN0YXRlKGluc3RhbmNlLCBwYXJlbnRXaW5kb3csIFwiYm91bmRzXCIpO1xuICAgIGNvbnN0IHN5bmNGb2N1cyA9IChmb2N1c2VkOiBib29sZWFuKSA9PiB0aGlzLnNpZ25hbFBhcmVudFN0YXRlKGluc3RhbmNlLCBwYXJlbnRXaW5kb3csIFwiZm9jdXNcIiwgeyBmb2N1c2VkIH0pO1xuICAgIGNvbnN0IHN5bmNWaXNpYmlsaXR5ID0gKHZpc2libGU6IGJvb2xlYW4pID0+XG4gICAgICB0aGlzLnNpZ25hbFBhcmVudFN0YXRlKGluc3RhbmNlLCBwYXJlbnRXaW5kb3csIFwidmlzaWJpbGl0eVwiLCB7IHZpc2libGUgfSk7XG4gICAgY29uc3QgZGlzcG9zZVdpdGhQYXJlbnQgPSAoKSA9PiB7XG4gICAgICB0aGlzLmxvZyhcImluZm9cIiwgYGRpc3Bvc2luZyBuYXRpdmUgJHtpbnN0YW5jZS5raW5kfSAke2luc3RhbmNlLnR3ZWFrSWR9OiR7aW5zdGFuY2UuaWR9OyBwYXJlbnQgY2xvc2VkYCk7XG4gICAgICB2b2lkIHRoaXMuZGlzcG9zZUluc3RhbmNlQnlJZChpbnN0YW5jZS50d2Vha0lkLCBpbnN0YW5jZS5pZCk7XG4gICAgfTtcblxuICAgIG9uKFwibW92ZVwiLCBzeW5jQm91bmRzKTtcbiAgICBvbihcInJlc2l6ZVwiLCBzeW5jQm91bmRzKTtcbiAgICBvbihcImVudGVyLWZ1bGwtc2NyZWVuXCIsIHN5bmNCb3VuZHMpO1xuICAgIG9uKFwibGVhdmUtZnVsbC1zY3JlZW5cIiwgc3luY0JvdW5kcyk7XG4gICAgb24oXCJtYXhpbWl6ZVwiLCBzeW5jQm91bmRzKTtcbiAgICBvbihcInVubWF4aW1pemVcIiwgc3luY0JvdW5kcyk7XG4gICAgb24oXCJtaW5pbWl6ZVwiLCBzeW5jQm91bmRzKTtcbiAgICBvbihcInJlc3RvcmVcIiwgc3luY0JvdW5kcyk7XG4gICAgb24oXCJzaG93XCIsICgpID0+IHN5bmNWaXNpYmlsaXR5KHRydWUpKTtcbiAgICBvbihcImhpZGVcIiwgKCkgPT4gc3luY1Zpc2liaWxpdHkoZmFsc2UpKTtcbiAgICBvbihcImZvY3VzXCIsICgpID0+IHN5bmNGb2N1cyh0cnVlKSk7XG4gICAgb24oXCJibHVyXCIsICgpID0+IHN5bmNGb2N1cyhmYWxzZSkpO1xuICAgIG9uKFwiY2xvc2VcIiwgZGlzcG9zZVdpdGhQYXJlbnQpO1xuICAgIG9uKFwiY2xvc2VkXCIsIGRpc3Bvc2VXaXRoUGFyZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY1BhcmVudFN0YXRlKFxuICAgIGluc3RhbmNlOiBOYXRpdmVJbnN0YW5jZSxcbiAgICBwYXJlbnRXaW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3csXG4gICAgcmVhc29uOiBzdHJpbmcsXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IHN0YXRlID0gcGFyZW50V2luZG93U3RhdGUocGFyZW50V2luZG93LCByZWFzb24pO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcbiAgICB2b2lkIHRoaXMuY2FsbEZpcnN0T3B0aW9uYWxJbnN0YW5jZShpbnN0YW5jZSwgW1wic3luY1BhcmVudFwiLCBcInBhcmVudENoYW5nZWRcIl0sIFtzdGF0ZV0pXG4gICAgICAudGhlbigoaGFuZGxlZCkgPT4ge1xuICAgICAgICBpZiAoIWhhbmRsZWQpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jYWxsRmlyc3RPcHRpb25hbEluc3RhbmNlKFxuICAgICAgICAgICAgaW5zdGFuY2UsXG4gICAgICAgICAgICBbXCJzZXRQYXJlbnRCb3VuZHNcIiwgXCJwYXJlbnRCb3VuZHNDaGFuZ2VkXCJdLFxuICAgICAgICAgICAgW3N0YXRlLmJvdW5kcywgc3RhdGVdLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHRoaXMubG9nKFwid2FyblwiLCBgbmF0aXZlICR7aW5zdGFuY2Uua2luZH0gcGFyZW50IHN5bmMgZmFpbGVkYCwgZXJyb3IpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2lnbmFsUGFyZW50U3RhdGUoXG4gICAgaW5zdGFuY2U6IE5hdGl2ZUluc3RhbmNlLFxuICAgIHBhcmVudFdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyxcbiAgICByZWFzb246IHN0cmluZyxcbiAgICBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IHN0YXRlID0gcGFyZW50V2luZG93U3RhdGUocGFyZW50V2luZG93LCByZWFzb24pO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcbiAgICBjb25zdCBwYXlsb2FkID0geyAuLi5zdGF0ZSwgLi4ucGF0Y2ggfTtcbiAgICB2b2lkIHRoaXMuY2FsbEZpcnN0T3B0aW9uYWxJbnN0YW5jZShpbnN0YW5jZSwgW1wicGFyZW50U3RhdGVDaGFuZ2VkXCIsIFwicGFyZW50Q2hhbmdlZFwiXSwgW3BheWxvYWRdKVxuICAgICAgLmNhdGNoKChlcnJvcikgPT4gdGhpcy5sb2coXCJ3YXJuXCIsIGBuYXRpdmUgJHtpbnN0YW5jZS5raW5kfSBwYXJlbnQgc2lnbmFsIGZhaWxlZGAsIGVycm9yKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNhbGxGaXJzdE9wdGlvbmFsSW5zdGFuY2UoXG4gICAgaW5zdGFuY2U6IE5hdGl2ZUluc3RhbmNlLFxuICAgIG1ldGhvZHM6IHN0cmluZ1tdLFxuICAgIGFyZ3M6IHVua25vd25bXSxcbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gYXNSZWNvcmQoaW5zdGFuY2UudmFsdWUpO1xuICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIG1ldGhvZHMpIHtcbiAgICAgIGNvbnN0IGZuID0gdGFyZ2V0Py5bbWV0aG9kXTtcbiAgICAgIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgY29udGludWU7XG4gICAgICBhd2FpdCBmbi5hcHBseShpbnN0YW5jZS52YWx1ZSwgYXJncyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzZW5kSGVscGVyKHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZywgbWVzc2FnZTogdW5rbm93bik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGhlbHBlciA9IHRoaXMuaGVscGVyRm9yKHR3ZWFrSWQsIGlkKTtcbiAgICBoZWxwZXIuY2hpbGQuc3RkaW4ud3JpdGUoYCR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSl9XFxuYCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlcXVlc3RIZWxwZXIoXG4gICAgdHdlYWtJZDogc3RyaW5nLFxuICAgIGlkOiBzdHJpbmcsXG4gICAgbWVzc2FnZTogdW5rbm93bixcbiAgICB0aW1lb3V0TXMgPSAxMF8wMDAsXG4gICk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgIGNvbnN0IGhlbHBlciA9IHRoaXMuaGVscGVyRm9yKHR3ZWFrSWQsIGlkKTtcbiAgICBjb25zdCByZXF1ZXN0SWQgPSByYW5kb21VVUlEKCk7XG4gICAgY29uc3QgcGF5bG9hZCA9IHsgaWQ6IHJlcXVlc3RJZCwgbWVzc2FnZSB9O1xuICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBoZWxwZXIucGVuZGluZy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgbmF0aXZlIGhlbHBlciByZXF1ZXN0IHRpbWVkIG91dDogJHt0d2Vha0lkfToke2lkfWApKTtcbiAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICBoZWxwZXIucGVuZGluZy5zZXQocmVxdWVzdElkLCB7IHJlc29sdmUsIHJlamVjdCwgdGltZXIgfSk7XG4gICAgICBoZWxwZXIuY2hpbGQuc3RkaW4ud3JpdGUoYCR7SlNPTi5zdHJpbmdpZnkocGF5bG9hZCl9XFxuYCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHN0b3BIZWxwZXJCeUlkKHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGtleSA9IGhlbHBlcktleSh0d2Vha0lkLCBpZCk7XG4gICAgY29uc3QgaGVscGVyID0gdGhpcy5oZWxwZXJzLmdldChrZXkpO1xuICAgIGlmICghaGVscGVyKSByZXR1cm47XG4gICAgdGhpcy5zdG9wSGVscGVyKGhlbHBlcik7XG4gICAgdGhpcy5oZWxwZXJzLmRlbGV0ZShrZXkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdG9wSGVscGVyKGhlbHBlcjogTmF0aXZlSGVscGVyUHJvY2Vzcyk6IHZvaWQge1xuICAgIGlmIChoZWxwZXIuY2hpbGQua2lsbGVkKSByZXR1cm47XG4gICAgaGVscGVyLmNoaWxkLmtpbGwoKTtcbiAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKCFoZWxwZXIuY2hpbGQua2lsbGVkKSBoZWxwZXIuY2hpbGQua2lsbChcIlNJR0tJTExcIik7XG4gICAgfSwgMTUwMCk7XG4gICAgdGltZXIudW5yZWY/LigpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVIZWxwZXJMaW5lKGhlbHBlcjogTmF0aXZlSGVscGVyUHJvY2VzcywgbGluZTogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IHBheWxvYWQ6IHsgaWQ/OiB1bmtub3duOyByZXN1bHQ/OiB1bmtub3duOyBlcnJvcj86IHVua25vd24gfTtcbiAgICB0cnkge1xuICAgICAgcGF5bG9hZCA9IEpTT04ucGFyc2UobGluZSkgYXMgdHlwZW9mIHBheWxvYWQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLmxvZyhcImluZm9cIiwgYG5hdGl2ZSBoZWxwZXIgJHtoZWxwZXIudHdlYWtJZH06JHtoZWxwZXIuaWR9YCwgbGluZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0eXBlb2YgcGF5bG9hZC5pZCAhPT0gXCJzdHJpbmdcIikgcmV0dXJuO1xuICAgIGNvbnN0IHJlcXVlc3QgPSBoZWxwZXIucGVuZGluZy5nZXQocGF5bG9hZC5pZCk7XG4gICAgaWYgKCFyZXF1ZXN0KSByZXR1cm47XG4gICAgaGVscGVyLnBlbmRpbmcuZGVsZXRlKHBheWxvYWQuaWQpO1xuICAgIGNsZWFyVGltZW91dChyZXF1ZXN0LnRpbWVyKTtcbiAgICBpZiAocGF5bG9hZC5lcnJvcikge1xuICAgICAgcmVxdWVzdC5yZWplY3QobmV3IEVycm9yKFN0cmluZyhwYXlsb2FkLmVycm9yKSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXF1ZXN0LnJlc29sdmUocGF5bG9hZC5yZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgbW9kdWxlRm9yKHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZyk6IExvYWRlZE5hdGl2ZU1vZHVsZSB7XG4gICAgY29uc3QgbW9kID0gdGhpcy5tb2R1bGVzLmdldChtb2R1bGVLZXkodHdlYWtJZCwgaWQpKTtcbiAgICBpZiAoIW1vZCkgdGhyb3cgbmV3IEVycm9yKGBuYXRpdmUgbW9kdWxlIGlzIG5vdCBsb2FkZWQ6ICR7dHdlYWtJZH06JHtpZH1gKTtcbiAgICByZXR1cm4gbW9kO1xuICB9XG5cbiAgcHJpdmF0ZSBpbnN0YW5jZUZvcih0d2Vha0lkOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBOYXRpdmVJbnN0YW5jZSB7XG4gICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLmluc3RhbmNlcy5nZXQoaW5zdGFuY2VLZXkodHdlYWtJZCwgaWQpKTtcbiAgICBpZiAoIWluc3RhbmNlKSB0aHJvdyBuZXcgRXJyb3IoYG5hdGl2ZSBpbnN0YW5jZSBpcyBub3QgbG9hZGVkOiAke3R3ZWFrSWR9OiR7aWR9YCk7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9XG5cbiAgcHJpdmF0ZSBoZWxwZXJGb3IodHdlYWtJZDogc3RyaW5nLCBpZDogc3RyaW5nKTogTmF0aXZlSGVscGVyUHJvY2VzcyB7XG4gICAgY29uc3QgaGVscGVyID0gdGhpcy5oZWxwZXJzLmdldChoZWxwZXJLZXkodHdlYWtJZCwgaWQpKTtcbiAgICBpZiAoIWhlbHBlcikgdGhyb3cgbmV3IEVycm9yKGBuYXRpdmUgaGVscGVyIGlzIG5vdCBydW5uaW5nOiAke3R3ZWFrSWR9OiR7aWR9YCk7XG4gICAgcmV0dXJuIGhlbHBlcjtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXNvbHZlVHdlYWtQYXRoKGN0eDogTmF0aXZlVHdlYWtDb250ZXh0LCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcmVzb2x2ZU5hdGl2ZVR3ZWFrUGF0aChjdHguZGlyLCBwYXRoKTtcbn1cblxuZnVuY3Rpb24gaW5mZXJNb2R1bGVLaW5kKHBhdGg6IHN0cmluZyk6IE5hdGl2ZU1vZHVsZUtpbmQge1xuICBpZiAocGF0aC5lbmRzV2l0aChcIi5ub2RlXCIpKSByZXR1cm4gXCJub2RlLWFkZG9uXCI7XG4gIGlmIChwYXRoLmVuZHNXaXRoKFwiLmR5bGliXCIpKSByZXR1cm4gXCJkeWxpYlwiO1xuICBpZiAocGF0aC5lbmRzV2l0aChcIi5mcmFtZXdvcmtcIikpIHJldHVybiBcImZyYW1ld29ya1wiO1xuICB0aHJvdyBuZXcgRXJyb3IoXCJuYXRpdmUgbW9kdWxlIHBhdGggbXVzdCBlbmQgaW4gLm5vZGUsIC5keWxpYiwgb3IgLmZyYW1ld29ya1wiKTtcbn1cblxuZnVuY3Rpb24gc2VsZWN0RW50cnlwb2ludChsb2FkZWQ6IHVua25vd24sIGVudHJ5cG9pbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHVua25vd24ge1xuICBpZiAoIWVudHJ5cG9pbnQpIHJldHVybiBhc1JlY29yZChsb2FkZWQpPy5kZWZhdWx0ID8/IGxvYWRlZDtcbiAgY29uc3Qgc2VsZWN0ZWQgPSBhc1JlY29yZChsb2FkZWQpPy5bZW50cnlwb2ludF07XG4gIGlmIChzZWxlY3RlZCA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoYG5hdGl2ZSBtb2R1bGUgZW50cnlwb2ludCBub3QgZm91bmQ6ICR7ZW50cnlwb2ludH1gKTtcbiAgcmV0dXJuIHNlbGVjdGVkO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRCcmlkZ2VJZCh2YWx1ZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhL15bYS16QS1aMC05Ll8tXSskLy50ZXN0KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgJHtsYWJlbH0gbWF5IG9ubHkgY29udGFpbiBsZXR0ZXJzLCBudW1iZXJzLCBkb3RzLCB1bmRlcnNjb3JlcywgYW5kIGRhc2hlc2ApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gbW9kdWxlS2V5KHR3ZWFrSWQ6IHN0cmluZywgbW9kdWxlSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHt0d2Vha0lkfToke21vZHVsZUlkfWA7XG59XG5cbmZ1bmN0aW9uIGluc3RhbmNlS2V5KHR3ZWFrSWQ6IHN0cmluZywgaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHt0d2Vha0lkfToke2lkfWA7XG59XG5cbmZ1bmN0aW9uIGhlbHBlcktleSh0d2Vha0lkOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7dHdlYWtJZH06JHtpZH1gO1xufVxuXG5mdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCB7XG4gIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgPyB2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA6IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhbGxPcHRpb25hbCh0YXJnZXQ6IHVua25vd24sIG1ldGhvZDogc3RyaW5nLCBhcmdzOiB1bmtub3duW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZm4gPSBhc1JlY29yZCh0YXJnZXQpPy5bbWV0aG9kXTtcbiAgaWYgKHR5cGVvZiBmbiA9PT0gXCJmdW5jdGlvblwiKSBhd2FpdCBmbi5hcHBseSh0YXJnZXQsIGFyZ3MpO1xufVxuXG5mdW5jdGlvbiBwYXJlbnRXaW5kb3dTdGF0ZShwYXJlbnRXaW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3csIHJlYXNvbjogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsIHtcbiAgaWYgKGlzV2luZG93RGVzdHJveWVkKHBhcmVudFdpbmRvdykpIHJldHVybiBudWxsO1xuICBjb25zdCBib3VuZHMgPSBjYWxsV2luZG93TWV0aG9kPEVsZWN0cm9uLlJlY3RhbmdsZT4ocGFyZW50V2luZG93LCBcImdldEJvdW5kc1wiKTtcbiAgY29uc3QgY29udGVudEJvdW5kcyA9IGNhbGxXaW5kb3dNZXRob2Q8RWxlY3Ryb24uUmVjdGFuZ2xlPihwYXJlbnRXaW5kb3csIFwiZ2V0Q29udGVudEJvdW5kc1wiKTtcbiAgcmV0dXJuIHtcbiAgICByZWFzb24sXG4gICAgd2luZG93SWQ6IHdpbmRvd0lkRm9yKHBhcmVudFdpbmRvdyksXG4gICAgd2ViQ29udGVudHNJZDogd2ViQ29udGVudHNJZEZvcihwYXJlbnRXaW5kb3cpLFxuICAgIGJvdW5kcyxcbiAgICBjb250ZW50Qm91bmRzLFxuICAgIHZpc2libGU6IGNhbGxXaW5kb3dNZXRob2Q8Ym9vbGVhbj4ocGFyZW50V2luZG93LCBcImlzVmlzaWJsZVwiKSA/PyBudWxsLFxuICAgIGZvY3VzZWQ6IGNhbGxXaW5kb3dNZXRob2Q8Ym9vbGVhbj4ocGFyZW50V2luZG93LCBcImlzRm9jdXNlZFwiKSA/PyBudWxsLFxuICAgIG1pbmltaXplZDogY2FsbFdpbmRvd01ldGhvZDxib29sZWFuPihwYXJlbnRXaW5kb3csIFwiaXNNaW5pbWl6ZWRcIikgPz8gbnVsbCxcbiAgICBtYXhpbWl6ZWQ6IGNhbGxXaW5kb3dNZXRob2Q8Ym9vbGVhbj4ocGFyZW50V2luZG93LCBcImlzTWF4aW1pemVkXCIpID8/IG51bGwsXG4gICAgZnVsbHNjcmVlbjogY2FsbFdpbmRvd01ldGhvZDxib29sZWFuPihwYXJlbnRXaW5kb3csIFwiaXNGdWxsU2NyZWVuXCIpID8/IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIG5hdGl2ZUhhbmRsZUZvcldpbmRvdyhwYXJlbnRXaW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsIHwgdW5kZWZpbmVkKTogQnVmZmVyIHwgbnVsbCB7XG4gIGlmICghcGFyZW50V2luZG93IHx8IGlzV2luZG93RGVzdHJveWVkKHBhcmVudFdpbmRvdykpIHJldHVybiBudWxsO1xuICBjb25zdCBmbiA9IGFzUmVjb3JkKHBhcmVudFdpbmRvdyk/LmdldE5hdGl2ZVdpbmRvd0hhbmRsZTtcbiAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBoYW5kbGUgPSBmbi5jYWxsKHBhcmVudFdpbmRvdyk7XG4gICAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihoYW5kbGUpID8gaGFuZGxlIDogbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FuQmluZFBhcmVudFdpbmRvdyhcbiAgcGFyZW50V2luZG93OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCxcbik6IHBhcmVudFdpbmRvdyBpcyBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHtcbiAgaWYgKCFwYXJlbnRXaW5kb3cgfHwgaXNXaW5kb3dEZXN0cm95ZWQocGFyZW50V2luZG93KSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHlwZW9mIGFzUmVjb3JkKHBhcmVudFdpbmRvdyk/Lm9uID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICB0eXBlb2YgYXNSZWNvcmQocGFyZW50V2luZG93KT8ub2ZmID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIGlzV2luZG93RGVzdHJveWVkKHBhcmVudFdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgY29uc3QgZm4gPSBhc1JlY29yZChwYXJlbnRXaW5kb3cpPy5pc0Rlc3Ryb3llZDtcbiAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gZmFsc2U7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEJvb2xlYW4oZm4uY2FsbChwYXJlbnRXaW5kb3cpKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gd2luZG93SWRGb3IocGFyZW50V2luZG93OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCk6IG51bWJlciB8IG51bGwge1xuICBjb25zdCBpZCA9IGFzUmVjb3JkKHBhcmVudFdpbmRvdyk/LmlkO1xuICByZXR1cm4gdHlwZW9mIGlkID09PSBcIm51bWJlclwiID8gaWQgOiBudWxsO1xufVxuXG5mdW5jdGlvbiB3ZWJDb250ZW50c0lkRm9yKHBhcmVudFdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3Qgd2ViQ29udGVudHMgPSBhc1JlY29yZChhc1JlY29yZChwYXJlbnRXaW5kb3cpPy53ZWJDb250ZW50cyk7XG4gIGNvbnN0IGlkID0gd2ViQ29udGVudHM/LmlkO1xuICByZXR1cm4gdHlwZW9mIGlkID09PSBcIm51bWJlclwiID8gaWQgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBjYWxsV2luZG93TWV0aG9kPFQ+KHBhcmVudFdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdywgbWV0aG9kOiBzdHJpbmcpOiBUIHwgbnVsbCB7XG4gIGNvbnN0IGZuID0gYXNSZWNvcmQocGFyZW50V2luZG93KT8uW21ldGhvZF07XG4gIGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuLmNhbGwocGFyZW50V2luZG93KSBhcyBUO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwgImltcG9ydCB7IHJlYWxwYXRoU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBpc0Fic29sdXRlLCByZWxhdGl2ZSwgcmVzb2x2ZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVOYXRpdmVUd2Vha1BhdGgodHdlYWtEaXI6IHN0cmluZywgcGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSBcInN0cmluZ1wiIHx8IHBhdGgudHJpbSgpID09PSBcIlwiKSB0aHJvdyBuZXcgRXJyb3IoXCJuYXRpdmUgcGF0aCBpcyByZXF1aXJlZFwiKTtcbiAgY29uc3Qgcm9vdCA9IHJlYWxwYXRoU3luYyh0d2Vha0Rpcik7XG4gIGNvbnN0IGZ1bGwgPSByZXNvbHZlKHR3ZWFrRGlyLCBwYXRoKTtcbiAgbGV0IHRhcmdldDogc3RyaW5nO1xuICB0cnkge1xuICAgIHRhcmdldCA9IHJlYWxwYXRoU3luYyhmdWxsKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibmF0aXZlIHBhdGggZG9lcyBub3QgZXhpc3RcIik7XG4gIH1cbiAgaWYgKCFpc1BhdGhJbnNpZGUocm9vdCwgdGFyZ2V0KSB8fCB0YXJnZXQgPT09IHJvb3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJuYXRpdmUgcGF0aCBtdXN0IHN0YXkgaW5zaWRlIHRoZSB0d2VhayBkaXJlY3RvcnlcIik7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUGF0aEluc2lkZShwYXJlbnQ6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgcmVsID0gcmVsYXRpdmUocmVzb2x2ZShwYXJlbnQpLCByZXNvbHZlKHRhcmdldCkpO1xuICByZXR1cm4gcmVsID09PSBcIlwiIHx8ICghIXJlbCAmJiAhcmVsLnN0YXJ0c1dpdGgoXCIuLlwiKSAmJiAhaXNBYnNvbHV0ZShyZWwpKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFR3ZWFrTWFuaWZlc3QgfSBmcm9tIFwiQGNoYXRncHQtcGx1c3BsdXMvc2RrXCI7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1RXRUFLX1NUT1JFX0lOREVYX1VSTCA9XG4gIFwiaHR0cHM6Ly9iLW5uZXR0LmdpdGh1Yi5pby9jb2RleC1wbHVzcGx1cy9zdG9yZS9pbmRleC5qc29uXCI7XG5leHBvcnQgY29uc3QgVFdFQUtfU1RPUkVfUkVWSUVXX0lTU1VFX1VSTCA9XG4gIFwiaHR0cHM6Ly9naXRodWIuY29tL1NodW5sbHkvY2hhdGdwdC1wbHVzcGx1cy9pc3N1ZXMvbmV3XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHdlYWtTdG9yZVJlZ2lzdHJ5IHtcbiAgc2NoZW1hVmVyc2lvbjogMTtcbiAgZ2VuZXJhdGVkQXQ/OiBzdHJpbmc7XG4gIGVudHJpZXM6IFR3ZWFrU3RvcmVFbnRyeVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICByZXBvOiBzdHJpbmc7XG4gIGFwcHJvdmVkQ29tbWl0U2hhOiBzdHJpbmc7XG4gIGFwcHJvdmVkQXQ6IHN0cmluZztcbiAgYXBwcm92ZWRCeTogc3RyaW5nO1xuICBwbGF0Zm9ybXM/OiBUd2Vha1N0b3JlUGxhdGZvcm1bXTtcbiAgcmVsZWFzZVVybD86IHN0cmluZztcbiAgcmV2aWV3VXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBUd2Vha1N0b3JlUGxhdGZvcm0gPSBcImRhcndpblwiIHwgXCJ3aW4zMlwiIHwgXCJsaW51eFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbiB7XG4gIHJlcG86IHN0cmluZztcbiAgZGVmYXVsdEJyYW5jaDogc3RyaW5nO1xuICBjb21taXRTaGE6IHN0cmluZztcbiAgY29tbWl0VXJsOiBzdHJpbmc7XG4gIG1hbmlmZXN0Pzoge1xuICAgIGlkPzogc3RyaW5nO1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICBpY29uVXJsPzogc3RyaW5nO1xuICB9O1xufVxuXG5jb25zdCBHSVRIVUJfUkVQT19SRSA9IC9eW0EtWmEtejAtOV8uLV0rXFwvW0EtWmEtejAtOV8uLV0rJC87XG5jb25zdCBGVUxMX1NIQV9SRSA9IC9eW2EtZjAtOV17NDB9JC9pO1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplR2l0SHViUmVwbyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcmF3ID0gaW5wdXQudHJpbSgpO1xuICBpZiAoIXJhdykgdGhyb3cgbmV3IEVycm9yKFwiR2l0SHViIHJlcG8gaXMgcmVxdWlyZWRcIik7XG5cbiAgY29uc3Qgc3NoID0gL15naXRAZ2l0aHViXFwuY29tOihbXi9dK1xcL1teL10rPykoPzpcXC5naXQpPyQvaS5leGVjKHJhdyk7XG4gIGlmIChzc2gpIHJldHVybiBub3JtYWxpemVSZXBvUGFydChzc2hbMV0pO1xuXG4gIGlmICgvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KHJhdykpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJhdyk7XG4gICAgaWYgKHVybC5ob3N0bmFtZSAhPT0gXCJnaXRodWIuY29tXCIpIHRocm93IG5ldyBFcnJvcihcIk9ubHkgZ2l0aHViLmNvbSByZXBvc2l0b3JpZXMgYXJlIHN1cHBvcnRlZFwiKTtcbiAgICBjb25zdCBwYXJ0cyA9IHVybC5wYXRobmFtZS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKS5zcGxpdChcIi9cIik7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHRocm93IG5ldyBFcnJvcihcIkdpdEh1YiByZXBvIFVSTCBtdXN0IGluY2x1ZGUgb3duZXIgYW5kIHJlcG9zaXRvcnlcIik7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZVJlcG9QYXJ0KGAke3BhcnRzWzBdfS8ke3BhcnRzWzFdfWApO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZVJlcG9QYXJ0KHJhdyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTdG9yZVJlZ2lzdHJ5KGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZVJlZ2lzdHJ5IHtcbiAgY29uc3QgcmVnaXN0cnkgPSBpbnB1dCBhcyBQYXJ0aWFsPFR3ZWFrU3RvcmVSZWdpc3RyeT4gfCBudWxsO1xuICBpZiAoIXJlZ2lzdHJ5IHx8IHJlZ2lzdHJ5LnNjaGVtYVZlcnNpb24gIT09IDEgfHwgIUFycmF5LmlzQXJyYXkocmVnaXN0cnkuZW50cmllcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCB0d2VhayBzdG9yZSByZWdpc3RyeVwiKTtcbiAgfVxuICBjb25zdCBlbnRyaWVzID0gcmVnaXN0cnkuZW50cmllcy5tYXAobm9ybWFsaXplU3RvcmVFbnRyeSk7XG4gIGVudHJpZXMuc29ydCgoYSwgYikgPT4gYS5tYW5pZmVzdC5uYW1lLmxvY2FsZUNvbXBhcmUoYi5tYW5pZmVzdC5uYW1lKSk7XG4gIHJldHVybiB7XG4gICAgc2NoZW1hVmVyc2lvbjogMSxcbiAgICBnZW5lcmF0ZWRBdDogdHlwZW9mIHJlZ2lzdHJ5LmdlbmVyYXRlZEF0ID09PSBcInN0cmluZ1wiID8gcmVnaXN0cnkuZ2VuZXJhdGVkQXQgOiB1bmRlZmluZWQsXG4gICAgZW50cmllcyxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodWZmbGVTdG9yZUVudHJpZXM8VD4oXG4gIGVudHJpZXM6IHJlYWRvbmx5IFRbXSxcbiAgcmFuZG9tSW5kZXg6IChleGNsdXNpdmVNYXg6IG51bWJlcikgPT4gbnVtYmVyID0gKGV4Y2x1c2l2ZU1heCkgPT4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZXhjbHVzaXZlTWF4KSxcbik6IFRbXSB7XG4gIGNvbnN0IHNodWZmbGVkID0gWy4uLmVudHJpZXNdO1xuICBmb3IgKGxldCBpID0gc2h1ZmZsZWQubGVuZ3RoIC0gMTsgaSA+IDA7IGkgLT0gMSkge1xuICAgIGNvbnN0IGogPSByYW5kb21JbmRleChpICsgMSk7XG4gICAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKGopIHx8IGogPCAwIHx8IGogPiBpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHNodWZmbGUgcmFuZG9tSW5kZXggcmV0dXJuZWQgJHtqfTsgZXhwZWN0ZWQgYW4gaW50ZWdlciBmcm9tIDAgdG8gJHtpfWApO1xuICAgIH1cbiAgICBbc2h1ZmZsZWRbaV0sIHNodWZmbGVkW2pdXSA9IFtzaHVmZmxlZFtqXSwgc2h1ZmZsZWRbaV1dO1xuICB9XG4gIHJldHVybiBzaHVmZmxlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVN0b3JlRW50cnkoaW5wdXQ6IHVua25vd24pOiBUd2Vha1N0b3JlRW50cnkge1xuICBjb25zdCBlbnRyeSA9IGlucHV0IGFzIFBhcnRpYWw8VHdlYWtTdG9yZUVudHJ5PiB8IG51bGw7XG4gIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHR3ZWFrIHN0b3JlIGVudHJ5XCIpO1xuICBjb25zdCByZXBvID0gbm9ybWFsaXplR2l0SHViUmVwbyhTdHJpbmcoZW50cnkucmVwbyA/PyBlbnRyeS5tYW5pZmVzdD8uZ2l0aHViUmVwbyA/PyBcIlwiKSk7XG4gIGNvbnN0IG1hbmlmZXN0ID0gZW50cnkubWFuaWZlc3QgYXMgVHdlYWtNYW5pZmVzdCB8IHVuZGVmaW5lZDtcbiAgaWYgKCFtYW5pZmVzdD8uaWQgfHwgIW1hbmlmZXN0Lm5hbWUgfHwgIW1hbmlmZXN0LnZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5IGZvciAke3JlcG99IGlzIG1pc3NpbmcgbWFuaWZlc3QgZmllbGRzYCk7XG4gIH1cbiAgaWYgKG5vcm1hbGl6ZUdpdEh1YlJlcG8obWFuaWZlc3QuZ2l0aHViUmVwbykgIT09IHJlcG8pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7bWFuaWZlc3QuaWR9IHJlcG8gZG9lcyBub3QgbWF0Y2ggbWFuaWZlc3QgZ2l0aHViUmVwb2ApO1xuICB9XG4gIGlmICghaXNGdWxsQ29tbWl0U2hhKFN0cmluZyhlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSA/PyBcIlwiKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7bWFuaWZlc3QuaWR9IG11c3QgcGluIGEgZnVsbCBhcHByb3ZlZCBjb21taXQgU0hBYCk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBpZDogbWFuaWZlc3QuaWQsXG4gICAgbWFuaWZlc3QsXG4gICAgcmVwbyxcbiAgICBhcHByb3ZlZENvbW1pdFNoYTogU3RyaW5nKGVudHJ5LmFwcHJvdmVkQ29tbWl0U2hhKSxcbiAgICBhcHByb3ZlZEF0OiB0eXBlb2YgZW50cnkuYXBwcm92ZWRBdCA9PT0gXCJzdHJpbmdcIiA/IGVudHJ5LmFwcHJvdmVkQXQgOiBcIlwiLFxuICAgIGFwcHJvdmVkQnk6IHR5cGVvZiBlbnRyeS5hcHByb3ZlZEJ5ID09PSBcInN0cmluZ1wiID8gZW50cnkuYXBwcm92ZWRCeSA6IFwiXCIsXG4gICAgcGxhdGZvcm1zOiBub3JtYWxpemVTdG9yZVBsYXRmb3JtcygoZW50cnkgYXMgeyBwbGF0Zm9ybXM/OiB1bmtub3duIH0pLnBsYXRmb3JtcyksXG4gICAgcmVsZWFzZVVybDogb3B0aW9uYWxHaXRodWJVcmwoZW50cnkucmVsZWFzZVVybCksXG4gICAgcmV2aWV3VXJsOiBvcHRpb25hbEdpdGh1YlVybChlbnRyeS5yZXZpZXdVcmwpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RvcmVBcmNoaXZlVXJsKGVudHJ5OiBUd2Vha1N0b3JlRW50cnkpOiBzdHJpbmcge1xuICBpZiAoIWlzRnVsbENvbW1pdFNoYShlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7ZW50cnkuaWR9IGlzIG5vdCBwaW5uZWQgdG8gYSBmdWxsIGNvbW1pdCBTSEFgKTtcbiAgfVxuICByZXR1cm4gYGh0dHBzOi8vY29kZWxvYWQuZ2l0aHViLmNvbS8ke2VudHJ5LnJlcG99L3Rhci5nei8ke2VudHJ5LmFwcHJvdmVkQ29tbWl0U2hhfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFR3ZWFrUHVibGlzaElzc3VlVXJsKHN1Ym1pc3Npb246IFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbik6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSBub3JtYWxpemVHaXRIdWJSZXBvKHN1Ym1pc3Npb24ucmVwbyk7XG4gIGlmICghaXNGdWxsQ29tbWl0U2hhKHN1Ym1pc3Npb24uY29tbWl0U2hhKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlN1Ym1pc3Npb24gbXVzdCBpbmNsdWRlIHRoZSBmdWxsIGNvbW1pdCBTSEEgdG8gcmV2aWV3XCIpO1xuICB9XG4gIGNvbnN0IHRpdGxlID0gYFR3ZWFrIHN0b3JlIHJldmlldzogJHtyZXBvfWA7XG4gIGNvbnN0IGJvZHkgPSBbXG4gICAgXCIjIyBUd2VhayByZXBvXCIsXG4gICAgYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3JlcG99YCxcbiAgICBcIlwiLFxuICAgIFwiIyMgQ29tbWl0IHRvIHJldmlld1wiLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0U2hhLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0VXJsLFxuICAgIFwiXCIsXG4gICAgXCJEbyBub3QgYXBwcm92ZSBhIGRpZmZlcmVudCBjb21taXQuIElmIHRoZSBhdXRob3IgcHVzaGVzIGNoYW5nZXMsIGFzayB0aGVtIHRvIHJlc3VibWl0LlwiLFxuICAgIFwiXCIsXG4gICAgXCIjIyBNYW5pZmVzdFwiLFxuICAgIGAtIGlkOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LmlkID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIGAtIG5hbWU6ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8ubmFtZSA/PyBcIihub3QgZGV0ZWN0ZWQpXCJ9YCxcbiAgICBgLSB2ZXJzaW9uOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LnZlcnNpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gZGVzY3JpcHRpb246ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8uZGVzY3JpcHRpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gaWNvblVybDogJHtzdWJtaXNzaW9uLm1hbmlmZXN0Py5pY29uVXJsID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIFwiXCIsXG4gICAgXCIjIyBBZG1pbiBjaGVja2xpc3RcIixcbiAgICBcIi0gWyBdIG1hbmlmZXN0Lmpzb24gaXMgdmFsaWRcIixcbiAgICBcIi0gWyBdIG1hbmlmZXN0Lmljb25VcmwgaXMgdXNhYmxlIGFzIHRoZSBzdG9yZSBpY29uXCIsXG4gICAgXCItIFsgXSBzb3VyY2Ugd2FzIHJldmlld2VkIGF0IHRoZSBleGFjdCBjb21taXQgYWJvdmVcIixcbiAgICBcIi0gWyBdIGBzdG9yZS9pbmRleC5qc29uYCBlbnRyeSBwaW5zIGBhcHByb3ZlZENvbW1pdFNoYWAgdG8gdGhlIGV4YWN0IGNvbW1pdCBhYm92ZVwiLFxuICBdLmpvaW4oXCJcXG5cIik7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwoVFdFQUtfU1RPUkVfUkVWSUVXX0lTU1VFX1VSTCk7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGVtcGxhdGVcIiwgXCJ0d2Vhay1zdG9yZS1yZXZpZXcubWRcIik7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGl0bGVcIiwgdGl0bGUpO1xuICB1cmwuc2VhcmNoUGFyYW1zLnNldChcImJvZHlcIiwgYm9keSk7XG4gIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRnVsbENvbW1pdFNoYSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBGVUxMX1NIQV9SRS50ZXN0KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUmVwb1BhcnQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSB2YWx1ZS50cmltKCkucmVwbGFjZSgvXFwuZ2l0JC9pLCBcIlwiKS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKTtcbiAgaWYgKCFHSVRIVUJfUkVQT19SRS50ZXN0KHJlcG8pKSB0aHJvdyBuZXcgRXJyb3IoXCJHaXRIdWIgcmVwbyBtdXN0IGJlIGluIG93bmVyL3JlcG8gZm9ybVwiKTtcbiAgcmV0dXJuIHJlcG87XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0b3JlUGxhdGZvcm1zKGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZVBsYXRmb3JtW10gfCB1bmRlZmluZWQge1xuICBpZiAoaW5wdXQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGlucHV0KSkgdGhyb3cgbmV3IEVycm9yKFwiU3RvcmUgZW50cnkgcGxhdGZvcm1zIG11c3QgYmUgYW4gYXJyYXlcIik7XG4gIGNvbnN0IGFsbG93ZWQgPSBuZXcgU2V0PFR3ZWFrU3RvcmVQbGF0Zm9ybT4oW1wiZGFyd2luXCIsIFwid2luMzJcIiwgXCJsaW51eFwiXSk7XG4gIGNvbnN0IHBsYXRmb3JtcyA9IEFycmF5LmZyb20obmV3IFNldChpbnB1dC5tYXAoKHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhYWxsb3dlZC5oYXModmFsdWUgYXMgVHdlYWtTdG9yZVBsYXRmb3JtKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBzdG9yZSBwbGF0Zm9ybTogJHtTdHJpbmcodmFsdWUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWUgYXMgVHdlYWtTdG9yZVBsYXRmb3JtO1xuICB9KSkpO1xuICByZXR1cm4gcGxhdGZvcm1zLmxlbmd0aCA+IDAgPyBwbGF0Zm9ybXMgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG9wdGlvbmFsR2l0aHViVXJsKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhdmFsdWUudHJpbSgpKSByZXR1cm4gdW5kZWZpbmVkO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKHZhbHVlKTtcbiAgaWYgKHVybC5wcm90b2NvbCAhPT0gXCJodHRwczpcIiB8fCB1cmwuaG9zdG5hbWUgIT09IFwiZ2l0aHViLmNvbVwiKSByZXR1cm4gdW5kZWZpbmVkO1xuICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG59XG4iLCAiaW1wb3J0IHsgYXBwLCBCcm93c2VyVmlldywgQnJvd3NlcldpbmRvdywgTWVzc2FnZUNoYW5uZWxNYWluLCBpcGNNYWluLCBuYXRpdmVUaGVtZSB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCwgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jLCBzdGF0U3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBjcmVhdGVTZXJ2ZXIsIHR5cGUgSW5jb21pbmdNZXNzYWdlLCB0eXBlIFNlcnZlciwgdHlwZSBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gXCJub2RlOmh0dHBcIjtcbmltcG9ydCB7IGpvaW4sIG5vcm1hbGl6ZSwgcmVsYXRpdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgdHlwZSB7IFNvY2tldCB9IGZyb20gXCJub2RlOm5ldFwiO1xuXG5jb25zdCBDT05ORUNUX1BPUlRfQ0hBTk5FTCA9IFwiY29kZXhwcDpicm93c2VyLXVpLWNvbm5lY3QtYXBwLWhvc3RcIjtcbmNvbnN0IEJSSURHRV9SRVFVRVNUX0NIQU5ORUwgPSBcImNvZGV4cHA6YnJvd3Nlci11aS1icmlkZ2UtcmVxdWVzdFwiO1xuY29uc3QgQlJJREdFX1JFU1BPTlNFX0NIQU5ORUwgPSBcImNvZGV4cHA6YnJvd3Nlci11aS1icmlkZ2UtcmVzcG9uc2VcIjtcbmNvbnN0IE1FU1NBR0VfRk9SX1ZJRVdfQ0hBTk5FTCA9IFwiY29kZXhwcDpicm93c2VyLXVpLW1lc3NhZ2UtZm9yLXZpZXdcIjtcbmNvbnN0IFdPUktFUl9NRVNTQUdFX0NIQU5ORUwgPSBcImNvZGV4cHA6YnJvd3Nlci11aS13b3JrZXItbWVzc2FnZVwiO1xuY29uc3QgU1lTVEVNX1RIRU1FX0NIQU5ORUwgPSBcImNvZGV4cHA6YnJvd3Nlci11aS1zeXN0ZW0tdGhlbWVcIjtcblxudHlwZSBMb2dGbiA9IChsZXZlbDogXCJpbmZvXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiwgLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkO1xuXG5pbnRlcmZhY2UgQ29kZXhXaW5kb3dTZXJ2aWNlcyB7XG4gIGdldENvbnRleHQ/OiAoaG9zdElkOiBzdHJpbmcpID0+IHsgcmVnaXN0ZXJXaW5kb3c/OiAod2luZG93TGlrZTogQ29kZXhXaW5kb3dMaWtlKSA9PiB2b2lkIH0gfCBudWxsO1xuICBnZXRDb250ZXh0Rm9yV2ViQ29udGVudHM/OiAoXG4gICAgd2ViQ29udGVudHM6IEVsZWN0cm9uLldlYkNvbnRlbnRzLFxuICApID0+IHsgcmVnaXN0ZXJXaW5kb3c/OiAod2luZG93TGlrZTogQ29kZXhXaW5kb3dMaWtlKSA9PiB2b2lkIH0gfCBudWxsO1xuICB3aW5kb3dNYW5hZ2VyPzoge1xuICAgIHJlZ2lzdGVyV2luZG93PzogKFxuICAgICAgd2luZG93TGlrZTogQ29kZXhXaW5kb3dMaWtlLFxuICAgICAgaG9zdElkOiBzdHJpbmcsXG4gICAgICBwcmltYXJ5OiBib29sZWFuLFxuICAgICAgYXBwZWFyYW5jZTogc3RyaW5nLFxuICAgICkgPT4gdm9pZDtcbiAgICBvcHRpb25zPzoge1xuICAgICAgYWxsb3dEZXZ0b29scz86IGJvb2xlYW47XG4gICAgICBwcmVsb2FkUGF0aD86IHN0cmluZztcbiAgICB9O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgQ29kZXhXaW5kb3dMaWtlIHtcbiAgaWQ6IG51bWJlcjtcbiAgd2ViQ29udGVudHM6IEVsZWN0cm9uLldlYkNvbnRlbnRzO1xuICBvbihldmVudDogXCJjbG9zZWRcIiwgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB1bmtub3duO1xuICBvbmNlPyhldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCk6IHVua25vd247XG4gIG9mZj8oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpOiB1bmtub3duO1xuICByZW1vdmVMaXN0ZW5lcj8oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpOiB1bmtub3duO1xuICBpc0Rlc3Ryb3llZD8oKTogYm9vbGVhbjtcbiAgaXNGb2N1c2VkPygpOiBib29sZWFuO1xuICBmb2N1cz8oKTogdm9pZDtcbiAgc2hvdz8oKTogdm9pZDtcbiAgaGlkZT8oKTogdm9pZDtcbiAgZ2V0Qm91bmRzPygpOiBFbGVjdHJvbi5SZWN0YW5nbGU7XG4gIGdldENvbnRlbnRCb3VuZHM/KCk6IEVsZWN0cm9uLlJlY3RhbmdsZTtcbiAgZ2V0U2l6ZT8oKTogW251bWJlciwgbnVtYmVyXTtcbiAgZ2V0Q29udGVudFNpemU/KCk6IFtudW1iZXIsIG51bWJlcl07XG4gIHNldFRpdGxlPyh0aXRsZTogc3RyaW5nKTogdm9pZDtcbiAgZ2V0VGl0bGU/KCk6IHN0cmluZztcbiAgc2V0UmVwcmVzZW50ZWRGaWxlbmFtZT8oZmlsZW5hbWU6IHN0cmluZyk6IHZvaWQ7XG4gIHNldERvY3VtZW50RWRpdGVkPyhlZGl0ZWQ6IGJvb2xlYW4pOiB2b2lkO1xuICBzZXRXaW5kb3dCdXR0b25WaXNpYmlsaXR5Pyh2aXNpYmxlOiBib29sZWFuKTogdm9pZDtcbn1cblxuaW50ZXJmYWNlIEJyb3dzZXJVaVNlcnZlck9wdGlvbnMge1xuICBwb3J0OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgaGlkZU1haW5XaW5kb3c6IGJvb2xlYW47XG4gIGdldFdpbmRvd1NlcnZpY2VzOiAoKSA9PiBDb2RleFdpbmRvd1NlcnZpY2VzIHwgbnVsbDtcbiAgbG9nOiBMb2dGbjtcbn1cblxuaW50ZXJmYWNlIEJyb3dzZXJVaUhvc3Qge1xuICB2aWV3OiBFbGVjdHJvbi5Ccm93c2VyVmlldztcbiAgd2ViQ29udGVudHM6IEVsZWN0cm9uLldlYkNvbnRlbnRzO1xufVxuXG5pbnRlcmZhY2UgQnJpZGdlUGVuZGluZ1JlcXVlc3Qge1xuICByZXNvbHZlOiAodmFsdWU6IHVua25vd24pID0+IHZvaWQ7XG4gIHJlamVjdDogKGVycm9yOiBFcnJvcikgPT4gdm9pZDtcbiAgdGltZXI6IE5vZGVKUy5UaW1lb3V0O1xufVxuXG5pbnRlcmZhY2UgSW5pdGlhbFN0YXRlIHtcbiAgc25hcHNob3Q6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBzeXN0ZW1UaGVtZVZhcmlhbnQ6IHN0cmluZztcbiAgc2VudHJ5SW5pdE9wdGlvbnM6IHVua25vd247XG4gIGJ1aWxkRmxhdm9yOiB1bmtub3duO1xuICB1c2VzT3dsQXBwU2hlbGw6IGJvb2xlYW47XG4gIHBsYXRmb3JtOiBOb2RlSlMuUGxhdGZvcm07XG4gIGFyY2g6IHN0cmluZztcbn1cblxuY29uc3QgTUlNRV9UWVBFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCIuaHRtbFwiOiBcInRleHQvaHRtbDsgY2hhcnNldD11dGYtOFwiLFxuICBcIi5qc1wiOiBcInRleHQvamF2YXNjcmlwdDsgY2hhcnNldD11dGYtOFwiLFxuICBcIi5jc3NcIjogXCJ0ZXh0L2NzczsgY2hhcnNldD11dGYtOFwiLFxuICBcIi5qc29uXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICBcIi5zdmdcIjogXCJpbWFnZS9zdmcreG1sXCIsXG4gIFwiLnBuZ1wiOiBcImltYWdlL3BuZ1wiLFxuICBcIi5qcGdcIjogXCJpbWFnZS9qcGVnXCIsXG4gIFwiLmpwZWdcIjogXCJpbWFnZS9qcGVnXCIsXG4gIFwiLndlYnBcIjogXCJpbWFnZS93ZWJwXCIsXG4gIFwiLmljb1wiOiBcImltYWdlL3gtaWNvblwiLFxuICBcIi53b2ZmXCI6IFwiZm9udC93b2ZmXCIsXG4gIFwiLndvZmYyXCI6IFwiZm9udC93b2ZmMlwiLFxufTtcblxubGV0IGFjdGl2ZVNlcnZlcjogU2VydmVyIHwgbnVsbCA9IG51bGw7XG5sZXQgYWN0aXZlSG9zdDogQnJvd3NlclVpSG9zdCB8IG51bGwgPSBudWxsO1xubGV0IGFjdGl2ZU9wdGlvbnM6IEJyb3dzZXJVaVNlcnZlck9wdGlvbnMgfCBudWxsID0gbnVsbDtcbmNvbnN0IGJyaWRnZVJlcXVlc3RzID0gbmV3IE1hcDxzdHJpbmcsIEJyaWRnZVBlbmRpbmdSZXF1ZXN0PigpO1xuY29uc3QgY29udHJvbENsaWVudHMgPSBuZXcgU2V0PFdlYlNvY2tldENvbm5lY3Rpb24+KCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVN0YXJ0QnJvd3NlclVpU2VydmVyKFxuICBvcHRzOiBQaWNrPEJyb3dzZXJVaVNlcnZlck9wdGlvbnMsIFwiZ2V0V2luZG93U2VydmljZXNcIiB8IFwibG9nXCI+LFxuKTogdm9pZCB7XG4gIGlmIChwcm9jZXNzLmVudi5DT0RFWFBQX0JST1dTRVJfVUkgIT09IFwiMVwiKSByZXR1cm47XG4gIGNvbnN0IHBvcnQgPSBwYXJzZVBvcnQocHJvY2Vzcy5lbnYuQ09ERVhQUF9CUk9XU0VSX1VJX1BPUlQsIDg3NjUpO1xuICBzdGFydEJyb3dzZXJVaVNlcnZlcih7XG4gICAgLi4ub3B0cyxcbiAgICBwb3J0LFxuICAgIGhvc3Q6IFwiMTI3LjAuMC4xXCIsXG4gICAgaGlkZU1haW5XaW5kb3c6IHByb2Nlc3MuZW52LkNPREVYUFBfQlJPV1NFUl9VSV9ISURFX01BSU4gPT09IFwiMVwiLFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0QnJvd3NlclVpU2VydmVyKG9wdHM6IEJyb3dzZXJVaVNlcnZlck9wdGlvbnMpOiB2b2lkIHtcbiAgaWYgKGFjdGl2ZVNlcnZlcikgcmV0dXJuO1xuICBhY3RpdmVPcHRpb25zID0gb3B0cztcbiAgaW5zdGFsbEJyb3dzZXJVaUlwY0hhbmRsZXJzKG9wdHMubG9nKTtcblxuICBjb25zdCBzZXJ2ZXIgPSBjcmVhdGVTZXJ2ZXIoKHJlcSwgcmVzKSA9PiB7XG4gICAgaGFuZGxlSHR0cFJlcXVlc3QocmVxLCByZXMpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgb3B0cy5sb2coXCJlcnJvclwiLCBcImJyb3dzZXIgVUkgcmVxdWVzdCBmYWlsZWRcIiwgeyBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pO1xuICAgICAgc2VuZFRleHQocmVzLCA1MDAsIFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXFxuXCIsIFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICB9KTtcbiAgfSk7XG4gIHNlcnZlci5vbihcInVwZ3JhZGVcIiwgKHJlcSwgc29ja2V0LCBoZWFkKSA9PiB7XG4gICAgaGFuZGxlVXBncmFkZShyZXEsIHNvY2tldCBhcyBTb2NrZXQsIGhlYWQpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgb3B0cy5sb2coXCJ3YXJuXCIsIFwiYnJvd3NlciBVSSB3ZWJzb2NrZXQgdXBncmFkZSBmYWlsZWRcIiwgeyBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pO1xuICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICB9KTtcbiAgfSk7XG4gIHNlcnZlci5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgIG9wdHMubG9nKFwiZXJyb3JcIiwgXCJicm93c2VyIFVJIHNlcnZlciBmYWlsZWRcIiwgeyBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9KTtcbiAgc2VydmVyLmxpc3RlbihvcHRzLnBvcnQsIG9wdHMuaG9zdCwgKCkgPT4ge1xuICAgIG9wdHMubG9nKFwiaW5mb1wiLCBgYnJvd3NlciBVSSBzZXJ2ZXIgbGlzdGVuaW5nIGF0IGh0dHA6Ly8ke29wdHMuaG9zdH06JHtvcHRzLnBvcnR9L2ApO1xuICB9KTtcbiAgYWN0aXZlU2VydmVyID0gc2VydmVyO1xuICBpZiAob3B0cy5oaWRlTWFpbldpbmRvdykge1xuICAgIGZvciAoY29uc3QgZGVsYXlNcyBvZiBbNTAwLCAxXzUwMCwgM18wMDBdKSB7XG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoaGlkZVZpc2libGVDb2RleFdpbmRvd3MsIGRlbGF5TXMpO1xuICAgICAgdGltZXIudW5yZWY/LigpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpbnN0YWxsQnJvd3NlclVpSXBjSGFuZGxlcnMobG9nOiBMb2dGbik6IHZvaWQge1xuICBpcGNNYWluLnJlbW92ZUFsbExpc3RlbmVycyhCUklER0VfUkVTUE9OU0VfQ0hBTk5FTCk7XG4gIGlwY01haW4ucmVtb3ZlQWxsTGlzdGVuZXJzKE1FU1NBR0VfRk9SX1ZJRVdfQ0hBTk5FTCk7XG4gIGlwY01haW4ucmVtb3ZlQWxsTGlzdGVuZXJzKFdPUktFUl9NRVNTQUdFX0NIQU5ORUwpO1xuICBpcGNNYWluLnJlbW92ZUFsbExpc3RlbmVycyhTWVNURU1fVEhFTUVfQ0hBTk5FTCk7XG5cbiAgaXBjTWFpbi5vbihCUklER0VfUkVTUE9OU0VfQ0hBTk5FTCwgKGV2ZW50LCBwYXlsb2FkKSA9PiB7XG4gICAgaWYgKCFpc0Jyb3dzZXJVaUhvc3RTZW5kZXIoZXZlbnQuc2VuZGVyKSkgcmV0dXJuO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXNSZWNvcmQocGF5bG9hZCk7XG4gICAgY29uc3QgaWQgPSB0eXBlb2YgcmVzcG9uc2U/LmlkID09PSBcInN0cmluZ1wiID8gcmVzcG9uc2UuaWQgOiBcIlwiO1xuICAgIGNvbnN0IHBlbmRpbmcgPSBicmlkZ2VSZXF1ZXN0cy5nZXQoaWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuICAgIGJyaWRnZVJlcXVlc3RzLmRlbGV0ZShpZCk7XG4gICAgY2xlYXJUaW1lb3V0KHBlbmRpbmcudGltZXIpO1xuICAgIGlmIChyZXNwb25zZT8ub2sgPT09IHRydWUpIHtcbiAgICAgIHBlbmRpbmcucmVzb2x2ZShyZXNwb25zZS52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBlbmRpbmcucmVqZWN0KG5ldyBFcnJvcih0eXBlb2YgcmVzcG9uc2U/LmVycm9yID09PSBcInN0cmluZ1wiID8gcmVzcG9uc2UuZXJyb3IgOiBcIkJyaWRnZSByZXF1ZXN0IGZhaWxlZFwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLm9uKE1FU1NBR0VfRk9SX1ZJRVdfQ0hBTk5FTCwgKGV2ZW50LCBtZXNzYWdlKSA9PiB7XG4gICAgaWYgKCFpc0Jyb3dzZXJVaUhvc3RTZW5kZXIoZXZlbnQuc2VuZGVyKSkgcmV0dXJuO1xuICAgIGJyb2FkY2FzdENvbnRyb2woeyB0eXBlOiBcIm1lc3NhZ2UtZm9yLXZpZXdcIiwgbWVzc2FnZSB9KTtcbiAgfSk7XG5cbiAgaXBjTWFpbi5vbihXT1JLRVJfTUVTU0FHRV9DSEFOTkVMLCAoZXZlbnQsIHdvcmtlcklkLCBtZXNzYWdlKSA9PiB7XG4gICAgaWYgKCFpc0Jyb3dzZXJVaUhvc3RTZW5kZXIoZXZlbnQuc2VuZGVyKSkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2Ygd29ya2VySWQgIT09IFwic3RyaW5nXCIpIHJldHVybjtcbiAgICBicm9hZGNhc3RDb250cm9sKHsgdHlwZTogXCJ3b3JrZXItbWVzc2FnZVwiLCB3b3JrZXJJZCwgbWVzc2FnZSB9KTtcbiAgfSk7XG5cbiAgaXBjTWFpbi5vbihTWVNURU1fVEhFTUVfQ0hBTk5FTCwgKGV2ZW50LCB2YWx1ZSkgPT4ge1xuICAgIGlmICghaXNCcm93c2VyVWlIb3N0U2VuZGVyKGV2ZW50LnNlbmRlcikpIHJldHVybjtcbiAgICBicm9hZGNhc3RDb250cm9sKHsgdHlwZTogXCJzeXN0ZW0tdGhlbWUtdmFyaWFudC11cGRhdGVkXCIsIHZhbHVlIH0pO1xuICB9KTtcblxuICBwcm9jZXNzLm9uY2UoXCJleGl0XCIsICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHBlbmRpbmcgb2YgYnJpZGdlUmVxdWVzdHMudmFsdWVzKCkpIHtcbiAgICAgIGNsZWFyVGltZW91dChwZW5kaW5nLnRpbWVyKTtcbiAgICAgIHBlbmRpbmcucmVqZWN0KG5ldyBFcnJvcihcIkNoYXRHUFQrKyBicm93c2VyIFVJIHNlcnZlciBzdG9wcGVkXCIpKTtcbiAgICB9XG4gICAgYnJpZGdlUmVxdWVzdHMuY2xlYXIoKTtcbiAgICBmb3IgKGNvbnN0IGNsaWVudCBvZiBjb250cm9sQ2xpZW50cykgY2xpZW50LmNsb3NlKCk7XG4gICAgY29udHJvbENsaWVudHMuY2xlYXIoKTtcbiAgICB0cnkge1xuICAgICAgaWYgKGFjdGl2ZUhvc3QgJiYgIWFjdGl2ZUhvc3Qud2ViQ29udGVudHMuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICBhY3RpdmVIb3N0LndlYkNvbnRlbnRzLmNsb3NlKHsgd2FpdEZvckJlZm9yZVVubG9hZDogZmFsc2UgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZyhcIndhcm5cIiwgXCJicm93c2VyIFVJIGhvc3QgY2xlYW51cCBmYWlsZWRcIiwgeyBtZXNzYWdlOiBTdHJpbmcoZXJyb3IpIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUh0dHBSZXF1ZXN0KHJlcTogSW5jb21pbmdNZXNzYWdlLCByZXM6IFNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG9wdGlvbnMgPSByZXF1aXJlT3B0aW9ucygpO1xuICBjb25zdCB1cmwgPSByZXF1ZXN0VXJsKHJlcSk7XG4gIGlmICghdXJsKSB7XG4gICAgc2VuZFRleHQocmVzLCA0MDAsIFwiQmFkIFJlcXVlc3RcXG5cIiwgXCJ0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh1cmwucGF0aG5hbWUgPT09IFwiL2NvZGV4cHAvYnJvd3Nlci11aS9oZWFsdGhcIikge1xuICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IG9rOiB0cnVlIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh1cmwucGF0aG5hbWUgPT09IFwiL2NvZGV4cHAvYnJvd3Nlci11aS9icmlkZ2VcIikge1xuICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xuICAgICAgc2VuZFRleHQocmVzLCA0MDUsIFwiTWV0aG9kIE5vdCBBbGxvd2VkXFxuXCIsIFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgYm9keSA9IGFzUmVjb3JkKGF3YWl0IHJlYWRKc29uQm9keShyZXEpKTtcbiAgICBjb25zdCBtZXRob2QgPSB0eXBlb2YgYm9keT8ubWV0aG9kID09PSBcInN0cmluZ1wiID8gYm9keS5tZXRob2QgOiBcIlwiO1xuICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5pc0FycmF5KGJvZHk/LmFyZ3MpID8gYm9keS5hcmdzIDogW107XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgY2FsbEhpZGRlbkJyaWRnZShtZXRob2QsIGFyZ3MpO1xuICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgb2s6IHRydWUsIHZhbHVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBzZW5kSnNvbihyZXMsIDUwMCwge1xuICAgICAgICBvazogZmFsc2UsXG4gICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvY29kZXhwcC9icm93c2VyLXVpL2JyaWRnZS5qc1wiKSB7XG4gICAgaWYgKHJlcS5tZXRob2QgIT09IFwiR0VUXCIgJiYgcmVxLm1ldGhvZCAhPT0gXCJIRUFEXCIpIHtcbiAgICAgIHNlbmRUZXh0KHJlcywgNDA1LCBcIk1ldGhvZCBOb3QgQWxsb3dlZFxcblwiLCBcInRleHQvcGxhaW47IGNoYXJzZXQ9dXRmLThcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdCA9IGJyb3dzZXJCcmlkZ2VTY3JpcHQoYXdhaXQgY29sbGVjdEluaXRpYWxTdGF0ZShvcHRpb25zKSk7XG4gICAgc2VuZEJ1ZmZlcihyZXMsIDIwMCwgQnVmZmVyLmZyb20oc2NyaXB0KSwgTUlNRV9UWVBFU1tcIi5qc1wiXSwgcmVxLm1ldGhvZCA9PT0gXCJIRUFEXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChyZXEubWV0aG9kICE9PSBcIkdFVFwiICYmIHJlcS5tZXRob2QgIT09IFwiSEVBRFwiKSB7XG4gICAgc2VuZFRleHQocmVzLCA0MDUsIFwiTWV0aG9kIE5vdCBBbGxvd2VkXFxuXCIsIFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAodXJsLnBhdGhuYW1lID09PSBcIi9cIiB8fCB1cmwucGF0aG5hbWUgPT09IFwiL2luZGV4Lmh0bWxcIikge1xuICAgIGNvbnN0IGh0bWwgPSBhd2FpdCBicm93c2VySW5kZXhIdG1sKG9wdGlvbnMpO1xuICAgIHNlbmRCdWZmZXIocmVzLCAyMDAsIEJ1ZmZlci5mcm9tKGh0bWwpLCBNSU1FX1RZUEVTW1wiLmh0bWxcIl0sIHJlcS5tZXRob2QgPT09IFwiSEVBRFwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmaWxlID0gd2Vidmlld0ZpbGUodXJsLnBhdGhuYW1lKTtcbiAgaWYgKCFmaWxlKSB7XG4gICAgc2VuZFRleHQocmVzLCA0MDQsIFwiTm90IEZvdW5kXFxuXCIsIFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgY29udGVudCA9IHJlYWRGaWxlU3luYyhmaWxlKTtcbiAgc2VuZEJ1ZmZlcihyZXMsIDIwMCwgY29udGVudCwgbWltZVR5cGUoZmlsZSksIHJlcS5tZXRob2QgPT09IFwiSEVBRFwiKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlVXBncmFkZShyZXE6IEluY29taW5nTWVzc2FnZSwgc29ja2V0OiBTb2NrZXQsIGhlYWQ6IEJ1ZmZlcik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB1cmwgPSByZXF1ZXN0VXJsKHJlcSk7XG4gIGlmICghdXJsKSB0aHJvdyBuZXcgRXJyb3IoXCJiYWQgd2Vic29ja2V0IFVSTFwiKTtcbiAgaWYgKHVybC5wYXRobmFtZSAhPT0gXCIvY29kZXhwcC9icm93c2VyLXVpL3JwY1wiICYmIHVybC5wYXRobmFtZSAhPT0gXCIvY29kZXhwcC9icm93c2VyLXVpL2NvbnRyb2xcIikge1xuICAgIHNvY2tldC5kZXN0cm95KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHdzID0gYWNjZXB0V2ViU29ja2V0KHJlcSwgc29ja2V0LCBoZWFkKTtcbiAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvY29kZXhwcC9icm93c2VyLXVpL2NvbnRyb2xcIikge1xuICAgIGNvbnRyb2xDbGllbnRzLmFkZCh3cyk7XG4gICAgd3Mub25DbG9zZSgoKSA9PiBjb250cm9sQ2xpZW50cy5kZWxldGUod3MpKTtcbiAgICB3cy5zZW5kSnNvbih7IHR5cGU6IFwiaGVsbG9cIiB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBob3N0ID0gYXdhaXQgZW5zdXJlQnJvd3NlclVpSG9zdCgpO1xuICBjb25zdCB7IHBvcnQxLCBwb3J0MiB9ID0gbmV3IE1lc3NhZ2VDaGFubmVsTWFpbigpO1xuICBob3N0LndlYkNvbnRlbnRzLnBvc3RNZXNzYWdlKENPTk5FQ1RfUE9SVF9DSEFOTkVMLCB7fSwgW3BvcnQyXSk7XG4gIGJyaWRnZU1lc3NhZ2VQb3J0VG9XZWJTb2NrZXQocG9ydDEsIHdzKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnJvd3NlckluZGV4SHRtbChvcHRpb25zOiBCcm93c2VyVWlTZXJ2ZXJPcHRpb25zKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgaW5kZXhQYXRoID0gam9pbih3ZWJ2aWV3Um9vdCgpLCBcImluZGV4Lmh0bWxcIik7XG4gIGxldCBodG1sID0gcmVsYXhCcm93c2VyVWlDc3AocmVhZEZpbGVTeW5jKGluZGV4UGF0aCwgXCJ1dGY4XCIpKTtcbiAgY29uc3Qgc2hpbSA9IGA8c2NyaXB0IHNyYz1cIi9jb2RleHBwL2Jyb3dzZXItdWkvYnJpZGdlLmpzXCI+PC9zY3JpcHQ+YDtcbiAgaWYgKGh0bWwuaW5jbHVkZXMoXCI8L2hlYWQ+XCIpKSB7XG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZShcIjwvaGVhZD5cIiwgYCR7c2hpbX1cXG4gIDwvaGVhZD5gKTtcbiAgfSBlbHNlIHtcbiAgICBodG1sID0gYCR7c2hpbX1cXG4ke2h0bWx9YDtcbiAgfVxuICByZXR1cm4gaHRtbDtcbn1cblxuZnVuY3Rpb24gcmVsYXhCcm93c2VyVWlDc3AoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGh0bWwucmVwbGFjZShcbiAgICAvKDxtZXRhXFxzK2h0dHAtZXF1aXY9W1wiJ11Db250ZW50LVNlY3VyaXR5LVBvbGljeVtcIiddXFxzK2NvbnRlbnQ9XCIpKFteXCJdKikoXCIpLyxcbiAgICAoX21hdGNoLCBwcmVmaXg6IHN0cmluZywgY29udGVudDogc3RyaW5nLCBzdWZmaXg6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgZGlyZWN0aXZlcyA9IHBhcnNlQ3NwRGlyZWN0aXZlcyhkZWNvZGVIdG1sQXR0cmlidXRlKGNvbnRlbnQpKTtcbiAgICAgIGRpcmVjdGl2ZXMuc2V0KFwiY2hpbGQtc3JjXCIsIFwiJ3NlbGYnIGJsb2I6IGRhdGE6IGh0dHA6IGh0dHBzOlwiKTtcbiAgICAgIGRpcmVjdGl2ZXMuc2V0KFwiZnJhbWUtc3JjXCIsIFwiJ3NlbGYnIGJsb2I6IGRhdGE6IGh0dHA6IGh0dHBzOlwiKTtcbiAgICAgIGRpcmVjdGl2ZXMuc2V0KFwiY29ubmVjdC1zcmNcIiwgXCInc2VsZicgaHR0cDogaHR0cHM6IHdzOiB3c3M6IHNlbnRyeS1pcGM6XCIpO1xuICAgICAgcmV0dXJuIGAke3ByZWZpeH0ke2VuY29kZUh0bWxBdHRyaWJ1dGUoZm9ybWF0Q3NwRGlyZWN0aXZlcyhkaXJlY3RpdmVzKSl9JHtzdWZmaXh9YDtcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBwYXJzZUNzcERpcmVjdGl2ZXMoY29udGVudDogc3RyaW5nKTogTWFwPHN0cmluZywgc3RyaW5nPiB7XG4gIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IHBhcnQgb2YgY29udGVudC5zcGxpdChcIjtcIikpIHtcbiAgICBjb25zdCB0cmltbWVkID0gcGFydC50cmltKCk7XG4gICAgaWYgKCF0cmltbWVkKSBjb250aW51ZTtcbiAgICBjb25zdCBbbmFtZSwgLi4ucmVzdF0gPSB0cmltbWVkLnNwbGl0KC9cXHMrLyk7XG4gICAgaWYgKCFuYW1lKSBjb250aW51ZTtcbiAgICBkaXJlY3RpdmVzLnNldChuYW1lLCByZXN0LmpvaW4oXCIgXCIpKTtcbiAgfVxuICByZXR1cm4gZGlyZWN0aXZlcztcbn1cblxuZnVuY3Rpb24gZm9ybWF0Q3NwRGlyZWN0aXZlcyhkaXJlY3RpdmVzOiBNYXA8c3RyaW5nLCBzdHJpbmc+KTogc3RyaW5nIHtcbiAgcmV0dXJuIFsuLi5kaXJlY3RpdmVzLmVudHJpZXMoKV1cbiAgICAubWFwKChbbmFtZSwgdmFsdWVdKSA9PiAodmFsdWUgPyBgJHtuYW1lfSAke3ZhbHVlfWAgOiBuYW1lKSlcbiAgICAuam9pbihcIjsgXCIpO1xufVxuXG5mdW5jdGlvbiBkZWNvZGVIdG1sQXR0cmlidXRlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpXG4gICAgLnJlcGxhY2UoLyYjMzk7L2csIFwiJ1wiKVxuICAgIC5yZXBsYWNlKC8mbHQ7L2csIFwiPFwiKVxuICAgIC5yZXBsYWNlKC8mZ3Q7L2csIFwiPlwiKVxuICAgIC5yZXBsYWNlKC8mYW1wOy9nLCBcIiZcIik7XG59XG5cbmZ1bmN0aW9uIGVuY29kZUh0bWxBdHRyaWJ1dGUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RJbml0aWFsU3RhdGUob3B0aW9uczogQnJvd3NlclVpU2VydmVyT3B0aW9ucyk6IFByb21pc2U8SW5pdGlhbFN0YXRlPiB7XG4gIGF3YWl0IGVuc3VyZUJyb3dzZXJVaUhvc3QoKTtcbiAgY29uc3QgW3NuYXBzaG90LCBzeXN0ZW1UaGVtZVZhcmlhbnQsIHNlbnRyeUluaXRPcHRpb25zLCBidWlsZEZsYXZvciwgdXNlc093bEFwcFNoZWxsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBjYWxsSGlkZGVuQnJpZGdlKFwic25hcHNob3RcIiwgW10pLFxuICAgIGNhbGxIaWRkZW5CcmlkZ2UoXCJzeXN0ZW1UaGVtZVwiLCBbXSksXG4gICAgY2FsbEhpZGRlbkJyaWRnZShcInNlbnRyeU9wdGlvbnNcIiwgW10pLFxuICAgIGNhbGxIaWRkZW5CcmlkZ2UoXCJidWlsZEZsYXZvclwiLCBbXSksXG4gICAgY2FsbEhpZGRlbkJyaWRnZShcInVzZXNPd2xBcHBTaGVsbFwiLCBbXSksXG4gIF0pO1xuICBpZiAob3B0aW9ucy5oaWRlTWFpbldpbmRvdykgaGlkZVZpc2libGVDb2RleFdpbmRvd3MoKTtcbiAgcmV0dXJuIHtcbiAgICBzbmFwc2hvdDogYXNQbGFpbk9iamVjdChzbmFwc2hvdCksXG4gICAgc3lzdGVtVGhlbWVWYXJpYW50OiB0eXBlb2Ygc3lzdGVtVGhlbWVWYXJpYW50ID09PSBcInN0cmluZ1wiID8gc3lzdGVtVGhlbWVWYXJpYW50IDogY3VycmVudFN5c3RlbVRoZW1lVmFyaWFudCgpLFxuICAgIHNlbnRyeUluaXRPcHRpb25zLFxuICAgIGJ1aWxkRmxhdm9yLFxuICAgIHVzZXNPd2xBcHBTaGVsbDogdXNlc093bEFwcFNoZWxsID09PSB0cnVlLFxuICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgIGFyY2g6IHByb2Nlc3MuYXJjaCxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlQnJvd3NlclVpSG9zdCgpOiBQcm9taXNlPEJyb3dzZXJVaUhvc3Q+IHtcbiAgaWYgKGFjdGl2ZUhvc3QgJiYgIWFjdGl2ZUhvc3Qud2ViQ29udGVudHMuaXNEZXN0cm95ZWQoKSkgcmV0dXJuIGFjdGl2ZUhvc3Q7XG4gIGNvbnN0IG9wdGlvbnMgPSByZXF1aXJlT3B0aW9ucygpO1xuICBjb25zdCBzZXJ2aWNlcyA9IGF3YWl0IHdhaXRGb3JXaW5kb3dTZXJ2aWNlcyhvcHRpb25zKTtcbiAgY29uc3Qgd2luZG93TWFuYWdlciA9IHNlcnZpY2VzLndpbmRvd01hbmFnZXI7XG4gIGlmICghd2luZG93TWFuYWdlcj8ucmVnaXN0ZXJXaW5kb3cpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2RleCB3aW5kb3cgcmVnaXN0cmF0aW9uIHNlcnZpY2VzIGFyZSB1bmF2YWlsYWJsZVwiKTtcbiAgfVxuXG4gIGNvbnN0IHZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICBwcmVsb2FkOiB3aW5kb3dNYW5hZ2VyLm9wdGlvbnM/LnByZWxvYWRQYXRoLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgIG5vZGVJbnRlZ3JhdGlvbjogZmFsc2UsXG4gICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgIGRldlRvb2xzOiB3aW5kb3dNYW5hZ2VyLm9wdGlvbnM/LmFsbG93RGV2dG9vbHMsXG4gICAgfSxcbiAgfSk7XG4gIGNvbnN0IHdpbmRvd0xpa2UgPSBtYWtlV2luZG93TGlrZUZvclZpZXcodmlldyk7XG4gIHdpbmRvd01hbmFnZXIucmVnaXN0ZXJXaW5kb3cod2luZG93TGlrZSwgXCJsb2NhbFwiLCBmYWxzZSwgXCJzZWNvbmRhcnlcIik7XG4gIGNvbnN0IGNvbnRleHQgPSBzZXJ2aWNlcy5nZXRDb250ZXh0Rm9yV2ViQ29udGVudHM/Lih2aWV3LndlYkNvbnRlbnRzKSA/PyBzZXJ2aWNlcy5nZXRDb250ZXh0Py4oXCJsb2NhbFwiKTtcbiAgY29udGV4dD8ucmVnaXN0ZXJXaW5kb3c/Lih3aW5kb3dMaWtlKTtcbiAgYXdhaXQgdmlldy53ZWJDb250ZW50cy5sb2FkVVJMKFwiYWJvdXQ6YmxhbmtcIik7XG4gIGFjdGl2ZUhvc3QgPSB7IHZpZXcsIHdlYkNvbnRlbnRzOiB2aWV3LndlYkNvbnRlbnRzIH07XG4gIHZpZXcud2ViQ29udGVudHMub25jZShcImRlc3Ryb3llZFwiLCAoKSA9PiB7XG4gICAgaWYgKGFjdGl2ZUhvc3Q/LndlYkNvbnRlbnRzID09PSB2aWV3LndlYkNvbnRlbnRzKSBhY3RpdmVIb3N0ID0gbnVsbDtcbiAgfSk7XG4gIG9wdGlvbnMubG9nKFwiaW5mb1wiLCBcImJyb3dzZXIgVUkgaGlkZGVuIGhvc3QgcmVhZHlcIiwgeyB3ZWJDb250ZW50c0lkOiB2aWV3LndlYkNvbnRlbnRzLmlkIH0pO1xuICByZXR1cm4gYWN0aXZlSG9zdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd2FpdEZvcldpbmRvd1NlcnZpY2VzKG9wdGlvbnM6IEJyb3dzZXJVaVNlcnZlck9wdGlvbnMpOiBQcm9taXNlPENvZGV4V2luZG93U2VydmljZXM+IHtcbiAgY29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XG4gIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnRlZCA8IDMwXzAwMCkge1xuICAgIGNvbnN0IHNlcnZpY2VzID0gb3B0aW9ucy5nZXRXaW5kb3dTZXJ2aWNlcygpO1xuICAgIGlmIChcbiAgICAgIHNlcnZpY2VzPy53aW5kb3dNYW5hZ2VyPy5yZWdpc3RlcldpbmRvdyAmJlxuICAgICAgKHNlcnZpY2VzLmdldENvbnRleHQgfHwgc2VydmljZXMuZ2V0Q29udGV4dEZvcldlYkNvbnRlbnRzKVxuICAgICkge1xuICAgICAgcmV0dXJuIHNlcnZpY2VzO1xuICAgIH1cbiAgICBhd2FpdCBkZWxheSgxMDApO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlRpbWVkIG91dCB3YWl0aW5nIGZvciBDb2RleCB3aW5kb3cgc2VydmljZXNcIik7XG59XG5cbmZ1bmN0aW9uIGNhbGxIaWRkZW5CcmlkZ2UobWV0aG9kOiBzdHJpbmcsIGFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8dW5rbm93bj4ge1xuICBhc3NlcnRCcmlkZ2VNZXRob2QobWV0aG9kKTtcbiAgcmV0dXJuIGVuc3VyZUJyb3dzZXJVaUhvc3QoKS50aGVuKChob3N0KSA9PiB7XG4gICAgY29uc3QgaWQgPSByYW5kb21VVUlEKCk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGJyaWRnZVJlcXVlc3RzLmRlbGV0ZShpZCk7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFRpbWVkIG91dCB3YWl0aW5nIGZvciBicm93c2VyIFVJIGJyaWRnZSBtZXRob2Q6ICR7bWV0aG9kfWApKTtcbiAgICAgIH0sIDE1XzAwMCk7XG4gICAgICBicmlkZ2VSZXF1ZXN0cy5zZXQoaWQsIHsgcmVzb2x2ZSwgcmVqZWN0LCB0aW1lciB9KTtcbiAgICAgIGhvc3Qud2ViQ29udGVudHMuc2VuZChCUklER0VfUkVRVUVTVF9DSEFOTkVMLCB7IGlkLCBtZXRob2QsIGFyZ3MgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBicmlkZ2VNZXNzYWdlUG9ydFRvV2ViU29ja2V0KHBvcnQ6IEVsZWN0cm9uLk1lc3NhZ2VQb3J0TWFpbiwgd3M6IFdlYlNvY2tldENvbm5lY3Rpb24pOiB2b2lkIHtcbiAgbGV0IGNsb3NlZCA9IGZhbHNlO1xuICBjb25zdCBjbG9zZSA9ICgpID0+IHtcbiAgICBpZiAoY2xvc2VkKSByZXR1cm47XG4gICAgY2xvc2VkID0gdHJ1ZTtcbiAgICB0cnkge1xuICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICB9IGNhdGNoIHt9XG4gICAgdHJ5IHtcbiAgICAgIHBvcnQuY2xvc2UoKTtcbiAgICB9IGNhdGNoIHt9XG4gICAgd3MuY2xvc2UoKTtcbiAgfTtcbiAgcG9ydC5zdGFydCgpO1xuICBwb3J0Lm9uKFwibWVzc2FnZVwiLCAoZXZlbnQpID0+IHtcbiAgICBpZiAoY2xvc2VkKSByZXR1cm47XG4gICAgaWYgKGV2ZW50LmRhdGEgPT0gbnVsbCkge1xuICAgICAgY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5kYXRhID09PSBcInN0cmluZ1wiKSB7XG4gICAgICB3cy5zZW5kVGV4dChldmVudC5kYXRhKTtcbiAgICB9XG4gIH0pO1xuICBwb3J0Lm9uKFwiY2xvc2VcIiwgY2xvc2UpO1xuICB3cy5vblRleHQoKHRleHQpID0+IHtcbiAgICBpZiAoY2xvc2VkKSByZXR1cm47XG4gICAgcG9ydC5wb3N0TWVzc2FnZSh0ZXh0KTtcbiAgfSk7XG4gIHdzLm9uQ2xvc2UoY2xvc2UpO1xufVxuXG5mdW5jdGlvbiBicm9hZGNhc3RDb250cm9sKHBheWxvYWQ6IHVua25vd24pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBjbGllbnQgb2YgWy4uLmNvbnRyb2xDbGllbnRzXSkge1xuICAgIHRyeSB7XG4gICAgICBjbGllbnQuc2VuZEpzb24ocGF5bG9hZCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjbGllbnQuY2xvc2UoKTtcbiAgICAgIGNvbnRyb2xDbGllbnRzLmRlbGV0ZShjbGllbnQpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBicm93c2VyQnJpZGdlU2NyaXB0KHN0YXRlOiBJbml0aWFsU3RhdGUpOiBzdHJpbmcge1xuICByZXR1cm4gYFxuKCgpID0+IHtcbiAgY29uc3QgaW5pdGlhbFN0YXRlID0gJHtzYWZlSnNvbihzdGF0ZSl9O1xuICBjb25zdCBzbmFwc2hvdCA9IG5ldyBNYXAoT2JqZWN0LmVudHJpZXMoaW5pdGlhbFN0YXRlLnNuYXBzaG90IHx8IHt9KSk7XG4gIGNvbnN0IHdvcmtlclN1YnNjcmliZXJzID0gbmV3IE1hcCgpO1xuICBjb25zdCB0aGVtZVN1YnNjcmliZXJzID0gbmV3IFNldCgpO1xuICBjb25zdCBicm93c2VyU2lkZWJhclNuYXBzaG90cyA9IG5ldyBNYXAoKTtcbiAgY29uc3QgYnJvd3NlclNpZGViYXJTZWVkZWRMb2NhbFNlcnZlcnMgPSBuZXcgU2V0KCk7XG4gIGxldCBzeXN0ZW1UaGVtZVZhcmlhbnQgPSBpbml0aWFsU3RhdGUuc3lzdGVtVGhlbWVWYXJpYW50IHx8IFwibGlnaHRcIjtcblxuICB3aW5kb3cuX19jb2RleHBwQnJvd3NlclVpID0gdHJ1ZTtcbiAgaW5zdGFsbEJyb3dzZXJVaVdlYnZpZXdTaGltKCk7XG5cbiAgY29uc3QgY29udHJvbCA9IG5ldyBXZWJTb2NrZXQobmV3IFVSTChcIi9jb2RleHBwL2Jyb3dzZXItdWkvY29udHJvbFwiLCBsb2NhdGlvbi5ocmVmKSk7XG4gIGNvbnRyb2wuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgKGV2ZW50KSA9PiB7XG4gICAgbGV0IHBheWxvYWQ7XG4gICAgdHJ5IHsgcGF5bG9hZCA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgICBpZiAocGF5bG9hZC50eXBlID09PSBcIm1lc3NhZ2UtZm9yLXZpZXdcIikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHBheWxvYWQubWVzc2FnZTtcbiAgICAgIGlmIChtZXNzYWdlICYmIG1lc3NhZ2UudHlwZSA9PT0gXCJzaGFyZWQtb2JqZWN0LXVwZGF0ZWRcIikge1xuICAgICAgICBpZiAobWVzc2FnZS52YWx1ZSA9PT0gdW5kZWZpbmVkKSBzbmFwc2hvdC5kZWxldGUobWVzc2FnZS5rZXkpO1xuICAgICAgICBlbHNlIHNuYXBzaG90LnNldChtZXNzYWdlLmtleSwgbWVzc2FnZS52YWx1ZSk7XG4gICAgICB9XG4gICAgICByZW1lbWJlckJyb3dzZXJTaWRlYmFySG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgTWVzc2FnZUV2ZW50KFwibWVzc2FnZVwiLCB7IGRhdGE6IG1lc3NhZ2UgfSkpO1xuICAgIH0gZWxzZSBpZiAocGF5bG9hZC50eXBlID09PSBcIndvcmtlci1tZXNzYWdlXCIpIHtcbiAgICAgIGNvbnN0IHN1YnMgPSB3b3JrZXJTdWJzY3JpYmVycy5nZXQocGF5bG9hZC53b3JrZXJJZCk7XG4gICAgICBpZiAoc3VicykgZm9yIChjb25zdCBmbiBvZiBbLi4uc3Vic10pIGZuKHBheWxvYWQubWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmIChwYXlsb2FkLnR5cGUgPT09IFwic3lzdGVtLXRoZW1lLXZhcmlhbnQtdXBkYXRlZFwiKSB7XG4gICAgICBzeXN0ZW1UaGVtZVZhcmlhbnQgPSBwYXlsb2FkLnZhbHVlO1xuICAgICAgZm9yIChjb25zdCBmbiBvZiBbLi4udGhlbWVTdWJzY3JpYmVyc10pIGZuKCk7XG4gICAgfVxuICB9KTtcblxuICBhc3luYyBmdW5jdGlvbiBicmlkZ2UobWV0aG9kLCBhcmdzID0gW10pIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChcIi9jb2RleHBwL2Jyb3dzZXItdWkvYnJpZGdlXCIsIHtcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1ldGhvZCwgYXJncyB9KSxcbiAgICB9KTtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICBpZiAoIWJvZHkub2spIHRocm93IG5ldyBFcnJvcihib2R5LmVycm9yIHx8IFwiQ2hhdEdQVCsrIGJyb3dzZXIgYnJpZGdlIGZhaWxlZFwiKTtcbiAgICByZXR1cm4gYm9keS52YWx1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxlZ2FjeUJyb3dzZXJUYWJJZChjb252ZXJzYXRpb25JZCkge1xuICAgIHJldHVybiBTdHJpbmcoY29udmVyc2F0aW9uSWQgfHwgXCJuZXctY29udmVyc2F0aW9uXCIpICsgXCI6bGVnYWN5XCI7XG4gIH1cblxuICBmdW5jdGlvbiBicm93c2VyU2lkZWJhcktleShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKSB7XG4gICAgcmV0dXJuIFN0cmluZyhjb252ZXJzYXRpb25JZCB8fCBcIm5ldy1jb252ZXJzYXRpb25cIikgKyBcIjo6XCIgKyBTdHJpbmcoYnJvd3NlclRhYklkIHx8IGxlZ2FjeUJyb3dzZXJUYWJJZChjb252ZXJzYXRpb25JZCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplQnJvd3NlclVybCh2YWx1ZSkge1xuICAgIGNvbnN0IHJhdyA9IFN0cmluZyh2YWx1ZSB8fCBcIlwiKS50cmltKCk7XG4gICAgaWYgKCFyYXcpIHJldHVybiBcIlwiO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gbmV3IFVSTChyYXcpLmhyZWY7XG4gICAgfSBjYXRjaCB7fVxuICAgIGlmICgvXlthLXpBLVpdW2EtekEtWjAtOSsuLV0qOi8udGVzdChyYXcpKSByZXR1cm4gcmF3O1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gbmV3IFVSTChcImh0dHBzOi8vXCIgKyByYXcpLmhyZWY7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gcmF3O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJyb3dzZXJUaXRsZUZvclVybCh1cmwpIHtcbiAgICBpZiAoIXVybCkgcmV0dXJuIFwiTmV3IHRhYlwiO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBob3N0ID0gbmV3IFVSTCh1cmwpLmhvc3RuYW1lLnJlcGxhY2UoL153d3dcXFxcLi8sIFwiXCIpO1xuICAgICAgcmV0dXJuIGhvc3QgfHwgdXJsO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlQnJvd3NlclNpZGViYXJTbmFwc2hvdCh1cmwsIHBhdGNoID0ge30pIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplQnJvd3NlclVybCh1cmwpO1xuICAgIHJldHVybiB7XG4gICAgICB0YWJUeXBlOiBub3JtYWxpemVkID8gXCJ3ZWJcIiA6IFwibmV3LXRhYi1wYWdlXCIsXG4gICAgICBpc1N1c3BlbmRlZDogZmFsc2UsXG4gICAgICB0aXRsZTogbm9ybWFsaXplZCA/IGJyb3dzZXJUaXRsZUZvclVybChub3JtYWxpemVkKSA6IFwiTmV3IHRhYlwiLFxuICAgICAgdXJsOiBub3JtYWxpemVkLFxuICAgICAgZmF2aWNvblVybDogbnVsbCxcbiAgICAgIGlzTG9hZGluZzogZmFsc2UsXG4gICAgICBjYW5Hb0JhY2s6IGZhbHNlLFxuICAgICAgY2FuR29Gb3J3YXJkOiBmYWxzZSxcbiAgICAgIHpvb21QZXJjZW50OiAxMDAsXG4gICAgICBjb21tZW50TW9kZURpc2FibGVkUmVhc29uOiBudWxsLFxuICAgICAgaW50ZXJhY3Rpb25Nb2RlOiBcImJyb3dzZVwiLFxuICAgICAgYW5ub3RhdGlvbkVkaXRvck1vZGU6IFwiY29tbWVudFwiLFxuICAgICAgaXNBbm5vdGF0aW9uQWRkTW9kaWZpZXJQcmVzc2VkOiBmYWxzZSxcbiAgICAgIGlzT3JpZ2luYWxWaWV3RW5hYmxlZDogZmFsc2UsXG4gICAgICBpc1R3ZWFrc0VkaXRvck9wZW46IGZhbHNlLFxuICAgICAgY29tbWVudHM6IFtdLFxuICAgICAgLi4ucGF0Y2gsXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc3BhdGNoQnJvd3NlclNpZGViYXJNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgTWVzc2FnZUV2ZW50KFwibWVzc2FnZVwiLCB7IGRhdGE6IG1lc3NhZ2UgfSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VlZEJyb3dzZXJTaWRlYmFyTG9jYWxTZXJ2ZXJzKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBicm93c2VyU2lkZWJhclNlZWRlZExvY2FsU2VydmVycy5oYXMoY29udmVyc2F0aW9uSWQpKSByZXR1cm47XG4gICAgYnJvd3NlclNpZGViYXJTZWVkZWRMb2NhbFNlcnZlcnMuYWRkKGNvbnZlcnNhdGlvbklkKTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBkaXNwYXRjaEJyb3dzZXJTaWRlYmFyTWVzc2FnZSh7XG4gICAgICAgIHR5cGU6IFwiYnJvd3Nlci1zaWRlYmFyLWxvY2FsLXNlcnZlcnNcIixcbiAgICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICAgIHN0YXRlOiB7IGlzTG9hZGluZzogZmFsc2UsIHNlcnZlcnM6IFtdLCBoaWRkZW5TZXJ2ZXJzOiBbXSB9LFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1lbWJlckJyb3dzZXJTaWRlYmFySG9zdE1lc3NhZ2UobWVzc2FnZSkge1xuICAgIGlmICghbWVzc2FnZSB8fCB0eXBlb2YgbWVzc2FnZSAhPT0gXCJvYmplY3RcIikgcmV0dXJuO1xuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09IFwiYnJvd3Nlci1zaWRlYmFyLXN0YXRlXCIpIHtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jb252ZXJzYXRpb25JZDtcbiAgICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgIW1lc3NhZ2Uuc25hcHNob3QpIHJldHVybjtcbiAgICAgIGJyb3dzZXJTaWRlYmFyU25hcHNob3RzLnNldChicm93c2VyU2lkZWJhcktleShjb252ZXJzYXRpb25JZCwgbWVzc2FnZS5icm93c2VyVGFiSWQpLCBtZXNzYWdlLnNuYXBzaG90KTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PT0gXCJicm93c2VyLXNpZGViYXItbG9jYWwtc2VydmVyc1wiKSB7XG4gICAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb25JZCkgYnJvd3NlclNpZGViYXJTZWVkZWRMb2NhbFNlcnZlcnMuYWRkKG1lc3NhZ2UuY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbmRCcm93c2VyU2lkZWJhclNuYXBzaG90KGNvbnZlcnNhdGlvbklkLCBicm93c2VyVGFiSWQsIHNuYXBzaG90UGF0Y2gpIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XG4gICAgY29uc3Qga2V5ID0gYnJvd3NlclNpZGViYXJLZXkoY29udmVyc2F0aW9uSWQsIGJyb3dzZXJUYWJJZCk7XG4gICAgY29uc3QgcHJldmlvdXMgPSBicm93c2VyU2lkZWJhclNuYXBzaG90cy5nZXQoa2V5KSB8fCBtYWtlQnJvd3NlclNpZGViYXJTbmFwc2hvdChcIlwiKTtcbiAgICBjb25zdCBuZXh0ID0geyAuLi5wcmV2aW91cywgLi4uc25hcHNob3RQYXRjaCB9O1xuICAgIGJyb3dzZXJTaWRlYmFyU25hcHNob3RzLnNldChrZXksIG5leHQpO1xuICAgIGRpc3BhdGNoQnJvd3NlclNpZGViYXJNZXNzYWdlKHtcbiAgICAgIHR5cGU6IFwiYnJvd3Nlci1zaWRlYmFyLXN0YXRlXCIsXG4gICAgICBjb252ZXJzYXRpb25JZCxcbiAgICAgIC4uLihicm93c2VyVGFiSWQgPyB7IGJyb3dzZXJUYWJJZCB9IDoge30pLFxuICAgICAgc25hcHNob3Q6IG5leHQsXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRCcm93c2VyU2lkZWJhclVybChjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkLCB1cmwsIGlzTG9hZGluZyA9IGZhbHNlKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZUJyb3dzZXJVcmwodXJsKTtcbiAgICBzZW5kQnJvd3NlclNpZGViYXJTbmFwc2hvdChjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkLCBtYWtlQnJvd3NlclNpZGViYXJTbmFwc2hvdChub3JtYWxpemVkLCB7IGlzTG9hZGluZyB9KSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kQnJvd3NlclNpZGViYXJGcmFtZShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKSB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBcIltkYXRhLWJyb3dzZXItc2lkZWJhci1jb252ZXJzYXRpb24taWQ9J1wiICsgY3NzRXNjYXBlKGNvbnZlcnNhdGlvbklkKSArIFwiJ11bZGF0YS1icm93c2VyLXNpZGViYXItYnJvd3Nlci10YWItaWQ9J1wiICsgY3NzRXNjYXBlKGJyb3dzZXJUYWJJZCB8fCBsZWdhY3lCcm93c2VyVGFiSWQoY29udmVyc2F0aW9uSWQpKSArIFwiJ11cIjtcbiAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIH1cblxuICBmdW5jdGlvbiBjc3NFc2NhcGUodmFsdWUpIHtcbiAgICBpZiAod2luZG93LkNTUyAmJiB0eXBlb2Ygd2luZG93LkNTUy5lc2NhcGUgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHdpbmRvdy5DU1MuZXNjYXBlKFN0cmluZyh2YWx1ZSkpO1xuICAgIHJldHVybiBTdHJpbmcodmFsdWUpLnJlcGxhY2UoL1snXFxcXFxcXFxdL2csIFwiXFxcXFxcXFwkJlwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZUJyb3dzZXJTaWRlYmFyVmlld01lc3NhZ2UobWVzc2FnZSkge1xuICAgIGlmICghbWVzc2FnZSB8fCB0eXBlb2YgbWVzc2FnZSAhPT0gXCJvYmplY3RcIikgcmV0dXJuO1xuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09IFwiYnJvd3Nlci1zaWRlYmFyLXN5bmNcIikge1xuICAgICAgY29uc3QgcGF5bG9hZCA9IG1lc3NhZ2UucGF5bG9hZCB8fCB7fTtcbiAgICAgIHNlZWRCcm93c2VyU2lkZWJhckxvY2FsU2VydmVycyhwYXlsb2FkLmNvbnZlcnNhdGlvbklkKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gXCJicm93c2VyLXNpZGViYXItb3duZXItc3luY1wiKSB7XG4gICAgICBzZWVkQnJvd3NlclNpZGViYXJMb2NhbFNlcnZlcnMobWVzc2FnZS5jb252ZXJzYXRpb25JZCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtZXNzYWdlLnR5cGUgIT09IFwiYnJvd3Nlci1zaWRlYmFyLWNvbW1hbmRcIikgcmV0dXJuO1xuXG4gICAgY29uc3QgY29udmVyc2F0aW9uSWQgPSBtZXNzYWdlLmNvbnZlcnNhdGlvbklkO1xuICAgIGNvbnN0IGJyb3dzZXJUYWJJZCA9IG1lc3NhZ2UuYnJvd3NlclRhYklkO1xuICAgIGNvbnN0IGNvbW1hbmQgPSBtZXNzYWdlLmNvbW1hbmQgfHwge307XG4gICAgc2VlZEJyb3dzZXJTaWRlYmFyTG9jYWxTZXJ2ZXJzKGNvbnZlcnNhdGlvbklkKTtcblxuICAgIGlmIChjb21tYW5kLnR5cGUgPT09IFwibmF2aWdhdGVcIikge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZUJyb3dzZXJVcmwoY29tbWFuZC51cmwpO1xuICAgICAgc2V0QnJvd3NlclNpZGViYXJVcmwoY29udmVyc2F0aW9uSWQsIGJyb3dzZXJUYWJJZCwgbm9ybWFsaXplZCwgdHJ1ZSk7XG4gICAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICAgIGNvbnN0IGZyYW1lID0gZmluZEJyb3dzZXJTaWRlYmFyRnJhbWUoY29udmVyc2F0aW9uSWQsIGJyb3dzZXJUYWJJZCk7XG4gICAgICAgIGlmICghZnJhbWUgfHwgIW5vcm1hbGl6ZWQgfHwgZnJhbWUuZ2V0VVJMPy4oKSA9PT0gbm9ybWFsaXplZCkgcmV0dXJuO1xuICAgICAgICBmcmFtZS5sb2FkVVJMPy4obm9ybWFsaXplZCk7XG4gICAgICB9KTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHNldEJyb3dzZXJTaWRlYmFyVXJsKGNvbnZlcnNhdGlvbklkLCBicm93c2VyVGFiSWQsIG5vcm1hbGl6ZWQsIGZhbHNlKSwgNTAwKTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQudHlwZSA9PT0gXCJyZWxvYWRcIikge1xuICAgICAgY29uc3QgZnJhbWUgPSBmaW5kQnJvd3NlclNpZGViYXJGcmFtZShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKTtcbiAgICAgIGZyYW1lPy5yZWxvYWQ/LigpO1xuICAgICAgY29uc3QgY3VycmVudCA9IGJyb3dzZXJTaWRlYmFyU25hcHNob3RzLmdldChicm93c2VyU2lkZWJhcktleShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKSk7XG4gICAgICBpZiAoY3VycmVudD8udXJsKSB7XG4gICAgICAgIHNlbmRCcm93c2VyU2lkZWJhclNuYXBzaG90KGNvbnZlcnNhdGlvbklkLCBicm93c2VyVGFiSWQsIHsgLi4uY3VycmVudCwgaXNMb2FkaW5nOiB0cnVlIH0pO1xuICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBzZW5kQnJvd3NlclNpZGViYXJTbmFwc2hvdChjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkLCB7IC4uLmN1cnJlbnQsIGlzTG9hZGluZzogZmFsc2UgfSksIDI1MCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjb21tYW5kLnR5cGUgPT09IFwiZ28tYmFja1wiKSB7XG4gICAgICBmaW5kQnJvd3NlclNpZGViYXJGcmFtZShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKT8uZ29CYWNrPy4oKTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQudHlwZSA9PT0gXCJnby1mb3J3YXJkXCIpIHtcbiAgICAgIGZpbmRCcm93c2VyU2lkZWJhckZyYW1lKGNvbnZlcnNhdGlvbklkLCBicm93c2VyVGFiSWQpPy5nb0ZvcndhcmQ/LigpO1xuICAgIH0gZWxzZSBpZiAoY29tbWFuZC50eXBlID09PSBcInN0b3BcIikge1xuICAgICAgY29uc3QgY3VycmVudCA9IGJyb3dzZXJTaWRlYmFyU25hcHNob3RzLmdldChicm93c2VyU2lkZWJhcktleShjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkKSk7XG4gICAgICBpZiAoY3VycmVudCkgc2VuZEJyb3dzZXJTaWRlYmFyU25hcHNob3QoY29udmVyc2F0aW9uSWQsIGJyb3dzZXJUYWJJZCwgeyAuLi5jdXJyZW50LCBpc0xvYWRpbmc6IGZhbHNlIH0pO1xuICAgIH0gZWxzZSBpZiAoY29tbWFuZC50eXBlID09PSBcInJlc2V0XCIgfHwgY29tbWFuZC50eXBlID09PSBcImNsb3NlLXRhYlwiKSB7XG4gICAgICBzZW5kQnJvd3NlclNpZGViYXJTbmFwc2hvdChjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkLCBtYWtlQnJvd3NlclNpZGViYXJTbmFwc2hvdChcIlwiKSk7XG4gICAgfVxuICB9XG5cbiAgd2luZG93LmNvZGV4V2luZG93VHlwZSA9IFwiZWxlY3Ryb25cIjtcbiAgd2luZG93LmVsZWN0cm9uQnJpZGdlID0ge1xuICAgIHdpbmRvd1R5cGU6IFwiZWxlY3Ryb25cIixcbiAgICBzZW5kTWVzc2FnZUZyb21WaWV3OiAobWVzc2FnZSkgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2UgJiYgbWVzc2FnZS50eXBlID09PSBcInNoYXJlZC1vYmplY3Qtc2V0XCIpIHNuYXBzaG90LnNldChtZXNzYWdlLmtleSwgbWVzc2FnZS52YWx1ZSk7XG4gICAgICBoYW5kbGVCcm93c2VyU2lkZWJhclZpZXdNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuIGJyaWRnZShcInNlbmRNZXNzYWdlRnJvbVZpZXdcIiwgW21lc3NhZ2VdKTtcbiAgICB9LFxuICAgIGdldFBhdGhGb3JGaWxlOiAoKSA9PiBudWxsLFxuICAgIHNlbmRXb3JrZXJNZXNzYWdlRnJvbVZpZXc6ICh3b3JrZXJJZCwgbWVzc2FnZSkgPT4gYnJpZGdlKFwic2VuZFdvcmtlck1lc3NhZ2VGcm9tVmlld1wiLCBbd29ya2VySWQsIG1lc3NhZ2VdKSxcbiAgICBzdWJzY3JpYmVUb1dvcmtlck1lc3NhZ2VzOiAod29ya2VySWQsIGhhbmRsZXIpID0+IHtcbiAgICAgIGxldCBzdWJzID0gd29ya2VyU3Vic2NyaWJlcnMuZ2V0KHdvcmtlcklkKTtcbiAgICAgIGlmICghc3Vicykge1xuICAgICAgICBzdWJzID0gbmV3IFNldCgpO1xuICAgICAgICB3b3JrZXJTdWJzY3JpYmVycy5zZXQod29ya2VySWQsIHN1YnMpO1xuICAgICAgICBicmlkZ2UoXCJzdWJzY3JpYmVXb3JrZXJNZXNzYWdlc1wiLCBbd29ya2VySWRdKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHN1YnMuYWRkKGhhbmRsZXIpO1xuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IHdvcmtlclN1YnNjcmliZXJzLmdldCh3b3JrZXJJZCk7XG4gICAgICAgIGlmICghY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBjdXJyZW50LmRlbGV0ZShoYW5kbGVyKTtcbiAgICAgICAgaWYgKGN1cnJlbnQuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgIHdvcmtlclN1YnNjcmliZXJzLmRlbGV0ZSh3b3JrZXJJZCk7XG4gICAgICAgICAgYnJpZGdlKFwidW5zdWJzY3JpYmVXb3JrZXJNZXNzYWdlc1wiLCBbd29ya2VySWRdKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9LFxuICAgIHNob3dDb250ZXh0TWVudTogKGl0ZW1zKSA9PiBicmlkZ2UoXCJzaG93Q29udGV4dE1lbnVcIiwgW2l0ZW1zXSksXG4gICAgc2hvd0FwcGxpY2F0aW9uTWVudTogKG1lbnVJZCwgeCwgeSkgPT4gYnJpZGdlKFwic2hvd0FwcGxpY2F0aW9uTWVudVwiLCBbbWVudUlkLCB4LCB5XSksXG4gICAgZ2V0RmFzdE1vZGVSb2xsb3V0TWV0cmljczogKHBhcmFtcykgPT4gYnJpZGdlKFwiZ2V0RmFzdE1vZGVSb2xsb3V0TWV0cmljc1wiLCBbcGFyYW1zXSksXG4gICAgZ2V0U2hhcmVkT2JqZWN0U25hcHNob3RWYWx1ZTogKGtleSkgPT4gc25hcHNob3QuZ2V0KGtleSksXG4gICAgZ2V0U3lzdGVtVGhlbWVWYXJpYW50OiAoKSA9PiBzeXN0ZW1UaGVtZVZhcmlhbnQsXG4gICAgc3Vic2NyaWJlVG9TeXN0ZW1UaGVtZVZhcmlhbnQ6IChoYW5kbGVyKSA9PiB7XG4gICAgICB0aGVtZVN1YnNjcmliZXJzLmFkZChoYW5kbGVyKTtcbiAgICAgIHJldHVybiAoKSA9PiB0aGVtZVN1YnNjcmliZXJzLmRlbGV0ZShoYW5kbGVyKTtcbiAgICB9LFxuICAgIHRyaWdnZXJTZW50cnlUZXN0RXJyb3I6ICgpID0+IGJyaWRnZShcInRyaWdnZXJTZW50cnlUZXN0RXJyb3JcIiwgW10pLFxuICAgIGdldFNlbnRyeUluaXRPcHRpb25zOiAoKSA9PiBudWxsLFxuICAgIGdldEFwcFNlc3Npb25JZDogKCkgPT4gbnVsbCxcbiAgICBnZXRCdWlsZEZsYXZvcjogKCkgPT4gaW5pdGlhbFN0YXRlLmJ1aWxkRmxhdm9yLFxuICAgIGlzSW50ZWxNYWNCdWlsZDogKCkgPT4gaW5pdGlhbFN0YXRlLnBsYXRmb3JtID09PSBcImRhcndpblwiICYmIGluaXRpYWxTdGF0ZS5hcmNoID09PSBcIng2NFwiLFxuICAgIHVzZXNPd2xBcHBTaGVsbDogKCkgPT4gaW5pdGlhbFN0YXRlLnVzZXNPd2xBcHBTaGVsbCxcbiAgfTtcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGV2ZW50LnNvdXJjZSAhPT0gd2luZG93IHx8ICFldmVudC5kYXRhIHx8IGV2ZW50LmRhdGEudHlwZSAhPT0gXCJjb25uZWN0LWFwcC1ob3N0XCIpIHJldHVybjtcbiAgICBjb25zdCBwb3J0ID0gZXZlbnQuZGF0YS5wb3J0O1xuICAgIGlmICghcG9ydCkgcmV0dXJuO1xuICAgIGNvbnN0IHdzID0gbmV3IFdlYlNvY2tldChuZXcgVVJMKFwiL2NvZGV4cHAvYnJvd3Nlci11aS9ycGNcIiwgbG9jYXRpb24uaHJlZikpO1xuICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChtZXNzYWdlKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG1lc3NhZ2UuZGF0YSkpO1xuICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJjbG9zZVwiLCAoKSA9PiB7XG4gICAgICB0cnkgeyBwb3J0LnBvc3RNZXNzYWdlKG51bGwpOyB9IGNhdGNoIHt9XG4gICAgICB0cnkgeyBwb3J0LmNsb3NlKCk7IH0gY2F0Y2gge31cbiAgICB9KTtcbiAgICB3cy5hZGRFdmVudExpc3RlbmVyKFwib3BlblwiLCAoKSA9PiB7XG4gICAgICBwb3J0Lm9ubWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICAgIGlmIChtZXNzYWdlLmRhdGEgPT0gbnVsbCkge1xuICAgICAgICAgIHdzLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdzLnNlbmQobWVzc2FnZS5kYXRhKTtcbiAgICAgIH07XG4gICAgICBwb3J0LnN0YXJ0ICYmIHBvcnQuc3RhcnQoKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaW5zdGFsbEJyb3dzZXJVaVdlYnZpZXdTaGltKCkge1xuICAgIGlmICh3aW5kb3cuX19jb2RleHBwV2Vidmlld1NoaW1JbnN0YWxsZWQpIHJldHVybjtcbiAgICB3aW5kb3cuX19jb2RleHBwV2Vidmlld1NoaW1JbnN0YWxsZWQgPSB0cnVlO1xuICAgIGNvbnN0IG9yaWdpbmFsQ3JlYXRlRWxlbWVudCA9IERvY3VtZW50LnByb3RvdHlwZS5jcmVhdGVFbGVtZW50O1xuICAgIERvY3VtZW50LnByb3RvdHlwZS5jcmVhdGVFbGVtZW50ID0gZnVuY3Rpb24odGFnTmFtZSwgb3B0aW9ucykge1xuICAgICAgaWYgKFN0cmluZyh0YWdOYW1lKS50b0xvd2VyQ2FzZSgpICE9PSBcIndlYnZpZXdcIikge1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxDcmVhdGVFbGVtZW50LmNhbGwodGhpcywgdGFnTmFtZSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlV2Vidmlld0lmcmFtZSh0aGlzKTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlV2Vidmlld0lmcmFtZShkb2MpIHtcbiAgICAgIGNvbnN0IGlmcmFtZSA9IG9yaWdpbmFsQ3JlYXRlRWxlbWVudC5jYWxsKGRvYywgXCJpZnJhbWVcIik7XG4gICAgICBpZnJhbWUuZGF0YXNldC5jb2RleHBwV2Vidmlld1NoaW0gPSBcInRydWVcIjtcbiAgICAgIGlmcmFtZS5zdHlsZS5ib3JkZXIgPSBcIjBcIjtcbiAgICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgaWZyYW1lLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI2ZmZlwiO1xuICAgICAgaWZyYW1lLnNldEF0dHJpYnV0ZShcImFsbG93XCIsIFwiYXV0b3BsYXk7IGNsaXBib2FyZC1yZWFkOyBjbGlwYm9hcmQtd3JpdGU7IGRpc3BsYXktY2FwdHVyZTsgZnVsbHNjcmVlbjsgbWljcm9waG9uZTsgY2FtZXJhXCIpO1xuICAgICAgY29uc3QgbmF0aXZlU2V0QXR0cmlidXRlID0gaWZyYW1lLnNldEF0dHJpYnV0ZS5iaW5kKGlmcmFtZSk7XG4gICAgICBjb25zdCBuYXRpdmVHZXRBdHRyaWJ1dGUgPSBpZnJhbWUuZ2V0QXR0cmlidXRlLmJpbmQoaWZyYW1lKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGlmcmFtZSwgXCJ0YWdOYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCBnZXQ6ICgpID0+IFwiV0VCVklFV1wiIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaWZyYW1lLCBcIm5vZGVOYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCBnZXQ6ICgpID0+IFwiV0VCVklFV1wiIH0pO1xuICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICBjb25zdCBlbWl0ID0gKHR5cGUsIGV4dHJhID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBuZXcgRXZlbnQodHlwZSk7XG4gICAgICAgIE9iamVjdC5hc3NpZ24oZXZlbnQsIGV4dHJhKTtcbiAgICAgICAgaWZyYW1lLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IGN1cnJlbnRVcmwgPSAoKSA9PiBpZnJhbWUuZGF0YXNldC5jb2RleHBwUmVxdWVzdGVkU3JjIHx8IG5hdGl2ZUdldEF0dHJpYnV0ZShcInNyY1wiKSB8fCBcImFib3V0OmJsYW5rXCI7XG4gICAgICBjb25zdCBhY3R1YWxGcmFtZVVybCA9ICh1cmwpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdGVkID0gU3RyaW5nKHVybCB8fCBcImFib3V0OmJsYW5rXCIpO1xuICAgICAgICBpZiAoIXNob3VsZEJyZWFrUmVjdXJzaXZlRnJhbWVMb2FkKHJlcXVlc3RlZCkpIHJldHVybiByZXF1ZXN0ZWQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBVUkwocmVxdWVzdGVkLCBsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgICBuZXh0LnNlYXJjaFBhcmFtcy5zZXQoXCJfX2NvZGV4cHBfZnJhbWVfZGVwdGhcIiwgU3RyaW5nKGZyYW1lQW5jZXN0b3JEZXB0aCgpICsgMSkpO1xuICAgICAgICAgIHJldHVybiBuZXh0LmhyZWY7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHJldHVybiByZXF1ZXN0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBjb25zdCBzZXRGcmFtZVVybCA9ICh1cmwpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdGVkID0gU3RyaW5nKHVybCB8fCBcImFib3V0OmJsYW5rXCIpO1xuICAgICAgICBpZnJhbWUuZGF0YXNldC5jb2RleHBwUmVxdWVzdGVkU3JjID0gcmVxdWVzdGVkO1xuICAgICAgICBuYXRpdmVTZXRBdHRyaWJ1dGUoXCJzcmNcIiwgYWN0dWFsRnJhbWVVcmwocmVxdWVzdGVkKSk7XG4gICAgICB9O1xuICAgICAgY29uc3QgbmF2aWdhdGUgPSAodXJsKSA9PiB7XG4gICAgICAgIGNvbnN0IG5leHQgPSBTdHJpbmcodXJsIHx8IFwiYWJvdXQ6YmxhbmtcIik7XG4gICAgICAgIGVtaXQoXCJkaWQtc3RhcnQtbG9hZGluZ1wiLCB7IHVybDogbmV4dCB9KTtcbiAgICAgICAgc2V0RnJhbWVVcmwobmV4dCk7XG4gICAgICB9O1xuXG4gICAgICBpZnJhbWUuc2V0QXR0cmlidXRlID0gKG5hbWUsIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmIChTdHJpbmcobmFtZSkudG9Mb3dlckNhc2UoKSA9PT0gXCJzcmNcIikge1xuICAgICAgICAgIHNldEZyYW1lVXJsKHZhbHVlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbmF0aXZlU2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICAgIH07XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpZnJhbWUsIFwic3JjXCIsIHtcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiAoKSA9PiBjdXJyZW50VXJsKCksXG4gICAgICAgICAgc2V0OiAodmFsdWUpID0+IHNldEZyYW1lVXJsKHZhbHVlKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIHt9XG5cbiAgICAgIGlmcmFtZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IGN1cnJlbnRVcmwoKTtcbiAgICAgICAgZW1pdChcImRvbS1yZWFkeVwiLCB7IHVybCB9KTtcbiAgICAgICAgZW1pdChcImRpZC1uYXZpZ2F0ZVwiLCB7IHVybCB9KTtcbiAgICAgICAgZW1pdChcImRpZC1zdG9wLWxvYWRpbmdcIiwgeyB1cmwgfSk7XG4gICAgICAgIGVtaXQoXCJkaWQtZmluaXNoLWxvYWRcIiwgeyB1cmwgfSk7XG4gICAgICAgIGxldCB0aXRsZSA9IFwiXCI7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGl0bGUgPSBpZnJhbWUuY29udGVudERvY3VtZW50Py50aXRsZSB8fCBcIlwiO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gaWZyYW1lLmdldEF0dHJpYnV0ZShcImRhdGEtYnJvd3Nlci1zaWRlYmFyLWNvbnZlcnNhdGlvbi1pZFwiKTtcbiAgICAgICAgY29uc3QgYnJvd3NlclRhYklkID0gaWZyYW1lLmdldEF0dHJpYnV0ZShcImRhdGEtYnJvd3Nlci1zaWRlYmFyLWJyb3dzZXItdGFiLWlkXCIpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgICBzZW5kQnJvd3NlclNpZGViYXJTbmFwc2hvdChjb252ZXJzYXRpb25JZCwgYnJvd3NlclRhYklkLCBtYWtlQnJvd3NlclNpZGViYXJTbmFwc2hvdCh1cmwsIHtcbiAgICAgICAgICAgIHRpdGxlOiB0aXRsZSB8fCBicm93c2VyVGl0bGVGb3JVcmwodXJsKSxcbiAgICAgICAgICAgIGlzTG9hZGluZzogZmFsc2UsXG4gICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aXRsZSkgZW1pdChcInBhZ2UtdGl0bGUtdXBkYXRlZFwiLCB7IHRpdGxlIH0pO1xuICAgICAgfSk7XG4gICAgICBpZnJhbWUuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcbiAgICAgICAgZW1pdChcImRpZC1mYWlsLWxvYWRcIiwgeyBlcnJvckNvZGU6IC0yLCBlcnJvckRlc2NyaXB0aW9uOiBcImlmcmFtZSBsb2FkIGZhaWxlZFwiLCB2YWxpZGF0ZWRVUkw6IGN1cnJlbnRVcmwoKSB9KTtcbiAgICAgICAgZW1pdChcImRpZC1zdG9wLWxvYWRpbmdcIiwgeyB1cmw6IGN1cnJlbnRVcmwoKSB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhpZnJhbWUsIHtcbiAgICAgICAgZGVzdHJveTogeyB2YWx1ZTogKCkgPT4gaWZyYW1lLnJlbW92ZSgpIH0sXG4gICAgICAgIGdldFVSTDogeyB2YWx1ZTogKCkgPT4gY3VycmVudFVybCgpIH0sXG4gICAgICAgIGdldFRpdGxlOiB7XG4gICAgICAgICAgdmFsdWU6ICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBpZnJhbWUuY29udGVudERvY3VtZW50Py50aXRsZSB8fCBcIlwiO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGxvYWRVUkw6IHsgdmFsdWU6ICh1cmwpID0+IHsgbmF2aWdhdGUodXJsKTsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpOyB9IH0sXG4gICAgICAgIHJlbG9hZDoge1xuICAgICAgICAgIHZhbHVlOiAoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBpZnJhbWUuY29udGVudFdpbmRvdz8ubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgbmF2aWdhdGUoY3VycmVudFVybCgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBzdG9wOiB7IHZhbHVlOiAoKSA9PiB7fSB9LFxuICAgICAgICBjYW5Hb0JhY2s6IHsgdmFsdWU6ICgpID0+IGZhbHNlIH0sXG4gICAgICAgIGNhbkdvRm9yd2FyZDogeyB2YWx1ZTogKCkgPT4gZmFsc2UgfSxcbiAgICAgICAgZ29CYWNrOiB7XG4gICAgICAgICAgdmFsdWU6ICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGlmcmFtZS5jb250ZW50V2luZG93Py5oaXN0b3J5LmJhY2soKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBnb0ZvcndhcmQ6IHtcbiAgICAgICAgICB2YWx1ZTogKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWZyYW1lLmNvbnRlbnRXaW5kb3c/Lmhpc3RvcnkuZm9yd2FyZCgpO1xuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGV4ZWN1dGVKYXZhU2NyaXB0OiB7XG4gICAgICAgICAgdmFsdWU6IChjb2RlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGlmcmFtZS5jb250ZW50V2luZG93Py5ldmFsKFN0cmluZyhjb2RlKSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbnNlcnRDU1M6IHsgdmFsdWU6ICgpID0+IFByb21pc2UucmVzb2x2ZShcIlwiKSB9LFxuICAgICAgICBvcGVuRGV2VG9vbHM6IHsgdmFsdWU6ICgpID0+IHt9IH0sXG4gICAgICAgIGNsb3NlRGV2VG9vbHM6IHsgdmFsdWU6ICgpID0+IHt9IH0sXG4gICAgICAgIGlzRGV2VG9vbHNPcGVuZWQ6IHsgdmFsdWU6ICgpID0+IGZhbHNlIH0sXG4gICAgICAgIHNlbmQ6IHsgdmFsdWU6ICgpID0+IHt9IH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGlmcmFtZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmcmFtZUFuY2VzdG9yRGVwdGgoKSB7XG4gICAgICBsZXQgZGVwdGggPSAwO1xuICAgICAgbGV0IGN1cnJlbnQgPSB3aW5kb3c7XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICAgICAgd2hpbGUgKGN1cnJlbnQgJiYgIXNlZW4uaGFzKGN1cnJlbnQpKSB7XG4gICAgICAgIHNlZW4uYWRkKGN1cnJlbnQpO1xuICAgICAgICBsZXQgcGFyZW50O1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHBhcmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFyZW50ID09PSBjdXJyZW50KSBicmVhaztcbiAgICAgICAgZGVwdGggKz0gMTtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZXB0aDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzaG91bGRCcmVha1JlY3Vyc2l2ZUZyYW1lTG9hZCh1cmwpIHtcbiAgICAgIGxldCB0YXJnZXQ7XG4gICAgICB0cnkge1xuICAgICAgICB0YXJnZXQgPSBuZXcgVVJMKHVybCwgbG9jYXRpb24uaHJlZikuaHJlZjtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBsZXQgY3VycmVudCA9IHdpbmRvdztcbiAgICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgICB3aGlsZSAoY3VycmVudCAmJiAhc2Vlbi5oYXMoY3VycmVudCkpIHtcbiAgICAgICAgc2Vlbi5hZGQoY3VycmVudCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKG5ldyBVUkwoY3VycmVudC5sb2NhdGlvbi5ocmVmKS5ocmVmID09PSB0YXJnZXQpIHJldHVybiB0cnVlO1xuICAgICAgICAgIGlmIChjdXJyZW50LnBhcmVudCA9PT0gY3VycmVudCkgYnJlYWs7XG4gICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn0pKCk7XG5gO1xufVxuXG5mdW5jdGlvbiBoaWRlVmlzaWJsZUNvZGV4V2luZG93cygpOiB2b2lkIHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHtcbiAgICB0cnkge1xuICAgICAgYXBwLmhpZGUoKTtcbiAgICB9IGNhdGNoIHt9XG4gIH1cbiAgZm9yIChjb25zdCB3aW4gb2YgQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkpIHtcbiAgICBpZiAod2luLmlzRGVzdHJveWVkKCkpIGNvbnRpbnVlO1xuICAgIGlmIChhY3RpdmVIb3N0ICYmIHdpbi53ZWJDb250ZW50cy5pZCA9PT0gYWN0aXZlSG9zdC53ZWJDb250ZW50cy5pZCkgY29udGludWU7XG4gICAgaWYgKCF3aW4uaXNWaXNpYmxlKCkpIGNvbnRpbnVlO1xuICAgIHRyeSB7XG4gICAgICB3aW4uaGlkZSgpO1xuICAgIH0gY2F0Y2gge31cbiAgfVxufVxuXG5mdW5jdGlvbiBtYWtlV2luZG93TGlrZUZvclZpZXcodmlldzogRWxlY3Ryb24uQnJvd3NlclZpZXcpOiBDb2RleFdpbmRvd0xpa2Uge1xuICBjb25zdCB2aWV3Qm91bmRzID0gKCkgPT4gdmlldy5nZXRCb3VuZHMoKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogdmlldy53ZWJDb250ZW50cy5pZCxcbiAgICB3ZWJDb250ZW50czogdmlldy53ZWJDb250ZW50cyxcbiAgICBvbjogKGV2ZW50OiBcImNsb3NlZFwiLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgaWYgKGV2ZW50ID09PSBcImNsb3NlZFwiKSB2aWV3LndlYkNvbnRlbnRzLm9uY2UoXCJkZXN0cm95ZWRcIiwgbGlzdGVuZXIpO1xuICAgICAgZWxzZSB2aWV3LndlYkNvbnRlbnRzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIG9uY2U6IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgdmlldy53ZWJDb250ZW50cy5vbmNlKGV2ZW50IGFzIFwiZGVzdHJveWVkXCIsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB2aWV3O1xuICAgIH0sXG4gICAgb2ZmOiAoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpID0+IHtcbiAgICAgIHZpZXcud2ViQ29udGVudHMub2ZmKGV2ZW50IGFzIFwiZGVzdHJveWVkXCIsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB2aWV3O1xuICAgIH0sXG4gICAgcmVtb3ZlTGlzdGVuZXI6IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgdmlldy53ZWJDb250ZW50cy5yZW1vdmVMaXN0ZW5lcihldmVudCBhcyBcImRlc3Ryb3llZFwiLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIGlzRGVzdHJveWVkOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmlzRGVzdHJveWVkKCksXG4gICAgaXNGb2N1c2VkOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmlzRm9jdXNlZCgpLFxuICAgIGZvY3VzOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmZvY3VzKCksXG4gICAgc2hvdzogKCkgPT4ge30sXG4gICAgaGlkZTogKCkgPT4ge30sXG4gICAgZ2V0Qm91bmRzOiB2aWV3Qm91bmRzLFxuICAgIGdldENvbnRlbnRCb3VuZHM6IHZpZXdCb3VuZHMsXG4gICAgZ2V0U2l6ZTogKCkgPT4ge1xuICAgICAgY29uc3QgYiA9IHZpZXdCb3VuZHMoKTtcbiAgICAgIHJldHVybiBbYi53aWR0aCwgYi5oZWlnaHRdO1xuICAgIH0sXG4gICAgZ2V0Q29udGVudFNpemU6ICgpID0+IHtcbiAgICAgIGNvbnN0IGIgPSB2aWV3Qm91bmRzKCk7XG4gICAgICByZXR1cm4gW2Iud2lkdGgsIGIuaGVpZ2h0XTtcbiAgICB9LFxuICAgIHNldFRpdGxlOiAoKSA9PiB7fSxcbiAgICBnZXRUaXRsZTogKCkgPT4gXCJcIixcbiAgICBzZXRSZXByZXNlbnRlZEZpbGVuYW1lOiAoKSA9PiB7fSxcbiAgICBzZXREb2N1bWVudEVkaXRlZDogKCkgPT4ge30sXG4gICAgc2V0V2luZG93QnV0dG9uVmlzaWJpbGl0eTogKCkgPT4ge30sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGFjY2VwdFdlYlNvY2tldChyZXE6IEluY29taW5nTWVzc2FnZSwgc29ja2V0OiBTb2NrZXQsIGhlYWQ6IEJ1ZmZlcik6IFdlYlNvY2tldENvbm5lY3Rpb24ge1xuICBjb25zdCBrZXkgPSByZXEuaGVhZGVyc1tcInNlYy13ZWJzb2NrZXQta2V5XCJdO1xuICBpZiAodHlwZW9mIGtleSAhPT0gXCJzdHJpbmdcIikgdGhyb3cgbmV3IEVycm9yKFwibWlzc2luZyBTZWMtV2ViU29ja2V0LUtleVwiKTtcbiAgY29uc3QgYWNjZXB0ID0gY3JlYXRlSGFzaChcInNoYTFcIilcbiAgICAudXBkYXRlKGAke2tleX0yNThFQUZBNS1FOTE0LTQ3REEtOTVDQS1DNUFCMERDODVCMTFgKVxuICAgIC5kaWdlc3QoXCJiYXNlNjRcIik7XG4gIHNvY2tldC53cml0ZShcbiAgICBbXG4gICAgICBcIkhUVFAvMS4xIDEwMSBTd2l0Y2hpbmcgUHJvdG9jb2xzXCIsXG4gICAgICBcIlVwZ3JhZGU6IHdlYnNvY2tldFwiLFxuICAgICAgXCJDb25uZWN0aW9uOiBVcGdyYWRlXCIsXG4gICAgICBgU2VjLVdlYlNvY2tldC1BY2NlcHQ6ICR7YWNjZXB0fWAsXG4gICAgICBcIlxcclxcblwiLFxuICAgIF0uam9pbihcIlxcclxcblwiKSxcbiAgKTtcbiAgY29uc3Qgd3MgPSBuZXcgV2ViU29ja2V0Q29ubmVjdGlvbihzb2NrZXQpO1xuICBpZiAoaGVhZC5sZW5ndGggPiAwKSB3cy5hY2NlcHRIZWFkKGhlYWQpO1xuICByZXR1cm4gd3M7XG59XG5cbmNsYXNzIFdlYlNvY2tldENvbm5lY3Rpb24ge1xuICBwcml2YXRlIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYygwKTtcbiAgcHJpdmF0ZSB0ZXh0SGFuZGxlcnMgPSBuZXcgU2V0PCh0ZXh0OiBzdHJpbmcpID0+IHZvaWQ+KCk7XG4gIHByaXZhdGUgY2xvc2VIYW5kbGVycyA9IG5ldyBTZXQ8KCkgPT4gdm9pZD4oKTtcbiAgcHJpdmF0ZSBjbG9zZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHNvY2tldDogU29ja2V0KSB7XG4gICAgc29ja2V0Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHRoaXMuYWNjZXB0SGVhZChjaHVuaykpO1xuICAgIHNvY2tldC5vbihcImNsb3NlXCIsICgpID0+IHRoaXMuZW1pdENsb3NlKCkpO1xuICAgIHNvY2tldC5vbihcImVycm9yXCIsICgpID0+IHRoaXMuZW1pdENsb3NlKCkpO1xuICB9XG5cbiAgYWNjZXB0SGVhZChjaHVuazogQnVmZmVyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY2xvc2VkKSByZXR1cm47XG4gICAgdGhpcy5idWZmZXIgPSBCdWZmZXIuY29uY2F0KFt0aGlzLmJ1ZmZlciwgY2h1bmtdKTtcbiAgICB0aGlzLnJlYWRGcmFtZXMoKTtcbiAgfVxuXG4gIG9uVGV4dChoYW5kbGVyOiAodGV4dDogc3RyaW5nKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy50ZXh0SGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuICB9XG5cbiAgb25DbG9zZShoYW5kbGVyOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5jbG9zZUhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgfVxuXG4gIHNlbmRKc29uKHBheWxvYWQ6IHVua25vd24pOiB2b2lkIHtcbiAgICB0aGlzLnNlbmRUZXh0KEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcbiAgfVxuXG4gIHNlbmRUZXh0KHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc2VuZEZyYW1lKDB4MSwgQnVmZmVyLmZyb20odGV4dCwgXCJ1dGY4XCIpKTtcbiAgfVxuXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNsb3NlZCkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnNlbmRGcmFtZSgweDgsIEJ1ZmZlci5hbGxvYygwKSk7XG4gICAgfSBjYXRjaCB7fVxuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZTtcbiAgICB0aGlzLnNvY2tldC5lbmQoKTtcbiAgICB0aGlzLmVtaXRDbG9zZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWFkRnJhbWVzKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLmJ1ZmZlci5sZW5ndGggPj0gMikge1xuICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLmJ1ZmZlclswXSE7XG4gICAgICBjb25zdCBzZWNvbmQgPSB0aGlzLmJ1ZmZlclsxXSE7XG4gICAgICBjb25zdCBvcGNvZGUgPSBmaXJzdCAmIDB4MGY7XG4gICAgICBjb25zdCBtYXNrZWQgPSAoc2Vjb25kICYgMHg4MCkgIT09IDA7XG4gICAgICBsZXQgbGVuZ3RoID0gc2Vjb25kICYgMHg3ZjtcbiAgICAgIGxldCBvZmZzZXQgPSAyO1xuICAgICAgaWYgKGxlbmd0aCA9PT0gMTI2KSB7XG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlci5sZW5ndGggPCBvZmZzZXQgKyAyKSByZXR1cm47XG4gICAgICAgIGxlbmd0aCA9IHRoaXMuYnVmZmVyLnJlYWRVSW50MTZCRShvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gMjtcbiAgICAgIH0gZWxzZSBpZiAobGVuZ3RoID09PSAxMjcpIHtcbiAgICAgICAgaWYgKHRoaXMuYnVmZmVyLmxlbmd0aCA8IG9mZnNldCArIDgpIHJldHVybjtcbiAgICAgICAgY29uc3QgaGlnaCA9IHRoaXMuYnVmZmVyLnJlYWRVSW50MzJCRShvZmZzZXQpO1xuICAgICAgICBjb25zdCBsb3cgPSB0aGlzLmJ1ZmZlci5yZWFkVUludDMyQkUob2Zmc2V0ICsgNCk7XG4gICAgICAgIGlmIChoaWdoICE9PSAwKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZW5ndGggPSBsb3c7XG4gICAgICAgIG9mZnNldCArPSA4O1xuICAgICAgfVxuICAgICAgY29uc3QgbWFza09mZnNldCA9IG9mZnNldDtcbiAgICAgIGlmIChtYXNrZWQpIG9mZnNldCArPSA0O1xuICAgICAgaWYgKHRoaXMuYnVmZmVyLmxlbmd0aCA8IG9mZnNldCArIGxlbmd0aCkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBtYXNrID0gbWFza2VkID8gdGhpcy5idWZmZXIuc3ViYXJyYXkobWFza09mZnNldCwgbWFza09mZnNldCArIDQpIDogbnVsbDtcbiAgICAgIGNvbnN0IHBheWxvYWQgPSBCdWZmZXIuZnJvbSh0aGlzLmJ1ZmZlci5zdWJhcnJheShvZmZzZXQsIG9mZnNldCArIGxlbmd0aCkpO1xuICAgICAgdGhpcy5idWZmZXIgPSB0aGlzLmJ1ZmZlci5zdWJhcnJheShvZmZzZXQgKyBsZW5ndGgpO1xuICAgICAgaWYgKG1hc2spIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSArPSAxKSBwYXlsb2FkW2ldIF49IG1hc2tbaSAlIDRdITtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wY29kZSA9PT0gMHg4KSB7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0gZWxzZSBpZiAob3Bjb2RlID09PSAweDkpIHtcbiAgICAgICAgdGhpcy5zZW5kRnJhbWUoMHhBLCBwYXlsb2FkKTtcbiAgICAgIH0gZWxzZSBpZiAob3Bjb2RlID09PSAweDEpIHtcbiAgICAgICAgY29uc3QgdGV4dCA9IHBheWxvYWQudG9TdHJpbmcoXCJ1dGY4XCIpO1xuICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgWy4uLnRoaXMudGV4dEhhbmRsZXJzXSkgaGFuZGxlcih0ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNlbmRGcmFtZShvcGNvZGU6IG51bWJlciwgcGF5bG9hZDogQnVmZmVyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY2xvc2VkICYmIG9wY29kZSAhPT0gMHg4KSByZXR1cm47XG4gICAgY29uc3QgbGVuZ3RoID0gcGF5bG9hZC5sZW5ndGg7XG4gICAgbGV0IGhlYWRlcjogQnVmZmVyO1xuICAgIGlmIChsZW5ndGggPCAxMjYpIHtcbiAgICAgIGhlYWRlciA9IEJ1ZmZlci5mcm9tKFsweDgwIHwgb3Bjb2RlLCBsZW5ndGhdKTtcbiAgICB9IGVsc2UgaWYgKGxlbmd0aCA8PSAweGZmZmYpIHtcbiAgICAgIGhlYWRlciA9IEJ1ZmZlci5hbGxvYyg0KTtcbiAgICAgIGhlYWRlclswXSA9IDB4ODAgfCBvcGNvZGU7XG4gICAgICBoZWFkZXJbMV0gPSAxMjY7XG4gICAgICBoZWFkZXIud3JpdGVVSW50MTZCRShsZW5ndGgsIDIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXIgPSBCdWZmZXIuYWxsb2MoMTApO1xuICAgICAgaGVhZGVyWzBdID0gMHg4MCB8IG9wY29kZTtcbiAgICAgIGhlYWRlclsxXSA9IDEyNztcbiAgICAgIGhlYWRlci53cml0ZVVJbnQzMkJFKDAsIDIpO1xuICAgICAgaGVhZGVyLndyaXRlVUludDMyQkUobGVuZ3RoLCA2KTtcbiAgICB9XG4gICAgdGhpcy5zb2NrZXQud3JpdGUoQnVmZmVyLmNvbmNhdChbaGVhZGVyLCBwYXlsb2FkXSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBlbWl0Q2xvc2UoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNsb3NlZCkgdGhpcy5jbG9zZWQgPSB0cnVlO1xuICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiBbLi4udGhpcy5jbG9zZUhhbmRsZXJzXSkgaGFuZGxlcigpO1xuICAgIHRoaXMuY2xvc2VIYW5kbGVycy5jbGVhcigpO1xuICAgIHRoaXMudGV4dEhhbmRsZXJzLmNsZWFyKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVxdWVzdFVybChyZXE6IEluY29taW5nTWVzc2FnZSk6IFVSTCB8IG51bGwge1xuICB0cnkge1xuICAgIHJldHVybiBuZXcgVVJMKHJlcS51cmwgPz8gXCIvXCIsIFwiaHR0cDovLzEyNy4wLjAuMVwiKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZEpzb25Cb2R5KHJlcTogSW5jb21pbmdNZXNzYWdlKTogUHJvbWlzZTx1bmtub3duPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgY2h1bmtzOiBCdWZmZXJbXSA9IFtdO1xuICAgIGxldCB0b3RhbCA9IDA7XG4gICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xuICAgICAgdG90YWwgKz0gY2h1bmsubGVuZ3RoO1xuICAgICAgaWYgKHRvdGFsID4gMTAyNCAqIDEwMjQpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcInJlcXVlc3QgYm9keSB0b28gbGFyZ2VcIikpO1xuICAgICAgICByZXEuZGVzdHJveSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgfSk7XG4gICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHJhdyA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZyhcInV0ZjhcIik7XG4gICAgICBpZiAoIXJhdykge1xuICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UocmF3KSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJlcS5vbihcImVycm9yXCIsIHJlamVjdCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBzZW5kSnNvbihyZXM6IFNlcnZlclJlc3BvbnNlLCBzdGF0dXM6IG51bWJlciwgYm9keTogdW5rbm93bik6IHZvaWQge1xuICBzZW5kQnVmZmVyKHJlcywgc3RhdHVzLCBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShib2R5KSksIE1JTUVfVFlQRVNbXCIuanNvblwiXSwgZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBzZW5kVGV4dChyZXM6IFNlcnZlclJlc3BvbnNlLCBzdGF0dXM6IG51bWJlciwgYm9keTogc3RyaW5nLCBjb250ZW50VHlwZTogc3RyaW5nKTogdm9pZCB7XG4gIHNlbmRCdWZmZXIocmVzLCBzdGF0dXMsIEJ1ZmZlci5mcm9tKGJvZHkpLCBjb250ZW50VHlwZSwgZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBzZW5kQnVmZmVyKFxuICByZXM6IFNlcnZlclJlc3BvbnNlLFxuICBzdGF0dXM6IG51bWJlcixcbiAgYm9keTogQnVmZmVyLFxuICBjb250ZW50VHlwZTogc3RyaW5nLFxuICBoZWFkT25seTogYm9vbGVhbixcbik6IHZvaWQge1xuICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgIFwiY29udGVudC10eXBlXCI6IGNvbnRlbnRUeXBlLFxuICAgIFwiY29udGVudC1sZW5ndGhcIjogYm9keS5sZW5ndGgsXG4gICAgXCJjYWNoZS1jb250cm9sXCI6IFwibm8tc3RvcmVcIixcbiAgfSk7XG4gIGlmIChoZWFkT25seSkgcmVzLmVuZCgpO1xuICBlbHNlIHJlcy5lbmQoYm9keSk7XG59XG5cbmZ1bmN0aW9uIHdlYnZpZXdSb290KCk6IHN0cmluZyB7XG4gIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgXCJhcHAuYXNhclwiLCBcIndlYnZpZXdcIik7XG59XG5cbmZ1bmN0aW9uIHdlYnZpZXdGaWxlKHBhdGhuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgY2xlYW5QYXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhdGhuYW1lKS5yZXBsYWNlKC9eXFwvKy8sIFwiXCIpO1xuICBpZiAoIWNsZWFuUGF0aCB8fCBjbGVhblBhdGguaW5jbHVkZXMoXCJcXDBcIikpIHJldHVybiBudWxsO1xuICBjb25zdCByb290ID0gd2Vidmlld1Jvb3QoKTtcbiAgY29uc3QgZmlsZSA9IG5vcm1hbGl6ZShqb2luKHJvb3QsIGNsZWFuUGF0aCkpO1xuICBjb25zdCByZWwgPSByZWxhdGl2ZShyb290LCBmaWxlKTtcbiAgaWYgKHJlbC5zdGFydHNXaXRoKFwiLi5cIikgfHwgcmVsID09PSBcIlwiKSByZXR1cm4gbnVsbDtcbiAgaWYgKCFleGlzdHNTeW5jKGZpbGUpIHx8ICFzdGF0U3luYyhmaWxlKS5pc0ZpbGUoKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBmaWxlO1xufVxuXG5mdW5jdGlvbiBtaW1lVHlwZShmaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBkb3QgPSBmaWxlLmxhc3RJbmRleE9mKFwiLlwiKTtcbiAgY29uc3QgZXh0ID0gZG90ID49IDAgPyBmaWxlLnNsaWNlKGRvdCkudG9Mb3dlckNhc2UoKSA6IFwiXCI7XG4gIHJldHVybiBNSU1FX1RZUEVTW2V4dF0gPz8gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIjtcbn1cblxuZnVuY3Rpb24gcmVxdWlyZU9wdGlvbnMoKTogQnJvd3NlclVpU2VydmVyT3B0aW9ucyB7XG4gIGlmICghYWN0aXZlT3B0aW9ucykgdGhyb3cgbmV3IEVycm9yKFwiQ2hhdEdQVCsrIGJyb3dzZXIgVUkgc2VydmVyIGlzIG5vdCBjb25maWd1cmVkXCIpO1xuICByZXR1cm4gYWN0aXZlT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaXNCcm93c2VyVWlIb3N0U2VuZGVyKHNlbmRlcjogRWxlY3Ryb24uV2ViQ29udGVudHMpOiBib29sZWFuIHtcbiAgcmV0dXJuICEhYWN0aXZlSG9zdCAmJiAhYWN0aXZlSG9zdC53ZWJDb250ZW50cy5pc0Rlc3Ryb3llZCgpICYmIHNlbmRlci5pZCA9PT0gYWN0aXZlSG9zdC53ZWJDb250ZW50cy5pZDtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0QnJpZGdlTWV0aG9kKG1ldGhvZDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghL15bYS16QS1aMC05Ll86LV0rJC8udGVzdChtZXRob2QpKSB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIGJyaWRnZSBtZXRob2RcIik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUG9ydCh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBmYWxsYmFjazogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgcGFyc2VkID0gTnVtYmVyKHZhbHVlKTtcbiAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIocGFyc2VkKSAmJiBwYXJzZWQgPiAwICYmIHBhcnNlZCA8PSA2NTUzNSA/IHBhcnNlZCA6IGZhbGxiYWNrO1xufVxuXG5mdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCB7XG4gIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgPyB2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFzUGxhaW5PYmplY3QodmFsdWU6IHVua25vd24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IHJlY29yZCA9IGFzUmVjb3JkKHZhbHVlKTtcbiAgcmV0dXJuIHJlY29yZCAmJiAhQXJyYXkuaXNBcnJheShyZWNvcmQpID8gcmVjb3JkIDoge307XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRTeXN0ZW1UaGVtZVZhcmlhbnQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hdGl2ZVRoZW1lLnNob3VsZFVzZURhcmtDb2xvcnMgPyBcImRhcmtcIiA6IFwibGlnaHRcIjtcbn1cblxuZnVuY3Rpb24gc2FmZUpzb24odmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoLzwvZywgXCJcXFxcdTAwM2NcIik7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBU0EsSUFBQUEsbUJBQWlHO0FBQ2pHLElBQUFDLG1CQUFxSTtBQUNySSxJQUFBQyw2QkFBK0M7QUFDL0MsSUFBQUMsc0JBQWtEO0FBQ2xELElBQUFDLG9CQUE2RDtBQUM3RCxJQUFBQyxrQkFBZ0M7OztBQ2JoQyxJQUFBQyxhQUErQjtBQUMvQixJQUFBQyxtQkFBOEI7QUFDOUIsb0JBQTZCO0FBQzdCLElBQUFDLFdBQXlCOzs7QUNKekIsc0JBQStDO0FBQy9DLHlCQUF5QjtBQUN6Qix1QkFBdUY7QUFDaEYsSUFBTSxhQUFhO0FBQUEsRUFDdEIsV0FBVztBQUFBLEVBQ1gsVUFBVTtBQUFBLEVBQ1YsZUFBZTtBQUFBLEVBQ2YsaUJBQWlCO0FBQ3JCO0FBQ0EsSUFBTSxpQkFBaUI7QUFBQSxFQUNuQixNQUFNO0FBQUEsRUFDTixZQUFZLENBQUMsZUFBZTtBQUFBLEVBQzVCLGlCQUFpQixDQUFDLGVBQWU7QUFBQSxFQUNqQyxNQUFNLFdBQVc7QUFBQSxFQUNqQixPQUFPO0FBQUEsRUFDUCxPQUFPO0FBQUEsRUFDUCxZQUFZO0FBQUEsRUFDWixlQUFlO0FBQ25CO0FBQ0EsT0FBTyxPQUFPLGNBQWM7QUFDNUIsSUFBTSx1QkFBdUI7QUFDN0IsSUFBTSxxQkFBcUIsb0JBQUksSUFBSSxDQUFDLFVBQVUsU0FBUyxVQUFVLFNBQVMsb0JBQW9CLENBQUM7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TztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ3ZGO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBWTtBQUFBLEVBQU87QUFBQSxFQUNyRjtBQUFBLEVBQVM7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ3ZCO0FBQUEsRUFBYTtBQUFBLEVBQWE7QUFBQSxFQUFhO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQ3BFO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFNO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQzFFO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFPO0FBQUEsRUFBVztBQUFBLEVBQU07QUFBQSxFQUNwQztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDNUQ7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDbkQ7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFNO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUMxQztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ3JGO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFTO0FBQUEsRUFDeEI7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQ3RDO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFXO0FBQUEsRUFDekI7QUFBQSxFQUFLO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ3REO0FBQUEsRUFBUztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUMvRTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFDZjtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDakY7QUFBQSxFQUNBO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBYTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUNwRjtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFVO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDbkY7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUNyQjtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDaEY7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFB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QTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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LEtBQUssT0FBTyxTQUFTLEdBQUc7QUFDekMsVUFBTSxJQUFJLE1BQU0sOENBQThDO0FBQUEsRUFDaEU7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X2VsZWN0cm9uIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX2NoaWxkX3Byb2Nlc3MiLCAiaW1wb3J0X25vZGVfY3J5cHRvIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfb3MiLCAiaW1wb3J0X2ZzIiwgImltcG9ydF9wcm9taXNlcyIsICJzeXNQYXRoIiwgInByZXNvbHZlIiwgImJhc2VuYW1lIiwgInBqb2luIiwgInByZWxhdGl2ZSIsICJwc2VwIiwgImltcG9ydF9wcm9taXNlcyIsICJvc1R5cGUiLCAiZnNfd2F0Y2giLCAicmF3RW1pdHRlciIsICJsaXN0ZW5lciIsICJiYXNlbmFtZSIsICJkaXJuYW1lIiwgIm5ld1N0YXRzIiwgImNsb3NlciIsICJmc3JlYWxwYXRoIiwgInJlc29sdmUiLCAicmVhbHBhdGgiLCAic3RhdHMiLCAicmVsYXRpdmUiLCAiRE9VQkxFX1NMQVNIX1JFIiwgInRlc3RTdHJpbmciLCAicGF0aCIsICJzdGF0cyIsICJzdGF0Y2IiLCAibm93IiwgInN0YXQiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJ1c2VyUm9vdCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9lbGVjdHJvbiIsICJpbXBvcnRfbm9kZV9jaGlsZF9wcm9jZXNzIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAibG9nIiwgImV4cG9ydHMiLCAiYXNSZWNvcmQiLCAicmVzb2x2ZSIsICJ3ZWJDb250ZW50cyIsICJpbXBvcnRfZWxlY3Ryb24iLCAiaW1wb3J0X25vZGVfY3J5cHRvIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAibG9nIiwgImFzUmVjb3JkIiwgInJlc29sdmUiLCAiaXNQYXRoSW5zaWRlIiwgImV4cG9ydHMiLCAiaW5mZXJNYWNBcHBSb290IiwgInBsYXRmb3JtIiwgInN0YXQiLCAiYXNSZWNvcmQiLCAiYXNzZXJ0QnJpZGdlSWQiLCAiaXNXaW5kb3dEZXN0cm95ZWQiLCAid2luZG93SWRGb3IiLCAibWFrZVdpbmRvd0xpa2VGb3JWaWV3Il0KfQo=
