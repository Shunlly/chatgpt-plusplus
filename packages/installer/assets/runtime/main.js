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
var import_electron = require("electron");
var import_node_fs6 = require("node:fs");
var import_node_child_process2 = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_node_path6 = require("node:path");
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
    const dirname5 = sysPath.dirname(file);
    const basename3 = sysPath.basename(file);
    const parent = this.fsw._getWatchedDir(dirname5);
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
          this.fsw._remove(dirname5, basename3);
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
    return new Promise((resolve5, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve5(void 0);
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
        const relative4 = sysPath2.relative(matcher.path, string);
        if (!relative4) {
          return false;
        }
        return !relative4.startsWith("..") && !sysPath2.isAbsolute(relative4);
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
      console.error("[codex-plusplus] storage flush failed:", id, e);
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
var MCP_MANAGED_START = "# BEGIN CODEX++ MANAGED MCP SERVERS";
var MCP_MANAGED_END = "# END CODEX++ MANAGED MCP SERVERS";
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
  if (!managedBlock && !currentToml.includes(MCP_MANAGED_START)) return currentToml;
  const stripped = stripManagedMcpBlock(currentToml).trimEnd();
  if (!managedBlock) return stripped ? `${stripped}
` : "";
  return `${stripped ? `${stripped}

` : ""}${managedBlock}
`;
}
function stripManagedMcpBlock(toml) {
  const pattern = new RegExp(
    `\\n?${escapeRegExp(MCP_MANAGED_START)}[\\s\\S]*?${escapeRegExp(MCP_MANAGED_END)}\\n?`,
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
var LAUNCHD_LABEL = "com.codexplusplus.watcher";
var WATCHER_LOG = (0, import_node_path5.join)((0, import_node_os.homedir)(), "Library", "Logs", "codex-plusplus-watcher.log");
function getWatcherHealth(userRoot2) {
  const checks = [];
  const state = readJson((0, import_node_path5.join)(userRoot2, "state.json"));
  const config = readJson((0, import_node_path5.join)(userRoot2, "config.json")) ?? {};
  const selfUpdate = readJson((0, import_node_path5.join)(userRoot2, "self-update-state.json"));
  checks.push({
    name: "Install state",
    status: state ? "ok" : "error",
    detail: state ? `Codex++ ${state.version ?? "(unknown version)"}` : "state.json is missing"
  });
  if (!state) return summarize("none", checks);
  const autoUpdate = config.codexPlusPlus?.autoUpdate !== false;
  checks.push({
    name: "Automatic refresh",
    status: autoUpdate ? "ok" : "warn",
    detail: autoUpdate ? "enabled" : "disabled in Codex++ config"
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
      name: "last Codex++ update",
      status: "warn",
      detail: state.error ? `failed ${at}: ${state.error}` : `failed ${at}`
    };
  }
  if (state.status === "disabled") {
    return { name: "last Codex++ update", status: "warn", detail: `skipped ${at}: automatic refresh disabled` };
  }
  if (state.status === "updated") {
    return { name: "last Codex++ update", status: "ok", detail: `updated ${at} to ${state.latestVersion ?? "new release"}` };
  }
  if (state.status === "up-to-date") {
    return { name: "last Codex++ update", status: "ok", detail: `up to date ${at}` };
  }
  return { name: "last Codex++ update", status: "warn", detail: `checking since ${at}` };
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
      status: plist.includes(LAUNCHD_LABEL) ? "ok" : "error",
      detail: LAUNCHD_LABEL
    });
    checks.push({
      name: "launchd trigger",
      status: asarPath && plist.includes(asarPath) ? "ok" : "error",
      detail: asarPath || "missing appRoot"
    });
    checks.push({
      name: "watcher command",
      status: plist.includes("CODEX_PLUSPLUS_WATCHER=1") && plist.includes(" update --watcher --quiet") ? "ok" : "error",
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
  const service = (0, import_node_path5.join)(dir, "codex-plusplus-watcher.service");
  const timer = (0, import_node_path5.join)(dir, "codex-plusplus-watcher.timer");
  const pathUnit = (0, import_node_path5.join)(dir, "codex-plusplus-watcher.path");
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
      status: commandSucceeds("systemctl", ["--user", "is-active", "--quiet", "codex-plusplus-watcher.path"]) ? "ok" : "warn",
      detail: "systemctl --user is-active codex-plusplus-watcher.path"
    },
    {
      name: "timer active",
      status: commandSucceeds("systemctl", ["--user", "is-active", "--quiet", "codex-plusplus-watcher.timer"]) ? "ok" : "warn",
      detail: "systemctl --user is-active codex-plusplus-watcher.timer"
    }
  ];
}
function checkScheduledTaskWatcher() {
  return [
    {
      name: "logon task",
      status: commandSucceeds("schtasks.exe", ["/Query", "/TN", "codex-plusplus-watcher"]) ? "ok" : "error",
      detail: "codex-plusplus-watcher"
    },
    {
      name: "hourly task",
      status: commandSucceeds("schtasks.exe", ["/Query", "/TN", "codex-plusplus-watcher-hourly"]) ? "ok" : "warn",
      detail: "codex-plusplus-watcher-hourly"
    }
  ];
}
function watcherLogCheck() {
  if (!(0, import_node_fs4.existsSync)(WATCHER_LOG)) {
    return { name: "watcher log", status: "warn", detail: "no watcher log yet" };
  }
  const tail = readFileSafe(WATCHER_LOG).split(/\r?\n/).slice(-40).join("\n");
  const hasError = /✗ codex-plusplus failed|codex-plusplus failed|error|failed/i.test(tail);
  return {
    name: "watcher log",
    status: hasError ? "warn" : "ok",
    detail: hasError ? "recent watcher log contains an error" : WATCHER_LOG
  };
}
function summarize(watcher, checks) {
  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");
  const status = hasError ? "error" : hasWarn ? "warn" : "ok";
  const failed = checks.filter((c) => c.status === "error").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const title = status === "ok" ? "Auto-repair watcher is ready" : status === "warn" ? "Auto-repair watcher needs review" : "Auto-repair watcher is not ready";
  const summary = status === "ok" ? "Codex++ should automatically repair itself after Codex updates." : `${failed} failing check(s), ${warned} warning(s).`;
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

// src/main.ts
var userRoot = process.env.CODEX_PLUSPLUS_USER_ROOT;
var runtimeDir = process.env.CODEX_PLUSPLUS_RUNTIME;
if (!userRoot || !runtimeDir) {
  throw new Error(
    "codex-plusplus runtime started without CODEX_PLUSPLUS_USER_ROOT/RUNTIME envs"
  );
}
var PRELOAD_PATH = (0, import_node_path6.resolve)(runtimeDir, "preload.js");
var TWEAKS_DIR = (0, import_node_path6.join)(userRoot, "tweaks");
var LOG_DIR = (0, import_node_path6.join)(userRoot, "log");
var LOG_FILE = (0, import_node_path6.join)(LOG_DIR, "main.log");
var CONFIG_FILE = (0, import_node_path6.join)(userRoot, "config.json");
var CODEX_CONFIG_FILE = (0, import_node_path6.join)((0, import_node_os2.homedir)(), ".codex", "config.toml");
var INSTALLER_STATE_FILE = (0, import_node_path6.join)(userRoot, "state.json");
var UPDATE_MODE_FILE = (0, import_node_path6.join)(userRoot, "update-mode.json");
var SELF_UPDATE_STATE_FILE = (0, import_node_path6.join)(userRoot, "self-update-state.json");
var SIGNED_CODEX_BACKUP = (0, import_node_path6.join)(userRoot, "backup", "Codex.app");
var CODEX_PLUSPLUS_VERSION = "0.1.5";
var CODEX_PLUSPLUS_REPO = "b-nnett/codex-plusplus";
var TWEAK_STORE_INDEX_URL = process.env.CODEX_PLUSPLUS_STORE_INDEX_URL ?? DEFAULT_TWEAK_STORE_INDEX_URL;
var CODEX_WINDOW_SERVICES_KEY = "__codexpp_window_services__";
(0, import_node_fs6.mkdirSync)(LOG_DIR, { recursive: true });
(0, import_node_fs6.mkdirSync)(TWEAKS_DIR, { recursive: true });
if (process.env.CODEXPP_REMOTE_DEBUG === "1") {
  const port = process.env.CODEXPP_REMOTE_DEBUG_PORT ?? "9222";
  import_electron.app.commandLine.appendSwitch("remote-debugging-port", port);
  log("info", `remote debugging enabled on port ${port}`);
}
function readState() {
  try {
    return JSON.parse((0, import_node_fs6.readFileSync)(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function writeState(s) {
  try {
    (0, import_node_fs6.writeFileSync)(CONFIG_FILE, JSON.stringify(s, null, 2));
  } catch (e) {
    log("warn", "writeState failed:", String(e.message));
  }
}
function isCodexPlusPlusAutoUpdateEnabled() {
  return readState().codexPlusPlus?.autoUpdate !== false;
}
function setCodexPlusPlusAutoUpdate(enabled) {
  const s = readState();
  s.codexPlusPlus ??= {};
  s.codexPlusPlus.autoUpdate = enabled;
  writeState(s);
}
function setCodexPlusPlusUpdateConfig(config) {
  const s = readState();
  s.codexPlusPlus ??= {};
  if (config.updateChannel) s.codexPlusPlus.updateChannel = config.updateChannel;
  if ("updateRepo" in config) s.codexPlusPlus.updateRepo = cleanOptionalString(config.updateRepo);
  if ("updateRef" in config) s.codexPlusPlus.updateRef = cleanOptionalString(config.updateRef);
  writeState(s);
}
function isCodexPlusPlusSafeModeEnabled() {
  return readState().codexPlusPlus?.safeMode === true;
}
function isTweakEnabled(id) {
  const s = readState();
  if (s.codexPlusPlus?.safeMode === true) return false;
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
    return JSON.parse((0, import_node_fs6.readFileSync)(INSTALLER_STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}
function readSelfUpdateState() {
  try {
    return JSON.parse((0, import_node_fs6.readFileSync)(SELF_UPDATE_STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}
function cleanOptionalString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function isPathInside(parent, target) {
  const rel = (0, import_node_path6.relative)((0, import_node_path6.resolve)(parent), (0, import_node_path6.resolve)(target));
  return rel === "" || !!rel && !rel.startsWith("..") && !(0, import_node_path6.isAbsolute)(rel);
}
function log(level, ...args) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level}] ${args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}
`;
  try {
    appendCappedLog(LOG_FILE, line);
  } catch {
  }
  if (level === "error") console.error("[codex-plusplus]", ...args);
}
function installSparkleUpdateHook() {
  if (process.platform !== "darwin") return;
  const Module = require("node:module");
  const originalLoad = Module._load;
  if (typeof originalLoad !== "function") return;
  Module._load = function codexPlusPlusModuleLoad(request, parent, isMain) {
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
    exports2[name] = function codexPlusPlusSparkleWrapper(...args) {
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
  if ((0, import_node_fs6.existsSync)(UPDATE_MODE_FILE)) {
    log("info", "Sparkle update prep skipped; update mode already active");
    return;
  }
  if (!(0, import_node_fs6.existsSync)(SIGNED_CODEX_BACKUP)) {
    log("warn", "Sparkle update prep skipped; signed Codex.app backup is missing");
    return;
  }
  if (!isDeveloperIdSignedApp(SIGNED_CODEX_BACKUP)) {
    log("warn", "Sparkle update prep skipped; Codex.app backup is not Developer ID signed");
    return;
  }
  const state = readInstallerState();
  const appRoot = state?.appRoot ?? inferMacAppRoot();
  if (!appRoot) {
    log("warn", "Sparkle update prep skipped; could not infer Codex.app path");
    return;
  }
  const mode = {
    enabledAt: (/* @__PURE__ */ new Date()).toISOString(),
    appRoot,
    codexVersion: state?.codexVersion ?? null
  };
  (0, import_node_fs6.writeFileSync)(UPDATE_MODE_FILE, JSON.stringify(mode, null, 2));
  try {
    (0, import_node_child_process2.execFileSync)("ditto", [SIGNED_CODEX_BACKUP, appRoot], { stdio: "ignore" });
    try {
      (0, import_node_child_process2.execFileSync)("xattr", ["-dr", "com.apple.quarantine", appRoot], { stdio: "ignore" });
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
  const result = (0, import_node_child_process2.spawnSync)("codesign", ["-dv", "--verbose=4", appRoot], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return result.status === 0 && /Authority=Developer ID Application:/.test(output) && !/Signature=adhoc/.test(output) && !/TeamIdentifier=not set/.test(output);
}
function inferMacAppRoot() {
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
      reg.call(s, { type: "frame", filePath: PRELOAD_PATH, id: "codex-plusplus" });
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
import_electron.app.whenReady().then(() => {
  log("info", "app ready fired");
  if (isCodexPlusPlusSafeModeEnabled()) {
    log("warn", "safe mode is enabled; preload will not be registered");
    return;
  }
  registerPreload(import_electron.session.defaultSession, "defaultSession");
});
import_electron.app.on("session-created", (s) => {
  if (isCodexPlusPlusSafeModeEnabled()) return;
  registerPreload(s, "session-created");
});
import_electron.app.on("web-contents-created", (_e, wc) => {
  try {
    const wp = wc.getLastWebPreferences?.();
    log("info", "web-contents-created", {
      id: wc.id,
      type: wc.getType(),
      sessionIsDefault: wc.session === import_electron.session.defaultSession,
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
log("info", "main.ts evaluated; app.isReady=" + import_electron.app.isReady());
if (isCodexPlusPlusSafeModeEnabled()) {
  log("warn", "safe mode is enabled; tweaks will not be loaded");
}
loadAllMainTweaks();
import_electron.app.on("will-quit", () => {
  stopAllMainTweaks();
  for (const t of tweakState.loadedMain.values()) {
    try {
      t.storage.flush();
    } catch {
    }
  }
});
import_electron.ipcMain.handle("codexpp:list-tweaks", async () => {
  await Promise.all(tweakState.discovered.map((t) => ensureTweakUpdateCheck(t)));
  const updateChecks = readState().tweakUpdateChecks ?? {};
  return tweakState.discovered.map((t) => ({
    manifest: t.manifest,
    entry: t.entry,
    dir: t.dir,
    entryExists: (0, import_node_fs6.existsSync)(t.entry),
    enabled: isTweakEnabled(t.manifest.id),
    update: updateChecks[t.manifest.id] ?? null
  }));
});
import_electron.ipcMain.handle("codexpp:get-tweak-enabled", (_e, id) => isTweakEnabled(id));
import_electron.ipcMain.handle("codexpp:set-tweak-enabled", (_e, id, enabled) => {
  return setTweakEnabledAndReload(id, enabled, tweakLifecycleDeps);
});
import_electron.ipcMain.handle("codexpp:get-config", () => {
  const s = readState();
  const installerState = readInstallerState();
  const sourceRoot = installerState?.sourceRoot ?? fallbackSourceRoot();
  return {
    version: CODEX_PLUSPLUS_VERSION,
    autoUpdate: s.codexPlusPlus?.autoUpdate !== false,
    safeMode: s.codexPlusPlus?.safeMode === true,
    updateChannel: s.codexPlusPlus?.updateChannel ?? "stable",
    updateRepo: s.codexPlusPlus?.updateRepo ?? CODEX_PLUSPLUS_REPO,
    updateRef: s.codexPlusPlus?.updateRef ?? "",
    updateCheck: s.codexPlusPlus?.updateCheck ?? null,
    selfUpdate: readSelfUpdateState(),
    installationSource: describeInstallationSource(sourceRoot)
  };
});
import_electron.ipcMain.handle("codexpp:set-auto-update", (_e, enabled) => {
  setCodexPlusPlusAutoUpdate(!!enabled);
  return { autoUpdate: isCodexPlusPlusAutoUpdateEnabled() };
});
import_electron.ipcMain.handle("codexpp:set-update-config", (_e, config) => {
  setCodexPlusPlusUpdateConfig(config);
  const s = readState();
  return {
    updateChannel: s.codexPlusPlus?.updateChannel ?? "stable",
    updateRepo: s.codexPlusPlus?.updateRepo ?? CODEX_PLUSPLUS_REPO,
    updateRef: s.codexPlusPlus?.updateRef ?? ""
  };
});
import_electron.ipcMain.handle("codexpp:check-codexpp-update", async (_e, force) => {
  return ensureCodexPlusPlusUpdateCheck(force === true);
});
import_electron.ipcMain.handle("codexpp:run-codexpp-update", async () => {
  const sourceRoot = readInstallerState()?.sourceRoot ?? fallbackSourceRoot();
  const cli = sourceRoot ? (0, import_node_path6.join)(sourceRoot, "packages", "installer", "dist", "cli.js") : null;
  if (!cli || !(0, import_node_fs6.existsSync)(cli)) {
    throw new Error("Codex++ source CLI was not found. Run the installer once, then try again.");
  }
  await runInstalledCli(cli, ["update", "--watcher"]);
  return readSelfUpdateState();
});
import_electron.ipcMain.handle("codexpp:get-watcher-health", () => getWatcherHealth(userRoot));
import_electron.ipcMain.handle("codexpp:get-tweak-store", async () => {
  const store = await fetchTweakStoreRegistry();
  const registry = store.registry;
  const installed = new Map(tweakState.discovered.map((t) => [t.manifest.id, t]));
  return {
    ...registry,
    sourceUrl: TWEAK_STORE_INDEX_URL,
    fetchedAt: store.fetchedAt,
    entries: registry.entries.map((entry) => {
      const local = installed.get(entry.id);
      const platform2 = storeEntryPlatformCompatibility(entry);
      return {
        ...entry,
        platform: platform2,
        installed: local ? {
          version: local.manifest.version,
          enabled: isTweakEnabled(local.manifest.id)
        } : null
      };
    })
  };
});
import_electron.ipcMain.handle("codexpp:install-store-tweak", async (_e, id) => {
  const { registry } = await fetchTweakStoreRegistry();
  const entry = registry.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Tweak store entry not found: ${id}`);
  assertStoreEntryPlatformCompatible(entry);
  await installStoreTweak(entry);
  reloadTweaks("store-install", tweakLifecycleDeps);
  return { installed: entry.id };
});
import_electron.ipcMain.handle("codexpp:prepare-tweak-store-submission", async (_e, repoInput) => {
  return prepareTweakStoreSubmission(repoInput);
});
import_electron.ipcMain.handle("codexpp:read-tweak-source", (_e, entryPath) => {
  const resolved = (0, import_node_path6.resolve)(entryPath);
  if (!isPathInside(TWEAKS_DIR, resolved)) {
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
import_electron.ipcMain.handle(
  "codexpp:read-tweak-asset",
  (_e, tweakDir, relPath) => {
    const fs = require("node:fs");
    const dir = (0, import_node_path6.resolve)(tweakDir);
    if (!isPathInside(TWEAKS_DIR, dir)) {
      throw new Error("tweakDir outside tweaks dir");
    }
    const full = (0, import_node_path6.resolve)(dir, relPath);
    if (!isPathInside(dir, full) || full === dir) {
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
import_electron.ipcMain.on("codexpp:preload-log", (_e, level, msg) => {
  const lvl = level === "error" || level === "warn" ? level : "info";
  try {
    appendCappedLog((0, import_node_path6.join)(LOG_DIR, "preload.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] [${lvl}] ${msg}
`);
  } catch {
  }
});
import_electron.ipcMain.handle("codexpp:tweak-fs", (_e, op, id, p, c) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("bad tweak id");
  const dir = (0, import_node_path6.join)(userRoot, "tweak-data", id);
  (0, import_node_fs6.mkdirSync)(dir, { recursive: true });
  const full = (0, import_node_path6.resolve)(dir, p);
  if (!isPathInside(dir, full) || full === dir) throw new Error("path traversal");
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
import_electron.ipcMain.handle("codexpp:user-paths", () => ({
  userRoot,
  runtimeDir,
  tweaksDir: TWEAKS_DIR,
  logDir: LOG_DIR
}));
import_electron.ipcMain.handle("codexpp:reveal", (_e, p) => {
  import_electron.shell.openPath(p).catch(() => {
  });
});
import_electron.ipcMain.handle("codexpp:open-external", (_e, url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error("only github.com links can be opened from tweak metadata");
  }
  import_electron.shell.openExternal(parsed.toString()).catch(() => {
  });
});
import_electron.ipcMain.handle("codexpp:copy-text", (_e, text) => {
  import_electron.clipboard.writeText(String(text));
  return true;
});
import_electron.ipcMain.handle("codexpp:reload-tweaks", () => {
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
  import_electron.app.on("will-quit", () => watcher.close().catch(() => {
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
          codex: makeCodexApi()
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
        `skipped Codex++ managed MCP server(s) already configured by user: ${result.skippedServerNames.join(", ")}`
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
    }
  }
  tweakState.loadedMain.clear();
}
function clearTweakModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (isPathInside(TWEAKS_DIR, key)) delete require.cache[key];
  }
}
var UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1e3;
var VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
async function ensureCodexPlusPlusUpdateCheck(force = false) {
  const state = readState();
  const cached = state.codexPlusPlus?.updateCheck;
  const channel = state.codexPlusPlus?.updateChannel ?? "stable";
  const repo = state.codexPlusPlus?.updateRepo ?? CODEX_PLUSPLUS_REPO;
  if (!force && cached && cached.currentVersion === CODEX_PLUSPLUS_VERSION && Date.now() - Date.parse(cached.checkedAt) < UPDATE_CHECK_INTERVAL_MS) {
    return cached;
  }
  const release = await fetchLatestRelease(repo, CODEX_PLUSPLUS_VERSION, channel === "prerelease");
  const latestVersion = release.latestTag ? normalizeVersion(release.latestTag) : null;
  const check = {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    currentVersion: CODEX_PLUSPLUS_VERSION,
    latestVersion,
    releaseUrl: release.releaseUrl ?? `https://github.com/${repo}/releases`,
    releaseNotes: release.releaseNotes,
    updateAvailable: latestVersion ? compareVersions(normalizeVersion(latestVersion), CODEX_PLUSPLUS_VERSION) > 0 : false,
    ...release.error ? { error: release.error } : {}
  };
  state.codexPlusPlus ??= {};
  state.codexPlusPlus.updateCheck = check;
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
          "User-Agent": `codex-plusplus/${currentVersion}`
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
      `${tweakName} has local source changes, so Codex++ can't auto-update it. Revert your local changes or reinstall the tweak manually.`
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
          "User-Agent": `codex-plusplus/${CODEX_PLUSPLUS_VERSION}`
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
  const work = (0, import_node_fs6.mkdtempSync)((0, import_node_path6.join)((0, import_node_os2.tmpdir)(), "codexpp-store-tweak-"));
  const archive = (0, import_node_path6.join)(work, "source.tar.gz");
  const extractDir = (0, import_node_path6.join)(work, "extract");
  const target = (0, import_node_path6.join)(TWEAKS_DIR, entry.id);
  const stagedTarget = (0, import_node_path6.join)(work, "staged", entry.id);
  try {
    log("info", `installing store tweak ${entry.id} from ${entry.repo}@${entry.approvedCommitSha}`);
    const res = await fetch(url, {
      headers: { "User-Agent": `codex-plusplus/${CODEX_PLUSPLUS_VERSION}` },
      redirect: "follow"
    });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    (0, import_node_fs6.writeFileSync)(archive, bytes);
    (0, import_node_fs6.mkdirSync)(extractDir, { recursive: true });
    extractTarArchive(archive, extractDir);
    const source = findTweakRoot(extractDir);
    if (!source) throw new Error("downloaded archive did not contain manifest.json");
    validateStoreTweakSource(entry, source);
    (0, import_node_fs6.rmSync)(stagedTarget, { recursive: true, force: true });
    copyTweakSource(source, stagedTarget);
    const stagedFiles = hashTweakSource(stagedTarget);
    (0, import_node_fs6.writeFileSync)(
      (0, import_node_path6.join)(stagedTarget, ".codexpp-store.json"),
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
    (0, import_node_fs6.rmSync)(target, { recursive: true, force: true });
    (0, import_node_fs6.cpSync)(stagedTarget, target, { recursive: true });
  } finally {
    (0, import_node_fs6.rmSync)(work, { recursive: true, force: true });
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
        "User-Agent": `codex-plusplus/${CODEX_PLUSPLUS_VERSION}`
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
      "User-Agent": `codex-plusplus/${CODEX_PLUSPLUS_VERSION}`
    }
  });
  if (!res.ok) throw new Error(`manifest fetch returned ${res.status}`);
  return await res.json();
}
function extractTarArchive(archive, targetDir) {
  const result = (0, import_node_child_process2.spawnSync)("tar", ["-xzf", archive, "-C", targetDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed: ${result.stderr || result.stdout || result.status}`);
  }
}
function validateStoreTweakSource(entry, source) {
  const manifestPath = (0, import_node_path6.join)(source, "manifest.json");
  const manifest = JSON.parse((0, import_node_fs6.readFileSync)(manifestPath, "utf8"));
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
  if (!(0, import_node_fs6.existsSync)(dir)) return null;
  if ((0, import_node_fs6.existsSync)((0, import_node_path6.join)(dir, "manifest.json"))) return dir;
  for (const name of (0, import_node_fs6.readdirSync)(dir)) {
    const child = (0, import_node_path6.join)(dir, name);
    try {
      if (!(0, import_node_fs6.statSync)(child).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findTweakRoot(child);
    if (found) return found;
  }
  return null;
}
function copyTweakSource(source, target) {
  (0, import_node_fs6.cpSync)(source, target, {
    recursive: true,
    filter: (src) => !/(^|[/\\])(?:\.git|node_modules)(?:[/\\]|$)/.test(src)
  });
}
async function assertStoreTweakCleanForAutoUpdate(entry, target, work) {
  if (!(0, import_node_fs6.existsSync)(target)) return;
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
  const metadataPath = (0, import_node_path6.join)(target, ".codexpp-store.json");
  if (!(0, import_node_fs6.existsSync)(metadataPath)) return null;
  try {
    const parsed = JSON.parse((0, import_node_fs6.readFileSync)(metadataPath, "utf8"));
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
  const baselineDir = (0, import_node_path6.join)(work, "baseline");
  const archive = (0, import_node_path6.join)(work, "baseline.tar.gz");
  const res = await fetch(`https://codeload.github.com/${metadata.repo}/tar.gz/${metadata.approvedCommitSha}`, {
    headers: { "User-Agent": `codex-plusplus/${CODEX_PLUSPLUS_VERSION}` },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Could not verify local tweak changes before update: ${res.status}`);
  (0, import_node_fs6.writeFileSync)(archive, Buffer.from(await res.arrayBuffer()));
  (0, import_node_fs6.mkdirSync)(baselineDir, { recursive: true });
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
  for (const name of (0, import_node_fs6.readdirSync)(dir).sort()) {
    if (name === ".git" || name === "node_modules" || name === ".codexpp-store.json") continue;
    const full = (0, import_node_path6.join)(dir, name);
    const rel = (0, import_node_path6.relative)(root, full).split("\\").join("/");
    const stat4 = (0, import_node_fs6.statSync)(full);
    if (stat4.isDirectory()) {
      collectTweakFileHashes(root, full, out);
      continue;
    }
    if (!stat4.isFile()) continue;
    out[rel] = (0, import_node_crypto.createHash)("sha256").update((0, import_node_fs6.readFileSync)(full)).digest("hex");
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
    (0, import_node_path6.join)((0, import_node_os2.homedir)(), ".codex-plusplus", "source"),
    (0, import_node_path6.join)(userRoot, "source")
  ];
  for (const candidate of candidates) {
    if ((0, import_node_fs6.existsSync)((0, import_node_path6.join)(candidate, "packages", "installer", "dist", "cli.js"))) return candidate;
  }
  return null;
}
function describeInstallationSource(sourceRoot) {
  if (!sourceRoot) {
    return {
      kind: "unknown",
      label: "Unknown",
      detail: "Codex++ source location is not recorded yet."
    };
  }
  const normalized = sourceRoot.replace(/\\/g, "/");
  if (/\/(?:Homebrew|homebrew)\/Cellar\/codexplusplus\//.test(normalized)) {
    return { kind: "homebrew", label: "Homebrew", detail: sourceRoot };
  }
  if ((0, import_node_fs6.existsSync)((0, import_node_path6.join)(sourceRoot, ".git"))) {
    return { kind: "local-dev", label: "Local development checkout", detail: sourceRoot };
  }
  if (normalized.endsWith("/.codex-plusplus/source") || normalized.includes("/.codex-plusplus/source/")) {
    return { kind: "github-source", label: "GitHub source installer", detail: sourceRoot };
  }
  if ((0, import_node_fs6.existsSync)((0, import_node_path6.join)(sourceRoot, "package.json"))) {
    return { kind: "source-archive", label: "Source archive", detail: sourceRoot };
  }
  return { kind: "unknown", label: "Unknown", detail: sourceRoot };
}
function runInstalledCli(cli, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = (0, import_node_child_process2.spawn)(process.execPath, [cli, ...args], {
      cwd: (0, import_node_path6.resolve)((0, import_node_path6.dirname)(cli), "..", "..", ".."),
      env: { ...process.env, CODEX_PLUSPLUS_MANUAL_UPDATE: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      const tail = output.trim().split(/\r?\n/).slice(-12).join("\n");
      rejectRun(new Error(tail || `codexplusplus ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
function broadcastReload() {
  const payload = {
    at: Date.now(),
    tweaks: tweakState.discovered.map((t) => t.manifest.id)
  };
  for (const wc of import_electron.webContents.getAllWebContents()) {
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
      import_electron.ipcMain.on(ch(c), wrapped);
      return () => import_electron.ipcMain.removeListener(ch(c), wrapped);
    },
    send: (_c) => {
      throw new Error("ipc.send is renderer\u2192main; main side uses handle/on");
    },
    invoke: (_c) => {
      throw new Error("ipc.invoke is renderer\u2192main; main side uses handle");
    },
    handle: (c, handler) => {
      import_electron.ipcMain.handle(ch(c), (_e, ...args) => handler(...args));
    }
  };
}
function makeMainFs(id) {
  const dir = (0, import_node_path6.join)(userRoot, "tweak-data", id);
  (0, import_node_fs6.mkdirSync)(dir, { recursive: true });
  const fs = require("node:fs/promises");
  return {
    dataDir: dir,
    read: (p) => fs.readFile((0, import_node_path6.join)(dir, p), "utf8"),
    write: (p, c) => fs.writeFile((0, import_node_path6.join)(dir, p), c, "utf8"),
    exists: async (p) => {
      try {
        await fs.access((0, import_node_path6.join)(dir, p));
        return true;
      } catch {
        return false;
      }
    }
  };
}
function makeCodexApi() {
  return {
    createBrowserView: async (opts) => {
      const services = getCodexWindowServices();
      const windowManager = services?.windowManager;
      if (!services || !windowManager?.registerWindow) {
        throw new Error(
          "Codex embedded view services are not available. Reinstall Codex++ 0.1.1 or later."
        );
      }
      const route = normalizeCodexRoute(opts.route);
      const hostId = opts.hostId || "local";
      const appearance = opts.appearance || "secondary";
      const view = new import_electron.BrowserView({
        webPreferences: {
          preload: windowManager.options?.preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          spellcheck: false,
          devTools: windowManager.options?.allowDevtools
        }
      });
      const windowLike = makeWindowLikeForView(view);
      windowManager.registerWindow(windowLike, hostId, false, appearance);
      services.getContext?.(hostId)?.registerWindow?.(windowLike);
      await view.webContents.loadURL(codexAppUrl(route, hostId));
      return view;
    },
    createWindow: async (opts) => {
      const services = getCodexWindowServices();
      if (!services) {
        throw new Error(
          "Codex window services are not available. Reinstall Codex++ 0.1.1 or later."
        );
      }
      const route = normalizeCodexRoute(opts.route);
      const hostId = opts.hostId || "local";
      const parent = typeof opts.parentWindowId === "number" ? import_electron.BrowserWindow.fromId(opts.parentWindowId) : import_electron.BrowserWindow.getFocusedWindow();
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
  };
}
function makeWindowLikeForView(view) {
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
/*! Bundled license information:

chokidar/esm/index.js:
  (*! chokidar - MIT License (c) 2012 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2Nob2tpZGFyL2VzbS9pbmRleC5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvcmVhZGRpcnAvZXNtL2luZGV4LmpzIiwgIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9jaG9raWRhci9lc20vaGFuZGxlci5qcyIsICIuLi9zcmMvdHdlYWstZGlzY292ZXJ5LnRzIiwgIi4uL3NyYy9zdG9yYWdlLnRzIiwgIi4uL3NyYy9tY3Atc3luYy50cyIsICIuLi9zcmMvd2F0Y2hlci1oZWFsdGgudHMiLCAiLi4vc3JjL3R3ZWFrLWxpZmVjeWNsZS50cyIsICIuLi9zcmMvbG9nZ2luZy50cyIsICIuLi9zcmMvdHdlYWstc3RvcmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogTWFpbi1wcm9jZXNzIGJvb3RzdHJhcC4gTG9hZGVkIGJ5IHRoZSBhc2FyIGxvYWRlciBiZWZvcmUgQ29kZXgncyBvd25cbiAqIG1haW4gcHJvY2VzcyBjb2RlIHJ1bnMuIFdlIGhvb2sgYEJyb3dzZXJXaW5kb3dgIHNvIGV2ZXJ5IHdpbmRvdyBDb2RleFxuICogY3JlYXRlcyBnZXRzIG91ciBwcmVsb2FkIHNjcmlwdCBhdHRhY2hlZC4gV2UgYWxzbyBzdGFuZCB1cCBhbiBJUENcbiAqIGNoYW5uZWwgZm9yIHR3ZWFrcyB0byB0YWxrIHRvIHRoZSBtYWluIHByb2Nlc3MuXG4gKlxuICogV2UgYXJlIGluIENKUyBsYW5kIGhlcmUgKG1hdGNoZXMgRWxlY3Ryb24ncyBtYWluIHByb2Nlc3MgYW5kIENvZGV4J3Mgb3duXG4gKiBjb2RlKS4gVGhlIHJlbmRlcmVyLXNpZGUgcnVudGltZSBpcyBidW5kbGVkIHNlcGFyYXRlbHkgaW50byBwcmVsb2FkLmpzLlxuICovXG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJWaWV3LCBCcm93c2VyV2luZG93LCBjbGlwYm9hcmQsIGlwY01haW4sIHNlc3Npb24sIHNoZWxsLCB3ZWJDb250ZW50cyB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgY3BTeW5jLCBleGlzdHNTeW5jLCBta2RpclN5bmMsIG1rZHRlbXBTeW5jLCByZWFkZGlyU3luYywgcmVhZEZpbGVTeW5jLCBybVN5bmMsIHN0YXRTeW5jLCB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGV4ZWNGaWxlU3luYywgc3Bhd24sIHNwYXduU3luYyB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IGRpcm5hbWUsIGlzQWJzb2x1dGUsIGpvaW4sIHJlbGF0aXZlLCByZXNvbHZlIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgaG9tZWRpciwgdG1wZGlyIH0gZnJvbSBcIm5vZGU6b3NcIjtcbmltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcbmltcG9ydCB7IGRpc2NvdmVyVHdlYWtzLCB0eXBlIERpc2NvdmVyZWRUd2VhayB9IGZyb20gXCIuL3R3ZWFrLWRpc2NvdmVyeVwiO1xuaW1wb3J0IHsgY3JlYXRlRGlza1N0b3JhZ2UsIHR5cGUgRGlza1N0b3JhZ2UgfSBmcm9tIFwiLi9zdG9yYWdlXCI7XG5pbXBvcnQgeyBzeW5jTWFuYWdlZE1jcFNlcnZlcnMgfSBmcm9tIFwiLi9tY3Atc3luY1wiO1xuaW1wb3J0IHsgZ2V0V2F0Y2hlckhlYWx0aCB9IGZyb20gXCIuL3dhdGNoZXItaGVhbHRoXCI7XG5pbXBvcnQge1xuICBpc01haW5Qcm9jZXNzVHdlYWtTY29wZSxcbiAgcmVsb2FkVHdlYWtzLFxuICBzZXRUd2Vha0VuYWJsZWRBbmRSZWxvYWQsXG59IGZyb20gXCIuL3R3ZWFrLWxpZmVjeWNsZVwiO1xuaW1wb3J0IHsgYXBwZW5kQ2FwcGVkTG9nIH0gZnJvbSBcIi4vbG9nZ2luZ1wiO1xuaW1wb3J0IHR5cGUgeyBUd2Vha01hbmlmZXN0IH0gZnJvbSBcIkBjb2RleC1wbHVzcGx1cy9zZGtcIjtcbmltcG9ydCB7XG4gIERFRkFVTFRfVFdFQUtfU1RPUkVfSU5ERVhfVVJMLFxuICBub3JtYWxpemVHaXRIdWJSZXBvLFxuICBub3JtYWxpemVTdG9yZVJlZ2lzdHJ5LFxuICBzdG9yZUFyY2hpdmVVcmwsXG4gIHR5cGUgVHdlYWtTdG9yZVB1Ymxpc2hTdWJtaXNzaW9uLFxuICB0eXBlIFR3ZWFrU3RvcmVFbnRyeSxcbiAgdHlwZSBUd2Vha1N0b3JlUmVnaXN0cnksXG4gIHR5cGUgVHdlYWtTdG9yZVBsYXRmb3JtLFxufSBmcm9tIFwiLi90d2Vhay1zdG9yZVwiO1xuXG5jb25zdCB1c2VyUm9vdCA9IHByb2Nlc3MuZW52LkNPREVYX1BMVVNQTFVTX1VTRVJfUk9PVDtcbmNvbnN0IHJ1bnRpbWVEaXIgPSBwcm9jZXNzLmVudi5DT0RFWF9QTFVTUExVU19SVU5USU1FO1xuXG5pZiAoIXVzZXJSb290IHx8ICFydW50aW1lRGlyKSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBcImNvZGV4LXBsdXNwbHVzIHJ1bnRpbWUgc3RhcnRlZCB3aXRob3V0IENPREVYX1BMVVNQTFVTX1VTRVJfUk9PVC9SVU5USU1FIGVudnNcIixcbiAgKTtcbn1cblxuY29uc3QgUFJFTE9BRF9QQVRIID0gcmVzb2x2ZShydW50aW1lRGlyLCBcInByZWxvYWQuanNcIik7XG5jb25zdCBUV0VBS1NfRElSID0gam9pbih1c2VyUm9vdCwgXCJ0d2Vha3NcIik7XG5jb25zdCBMT0dfRElSID0gam9pbih1c2VyUm9vdCwgXCJsb2dcIik7XG5jb25zdCBMT0dfRklMRSA9IGpvaW4oTE9HX0RJUiwgXCJtYWluLmxvZ1wiKTtcbmNvbnN0IENPTkZJR19GSUxFID0gam9pbih1c2VyUm9vdCwgXCJjb25maWcuanNvblwiKTtcbmNvbnN0IENPREVYX0NPTkZJR19GSUxFID0gam9pbihob21lZGlyKCksIFwiLmNvZGV4XCIsIFwiY29uZmlnLnRvbWxcIik7XG5jb25zdCBJTlNUQUxMRVJfU1RBVEVfRklMRSA9IGpvaW4odXNlclJvb3QsIFwic3RhdGUuanNvblwiKTtcbmNvbnN0IFVQREFURV9NT0RFX0ZJTEUgPSBqb2luKHVzZXJSb290LCBcInVwZGF0ZS1tb2RlLmpzb25cIik7XG5jb25zdCBTRUxGX1VQREFURV9TVEFURV9GSUxFID0gam9pbih1c2VyUm9vdCwgXCJzZWxmLXVwZGF0ZS1zdGF0ZS5qc29uXCIpO1xuY29uc3QgU0lHTkVEX0NPREVYX0JBQ0tVUCA9IGpvaW4odXNlclJvb3QsIFwiYmFja3VwXCIsIFwiQ29kZXguYXBwXCIpO1xuY29uc3QgQ09ERVhfUExVU1BMVVNfVkVSU0lPTiA9IFwiMC4xLjVcIjtcbmNvbnN0IENPREVYX1BMVVNQTFVTX1JFUE8gPSBcImItbm5ldHQvY29kZXgtcGx1c3BsdXNcIjtcbmNvbnN0IFRXRUFLX1NUT1JFX0lOREVYX1VSTCA9IHByb2Nlc3MuZW52LkNPREVYX1BMVVNQTFVTX1NUT1JFX0lOREVYX1VSTCA/PyBERUZBVUxUX1RXRUFLX1NUT1JFX0lOREVYX1VSTDtcbmNvbnN0IENPREVYX1dJTkRPV19TRVJWSUNFU19LRVkgPSBcIl9fY29kZXhwcF93aW5kb3dfc2VydmljZXNfX1wiO1xuXG5ta2RpclN5bmMoTE9HX0RJUiwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5ta2RpclN5bmMoVFdFQUtTX0RJUiwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbi8vIE9wdGlvbmFsOiBlbmFibGUgQ2hyb21lIERldlRvb2xzIFByb3RvY29sIG9uIGEgVENQIHBvcnQgc28gd2UgY2FuIGRyaXZlIHRoZVxuLy8gcnVubmluZyBDb2RleCBmcm9tIG91dHNpZGUgKGN1cmwgaHR0cDovL2xvY2FsaG9zdDo8cG9ydD4vanNvbiwgYXR0YWNoIHZpYVxuLy8gQ0RQIFdlYlNvY2tldCwgdGFrZSBzY3JlZW5zaG90cywgZXZhbHVhdGUgaW4gcmVuZGVyZXIsIGV0Yy4pLiBDb2RleCdzXG4vLyBwcm9kdWN0aW9uIGJ1aWxkIHNldHMgd2ViUHJlZmVyZW5jZXMuZGV2VG9vbHM9ZmFsc2UsIHdoaWNoIGtpbGxzIHRoZVxuLy8gaW4td2luZG93IERldlRvb2xzIHNob3J0Y3V0LCBidXQgYC0tcmVtb3RlLWRlYnVnZ2luZy1wb3J0YCB3b3JrcyByZWdhcmRsZXNzXG4vLyBiZWNhdXNlIGl0J3MgYSBDaHJvbWl1bSBjb21tYW5kLWxpbmUgc3dpdGNoIHByb2Nlc3NlZCBiZWZvcmUgYXBwIGluaXQuXG4vL1xuLy8gT2ZmIGJ5IGRlZmF1bHQuIFNldCBDT0RFWFBQX1JFTU9URV9ERUJVRz0xIChvcHRpb25hbGx5IENPREVYUFBfUkVNT1RFX0RFQlVHX1BPUlQpXG4vLyB0byB0dXJuIGl0IG9uLiBNdXN0IGJlIGFwcGVuZGVkIGJlZm9yZSBgYXBwYCBiZWNvbWVzIHJlYWR5OyB3ZSdyZSBhdCBtb2R1bGVcbi8vIHRvcC1sZXZlbCBzbyB0aGF0J3MgZmluZS5cbmlmIChwcm9jZXNzLmVudi5DT0RFWFBQX1JFTU9URV9ERUJVRyA9PT0gXCIxXCIpIHtcbiAgY29uc3QgcG9ydCA9IHByb2Nlc3MuZW52LkNPREVYUFBfUkVNT1RFX0RFQlVHX1BPUlQgPz8gXCI5MjIyXCI7XG4gIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goXCJyZW1vdGUtZGVidWdnaW5nLXBvcnRcIiwgcG9ydCk7XG4gIGxvZyhcImluZm9cIiwgYHJlbW90ZSBkZWJ1Z2dpbmcgZW5hYmxlZCBvbiBwb3J0ICR7cG9ydH1gKTtcbn1cblxuaW50ZXJmYWNlIFBlcnNpc3RlZFN0YXRlIHtcbiAgY29kZXhQbHVzUGx1cz86IHtcbiAgICBhdXRvVXBkYXRlPzogYm9vbGVhbjtcbiAgICBzYWZlTW9kZT86IGJvb2xlYW47XG4gICAgdXBkYXRlQ2hhbm5lbD86IFNlbGZVcGRhdGVDaGFubmVsO1xuICAgIHVwZGF0ZVJlcG8/OiBzdHJpbmc7XG4gICAgdXBkYXRlUmVmPzogc3RyaW5nO1xuICAgIHVwZGF0ZUNoZWNrPzogQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrO1xuICB9O1xuICAvKiogUGVyLXR3ZWFrIGVuYWJsZSBmbGFncy4gTWlzc2luZyBlbnRyaWVzIGRlZmF1bHQgdG8gZW5hYmxlZC4gKi9cbiAgdHdlYWtzPzogUmVjb3JkPHN0cmluZywgeyBlbmFibGVkPzogYm9vbGVhbiB9PjtcbiAgLyoqIENhY2hlZCBHaXRIdWIgcmVsZWFzZSBjaGVja3MuIFJ1bnRpbWUgbmV2ZXIgYXV0by1pbnN0YWxscyB1cGRhdGVzLiAqL1xuICB0d2Vha1VwZGF0ZUNoZWNrcz86IFJlY29yZDxzdHJpbmcsIFR3ZWFrVXBkYXRlQ2hlY2s+O1xufVxuXG5pbnRlcmZhY2UgQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrIHtcbiAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gIGN1cnJlbnRWZXJzaW9uOiBzdHJpbmc7XG4gIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gIHJlbGVhc2VOb3Rlczogc3RyaW5nIHwgbnVsbDtcbiAgdXBkYXRlQXZhaWxhYmxlOiBib29sZWFuO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxudHlwZSBTZWxmVXBkYXRlQ2hhbm5lbCA9IFwic3RhYmxlXCIgfCBcInByZXJlbGVhc2VcIiB8IFwiY3VzdG9tXCI7XG50eXBlIFNlbGZVcGRhdGVTdGF0dXMgPSBcImNoZWNraW5nXCIgfCBcInVwLXRvLWRhdGVcIiB8IFwidXBkYXRlZFwiIHwgXCJmYWlsZWRcIiB8IFwiZGlzYWJsZWRcIjtcblxuaW50ZXJmYWNlIFNlbGZVcGRhdGVTdGF0ZSB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBjb21wbGV0ZWRBdD86IHN0cmluZztcbiAgc3RhdHVzOiBTZWxmVXBkYXRlU3RhdHVzO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICB0YXJnZXRSZWY6IHN0cmluZyB8IG51bGw7XG4gIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gIHJlcG86IHN0cmluZztcbiAgY2hhbm5lbDogU2VsZlVwZGF0ZUNoYW5uZWw7XG4gIHNvdXJjZVJvb3Q6IHN0cmluZztcbiAgaW5zdGFsbGF0aW9uU291cmNlPzogSW5zdGFsbGF0aW9uU291cmNlO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEluc3RhbGxhdGlvblNvdXJjZSB7XG4gIGtpbmQ6IFwiZ2l0aHViLXNvdXJjZVwiIHwgXCJob21lYnJld1wiIHwgXCJsb2NhbC1kZXZcIiB8IFwic291cmNlLWFyY2hpdmVcIiB8IFwidW5rbm93blwiO1xuICBsYWJlbDogc3RyaW5nO1xuICBkZXRhaWw6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFR3ZWFrVXBkYXRlQ2hlY2sge1xuICBjaGVja2VkQXQ6IHN0cmluZztcbiAgcmVwbzogc3RyaW5nO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICBsYXRlc3RUYWc6IHN0cmluZyB8IG51bGw7XG4gIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gIHVwZGF0ZUF2YWlsYWJsZTogYm9vbGVhbjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHJlYWRTdGF0ZSgpOiBQZXJzaXN0ZWRTdGF0ZSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKENPTkZJR19GSUxFLCBcInV0ZjhcIikpIGFzIFBlcnNpc3RlZFN0YXRlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge307XG4gIH1cbn1cbmZ1bmN0aW9uIHdyaXRlU3RhdGUoczogUGVyc2lzdGVkU3RhdGUpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICB3cml0ZUZpbGVTeW5jKENPTkZJR19GSUxFLCBKU09OLnN0cmluZ2lmeShzLCBudWxsLCAyKSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwid3JpdGVTdGF0ZSBmYWlsZWQ6XCIsIFN0cmluZygoZSBhcyBFcnJvcikubWVzc2FnZSkpO1xuICB9XG59XG5mdW5jdGlvbiBpc0NvZGV4UGx1c1BsdXNBdXRvVXBkYXRlRW5hYmxlZCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIHJlYWRTdGF0ZSgpLmNvZGV4UGx1c1BsdXM/LmF1dG9VcGRhdGUgIT09IGZhbHNlO1xufVxuZnVuY3Rpb24gc2V0Q29kZXhQbHVzUGx1c0F1dG9VcGRhdGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHMuY29kZXhQbHVzUGx1cyA/Pz0ge307XG4gIHMuY29kZXhQbHVzUGx1cy5hdXRvVXBkYXRlID0gZW5hYmxlZDtcbiAgd3JpdGVTdGF0ZShzKTtcbn1cbmZ1bmN0aW9uIHNldENvZGV4UGx1c1BsdXNVcGRhdGVDb25maWcoY29uZmlnOiB7XG4gIHVwZGF0ZUNoYW5uZWw/OiBTZWxmVXBkYXRlQ2hhbm5lbDtcbiAgdXBkYXRlUmVwbz86IHN0cmluZztcbiAgdXBkYXRlUmVmPzogc3RyaW5nO1xufSk6IHZvaWQge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHMuY29kZXhQbHVzUGx1cyA/Pz0ge307XG4gIGlmIChjb25maWcudXBkYXRlQ2hhbm5lbCkgcy5jb2RleFBsdXNQbHVzLnVwZGF0ZUNoYW5uZWwgPSBjb25maWcudXBkYXRlQ2hhbm5lbDtcbiAgaWYgKFwidXBkYXRlUmVwb1wiIGluIGNvbmZpZykgcy5jb2RleFBsdXNQbHVzLnVwZGF0ZVJlcG8gPSBjbGVhbk9wdGlvbmFsU3RyaW5nKGNvbmZpZy51cGRhdGVSZXBvKTtcbiAgaWYgKFwidXBkYXRlUmVmXCIgaW4gY29uZmlnKSBzLmNvZGV4UGx1c1BsdXMudXBkYXRlUmVmID0gY2xlYW5PcHRpb25hbFN0cmluZyhjb25maWcudXBkYXRlUmVmKTtcbiAgd3JpdGVTdGF0ZShzKTtcbn1cbmZ1bmN0aW9uIGlzQ29kZXhQbHVzUGx1c1NhZmVNb2RlRW5hYmxlZCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIHJlYWRTdGF0ZSgpLmNvZGV4UGx1c1BsdXM/LnNhZmVNb2RlID09PSB0cnVlO1xufVxuZnVuY3Rpb24gaXNUd2Vha0VuYWJsZWQoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIGlmIChzLmNvZGV4UGx1c1BsdXM/LnNhZmVNb2RlID09PSB0cnVlKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzLnR3ZWFrcz8uW2lkXT8uZW5hYmxlZCAhPT0gZmFsc2U7XG59XG5mdW5jdGlvbiBzZXRUd2Vha0VuYWJsZWQoaWQ6IHN0cmluZywgZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHMudHdlYWtzID8/PSB7fTtcbiAgcy50d2Vha3NbaWRdID0geyAuLi5zLnR3ZWFrc1tpZF0sIGVuYWJsZWQgfTtcbiAgd3JpdGVTdGF0ZShzKTtcbn1cblxuaW50ZXJmYWNlIEluc3RhbGxlclN0YXRlIHtcbiAgYXBwUm9vdDogc3RyaW5nO1xuICBjb2RleFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIHNvdXJjZVJvb3Q/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHJlYWRJbnN0YWxsZXJTdGF0ZSgpOiBJbnN0YWxsZXJTdGF0ZSB8IG51bGwge1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhJTlNUQUxMRVJfU1RBVEVfRklMRSwgXCJ1dGY4XCIpKSBhcyBJbnN0YWxsZXJTdGF0ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZFNlbGZVcGRhdGVTdGF0ZSgpOiBTZWxmVXBkYXRlU3RhdGUgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoU0VMRl9VUERBVEVfU1RBVEVfRklMRSwgXCJ1dGY4XCIpKSBhcyBTZWxmVXBkYXRlU3RhdGU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFuT3B0aW9uYWxTdHJpbmcodmFsdWU6IHVua25vd24pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcInN0cmluZ1wiKSByZXR1cm4gdW5kZWZpbmVkO1xuICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICByZXR1cm4gdHJpbW1lZCA/IHRyaW1tZWQgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzUGF0aEluc2lkZShwYXJlbnQ6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgcmVsID0gcmVsYXRpdmUocmVzb2x2ZShwYXJlbnQpLCByZXNvbHZlKHRhcmdldCkpO1xuICByZXR1cm4gcmVsID09PSBcIlwiIHx8ICghIXJlbCAmJiAhcmVsLnN0YXJ0c1dpdGgoXCIuLlwiKSAmJiAhaXNBYnNvbHV0ZShyZWwpKTtcbn1cblxuZnVuY3Rpb24gbG9nKGxldmVsOiBcImluZm9cIiB8IFwid2FyblwiIHwgXCJlcnJvclwiLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgY29uc3QgbGluZSA9IGBbJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9XSBbJHtsZXZlbH1dICR7YXJnc1xuICAgIC5tYXAoKGEpID0+ICh0eXBlb2YgYSA9PT0gXCJzdHJpbmdcIiA/IGEgOiBKU09OLnN0cmluZ2lmeShhKSkpXG4gICAgLmpvaW4oXCIgXCIpfVxcbmA7XG4gIHRyeSB7XG4gICAgYXBwZW5kQ2FwcGVkTG9nKExPR19GSUxFLCBsaW5lKTtcbiAgfSBjYXRjaCB7fVxuICBpZiAobGV2ZWwgPT09IFwiZXJyb3JcIikgY29uc29sZS5lcnJvcihcIltjb2RleC1wbHVzcGx1c11cIiwgLi4uYXJncyk7XG59XG5cbmZ1bmN0aW9uIGluc3RhbGxTcGFya2xlVXBkYXRlSG9vaygpOiB2b2lkIHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09IFwiZGFyd2luXCIpIHJldHVybjtcblxuICBjb25zdCBNb2R1bGUgPSByZXF1aXJlKFwibm9kZTptb2R1bGVcIikgYXMgdHlwZW9mIGltcG9ydChcIm5vZGU6bW9kdWxlXCIpICYge1xuICAgIF9sb2FkPzogKHJlcXVlc3Q6IHN0cmluZywgcGFyZW50OiB1bmtub3duLCBpc01haW46IGJvb2xlYW4pID0+IHVua25vd247XG4gIH07XG4gIGNvbnN0IG9yaWdpbmFsTG9hZCA9IE1vZHVsZS5fbG9hZDtcbiAgaWYgKHR5cGVvZiBvcmlnaW5hbExvYWQgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuXG4gIE1vZHVsZS5fbG9hZCA9IGZ1bmN0aW9uIGNvZGV4UGx1c1BsdXNNb2R1bGVMb2FkKHJlcXVlc3Q6IHN0cmluZywgcGFyZW50OiB1bmtub3duLCBpc01haW46IGJvb2xlYW4pIHtcbiAgICBjb25zdCBsb2FkZWQgPSBvcmlnaW5hbExvYWQuYXBwbHkodGhpcywgW3JlcXVlc3QsIHBhcmVudCwgaXNNYWluXSkgYXMgdW5rbm93bjtcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QgPT09IFwic3RyaW5nXCIgJiYgL3NwYXJrbGUoPzpcXC5ub2RlKT8kL2kudGVzdChyZXF1ZXN0KSkge1xuICAgICAgd3JhcFNwYXJrbGVFeHBvcnRzKGxvYWRlZCk7XG4gICAgfVxuICAgIHJldHVybiBsb2FkZWQ7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXBTcGFya2xlRXhwb3J0cyhsb2FkZWQ6IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKCFsb2FkZWQgfHwgdHlwZW9mIGxvYWRlZCAhPT0gXCJvYmplY3RcIikgcmV0dXJuO1xuICBjb25zdCBleHBvcnRzID0gbG9hZGVkIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+ICYgeyBfX2NvZGV4cHBTcGFya2xlV3JhcHBlZD86IGJvb2xlYW4gfTtcbiAgaWYgKGV4cG9ydHMuX19jb2RleHBwU3BhcmtsZVdyYXBwZWQpIHJldHVybjtcbiAgZXhwb3J0cy5fX2NvZGV4cHBTcGFya2xlV3JhcHBlZCA9IHRydWU7XG5cbiAgZm9yIChjb25zdCBuYW1lIG9mIFtcImluc3RhbGxVcGRhdGVzSWZBdmFpbGFibGVcIl0pIHtcbiAgICBjb25zdCBmbiA9IGV4cG9ydHNbbmFtZV07XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSBjb250aW51ZTtcbiAgICBleHBvcnRzW25hbWVdID0gZnVuY3Rpb24gY29kZXhQbHVzUGx1c1NwYXJrbGVXcmFwcGVyKHRoaXM6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkge1xuICAgICAgcHJlcGFyZVNpZ25lZENvZGV4Rm9yU3BhcmtsZUluc3RhbGwoKTtcbiAgICAgIHJldHVybiBSZWZsZWN0LmFwcGx5KGZuLCB0aGlzLCBhcmdzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKGV4cG9ydHMuZGVmYXVsdCAmJiBleHBvcnRzLmRlZmF1bHQgIT09IGV4cG9ydHMpIHtcbiAgICB3cmFwU3BhcmtsZUV4cG9ydHMoZXhwb3J0cy5kZWZhdWx0KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmVwYXJlU2lnbmVkQ29kZXhGb3JTcGFya2xlSW5zdGFsbCgpOiB2b2lkIHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09IFwiZGFyd2luXCIpIHJldHVybjtcbiAgaWYgKGV4aXN0c1N5bmMoVVBEQVRFX01PREVfRklMRSkpIHtcbiAgICBsb2coXCJpbmZvXCIsIFwiU3BhcmtsZSB1cGRhdGUgcHJlcCBza2lwcGVkOyB1cGRhdGUgbW9kZSBhbHJlYWR5IGFjdGl2ZVwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFleGlzdHNTeW5jKFNJR05FRF9DT0RFWF9CQUNLVVApKSB7XG4gICAgbG9nKFwid2FyblwiLCBcIlNwYXJrbGUgdXBkYXRlIHByZXAgc2tpcHBlZDsgc2lnbmVkIENvZGV4LmFwcCBiYWNrdXAgaXMgbWlzc2luZ1wiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFpc0RldmVsb3BlcklkU2lnbmVkQXBwKFNJR05FRF9DT0RFWF9CQUNLVVApKSB7XG4gICAgbG9nKFwid2FyblwiLCBcIlNwYXJrbGUgdXBkYXRlIHByZXAgc2tpcHBlZDsgQ29kZXguYXBwIGJhY2t1cCBpcyBub3QgRGV2ZWxvcGVyIElEIHNpZ25lZFwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzdGF0ZSA9IHJlYWRJbnN0YWxsZXJTdGF0ZSgpO1xuICBjb25zdCBhcHBSb290ID0gc3RhdGU/LmFwcFJvb3QgPz8gaW5mZXJNYWNBcHBSb290KCk7XG4gIGlmICghYXBwUm9vdCkge1xuICAgIGxvZyhcIndhcm5cIiwgXCJTcGFya2xlIHVwZGF0ZSBwcmVwIHNraXBwZWQ7IGNvdWxkIG5vdCBpbmZlciBDb2RleC5hcHAgcGF0aFwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBtb2RlID0ge1xuICAgIGVuYWJsZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGFwcFJvb3QsXG4gICAgY29kZXhWZXJzaW9uOiBzdGF0ZT8uY29kZXhWZXJzaW9uID8/IG51bGwsXG4gIH07XG4gIHdyaXRlRmlsZVN5bmMoVVBEQVRFX01PREVfRklMRSwgSlNPTi5zdHJpbmdpZnkobW9kZSwgbnVsbCwgMikpO1xuXG4gIHRyeSB7XG4gICAgZXhlY0ZpbGVTeW5jKFwiZGl0dG9cIiwgW1NJR05FRF9DT0RFWF9CQUNLVVAsIGFwcFJvb3RdLCB7IHN0ZGlvOiBcImlnbm9yZVwiIH0pO1xuICAgIHRyeSB7XG4gICAgICBleGVjRmlsZVN5bmMoXCJ4YXR0clwiLCBbXCItZHJcIiwgXCJjb20uYXBwbGUucXVhcmFudGluZVwiLCBhcHBSb290XSwgeyBzdGRpbzogXCJpZ25vcmVcIiB9KTtcbiAgICB9IGNhdGNoIHt9XG4gICAgbG9nKFwiaW5mb1wiLCBcIlJlc3RvcmVkIHNpZ25lZCBDb2RleC5hcHAgYmVmb3JlIFNwYXJrbGUgaW5zdGFsbFwiLCB7IGFwcFJvb3QgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJlcnJvclwiLCBcIkZhaWxlZCB0byByZXN0b3JlIHNpZ25lZCBDb2RleC5hcHAgYmVmb3JlIFNwYXJrbGUgaW5zdGFsbFwiLCB7XG4gICAgICBtZXNzYWdlOiAoZSBhcyBFcnJvcikubWVzc2FnZSxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0RldmVsb3BlcklkU2lnbmVkQXBwKGFwcFJvb3Q6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCByZXN1bHQgPSBzcGF3blN5bmMoXCJjb2Rlc2lnblwiLCBbXCItZHZcIiwgXCItLXZlcmJvc2U9NFwiLCBhcHBSb290XSwge1xuICAgIGVuY29kaW5nOiBcInV0ZjhcIixcbiAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXG4gIH0pO1xuICBjb25zdCBvdXRwdXQgPSBgJHtyZXN1bHQuc3Rkb3V0ID8/IFwiXCJ9JHtyZXN1bHQuc3RkZXJyID8/IFwiXCJ9YDtcbiAgcmV0dXJuIChcbiAgICByZXN1bHQuc3RhdHVzID09PSAwICYmXG4gICAgL0F1dGhvcml0eT1EZXZlbG9wZXIgSUQgQXBwbGljYXRpb246Ly50ZXN0KG91dHB1dCkgJiZcbiAgICAhL1NpZ25hdHVyZT1hZGhvYy8udGVzdChvdXRwdXQpICYmXG4gICAgIS9UZWFtSWRlbnRpZmllcj1ub3Qgc2V0Ly50ZXN0KG91dHB1dClcbiAgKTtcbn1cblxuZnVuY3Rpb24gaW5mZXJNYWNBcHBSb290KCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBtYXJrZXIgPSBcIi5hcHAvQ29udGVudHMvTWFjT1MvXCI7XG4gIGNvbnN0IGlkeCA9IHByb2Nlc3MuZXhlY1BhdGguaW5kZXhPZihtYXJrZXIpO1xuICByZXR1cm4gaWR4ID49IDAgPyBwcm9jZXNzLmV4ZWNQYXRoLnNsaWNlKDAsIGlkeCArIFwiLmFwcFwiLmxlbmd0aCkgOiBudWxsO1xufVxuXG4vLyBTdXJmYWNlIHVuaGFuZGxlZCBlcnJvcnMgZnJvbSBhbnl3aGVyZSBpbiB0aGUgbWFpbiBwcm9jZXNzIHRvIG91ciBsb2cuXG5wcm9jZXNzLm9uKFwidW5jYXVnaHRFeGNlcHRpb25cIiwgKGU6IEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH0pID0+IHtcbiAgbG9nKFwiZXJyb3JcIiwgXCJ1bmNhdWdodEV4Y2VwdGlvblwiLCB7IGNvZGU6IGUuY29kZSwgbWVzc2FnZTogZS5tZXNzYWdlLCBzdGFjazogZS5zdGFjayB9KTtcbn0pO1xucHJvY2Vzcy5vbihcInVuaGFuZGxlZFJlamVjdGlvblwiLCAoZSkgPT4ge1xuICBsb2coXCJlcnJvclwiLCBcInVuaGFuZGxlZFJlamVjdGlvblwiLCB7IHZhbHVlOiBTdHJpbmcoZSkgfSk7XG59KTtcblxuaW5zdGFsbFNwYXJrbGVVcGRhdGVIb29rKCk7XG5cbmludGVyZmFjZSBMb2FkZWRNYWluVHdlYWsge1xuICBzdG9wPzogKCkgPT4gdm9pZDtcbiAgc3RvcmFnZTogRGlza1N0b3JhZ2U7XG59XG5cbmludGVyZmFjZSBDb2RleFdpbmRvd1NlcnZpY2VzIHtcbiAgY3JlYXRlRnJlc2hMb2NhbFdpbmRvdz86IChyb3V0ZT86IHN0cmluZykgPT4gUHJvbWlzZTxFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbD47XG4gIGVuc3VyZUhvc3RXaW5kb3c/OiAoaG9zdElkPzogc3RyaW5nKSA9PiBQcm9taXNlPEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsPjtcbiAgZ2V0UHJpbWFyeVdpbmRvdz86IChob3N0SWQ/OiBzdHJpbmcpID0+IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCBudWxsO1xuICBnZXRDb250ZXh0PzogKGhvc3RJZDogc3RyaW5nKSA9PiB7IHJlZ2lzdGVyV2luZG93PzogKHdpbmRvd0xpa2U6IENvZGV4V2luZG93TGlrZSkgPT4gdm9pZCB9IHwgbnVsbDtcbiAgd2luZG93TWFuYWdlcj86IHtcbiAgICBjcmVhdGVXaW5kb3c/OiAob3B0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IFByb21pc2U8RWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGw+O1xuICAgIHJlZ2lzdGVyV2luZG93PzogKFxuICAgICAgd2luZG93TGlrZTogQ29kZXhXaW5kb3dMaWtlLFxuICAgICAgaG9zdElkOiBzdHJpbmcsXG4gICAgICBwcmltYXJ5OiBib29sZWFuLFxuICAgICAgYXBwZWFyYW5jZTogc3RyaW5nLFxuICAgICkgPT4gdm9pZDtcbiAgICBvcHRpb25zPzoge1xuICAgICAgYWxsb3dEZXZ0b29scz86IGJvb2xlYW47XG4gICAgICBwcmVsb2FkUGF0aD86IHN0cmluZztcbiAgICB9O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgQ29kZXhXaW5kb3dMaWtlIHtcbiAgaWQ6IG51bWJlcjtcbiAgd2ViQ29udGVudHM6IEVsZWN0cm9uLldlYkNvbnRlbnRzO1xuICBvbihldmVudDogXCJjbG9zZWRcIiwgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB1bmtub3duO1xuICBvbmNlPyhldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCk6IHVua25vd247XG4gIG9mZj8oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpOiB1bmtub3duO1xuICByZW1vdmVMaXN0ZW5lcj8oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpOiB1bmtub3duO1xuICBpc0Rlc3Ryb3llZD8oKTogYm9vbGVhbjtcbiAgaXNGb2N1c2VkPygpOiBib29sZWFuO1xuICBmb2N1cz8oKTogdm9pZDtcbiAgc2hvdz8oKTogdm9pZDtcbiAgaGlkZT8oKTogdm9pZDtcbiAgZ2V0Qm91bmRzPygpOiBFbGVjdHJvbi5SZWN0YW5nbGU7XG4gIGdldENvbnRlbnRCb3VuZHM/KCk6IEVsZWN0cm9uLlJlY3RhbmdsZTtcbiAgZ2V0U2l6ZT8oKTogW251bWJlciwgbnVtYmVyXTtcbiAgZ2V0Q29udGVudFNpemU/KCk6IFtudW1iZXIsIG51bWJlcl07XG4gIHNldFRpdGxlPyh0aXRsZTogc3RyaW5nKTogdm9pZDtcbiAgZ2V0VGl0bGU/KCk6IHN0cmluZztcbiAgc2V0UmVwcmVzZW50ZWRGaWxlbmFtZT8oZmlsZW5hbWU6IHN0cmluZyk6IHZvaWQ7XG4gIHNldERvY3VtZW50RWRpdGVkPyhlZGl0ZWQ6IGJvb2xlYW4pOiB2b2lkO1xuICBzZXRXaW5kb3dCdXR0b25WaXNpYmlsaXR5Pyh2aXNpYmxlOiBib29sZWFuKTogdm9pZDtcbn1cblxuaW50ZXJmYWNlIENvZGV4Q3JlYXRlV2luZG93T3B0aW9ucyB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIGhvc3RJZD86IHN0cmluZztcbiAgc2hvdz86IGJvb2xlYW47XG4gIGFwcGVhcmFuY2U/OiBzdHJpbmc7XG4gIHBhcmVudFdpbmRvd0lkPzogbnVtYmVyO1xuICBib3VuZHM/OiBFbGVjdHJvbi5SZWN0YW5nbGU7XG59XG5cbmludGVyZmFjZSBDb2RleENyZWF0ZVZpZXdPcHRpb25zIHtcbiAgcm91dGU6IHN0cmluZztcbiAgaG9zdElkPzogc3RyaW5nO1xuICBhcHBlYXJhbmNlPzogc3RyaW5nO1xufVxuXG5jb25zdCB0d2Vha1N0YXRlID0ge1xuICBkaXNjb3ZlcmVkOiBbXSBhcyBEaXNjb3ZlcmVkVHdlYWtbXSxcbiAgbG9hZGVkTWFpbjogbmV3IE1hcDxzdHJpbmcsIExvYWRlZE1haW5Ud2Vhaz4oKSxcbn07XG5cbmNvbnN0IHR3ZWFrTGlmZWN5Y2xlRGVwcyA9IHtcbiAgbG9nSW5mbzogKG1lc3NhZ2U6IHN0cmluZykgPT4gbG9nKFwiaW5mb1wiLCBtZXNzYWdlKSxcbiAgc2V0VHdlYWtFbmFibGVkLFxuICBzdG9wQWxsTWFpblR3ZWFrcyxcbiAgY2xlYXJUd2Vha01vZHVsZUNhY2hlLFxuICBsb2FkQWxsTWFpblR3ZWFrcyxcbiAgYnJvYWRjYXN0UmVsb2FkLFxufTtcblxuLy8gMS4gSG9vayBldmVyeSBzZXNzaW9uIHNvIG91ciBwcmVsb2FkIHJ1bnMgaW4gZXZlcnkgcmVuZGVyZXIuXG4vL1xuLy8gV2UgdXNlIEVsZWN0cm9uJ3MgbW9kZXJuIGBzZXNzaW9uLnJlZ2lzdGVyUHJlbG9hZFNjcmlwdGAgQVBJIChhZGRlZCBpblxuLy8gRWxlY3Ryb24gMzUpLiBUaGUgZGVwcmVjYXRlZCBgc2V0UHJlbG9hZHNgIHBhdGggc2lsZW50bHkgbm8tb3BzIGluIHNvbWVcbi8vIGNvbmZpZ3VyYXRpb25zIChub3RhYmx5IHdpdGggc2FuZGJveGVkIHJlbmRlcmVycyksIHNvIHJlZ2lzdGVyUHJlbG9hZFNjcmlwdFxuLy8gaXMgdGhlIG9ubHkgcmVsaWFibGUgd2F5IHRvIGluamVjdCBpbnRvIENvZGV4J3MgQnJvd3NlcldpbmRvd3MuXG5mdW5jdGlvbiByZWdpc3RlclByZWxvYWQoczogRWxlY3Ryb24uU2Vzc2lvbiwgbGFiZWw6IHN0cmluZyk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IHJlZyA9IChzIGFzIHVua25vd24gYXMge1xuICAgICAgcmVnaXN0ZXJQcmVsb2FkU2NyaXB0PzogKG9wdHM6IHtcbiAgICAgICAgdHlwZT86IFwiZnJhbWVcIiB8IFwic2VydmljZS13b3JrZXJcIjtcbiAgICAgICAgaWQ/OiBzdHJpbmc7XG4gICAgICAgIGZpbGVQYXRoOiBzdHJpbmc7XG4gICAgICB9KSA9PiBzdHJpbmc7XG4gICAgfSkucmVnaXN0ZXJQcmVsb2FkU2NyaXB0O1xuICAgIGlmICh0eXBlb2YgcmVnID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJlZy5jYWxsKHMsIHsgdHlwZTogXCJmcmFtZVwiLCBmaWxlUGF0aDogUFJFTE9BRF9QQVRILCBpZDogXCJjb2RleC1wbHVzcGx1c1wiIH0pO1xuICAgICAgbG9nKFwiaW5mb1wiLCBgcHJlbG9hZCByZWdpc3RlcmVkIChyZWdpc3RlclByZWxvYWRTY3JpcHQpIG9uICR7bGFiZWx9OmAsIFBSRUxPQURfUEFUSCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIEZhbGxiYWNrIGZvciBvbGRlciBFbGVjdHJvbiB2ZXJzaW9ucy5cbiAgICBjb25zdCBleGlzdGluZyA9IHMuZ2V0UHJlbG9hZHMoKTtcbiAgICBpZiAoIWV4aXN0aW5nLmluY2x1ZGVzKFBSRUxPQURfUEFUSCkpIHtcbiAgICAgIHMuc2V0UHJlbG9hZHMoWy4uLmV4aXN0aW5nLCBQUkVMT0FEX1BBVEhdKTtcbiAgICB9XG4gICAgbG9nKFwiaW5mb1wiLCBgcHJlbG9hZCByZWdpc3RlcmVkIChzZXRQcmVsb2Fkcykgb24gJHtsYWJlbH06YCwgUFJFTE9BRF9QQVRIKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IgJiYgZS5tZXNzYWdlLmluY2x1ZGVzKFwiZXhpc3RpbmcgSURcIikpIHtcbiAgICAgIGxvZyhcImluZm9cIiwgYHByZWxvYWQgYWxyZWFkeSByZWdpc3RlcmVkIG9uICR7bGFiZWx9OmAsIFBSRUxPQURfUEFUSCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxvZyhcImVycm9yXCIsIGBwcmVsb2FkIHJlZ2lzdHJhdGlvbiBvbiAke2xhYmVsfSBmYWlsZWQ6YCwgZSk7XG4gIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpLnRoZW4oKCkgPT4ge1xuICBsb2coXCJpbmZvXCIsIFwiYXBwIHJlYWR5IGZpcmVkXCIpO1xuICBpZiAoaXNDb2RleFBsdXNQbHVzU2FmZU1vZGVFbmFibGVkKCkpIHtcbiAgICBsb2coXCJ3YXJuXCIsIFwic2FmZSBtb2RlIGlzIGVuYWJsZWQ7IHByZWxvYWQgd2lsbCBub3QgYmUgcmVnaXN0ZXJlZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVnaXN0ZXJQcmVsb2FkKHNlc3Npb24uZGVmYXVsdFNlc3Npb24sIFwiZGVmYXVsdFNlc3Npb25cIik7XG59KTtcblxuYXBwLm9uKFwic2Vzc2lvbi1jcmVhdGVkXCIsIChzKSA9PiB7XG4gIGlmIChpc0NvZGV4UGx1c1BsdXNTYWZlTW9kZUVuYWJsZWQoKSkgcmV0dXJuO1xuICByZWdpc3RlclByZWxvYWQocywgXCJzZXNzaW9uLWNyZWF0ZWRcIik7XG59KTtcblxuLy8gRElBR05PU1RJQzogbG9nIGV2ZXJ5IHdlYkNvbnRlbnRzIGNyZWF0aW9uLiBVc2VmdWwgZm9yIHZlcmlmeWluZyBvdXJcbi8vIHByZWxvYWQgcmVhY2hlcyBldmVyeSByZW5kZXJlciBDb2RleCBzcGF3bnMuXG5hcHAub24oXCJ3ZWItY29udGVudHMtY3JlYXRlZFwiLCAoX2UsIHdjKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgd3AgPSAod2MgYXMgdW5rbm93biBhcyB7IGdldExhc3RXZWJQcmVmZXJlbmNlcz86ICgpID0+IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0pXG4gICAgICAuZ2V0TGFzdFdlYlByZWZlcmVuY2VzPy4oKTtcbiAgICBsb2coXCJpbmZvXCIsIFwid2ViLWNvbnRlbnRzLWNyZWF0ZWRcIiwge1xuICAgICAgaWQ6IHdjLmlkLFxuICAgICAgdHlwZTogd2MuZ2V0VHlwZSgpLFxuICAgICAgc2Vzc2lvbklzRGVmYXVsdDogd2Muc2Vzc2lvbiA9PT0gc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbixcbiAgICAgIHNhbmRib3g6IHdwPy5zYW5kYm94LFxuICAgICAgY29udGV4dElzb2xhdGlvbjogd3A/LmNvbnRleHRJc29sYXRpb24sXG4gICAgfSk7XG4gICAgd2Mub24oXCJwcmVsb2FkLWVycm9yXCIsIChfZXYsIHAsIGVycikgPT4ge1xuICAgICAgbG9nKFwiZXJyb3JcIiwgYHdjICR7d2MuaWR9IHByZWxvYWQtZXJyb3IgcGF0aD0ke3B9YCwgU3RyaW5nKGVycj8uc3RhY2sgPz8gZXJyKSk7XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJlcnJvclwiLCBcIndlYi1jb250ZW50cy1jcmVhdGVkIGhhbmRsZXIgZmFpbGVkOlwiLCBTdHJpbmcoKGUgYXMgRXJyb3IpPy5zdGFjayA/PyBlKSk7XG4gIH1cbn0pO1xuXG5sb2coXCJpbmZvXCIsIFwibWFpbi50cyBldmFsdWF0ZWQ7IGFwcC5pc1JlYWR5PVwiICsgYXBwLmlzUmVhZHkoKSk7XG5pZiAoaXNDb2RleFBsdXNQbHVzU2FmZU1vZGVFbmFibGVkKCkpIHtcbiAgbG9nKFwid2FyblwiLCBcInNhZmUgbW9kZSBpcyBlbmFibGVkOyB0d2Vha3Mgd2lsbCBub3QgYmUgbG9hZGVkXCIpO1xufVxuXG4vLyAyLiBJbml0aWFsIHR3ZWFrIGRpc2NvdmVyeSArIG1haW4tc2NvcGUgbG9hZC5cbmxvYWRBbGxNYWluVHdlYWtzKCk7XG5cbmFwcC5vbihcIndpbGwtcXVpdFwiLCAoKSA9PiB7XG4gIHN0b3BBbGxNYWluVHdlYWtzKCk7XG4gIC8vIEJlc3QtZWZmb3J0IGZsdXNoIG9mIGFueSBwZW5kaW5nIHN0b3JhZ2Ugd3JpdGVzLlxuICBmb3IgKGNvbnN0IHQgb2YgdHdlYWtTdGF0ZS5sb2FkZWRNYWluLnZhbHVlcygpKSB7XG4gICAgdHJ5IHtcbiAgICAgIHQuc3RvcmFnZS5mbHVzaCgpO1xuICAgIH0gY2F0Y2gge31cbiAgfVxufSk7XG5cbi8vIDMuIElQQzogZXhwb3NlIHR3ZWFrIG1ldGFkYXRhICsgcmV2ZWFsLWluLWZpbmRlci5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpsaXN0LXR3ZWFrc1wiLCBhc3luYyAoKSA9PiB7XG4gIGF3YWl0IFByb21pc2UuYWxsKHR3ZWFrU3RhdGUuZGlzY292ZXJlZC5tYXAoKHQpID0+IGVuc3VyZVR3ZWFrVXBkYXRlQ2hlY2sodCkpKTtcbiAgY29uc3QgdXBkYXRlQ2hlY2tzID0gcmVhZFN0YXRlKCkudHdlYWtVcGRhdGVDaGVja3MgPz8ge307XG4gIHJldHVybiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQubWFwKCh0KSA9PiAoe1xuICAgIG1hbmlmZXN0OiB0Lm1hbmlmZXN0LFxuICAgIGVudHJ5OiB0LmVudHJ5LFxuICAgIGRpcjogdC5kaXIsXG4gICAgZW50cnlFeGlzdHM6IGV4aXN0c1N5bmModC5lbnRyeSksXG4gICAgZW5hYmxlZDogaXNUd2Vha0VuYWJsZWQodC5tYW5pZmVzdC5pZCksXG4gICAgdXBkYXRlOiB1cGRhdGVDaGVja3NbdC5tYW5pZmVzdC5pZF0gPz8gbnVsbCxcbiAgfSkpO1xufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpnZXQtdHdlYWstZW5hYmxlZFwiLCAoX2UsIGlkOiBzdHJpbmcpID0+IGlzVHdlYWtFbmFibGVkKGlkKSk7XG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6c2V0LXR3ZWFrLWVuYWJsZWRcIiwgKF9lLCBpZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKSA9PiB7XG4gIHJldHVybiBzZXRUd2Vha0VuYWJsZWRBbmRSZWxvYWQoaWQsIGVuYWJsZWQsIHR3ZWFrTGlmZWN5Y2xlRGVwcyk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmdldC1jb25maWdcIiwgKCkgPT4ge1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIGNvbnN0IGluc3RhbGxlclN0YXRlID0gcmVhZEluc3RhbGxlclN0YXRlKCk7XG4gIGNvbnN0IHNvdXJjZVJvb3QgPSBpbnN0YWxsZXJTdGF0ZT8uc291cmNlUm9vdCA/PyBmYWxsYmFja1NvdXJjZVJvb3QoKTtcbiAgcmV0dXJuIHtcbiAgICB2ZXJzaW9uOiBDT0RFWF9QTFVTUExVU19WRVJTSU9OLFxuICAgIGF1dG9VcGRhdGU6IHMuY29kZXhQbHVzUGx1cz8uYXV0b1VwZGF0ZSAhPT0gZmFsc2UsXG4gICAgc2FmZU1vZGU6IHMuY29kZXhQbHVzUGx1cz8uc2FmZU1vZGUgPT09IHRydWUsXG4gICAgdXBkYXRlQ2hhbm5lbDogcy5jb2RleFBsdXNQbHVzPy51cGRhdGVDaGFubmVsID8/IFwic3RhYmxlXCIsXG4gICAgdXBkYXRlUmVwbzogcy5jb2RleFBsdXNQbHVzPy51cGRhdGVSZXBvID8/IENPREVYX1BMVVNQTFVTX1JFUE8sXG4gICAgdXBkYXRlUmVmOiBzLmNvZGV4UGx1c1BsdXM/LnVwZGF0ZVJlZiA/PyBcIlwiLFxuICAgIHVwZGF0ZUNoZWNrOiBzLmNvZGV4UGx1c1BsdXM/LnVwZGF0ZUNoZWNrID8/IG51bGwsXG4gICAgc2VsZlVwZGF0ZTogcmVhZFNlbGZVcGRhdGVTdGF0ZSgpLFxuICAgIGluc3RhbGxhdGlvblNvdXJjZTogZGVzY3JpYmVJbnN0YWxsYXRpb25Tb3VyY2Uoc291cmNlUm9vdCksXG4gIH07XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnNldC1hdXRvLXVwZGF0ZVwiLCAoX2UsIGVuYWJsZWQ6IGJvb2xlYW4pID0+IHtcbiAgc2V0Q29kZXhQbHVzUGx1c0F1dG9VcGRhdGUoISFlbmFibGVkKTtcbiAgcmV0dXJuIHsgYXV0b1VwZGF0ZTogaXNDb2RleFBsdXNQbHVzQXV0b1VwZGF0ZUVuYWJsZWQoKSB9O1xufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpzZXQtdXBkYXRlLWNvbmZpZ1wiLCAoX2UsIGNvbmZpZzoge1xuICB1cGRhdGVDaGFubmVsPzogU2VsZlVwZGF0ZUNoYW5uZWw7XG4gIHVwZGF0ZVJlcG8/OiBzdHJpbmc7XG4gIHVwZGF0ZVJlZj86IHN0cmluZztcbn0pID0+IHtcbiAgc2V0Q29kZXhQbHVzUGx1c1VwZGF0ZUNvbmZpZyhjb25maWcpO1xuICBjb25zdCBzID0gcmVhZFN0YXRlKCk7XG4gIHJldHVybiB7XG4gICAgdXBkYXRlQ2hhbm5lbDogcy5jb2RleFBsdXNQbHVzPy51cGRhdGVDaGFubmVsID8/IFwic3RhYmxlXCIsXG4gICAgdXBkYXRlUmVwbzogcy5jb2RleFBsdXNQbHVzPy51cGRhdGVSZXBvID8/IENPREVYX1BMVVNQTFVTX1JFUE8sXG4gICAgdXBkYXRlUmVmOiBzLmNvZGV4UGx1c1BsdXM/LnVwZGF0ZVJlZiA/PyBcIlwiLFxuICB9O1xufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDpjaGVjay1jb2RleHBwLXVwZGF0ZVwiLCBhc3luYyAoX2UsIGZvcmNlPzogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gZW5zdXJlQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrKGZvcmNlID09PSB0cnVlKTtcbn0pO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6cnVuLWNvZGV4cHAtdXBkYXRlXCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3Qgc291cmNlUm9vdCA9IHJlYWRJbnN0YWxsZXJTdGF0ZSgpPy5zb3VyY2VSb290ID8/IGZhbGxiYWNrU291cmNlUm9vdCgpO1xuICBjb25zdCBjbGkgPSBzb3VyY2VSb290ID8gam9pbihzb3VyY2VSb290LCBcInBhY2thZ2VzXCIsIFwiaW5zdGFsbGVyXCIsIFwiZGlzdFwiLCBcImNsaS5qc1wiKSA6IG51bGw7XG4gIGlmICghY2xpIHx8ICFleGlzdHNTeW5jKGNsaSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2RleCsrIHNvdXJjZSBDTEkgd2FzIG5vdCBmb3VuZC4gUnVuIHRoZSBpbnN0YWxsZXIgb25jZSwgdGhlbiB0cnkgYWdhaW4uXCIpO1xuICB9XG4gIGF3YWl0IHJ1bkluc3RhbGxlZENsaShjbGksIFtcInVwZGF0ZVwiLCBcIi0td2F0Y2hlclwiXSk7XG4gIHJldHVybiByZWFkU2VsZlVwZGF0ZVN0YXRlKCk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmdldC13YXRjaGVyLWhlYWx0aFwiLCAoKSA9PiBnZXRXYXRjaGVySGVhbHRoKHVzZXJSb290ISkpO1xuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6Z2V0LXR3ZWFrLXN0b3JlXCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3Qgc3RvcmUgPSBhd2FpdCBmZXRjaFR3ZWFrU3RvcmVSZWdpc3RyeSgpO1xuICBjb25zdCByZWdpc3RyeSA9IHN0b3JlLnJlZ2lzdHJ5O1xuICBjb25zdCBpbnN0YWxsZWQgPSBuZXcgTWFwKHR3ZWFrU3RhdGUuZGlzY292ZXJlZC5tYXAoKHQpID0+IFt0Lm1hbmlmZXN0LmlkLCB0XSkpO1xuICByZXR1cm4ge1xuICAgIC4uLnJlZ2lzdHJ5LFxuICAgIHNvdXJjZVVybDogVFdFQUtfU1RPUkVfSU5ERVhfVVJMLFxuICAgIGZldGNoZWRBdDogc3RvcmUuZmV0Y2hlZEF0LFxuICAgIGVudHJpZXM6IHJlZ2lzdHJ5LmVudHJpZXMubWFwKChlbnRyeSkgPT4ge1xuICAgICAgY29uc3QgbG9jYWwgPSBpbnN0YWxsZWQuZ2V0KGVudHJ5LmlkKTtcbiAgICAgIGNvbnN0IHBsYXRmb3JtID0gc3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eShlbnRyeSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5lbnRyeSxcbiAgICAgICAgcGxhdGZvcm0sXG4gICAgICAgIGluc3RhbGxlZDogbG9jYWxcbiAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgdmVyc2lvbjogbG9jYWwubWFuaWZlc3QudmVyc2lvbixcbiAgICAgICAgICAgICAgZW5hYmxlZDogaXNUd2Vha0VuYWJsZWQobG9jYWwubWFuaWZlc3QuaWQpLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIDogbnVsbCxcbiAgICAgIH07XG4gICAgfSksXG4gIH07XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmluc3RhbGwtc3RvcmUtdHdlYWtcIiwgYXN5bmMgKF9lLCBpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgcmVnaXN0cnkgfSA9IGF3YWl0IGZldGNoVHdlYWtTdG9yZVJlZ2lzdHJ5KCk7XG4gIGNvbnN0IGVudHJ5ID0gcmVnaXN0cnkuZW50cmllcy5maW5kKChjYW5kaWRhdGUpID0+IGNhbmRpZGF0ZS5pZCA9PT0gaWQpO1xuICBpZiAoIWVudHJ5KSB0aHJvdyBuZXcgRXJyb3IoYFR3ZWFrIHN0b3JlIGVudHJ5IG5vdCBmb3VuZDogJHtpZH1gKTtcbiAgYXNzZXJ0U3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJsZShlbnRyeSk7XG4gIGF3YWl0IGluc3RhbGxTdG9yZVR3ZWFrKGVudHJ5KTtcbiAgcmVsb2FkVHdlYWtzKFwic3RvcmUtaW5zdGFsbFwiLCB0d2Vha0xpZmVjeWNsZURlcHMpO1xuICByZXR1cm4geyBpbnN0YWxsZWQ6IGVudHJ5LmlkIH07XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnByZXBhcmUtdHdlYWstc3RvcmUtc3VibWlzc2lvblwiLCBhc3luYyAoX2UsIHJlcG9JbnB1dDogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBwcmVwYXJlVHdlYWtTdG9yZVN1Ym1pc3Npb24ocmVwb0lucHV0KTtcbn0pO1xuXG4vLyBTYW5kYm94ZWQgcmVuZGVyZXIgcHJlbG9hZCBjYW4ndCB1c2UgTm9kZSBmcyB0byByZWFkIHR3ZWFrIHNvdXJjZS4gTWFpblxuLy8gcmVhZHMgaXQgb24gdGhlIHJlbmRlcmVyJ3MgYmVoYWxmLiBQYXRoIG11c3QgbGl2ZSB1bmRlciB0d2Vha3NEaXIgZm9yXG4vLyBzZWN1cml0eSBcdTIwMTQgd2UgcmVmdXNlIGFueXRoaW5nIGVsc2UuXG5pcGNNYWluLmhhbmRsZShcImNvZGV4cHA6cmVhZC10d2Vhay1zb3VyY2VcIiwgKF9lLCBlbnRyeVBhdGg6IHN0cmluZykgPT4ge1xuICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmUoZW50cnlQYXRoKTtcbiAgaWYgKCFpc1BhdGhJbnNpZGUoVFdFQUtTX0RJUiwgcmVzb2x2ZWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwicGF0aCBvdXRzaWRlIHR3ZWFrcyBkaXJcIik7XG4gIH1cbiAgcmV0dXJuIHJlcXVpcmUoXCJub2RlOmZzXCIpLnJlYWRGaWxlU3luYyhyZXNvbHZlZCwgXCJ1dGY4XCIpO1xufSk7XG5cbi8qKlxuICogUmVhZCBhbiBhcmJpdHJhcnkgYXNzZXQgZmlsZSBmcm9tIGluc2lkZSBhIHR3ZWFrJ3MgZGlyZWN0b3J5IGFuZCByZXR1cm4gaXRcbiAqIGFzIGEgYGRhdGE6YCBVUkwuIFVzZWQgYnkgdGhlIHNldHRpbmdzIGluamVjdG9yIHRvIHJlbmRlciBtYW5pZmVzdCBpY29uc1xuICogKHRoZSByZW5kZXJlciBpcyBzYW5kYm94ZWQ7IGBmaWxlOi8vYCB3b24ndCBsb2FkKS5cbiAqXG4gKiBTZWN1cml0eTogY2FsbGVyIHBhc3NlcyBgdHdlYWtEaXJgIGFuZCBgcmVsUGF0aGA7IHdlICgxKSByZXF1aXJlIHR3ZWFrRGlyXG4gKiB0byBsaXZlIHVuZGVyIFRXRUFLU19ESVIsICgyKSByZXNvbHZlIHJlbFBhdGggYWdhaW5zdCBpdCBhbmQgcmUtY2hlY2sgdGhlXG4gKiByZXN1bHQgc3RpbGwgbGl2ZXMgdW5kZXIgVFdFQUtTX0RJUiwgKDMpIGNhcCBvdXRwdXQgc2l6ZSBhdCAxIE1pQi5cbiAqL1xuY29uc3QgQVNTRVRfTUFYX0JZVEVTID0gMTAyNCAqIDEwMjQ7XG5jb25zdCBNSU1FX0JZX0VYVDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCIucG5nXCI6IFwiaW1hZ2UvcG5nXCIsXG4gIFwiLmpwZ1wiOiBcImltYWdlL2pwZWdcIixcbiAgXCIuanBlZ1wiOiBcImltYWdlL2pwZWdcIixcbiAgXCIuZ2lmXCI6IFwiaW1hZ2UvZ2lmXCIsXG4gIFwiLndlYnBcIjogXCJpbWFnZS93ZWJwXCIsXG4gIFwiLnN2Z1wiOiBcImltYWdlL3N2Zyt4bWxcIixcbiAgXCIuaWNvXCI6IFwiaW1hZ2UveC1pY29uXCIsXG59O1xuaXBjTWFpbi5oYW5kbGUoXG4gIFwiY29kZXhwcDpyZWFkLXR3ZWFrLWFzc2V0XCIsXG4gIChfZSwgdHdlYWtEaXI6IHN0cmluZywgcmVsUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZnMgPSByZXF1aXJlKFwibm9kZTpmc1wiKSBhcyB0eXBlb2YgaW1wb3J0KFwibm9kZTpmc1wiKTtcbiAgICBjb25zdCBkaXIgPSByZXNvbHZlKHR3ZWFrRGlyKTtcbiAgICBpZiAoIWlzUGF0aEluc2lkZShUV0VBS1NfRElSLCBkaXIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0d2Vha0RpciBvdXRzaWRlIHR3ZWFrcyBkaXJcIik7XG4gICAgfVxuICAgIGNvbnN0IGZ1bGwgPSByZXNvbHZlKGRpciwgcmVsUGF0aCk7XG4gICAgaWYgKCFpc1BhdGhJbnNpZGUoZGlyLCBmdWxsKSB8fCBmdWxsID09PSBkaXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInBhdGggdHJhdmVyc2FsXCIpO1xuICAgIH1cbiAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoZnVsbCk7XG4gICAgaWYgKHN0YXQuc2l6ZSA+IEFTU0VUX01BWF9CWVRFUykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhc3NldCB0b28gbGFyZ2UgKCR7c3RhdC5zaXplfSA+ICR7QVNTRVRfTUFYX0JZVEVTfSlgKTtcbiAgICB9XG4gICAgY29uc3QgZXh0ID0gZnVsbC5zbGljZShmdWxsLmxhc3RJbmRleE9mKFwiLlwiKSkudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBtaW1lID0gTUlNRV9CWV9FWFRbZXh0XSA/PyBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xuICAgIGNvbnN0IGJ1ZiA9IGZzLnJlYWRGaWxlU3luYyhmdWxsKTtcbiAgICByZXR1cm4gYGRhdGE6JHttaW1lfTtiYXNlNjQsJHtidWYudG9TdHJpbmcoXCJiYXNlNjRcIil9YDtcbiAgfSxcbik7XG5cbi8vIFNhbmRib3hlZCBwcmVsb2FkIGNhbid0IHdyaXRlIGxvZ3MgdG8gZGlzazsgZm9yd2FyZCB0byB1cyB2aWEgSVBDLlxuaXBjTWFpbi5vbihcImNvZGV4cHA6cHJlbG9hZC1sb2dcIiwgKF9lLCBsZXZlbDogXCJpbmZvXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiwgbXNnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgbHZsID0gbGV2ZWwgPT09IFwiZXJyb3JcIiB8fCBsZXZlbCA9PT0gXCJ3YXJuXCIgPyBsZXZlbCA6IFwiaW5mb1wiO1xuICB0cnkge1xuICAgIGFwcGVuZENhcHBlZExvZyhqb2luKExPR19ESVIsIFwicHJlbG9hZC5sb2dcIiksIGBbJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9XSBbJHtsdmx9XSAke21zZ31cXG5gKTtcbiAgfSBjYXRjaCB7fVxufSk7XG5cbi8vIFNhbmRib3gtc2FmZSBmaWxlc3lzdGVtIG9wcyBmb3IgcmVuZGVyZXItc2NvcGUgdHdlYWtzLiBFYWNoIHR3ZWFrIGdldHNcbi8vIGEgc2FuZGJveGVkIGRpciB1bmRlciB1c2VyUm9vdC90d2Vhay1kYXRhLzxpZD4uIFJlbmRlcmVyIHNpZGUgY2FsbHMgdGhlc2Vcbi8vIG92ZXIgSVBDIGluc3RlYWQgb2YgdXNpbmcgTm9kZSBmcyBkaXJlY3RseS5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDp0d2Vhay1mc1wiLCAoX2UsIG9wOiBzdHJpbmcsIGlkOiBzdHJpbmcsIHA6IHN0cmluZywgYz86IHN0cmluZykgPT4ge1xuICBpZiAoIS9eW2EtekEtWjAtOS5fLV0rJC8udGVzdChpZCkpIHRocm93IG5ldyBFcnJvcihcImJhZCB0d2VhayBpZFwiKTtcbiAgY29uc3QgZGlyID0gam9pbih1c2VyUm9vdCEsIFwidHdlYWstZGF0YVwiLCBpZCk7XG4gIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBjb25zdCBmdWxsID0gcmVzb2x2ZShkaXIsIHApO1xuICBpZiAoIWlzUGF0aEluc2lkZShkaXIsIGZ1bGwpIHx8IGZ1bGwgPT09IGRpcikgdGhyb3cgbmV3IEVycm9yKFwicGF0aCB0cmF2ZXJzYWxcIik7XG4gIGNvbnN0IGZzID0gcmVxdWlyZShcIm5vZGU6ZnNcIikgYXMgdHlwZW9mIGltcG9ydChcIm5vZGU6ZnNcIik7XG4gIHN3aXRjaCAob3ApIHtcbiAgICBjYXNlIFwicmVhZFwiOiByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZ1bGwsIFwidXRmOFwiKTtcbiAgICBjYXNlIFwid3JpdGVcIjogcmV0dXJuIGZzLndyaXRlRmlsZVN5bmMoZnVsbCwgYyA/PyBcIlwiLCBcInV0ZjhcIik7XG4gICAgY2FzZSBcImV4aXN0c1wiOiByZXR1cm4gZnMuZXhpc3RzU3luYyhmdWxsKTtcbiAgICBjYXNlIFwiZGF0YURpclwiOiByZXR1cm4gZGlyO1xuICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcihgdW5rbm93biBvcDogJHtvcH1gKTtcbiAgfVxufSk7XG5cbmlwY01haW4uaGFuZGxlKFwiY29kZXhwcDp1c2VyLXBhdGhzXCIsICgpID0+ICh7XG4gIHVzZXJSb290LFxuICBydW50aW1lRGlyLFxuICB0d2Vha3NEaXI6IFRXRUFLU19ESVIsXG4gIGxvZ0RpcjogTE9HX0RJUixcbn0pKTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJldmVhbFwiLCAoX2UsIHA6IHN0cmluZykgPT4ge1xuICBzaGVsbC5vcGVuUGF0aChwKS5jYXRjaCgoKSA9PiB7fSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgKF9lLCB1cmw6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHVybCk7XG4gIGlmIChwYXJzZWQucHJvdG9jb2wgIT09IFwiaHR0cHM6XCIgfHwgcGFyc2VkLmhvc3RuYW1lICE9PSBcImdpdGh1Yi5jb21cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm9ubHkgZ2l0aHViLmNvbSBsaW5rcyBjYW4gYmUgb3BlbmVkIGZyb20gdHdlYWsgbWV0YWRhdGFcIik7XG4gIH1cbiAgc2hlbGwub3BlbkV4dGVybmFsKHBhcnNlZC50b1N0cmluZygpKS5jYXRjaCgoKSA9PiB7fSk7XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOmNvcHktdGV4dFwiLCAoX2UsIHRleHQ6IHN0cmluZykgPT4ge1xuICBjbGlwYm9hcmQud3JpdGVUZXh0KFN0cmluZyh0ZXh0KSk7XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbi8vIE1hbnVhbCBmb3JjZS1yZWxvYWQgdHJpZ2dlciBmcm9tIHRoZSByZW5kZXJlciAoZS5nLiB0aGUgXCJGb3JjZSBSZWxvYWRcIlxuLy8gYnV0dG9uIG9uIG91ciBpbmplY3RlZCBUd2Vha3MgcGFnZSkuIEJ5cGFzc2VzIHRoZSB3YXRjaGVyIGRlYm91bmNlLlxuaXBjTWFpbi5oYW5kbGUoXCJjb2RleHBwOnJlbG9hZC10d2Vha3NcIiwgKCkgPT4ge1xuICByZWxvYWRUd2Vha3MoXCJtYW51YWxcIiwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbiAgcmV0dXJuIHsgYXQ6IERhdGUubm93KCksIGNvdW50OiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQubGVuZ3RoIH07XG59KTtcblxuLy8gNC4gRmlsZXN5c3RlbSB3YXRjaGVyIFx1MjE5MiBkZWJvdW5jZWQgcmVsb2FkICsgYnJvYWRjYXN0LlxuLy8gICAgV2Ugd2F0Y2ggdGhlIHR3ZWFrcyBkaXIgZm9yIGFueSBjaGFuZ2UuIE9uIHRoZSBmaXJzdCB0aWNrIG9mIGluYWN0aXZpdHlcbi8vICAgIHdlIHN0b3AgbWFpbi1zaWRlIHR3ZWFrcywgY2xlYXIgdGhlaXIgY2FjaGVkIG1vZHVsZXMsIHJlLWRpc2NvdmVyLCB0aGVuXG4vLyAgICByZXN0YXJ0IGFuZCBicm9hZGNhc3QgYGNvZGV4cHA6dHdlYWtzLWNoYW5nZWRgIHRvIGV2ZXJ5IHJlbmRlcmVyIHNvIGl0XG4vLyAgICBjYW4gcmUtaW5pdCBpdHMgaG9zdC5cbmNvbnN0IFJFTE9BRF9ERUJPVU5DRV9NUyA9IDI1MDtcbmxldCByZWxvYWRUaW1lcjogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcbmZ1bmN0aW9uIHNjaGVkdWxlUmVsb2FkKHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChyZWxvYWRUaW1lcikgY2xlYXJUaW1lb3V0KHJlbG9hZFRpbWVyKTtcbiAgcmVsb2FkVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICByZWxvYWRUaW1lciA9IG51bGw7XG4gICAgcmVsb2FkVHdlYWtzKHJlYXNvbiwgdHdlYWtMaWZlY3ljbGVEZXBzKTtcbiAgfSwgUkVMT0FEX0RFQk9VTkNFX01TKTtcbn1cblxudHJ5IHtcbiAgY29uc3Qgd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKFRXRUFLU19ESVIsIHtcbiAgICBpZ25vcmVJbml0aWFsOiB0cnVlLFxuICAgIC8vIFdhaXQgZm9yIGZpbGVzIHRvIHNldHRsZSBiZWZvcmUgdHJpZ2dlcmluZyBcdTIwMTQgZ3VhcmRzIGFnYWluc3QgcGFydGlhbGx5XG4gICAgLy8gd3JpdHRlbiB0d2VhayBmaWxlcyBkdXJpbmcgZWRpdG9yIHNhdmVzIC8gZ2l0IGNoZWNrb3V0cy5cbiAgICBhd2FpdFdyaXRlRmluaXNoOiB7IHN0YWJpbGl0eVRocmVzaG9sZDogMTUwLCBwb2xsSW50ZXJ2YWw6IDUwIH0sXG4gICAgLy8gQXZvaWQgZWF0aW5nIENQVSBvbiBodWdlIG5vZGVfbW9kdWxlcyB0cmVlcyBpbnNpZGUgdHdlYWsgZm9sZGVycy5cbiAgICBpZ25vcmVkOiAocCkgPT4gcC5pbmNsdWRlcyhgJHtUV0VBS1NfRElSfS9gKSAmJiAvXFwvbm9kZV9tb2R1bGVzXFwvLy50ZXN0KHApLFxuICB9KTtcbiAgd2F0Y2hlci5vbihcImFsbFwiLCAoZXZlbnQsIHBhdGgpID0+IHNjaGVkdWxlUmVsb2FkKGAke2V2ZW50fSAke3BhdGh9YCkpO1xuICB3YXRjaGVyLm9uKFwiZXJyb3JcIiwgKGUpID0+IGxvZyhcIndhcm5cIiwgXCJ3YXRjaGVyIGVycm9yOlwiLCBlKSk7XG4gIGxvZyhcImluZm9cIiwgXCJ3YXRjaGluZ1wiLCBUV0VBS1NfRElSKTtcbiAgYXBwLm9uKFwid2lsbC1xdWl0XCIsICgpID0+IHdhdGNoZXIuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSkpO1xufSBjYXRjaCAoZSkge1xuICBsb2coXCJlcnJvclwiLCBcImZhaWxlZCB0byBzdGFydCB3YXRjaGVyOlwiLCBlKTtcbn1cblxuLy8gLS0tIGhlbHBlcnMgLS0tXG5cbmZ1bmN0aW9uIGxvYWRBbGxNYWluVHdlYWtzKCk6IHZvaWQge1xuICB0cnkge1xuICAgIHR3ZWFrU3RhdGUuZGlzY292ZXJlZCA9IGRpc2NvdmVyVHdlYWtzKFRXRUFLU19ESVIpO1xuICAgIGxvZyhcbiAgICAgIFwiaW5mb1wiLFxuICAgICAgYGRpc2NvdmVyZWQgJHt0d2Vha1N0YXRlLmRpc2NvdmVyZWQubGVuZ3RofSB0d2VhayhzKTpgLFxuICAgICAgdHdlYWtTdGF0ZS5kaXNjb3ZlcmVkLm1hcCgodCkgPT4gdC5tYW5pZmVzdC5pZCkuam9pbihcIiwgXCIpLFxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2coXCJlcnJvclwiLCBcInR3ZWFrIGRpc2NvdmVyeSBmYWlsZWQ6XCIsIGUpO1xuICAgIHR3ZWFrU3RhdGUuZGlzY292ZXJlZCA9IFtdO1xuICB9XG5cbiAgc3luY01jcFNlcnZlcnNGcm9tRW5hYmxlZFR3ZWFrcygpO1xuXG4gIGZvciAoY29uc3QgdCBvZiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQpIHtcbiAgICBpZiAoIWlzTWFpblByb2Nlc3NUd2Vha1Njb3BlKHQubWFuaWZlc3Quc2NvcGUpKSBjb250aW51ZTtcbiAgICBpZiAoIWlzVHdlYWtFbmFibGVkKHQubWFuaWZlc3QuaWQpKSB7XG4gICAgICBsb2coXCJpbmZvXCIsIGBza2lwcGluZyBkaXNhYmxlZCBtYWluIHR3ZWFrOiAke3QubWFuaWZlc3QuaWR9YCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1vZCA9IHJlcXVpcmUodC5lbnRyeSk7XG4gICAgICBjb25zdCB0d2VhayA9IG1vZC5kZWZhdWx0ID8/IG1vZDtcbiAgICAgIGlmICh0eXBlb2YgdHdlYWs/LnN0YXJ0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IGNyZWF0ZURpc2tTdG9yYWdlKHVzZXJSb290ISwgdC5tYW5pZmVzdC5pZCk7XG4gICAgICAgIHR3ZWFrLnN0YXJ0KHtcbiAgICAgICAgICBtYW5pZmVzdDogdC5tYW5pZmVzdCxcbiAgICAgICAgICBwcm9jZXNzOiBcIm1haW5cIixcbiAgICAgICAgICBsb2c6IG1ha2VMb2dnZXIodC5tYW5pZmVzdC5pZCksXG4gICAgICAgICAgc3RvcmFnZSxcbiAgICAgICAgICBpcGM6IG1ha2VNYWluSXBjKHQubWFuaWZlc3QuaWQpLFxuICAgICAgICAgIGZzOiBtYWtlTWFpbkZzKHQubWFuaWZlc3QuaWQpLFxuICAgICAgICAgIGNvZGV4OiBtYWtlQ29kZXhBcGkoKSxcbiAgICAgICAgfSk7XG4gICAgICAgIHR3ZWFrU3RhdGUubG9hZGVkTWFpbi5zZXQodC5tYW5pZmVzdC5pZCwge1xuICAgICAgICAgIHN0b3A6IHR3ZWFrLnN0b3AsXG4gICAgICAgICAgc3RvcmFnZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZyhcImluZm9cIiwgYHN0YXJ0ZWQgbWFpbiB0d2VhazogJHt0Lm1hbmlmZXN0LmlkfWApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZyhcImVycm9yXCIsIGB0d2VhayAke3QubWFuaWZlc3QuaWR9IGZhaWxlZCB0byBzdGFydDpgLCBlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc3luY01jcFNlcnZlcnNGcm9tRW5hYmxlZFR3ZWFrcygpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBzeW5jTWFuYWdlZE1jcFNlcnZlcnMoe1xuICAgICAgY29uZmlnUGF0aDogQ09ERVhfQ09ORklHX0ZJTEUsXG4gICAgICB0d2Vha3M6IHR3ZWFrU3RhdGUuZGlzY292ZXJlZC5maWx0ZXIoKHQpID0+IGlzVHdlYWtFbmFibGVkKHQubWFuaWZlc3QuaWQpKSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNoYW5nZWQpIHtcbiAgICAgIGxvZyhcImluZm9cIiwgYHN5bmNlZCBDb2RleCBNQ1AgY29uZmlnOiAke3Jlc3VsdC5zZXJ2ZXJOYW1lcy5qb2luKFwiLCBcIikgfHwgXCJub25lXCJ9YCk7XG4gICAgfVxuICAgIGlmIChyZXN1bHQuc2tpcHBlZFNlcnZlck5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGxvZyhcbiAgICAgICAgXCJpbmZvXCIsXG4gICAgICAgIGBza2lwcGVkIENvZGV4KysgbWFuYWdlZCBNQ1Agc2VydmVyKHMpIGFscmVhZHkgY29uZmlndXJlZCBieSB1c2VyOiAke3Jlc3VsdC5za2lwcGVkU2VydmVyTmFtZXMuam9pbihcIiwgXCIpfWAsXG4gICAgICApO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGxvZyhcIndhcm5cIiwgXCJmYWlsZWQgdG8gc3luYyBDb2RleCBNQ1AgY29uZmlnOlwiLCBlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdG9wQWxsTWFpblR3ZWFrcygpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbaWQsIHRdIG9mIHR3ZWFrU3RhdGUubG9hZGVkTWFpbikge1xuICAgIHRyeSB7XG4gICAgICB0LnN0b3A/LigpO1xuICAgICAgdC5zdG9yYWdlLmZsdXNoKCk7XG4gICAgICBsb2coXCJpbmZvXCIsIGBzdG9wcGVkIG1haW4gdHdlYWs6ICR7aWR9YCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nKFwid2FyblwiLCBgc3RvcCBmYWlsZWQgZm9yICR7aWR9OmAsIGUpO1xuICAgIH1cbiAgfVxuICB0d2Vha1N0YXRlLmxvYWRlZE1haW4uY2xlYXIoKTtcbn1cblxuZnVuY3Rpb24gY2xlYXJUd2Vha01vZHVsZUNhY2hlKCk6IHZvaWQge1xuICAvLyBEcm9wIGFueSBjYWNoZWQgcmVxdWlyZSgpIGVudHJpZXMgdGhhdCBsaXZlIGluc2lkZSB0aGUgdHdlYWtzIGRpciBzbyBhXG4gIC8vIHJlLXJlcXVpcmUgb24gbmV4dCBsb2FkIHBpY2tzIHVwIGZyZXNoIGNvZGUuXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHJlcXVpcmUuY2FjaGUpKSB7XG4gICAgaWYgKGlzUGF0aEluc2lkZShUV0VBS1NfRElSLCBrZXkpKSBkZWxldGUgcmVxdWlyZS5jYWNoZVtrZXldO1xuICB9XG59XG5cbmNvbnN0IFVQREFURV9DSEVDS19JTlRFUlZBTF9NUyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XG5jb25zdCBWRVJTSU9OX1JFID0gL152PyhcXGQrKVxcLihcXGQrKVxcLihcXGQrKSg/OlstK10uKik/JC87XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUNvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayhmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTxDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2s+IHtcbiAgY29uc3Qgc3RhdGUgPSByZWFkU3RhdGUoKTtcbiAgY29uc3QgY2FjaGVkID0gc3RhdGUuY29kZXhQbHVzUGx1cz8udXBkYXRlQ2hlY2s7XG4gIGNvbnN0IGNoYW5uZWwgPSBzdGF0ZS5jb2RleFBsdXNQbHVzPy51cGRhdGVDaGFubmVsID8/IFwic3RhYmxlXCI7XG4gIGNvbnN0IHJlcG8gPSBzdGF0ZS5jb2RleFBsdXNQbHVzPy51cGRhdGVSZXBvID8/IENPREVYX1BMVVNQTFVTX1JFUE87XG4gIGlmIChcbiAgICAhZm9yY2UgJiZcbiAgICBjYWNoZWQgJiZcbiAgICBjYWNoZWQuY3VycmVudFZlcnNpb24gPT09IENPREVYX1BMVVNQTFVTX1ZFUlNJT04gJiZcbiAgICBEYXRlLm5vdygpIC0gRGF0ZS5wYXJzZShjYWNoZWQuY2hlY2tlZEF0KSA8IFVQREFURV9DSEVDS19JTlRFUlZBTF9NU1xuICApIHtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9XG5cbiAgY29uc3QgcmVsZWFzZSA9IGF3YWl0IGZldGNoTGF0ZXN0UmVsZWFzZShyZXBvLCBDT0RFWF9QTFVTUExVU19WRVJTSU9OLCBjaGFubmVsID09PSBcInByZXJlbGVhc2VcIik7XG4gIGNvbnN0IGxhdGVzdFZlcnNpb24gPSByZWxlYXNlLmxhdGVzdFRhZyA/IG5vcm1hbGl6ZVZlcnNpb24ocmVsZWFzZS5sYXRlc3RUYWcpIDogbnVsbDtcbiAgY29uc3QgY2hlY2s6IENvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayA9IHtcbiAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBjdXJyZW50VmVyc2lvbjogQ09ERVhfUExVU1BMVVNfVkVSU0lPTixcbiAgICBsYXRlc3RWZXJzaW9uLFxuICAgIHJlbGVhc2VVcmw6IHJlbGVhc2UucmVsZWFzZVVybCA/PyBgaHR0cHM6Ly9naXRodWIuY29tLyR7cmVwb30vcmVsZWFzZXNgLFxuICAgIHJlbGVhc2VOb3RlczogcmVsZWFzZS5yZWxlYXNlTm90ZXMsXG4gICAgdXBkYXRlQXZhaWxhYmxlOiBsYXRlc3RWZXJzaW9uXG4gICAgICA/IGNvbXBhcmVWZXJzaW9ucyhub3JtYWxpemVWZXJzaW9uKGxhdGVzdFZlcnNpb24pLCBDT0RFWF9QTFVTUExVU19WRVJTSU9OKSA+IDBcbiAgICAgIDogZmFsc2UsXG4gICAgLi4uKHJlbGVhc2UuZXJyb3IgPyB7IGVycm9yOiByZWxlYXNlLmVycm9yIH0gOiB7fSksXG4gIH07XG4gIHN0YXRlLmNvZGV4UGx1c1BsdXMgPz89IHt9O1xuICBzdGF0ZS5jb2RleFBsdXNQbHVzLnVwZGF0ZUNoZWNrID0gY2hlY2s7XG4gIHdyaXRlU3RhdGUoc3RhdGUpO1xuICByZXR1cm4gY2hlY2s7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVR3ZWFrVXBkYXRlQ2hlY2sodDogRGlzY292ZXJlZFR3ZWFrKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGlkID0gdC5tYW5pZmVzdC5pZDtcbiAgY29uc3QgcmVwbyA9IHQubWFuaWZlc3QuZ2l0aHViUmVwbztcbiAgY29uc3Qgc3RhdGUgPSByZWFkU3RhdGUoKTtcbiAgY29uc3QgY2FjaGVkID0gc3RhdGUudHdlYWtVcGRhdGVDaGVja3M/LltpZF07XG4gIGlmIChcbiAgICBjYWNoZWQgJiZcbiAgICBjYWNoZWQucmVwbyA9PT0gcmVwbyAmJlxuICAgIGNhY2hlZC5jdXJyZW50VmVyc2lvbiA9PT0gdC5tYW5pZmVzdC52ZXJzaW9uICYmXG4gICAgRGF0ZS5ub3coKSAtIERhdGUucGFyc2UoY2FjaGVkLmNoZWNrZWRBdCkgPCBVUERBVEVfQ0hFQ0tfSU5URVJWQUxfTVNcbiAgKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbmV4dCA9IGF3YWl0IGZldGNoTGF0ZXN0UmVsZWFzZShyZXBvLCB0Lm1hbmlmZXN0LnZlcnNpb24pO1xuICBjb25zdCBsYXRlc3RWZXJzaW9uID0gbmV4dC5sYXRlc3RUYWcgPyBub3JtYWxpemVWZXJzaW9uKG5leHQubGF0ZXN0VGFnKSA6IG51bGw7XG4gIGNvbnN0IGNoZWNrOiBUd2Vha1VwZGF0ZUNoZWNrID0ge1xuICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIHJlcG8sXG4gICAgY3VycmVudFZlcnNpb246IHQubWFuaWZlc3QudmVyc2lvbixcbiAgICBsYXRlc3RWZXJzaW9uLFxuICAgIGxhdGVzdFRhZzogbmV4dC5sYXRlc3RUYWcsXG4gICAgcmVsZWFzZVVybDogbmV4dC5yZWxlYXNlVXJsLFxuICAgIHVwZGF0ZUF2YWlsYWJsZTogbGF0ZXN0VmVyc2lvblxuICAgICAgPyBjb21wYXJlVmVyc2lvbnMobGF0ZXN0VmVyc2lvbiwgbm9ybWFsaXplVmVyc2lvbih0Lm1hbmlmZXN0LnZlcnNpb24pKSA+IDBcbiAgICAgIDogZmFsc2UsXG4gICAgLi4uKG5leHQuZXJyb3IgPyB7IGVycm9yOiBuZXh0LmVycm9yIH0gOiB7fSksXG4gIH07XG4gIHN0YXRlLnR3ZWFrVXBkYXRlQ2hlY2tzID8/PSB7fTtcbiAgc3RhdGUudHdlYWtVcGRhdGVDaGVja3NbaWRdID0gY2hlY2s7XG4gIHdyaXRlU3RhdGUoc3RhdGUpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaExhdGVzdFJlbGVhc2UoXG4gIHJlcG86IHN0cmluZyxcbiAgY3VycmVudFZlcnNpb246IHN0cmluZyxcbiAgaW5jbHVkZVByZXJlbGVhc2UgPSBmYWxzZSxcbik6IFByb21pc2U8eyBsYXRlc3RUYWc6IHN0cmluZyB8IG51bGw7IHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7IHJlbGVhc2VOb3Rlczogc3RyaW5nIHwgbnVsbDsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA4MDAwKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW5kcG9pbnQgPSBpbmNsdWRlUHJlcmVsZWFzZSA/IFwicmVsZWFzZXM/cGVyX3BhZ2U9MjBcIiA6IFwicmVsZWFzZXMvbGF0ZXN0XCI7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke3JlcG99LyR7ZW5kcG9pbnR9YCwge1xuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi92bmQuZ2l0aHViK2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogYGNvZGV4LXBsdXNwbHVzLyR7Y3VycmVudFZlcnNpb259YCxcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuICAgICAgaWYgKHJlcy5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4geyBsYXRlc3RUYWc6IG51bGwsIHJlbGVhc2VVcmw6IG51bGwsIHJlbGVhc2VOb3RlczogbnVsbCwgZXJyb3I6IFwibm8gR2l0SHViIHJlbGVhc2UgZm91bmRcIiB9O1xuICAgICAgfVxuICAgICAgaWYgKCFyZXMub2spIHtcbiAgICAgICAgcmV0dXJuIHsgbGF0ZXN0VGFnOiBudWxsLCByZWxlYXNlVXJsOiBudWxsLCByZWxlYXNlTm90ZXM6IG51bGwsIGVycm9yOiBgR2l0SHViIHJldHVybmVkICR7cmVzLnN0YXR1c31gIH07XG4gICAgICB9XG4gICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKSBhcyB7IHRhZ19uYW1lPzogc3RyaW5nOyBodG1sX3VybD86IHN0cmluZzsgYm9keT86IHN0cmluZzsgZHJhZnQ/OiBib29sZWFuIH0gfCBBcnJheTx7IHRhZ19uYW1lPzogc3RyaW5nOyBodG1sX3VybD86IHN0cmluZzsgYm9keT86IHN0cmluZzsgZHJhZnQ/OiBib29sZWFuIH0+O1xuICAgICAgY29uc3QgYm9keSA9IEFycmF5LmlzQXJyYXkoanNvbikgPyBqc29uLmZpbmQoKHJlbGVhc2UpID0+ICFyZWxlYXNlLmRyYWZ0KSA6IGpzb247XG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgcmV0dXJuIHsgbGF0ZXN0VGFnOiBudWxsLCByZWxlYXNlVXJsOiBudWxsLCByZWxlYXNlTm90ZXM6IG51bGwsIGVycm9yOiBcIm5vIEdpdEh1YiByZWxlYXNlIGZvdW5kXCIgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxhdGVzdFRhZzogYm9keS50YWdfbmFtZSA/PyBudWxsLFxuICAgICAgICByZWxlYXNlVXJsOiBib2R5Lmh0bWxfdXJsID8/IGBodHRwczovL2dpdGh1Yi5jb20vJHtyZXBvfS9yZWxlYXNlc2AsXG4gICAgICAgIHJlbGVhc2VOb3RlczogYm9keS5ib2R5ID8/IG51bGwsXG4gICAgICB9O1xuICAgIH0gZmluYWxseSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxhdGVzdFRhZzogbnVsbCxcbiAgICAgIHJlbGVhc2VVcmw6IG51bGwsXG4gICAgICByZWxlYXNlTm90ZXM6IG51bGwsXG4gICAgICBlcnJvcjogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpLFxuICAgIH07XG4gIH1cbn1cblxuaW50ZXJmYWNlIFR3ZWFrU3RvcmVGZXRjaFJlc3VsdCB7XG4gIHJlZ2lzdHJ5OiBUd2Vha1N0b3JlUmVnaXN0cnk7XG4gIGZldGNoZWRBdDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU3RvcmVJbnN0YWxsTWV0YWRhdGEge1xuICByZXBvOiBzdHJpbmc7XG4gIGFwcHJvdmVkQ29tbWl0U2hhOiBzdHJpbmc7XG4gIGluc3RhbGxlZEF0OiBzdHJpbmc7XG4gIHN0b3JlSW5kZXhVcmw6IHN0cmluZztcbiAgZmlsZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5pbnRlcmZhY2UgU3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eSB7XG4gIGN1cnJlbnQ6IE5vZGVKUy5QbGF0Zm9ybTtcbiAgc3VwcG9ydGVkOiBUd2Vha1N0b3JlUGxhdGZvcm1bXSB8IG51bGw7XG4gIGNvbXBhdGlibGU6IGJvb2xlYW47XG4gIHJlYXNvbjogc3RyaW5nIHwgbnVsbDtcbn1cblxuY2xhc3MgU3RvcmVUd2Vha01vZGlmaWVkRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHR3ZWFrTmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBgJHt0d2Vha05hbWV9IGhhcyBsb2NhbCBzb3VyY2UgY2hhbmdlcywgc28gQ29kZXgrKyBjYW4ndCBhdXRvLXVwZGF0ZSBpdC4gUmV2ZXJ0IHlvdXIgbG9jYWwgY2hhbmdlcyBvciByZWluc3RhbGwgdGhlIHR3ZWFrIG1hbnVhbGx5LmAsXG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSBcIlN0b3JlVHdlYWtNb2RpZmllZEVycm9yXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eShlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogU3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eSB7XG4gIGNvbnN0IHN1cHBvcnRlZCA9IGVudHJ5LnBsYXRmb3JtcyA/PyBudWxsO1xuICBjb25zdCBjb21wYXRpYmxlID0gIXN1cHBvcnRlZCB8fCBzdXBwb3J0ZWQuaW5jbHVkZXMocHJvY2Vzcy5wbGF0Zm9ybSBhcyBUd2Vha1N0b3JlUGxhdGZvcm0pO1xuICByZXR1cm4ge1xuICAgIGN1cnJlbnQ6IHByb2Nlc3MucGxhdGZvcm0sXG4gICAgc3VwcG9ydGVkLFxuICAgIGNvbXBhdGlibGUsXG4gICAgcmVhc29uOiBjb21wYXRpYmxlID8gbnVsbCA6IGAke2VudHJ5Lm1hbmlmZXN0Lm5hbWV9IGlzIG9ubHkgYXZhaWxhYmxlIG9uICR7Zm9ybWF0U3RvcmVQbGF0Zm9ybXMoc3VwcG9ydGVkKX0uYCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0U3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJsZShlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogdm9pZCB7XG4gIGNvbnN0IHBsYXRmb3JtID0gc3RvcmVFbnRyeVBsYXRmb3JtQ29tcGF0aWJpbGl0eShlbnRyeSk7XG4gIGlmICghcGxhdGZvcm0uY29tcGF0aWJsZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihwbGF0Zm9ybS5yZWFzb24gPz8gYCR7ZW50cnkubWFuaWZlc3QubmFtZX0gaXMgbm90IGF2YWlsYWJsZSBvbiB0aGlzIHBsYXRmb3JtLmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFN0b3JlUGxhdGZvcm1zKHBsYXRmb3JtczogVHdlYWtTdG9yZVBsYXRmb3JtW10gfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFwbGF0Zm9ybXMgfHwgcGxhdGZvcm1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwic3VwcG9ydGVkIHBsYXRmb3Jtc1wiO1xuICByZXR1cm4gcGxhdGZvcm1zLm1hcCgocGxhdGZvcm0pID0+IHtcbiAgICBpZiAocGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHJldHVybiBcIm1hY09TXCI7XG4gICAgaWYgKHBsYXRmb3JtID09PSBcIndpbjMyXCIpIHJldHVybiBcIldpbmRvd3NcIjtcbiAgICByZXR1cm4gXCJMaW51eFwiO1xuICB9KS5qb2luKFwiLCBcIik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoVHdlYWtTdG9yZVJlZ2lzdHJ5KCk6IFByb21pc2U8VHdlYWtTdG9yZUZldGNoUmVzdWx0PiB7XG4gIGNvbnN0IGZldGNoZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFRXRUFLX1NUT1JFX0lOREVYX1VSTCwge1xuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IGBjb2RleC1wbHVzcGx1cy8ke0NPREVYX1BMVVNQTFVTX1ZFUlNJT059YCxcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgc3RvcmUgcmV0dXJuZWQgJHtyZXMuc3RhdHVzfWApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVnaXN0cnk6IG5vcm1hbGl6ZVN0b3JlUmVnaXN0cnkoYXdhaXQgcmVzLmpzb24oKSksXG4gICAgICAgIGZldGNoZWRBdCxcbiAgICAgIH07XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zdCBlcnJvciA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoU3RyaW5nKGUpKTtcbiAgICBsb2coXCJ3YXJuXCIsIFwiZmFpbGVkIHRvIGZldGNoIHR3ZWFrIHN0b3JlIHJlZ2lzdHJ5OlwiLCBlcnJvci5tZXNzYWdlKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbnN0YWxsU3RvcmVUd2VhayhlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHVybCA9IHN0b3JlQXJjaGl2ZVVybChlbnRyeSk7XG4gIGNvbnN0IHdvcmsgPSBta2R0ZW1wU3luYyhqb2luKHRtcGRpcigpLCBcImNvZGV4cHAtc3RvcmUtdHdlYWstXCIpKTtcbiAgY29uc3QgYXJjaGl2ZSA9IGpvaW4od29yaywgXCJzb3VyY2UudGFyLmd6XCIpO1xuICBjb25zdCBleHRyYWN0RGlyID0gam9pbih3b3JrLCBcImV4dHJhY3RcIik7XG4gIGNvbnN0IHRhcmdldCA9IGpvaW4oVFdFQUtTX0RJUiwgZW50cnkuaWQpO1xuICBjb25zdCBzdGFnZWRUYXJnZXQgPSBqb2luKHdvcmssIFwic3RhZ2VkXCIsIGVudHJ5LmlkKTtcblxuICB0cnkge1xuICAgIGxvZyhcImluZm9cIiwgYGluc3RhbGxpbmcgc3RvcmUgdHdlYWsgJHtlbnRyeS5pZH0gZnJvbSAke2VudHJ5LnJlcG99QCR7ZW50cnkuYXBwcm92ZWRDb21taXRTaGF9YCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBoZWFkZXJzOiB7IFwiVXNlci1BZ2VudFwiOiBgY29kZXgtcGx1c3BsdXMvJHtDT0RFWF9QTFVTUExVU19WRVJTSU9OfWAgfSxcbiAgICAgIHJlZGlyZWN0OiBcImZvbGxvd1wiLFxuICAgIH0pO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYGRvd25sb2FkIGZhaWxlZDogJHtyZXMuc3RhdHVzfWApO1xuICAgIGNvbnN0IGJ5dGVzID0gQnVmZmVyLmZyb20oYXdhaXQgcmVzLmFycmF5QnVmZmVyKCkpO1xuICAgIHdyaXRlRmlsZVN5bmMoYXJjaGl2ZSwgYnl0ZXMpO1xuICAgIG1rZGlyU3luYyhleHRyYWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBleHRyYWN0VGFyQXJjaGl2ZShhcmNoaXZlLCBleHRyYWN0RGlyKTtcbiAgICBjb25zdCBzb3VyY2UgPSBmaW5kVHdlYWtSb290KGV4dHJhY3REaXIpO1xuICAgIGlmICghc291cmNlKSB0aHJvdyBuZXcgRXJyb3IoXCJkb3dubG9hZGVkIGFyY2hpdmUgZGlkIG5vdCBjb250YWluIG1hbmlmZXN0Lmpzb25cIik7XG4gICAgdmFsaWRhdGVTdG9yZVR3ZWFrU291cmNlKGVudHJ5LCBzb3VyY2UpO1xuICAgIHJtU3luYyhzdGFnZWRUYXJnZXQsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICBjb3B5VHdlYWtTb3VyY2Uoc291cmNlLCBzdGFnZWRUYXJnZXQpO1xuICAgIGNvbnN0IHN0YWdlZEZpbGVzID0gaGFzaFR3ZWFrU291cmNlKHN0YWdlZFRhcmdldCk7XG4gICAgd3JpdGVGaWxlU3luYyhcbiAgICAgIGpvaW4oc3RhZ2VkVGFyZ2V0LCBcIi5jb2RleHBwLXN0b3JlLmpzb25cIiksXG4gICAgICBKU09OLnN0cmluZ2lmeShcbiAgICAgICAge1xuICAgICAgICAgIHJlcG86IGVudHJ5LnJlcG8sXG4gICAgICAgICAgYXBwcm92ZWRDb21taXRTaGE6IGVudHJ5LmFwcHJvdmVkQ29tbWl0U2hhLFxuICAgICAgICAgIGluc3RhbGxlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgc3RvcmVJbmRleFVybDogVFdFQUtfU1RPUkVfSU5ERVhfVVJMLFxuICAgICAgICAgIGZpbGVzOiBzdGFnZWRGaWxlcyxcbiAgICAgICAgfSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgMixcbiAgICAgICksXG4gICAgKTtcbiAgICBhd2FpdCBhc3NlcnRTdG9yZVR3ZWFrQ2xlYW5Gb3JBdXRvVXBkYXRlKGVudHJ5LCB0YXJnZXQsIHdvcmspO1xuICAgIHJtU3luYyh0YXJnZXQsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICBjcFN5bmMoc3RhZ2VkVGFyZ2V0LCB0YXJnZXQsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9IGZpbmFsbHkge1xuICAgIHJtU3luYyh3b3JrLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcHJlcGFyZVR3ZWFrU3RvcmVTdWJtaXNzaW9uKHJlcG9JbnB1dDogc3RyaW5nKTogUHJvbWlzZTxUd2Vha1N0b3JlUHVibGlzaFN1Ym1pc3Npb24+IHtcbiAgY29uc3QgcmVwbyA9IG5vcm1hbGl6ZUdpdEh1YlJlcG8ocmVwb0lucHV0KTtcbiAgY29uc3QgcmVwb0luZm8gPSBhd2FpdCBmZXRjaEdpdGh1Ykpzb248eyBkZWZhdWx0X2JyYW5jaD86IHN0cmluZyB9PihgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke3JlcG99YCk7XG4gIGNvbnN0IGRlZmF1bHRCcmFuY2ggPSByZXBvSW5mby5kZWZhdWx0X2JyYW5jaDtcbiAgaWYgKCFkZWZhdWx0QnJhbmNoKSB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZXNvbHZlIGRlZmF1bHQgYnJhbmNoIGZvciAke3JlcG99YCk7XG5cbiAgY29uc3QgY29tbWl0ID0gYXdhaXQgZmV0Y2hHaXRodWJKc29uPHtcbiAgICBzaGE/OiBzdHJpbmc7XG4gICAgaHRtbF91cmw/OiBzdHJpbmc7XG4gIH0+KGBodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zLyR7cmVwb30vY29tbWl0cy8ke2VuY29kZVVSSUNvbXBvbmVudChkZWZhdWx0QnJhbmNoKX1gKTtcbiAgaWYgKCFjb21taXQuc2hhKSB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZXNvbHZlIGN1cnJlbnQgY29tbWl0IGZvciAke3JlcG99YCk7XG5cbiAgY29uc3QgbWFuaWZlc3QgPSBhd2FpdCBmZXRjaE1hbmlmZXN0QXRDb21taXQocmVwbywgY29tbWl0LnNoYSkuY2F0Y2goKGUpID0+IHtcbiAgICBsb2coXCJ3YXJuXCIsIGBjb3VsZCBub3QgcmVhZCBtYW5pZmVzdCBmb3Igc3RvcmUgc3VibWlzc2lvbiAke3JlcG99QCR7Y29tbWl0LnNoYX06YCwgZSk7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICByZXBvLFxuICAgIGRlZmF1bHRCcmFuY2gsXG4gICAgY29tbWl0U2hhOiBjb21taXQuc2hhLFxuICAgIGNvbW1pdFVybDogY29tbWl0Lmh0bWxfdXJsID8/IGBodHRwczovL2dpdGh1Yi5jb20vJHtyZXBvfS9jb21taXQvJHtjb21taXQuc2hhfWAsXG4gICAgbWFuaWZlc3Q6IG1hbmlmZXN0XG4gICAgICA/IHtcbiAgICAgICAgICBpZDogdHlwZW9mIG1hbmlmZXN0LmlkID09PSBcInN0cmluZ1wiID8gbWFuaWZlc3QuaWQgOiB1bmRlZmluZWQsXG4gICAgICAgICAgbmFtZTogdHlwZW9mIG1hbmlmZXN0Lm5hbWUgPT09IFwic3RyaW5nXCIgPyBtYW5pZmVzdC5uYW1lIDogdW5kZWZpbmVkLFxuICAgICAgICAgIHZlcnNpb246IHR5cGVvZiBtYW5pZmVzdC52ZXJzaW9uID09PSBcInN0cmluZ1wiID8gbWFuaWZlc3QudmVyc2lvbiA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogdHlwZW9mIG1hbmlmZXN0LmRlc2NyaXB0aW9uID09PSBcInN0cmluZ1wiID8gbWFuaWZlc3QuZGVzY3JpcHRpb24gOiB1bmRlZmluZWQsXG4gICAgICAgICAgaWNvblVybDogdHlwZW9mIG1hbmlmZXN0Lmljb25VcmwgPT09IFwic3RyaW5nXCIgPyBtYW5pZmVzdC5pY29uVXJsIDogdW5kZWZpbmVkLFxuICAgICAgICB9XG4gICAgICA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hHaXRodWJKc29uPFQ+KHVybDogc3RyaW5nKTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vdm5kLmdpdGh1Yitqc29uXCIsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBgY29kZXgtcGx1c3BsdXMvJHtDT0RFWF9QTFVTUExVU19WRVJTSU9OfWAsXG4gICAgICB9LFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBHaXRIdWIgcmV0dXJuZWQgJHtyZXMuc3RhdHVzfWApO1xuICAgIHJldHVybiBhd2FpdCByZXMuanNvbigpIGFzIFQ7XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoTWFuaWZlc3RBdENvbW1pdChyZXBvOiBzdHJpbmcsIGNvbW1pdFNoYTogc3RyaW5nKTogUHJvbWlzZTxQYXJ0aWFsPFR3ZWFrTWFuaWZlc3Q+PiB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vJHtyZXBvfS8ke2NvbW1pdFNoYX0vbWFuaWZlc3QuanNvbmAsIHtcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwiVXNlci1BZ2VudFwiOiBgY29kZXgtcGx1c3BsdXMvJHtDT0RFWF9QTFVTUExVU19WRVJTSU9OfWAsXG4gICAgfSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYG1hbmlmZXN0IGZldGNoIHJldHVybmVkICR7cmVzLnN0YXR1c31gKTtcbiAgcmV0dXJuIGF3YWl0IHJlcy5qc29uKCkgYXMgUGFydGlhbDxUd2Vha01hbmlmZXN0Pjtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdFRhckFyY2hpdmUoYXJjaGl2ZTogc3RyaW5nLCB0YXJnZXREaXI6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCByZXN1bHQgPSBzcGF3blN5bmMoXCJ0YXJcIiwgW1wiLXh6ZlwiLCBhcmNoaXZlLCBcIi1DXCIsIHRhcmdldERpcl0sIHtcbiAgICBlbmNvZGluZzogXCJ1dGY4XCIsXG4gICAgc3RkaW86IFtcImlnbm9yZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICB9KTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRhciBleHRyYWN0aW9uIGZhaWxlZDogJHtyZXN1bHQuc3RkZXJyIHx8IHJlc3VsdC5zdGRvdXQgfHwgcmVzdWx0LnN0YXR1c31gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVN0b3JlVHdlYWtTb3VyY2UoZW50cnk6IFR3ZWFrU3RvcmVFbnRyeSwgc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgbWFuaWZlc3RQYXRoID0gam9pbihzb3VyY2UsIFwibWFuaWZlc3QuanNvblwiKTtcbiAgY29uc3QgbWFuaWZlc3QgPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhtYW5pZmVzdFBhdGgsIFwidXRmOFwiKSkgYXMgVHdlYWtNYW5pZmVzdDtcbiAgaWYgKG1hbmlmZXN0LmlkICE9PSBlbnRyeS5tYW5pZmVzdC5pZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgZG93bmxvYWRlZCB0d2VhayBpZCAke21hbmlmZXN0LmlkfSBkb2VzIG5vdCBtYXRjaCBhcHByb3ZlZCBpZCAke2VudHJ5Lm1hbmlmZXN0LmlkfWApO1xuICB9XG4gIGlmIChtYW5pZmVzdC5naXRodWJSZXBvICE9PSBlbnRyeS5yZXBvKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBkb3dubG9hZGVkIHR3ZWFrIHJlcG8gJHttYW5pZmVzdC5naXRodWJSZXBvfSBkb2VzIG5vdCBtYXRjaCBhcHByb3ZlZCByZXBvICR7ZW50cnkucmVwb31gKTtcbiAgfVxuICBpZiAobWFuaWZlc3QudmVyc2lvbiAhPT0gZW50cnkubWFuaWZlc3QudmVyc2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgZG93bmxvYWRlZCB0d2VhayB2ZXJzaW9uICR7bWFuaWZlc3QudmVyc2lvbn0gZG9lcyBub3QgbWF0Y2ggYXBwcm92ZWQgdmVyc2lvbiAke2VudHJ5Lm1hbmlmZXN0LnZlcnNpb259YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFR3ZWFrUm9vdChkaXI6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIWV4aXN0c1N5bmMoZGlyKSkgcmV0dXJuIG51bGw7XG4gIGlmIChleGlzdHNTeW5jKGpvaW4oZGlyLCBcIm1hbmlmZXN0Lmpzb25cIikpKSByZXR1cm4gZGlyO1xuICBmb3IgKGNvbnN0IG5hbWUgb2YgcmVhZGRpclN5bmMoZGlyKSkge1xuICAgIGNvbnN0IGNoaWxkID0gam9pbihkaXIsIG5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIXN0YXRTeW5jKGNoaWxkKS5pc0RpcmVjdG9yeSgpKSBjb250aW51ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBmb3VuZCA9IGZpbmRUd2Vha1Jvb3QoY2hpbGQpO1xuICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjb3B5VHdlYWtTb3VyY2Uoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nKTogdm9pZCB7XG4gIGNwU3luYyhzb3VyY2UsIHRhcmdldCwge1xuICAgIHJlY3Vyc2l2ZTogdHJ1ZSxcbiAgICBmaWx0ZXI6IChzcmMpID0+ICEvKF58Wy9cXFxcXSkoPzpcXC5naXR8bm9kZV9tb2R1bGVzKSg/OlsvXFxcXF18JCkvLnRlc3Qoc3JjKSxcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFzc2VydFN0b3JlVHdlYWtDbGVhbkZvckF1dG9VcGRhdGUoXG4gIGVudHJ5OiBUd2Vha1N0b3JlRW50cnksXG4gIHRhcmdldDogc3RyaW5nLFxuICB3b3JrOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCFleGlzdHNTeW5jKHRhcmdldCkpIHJldHVybjtcbiAgY29uc3QgbWV0YWRhdGEgPSByZWFkU3RvcmVJbnN0YWxsTWV0YWRhdGEodGFyZ2V0KTtcbiAgaWYgKCFtZXRhZGF0YSkgcmV0dXJuO1xuICBpZiAobWV0YWRhdGEucmVwbyAhPT0gZW50cnkucmVwbykge1xuICAgIHRocm93IG5ldyBTdG9yZVR3ZWFrTW9kaWZpZWRFcnJvcihlbnRyeS5tYW5pZmVzdC5uYW1lKTtcbiAgfVxuICBjb25zdCBjdXJyZW50RmlsZXMgPSBoYXNoVHdlYWtTb3VyY2UodGFyZ2V0KTtcbiAgY29uc3QgYmFzZWxpbmVGaWxlcyA9IG1ldGFkYXRhLmZpbGVzID8/IGF3YWl0IGZldGNoQmFzZWxpbmVTdG9yZVR3ZWFrSGFzaGVzKG1ldGFkYXRhLCB3b3JrKTtcbiAgaWYgKCFzYW1lRmlsZUhhc2hlcyhjdXJyZW50RmlsZXMsIGJhc2VsaW5lRmlsZXMpKSB7XG4gICAgdGhyb3cgbmV3IFN0b3JlVHdlYWtNb2RpZmllZEVycm9yKGVudHJ5Lm1hbmlmZXN0Lm5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWRTdG9yZUluc3RhbGxNZXRhZGF0YSh0YXJnZXQ6IHN0cmluZyk6IFN0b3JlSW5zdGFsbE1ldGFkYXRhIHwgbnVsbCB7XG4gIGNvbnN0IG1ldGFkYXRhUGF0aCA9IGpvaW4odGFyZ2V0LCBcIi5jb2RleHBwLXN0b3JlLmpzb25cIik7XG4gIGlmICghZXhpc3RzU3luYyhtZXRhZGF0YVBhdGgpKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhtZXRhZGF0YVBhdGgsIFwidXRmOFwiKSkgYXMgUGFydGlhbDxTdG9yZUluc3RhbGxNZXRhZGF0YT47XG4gICAgaWYgKHR5cGVvZiBwYXJzZWQucmVwbyAhPT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgcGFyc2VkLmFwcHJvdmVkQ29tbWl0U2hhICE9PSBcInN0cmluZ1wiKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4ge1xuICAgICAgcmVwbzogcGFyc2VkLnJlcG8sXG4gICAgICBhcHByb3ZlZENvbW1pdFNoYTogcGFyc2VkLmFwcHJvdmVkQ29tbWl0U2hhLFxuICAgICAgaW5zdGFsbGVkQXQ6IHR5cGVvZiBwYXJzZWQuaW5zdGFsbGVkQXQgPT09IFwic3RyaW5nXCIgPyBwYXJzZWQuaW5zdGFsbGVkQXQgOiBcIlwiLFxuICAgICAgc3RvcmVJbmRleFVybDogdHlwZW9mIHBhcnNlZC5zdG9yZUluZGV4VXJsID09PSBcInN0cmluZ1wiID8gcGFyc2VkLnN0b3JlSW5kZXhVcmwgOiBcIlwiLFxuICAgICAgZmlsZXM6IGlzSGFzaFJlY29yZChwYXJzZWQuZmlsZXMpID8gcGFyc2VkLmZpbGVzIDogdW5kZWZpbmVkLFxuICAgIH07XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQmFzZWxpbmVTdG9yZVR3ZWFrSGFzaGVzKFxuICBtZXRhZGF0YTogU3RvcmVJbnN0YWxsTWV0YWRhdGEsXG4gIHdvcms6IHN0cmluZyxcbik6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICBjb25zdCBiYXNlbGluZURpciA9IGpvaW4od29yaywgXCJiYXNlbGluZVwiKTtcbiAgY29uc3QgYXJjaGl2ZSA9IGpvaW4od29yaywgXCJiYXNlbGluZS50YXIuZ3pcIik7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovL2NvZGVsb2FkLmdpdGh1Yi5jb20vJHttZXRhZGF0YS5yZXBvfS90YXIuZ3ovJHttZXRhZGF0YS5hcHByb3ZlZENvbW1pdFNoYX1gLCB7XG4gICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogYGNvZGV4LXBsdXNwbHVzLyR7Q09ERVhfUExVU1BMVVNfVkVSU0lPTn1gIH0sXG4gICAgcmVkaXJlY3Q6IFwiZm9sbG93XCIsXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgdmVyaWZ5IGxvY2FsIHR3ZWFrIGNoYW5nZXMgYmVmb3JlIHVwZGF0ZTogJHtyZXMuc3RhdHVzfWApO1xuICB3cml0ZUZpbGVTeW5jKGFyY2hpdmUsIEJ1ZmZlci5mcm9tKGF3YWl0IHJlcy5hcnJheUJ1ZmZlcigpKSk7XG4gIG1rZGlyU3luYyhiYXNlbGluZURpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGV4dHJhY3RUYXJBcmNoaXZlKGFyY2hpdmUsIGJhc2VsaW5lRGlyKTtcbiAgY29uc3Qgc291cmNlID0gZmluZFR3ZWFrUm9vdChiYXNlbGluZURpcik7XG4gIGlmICghc291cmNlKSB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgdmVyaWZ5IGxvY2FsIHR3ZWFrIGNoYW5nZXMgYmVmb3JlIHVwZGF0ZTogYmFzZWxpbmUgbWFuaWZlc3QgbWlzc2luZ1wiKTtcbiAgcmV0dXJuIGhhc2hUd2Vha1NvdXJjZShzb3VyY2UpO1xufVxuXG5mdW5jdGlvbiBoYXNoVHdlYWtTb3VyY2Uocm9vdDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGNvbnN0IG91dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBjb2xsZWN0VHdlYWtGaWxlSGFzaGVzKHJvb3QsIHJvb3QsIG91dCk7XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RUd2Vha0ZpbGVIYXNoZXMocm9vdDogc3RyaW5nLCBkaXI6IHN0cmluZywgb3V0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogdm9pZCB7XG4gIGZvciAoY29uc3QgbmFtZSBvZiByZWFkZGlyU3luYyhkaXIpLnNvcnQoKSkge1xuICAgIGlmIChuYW1lID09PSBcIi5naXRcIiB8fCBuYW1lID09PSBcIm5vZGVfbW9kdWxlc1wiIHx8IG5hbWUgPT09IFwiLmNvZGV4cHAtc3RvcmUuanNvblwiKSBjb250aW51ZTtcbiAgICBjb25zdCBmdWxsID0gam9pbihkaXIsIG5hbWUpO1xuICAgIGNvbnN0IHJlbCA9IHJlbGF0aXZlKHJvb3QsIGZ1bGwpLnNwbGl0KFwiXFxcXFwiKS5qb2luKFwiL1wiKTtcbiAgICBjb25zdCBzdGF0ID0gc3RhdFN5bmMoZnVsbCk7XG4gICAgaWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgY29sbGVjdFR3ZWFrRmlsZUhhc2hlcyhyb290LCBmdWxsLCBvdXQpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghc3RhdC5pc0ZpbGUoKSkgY29udGludWU7XG4gICAgb3V0W3JlbF0gPSBjcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShyZWFkRmlsZVN5bmMoZnVsbCkpLmRpZ2VzdChcImhleFwiKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzYW1lRmlsZUhhc2hlcyhhOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LCBiOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogYm9vbGVhbiB7XG4gIGNvbnN0IGFrID0gT2JqZWN0LmtleXMoYSkuc29ydCgpO1xuICBjb25zdCBiayA9IE9iamVjdC5rZXlzKGIpLnNvcnQoKTtcbiAgaWYgKGFrLmxlbmd0aCAhPT0gYmsubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYWsubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBha1tpXTtcbiAgICBpZiAoa2V5ICE9PSBia1tpXSB8fCBhW2tleV0gIT09IGJba2V5XSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc0hhc2hSZWNvcmQodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIE9iamVjdC52YWx1ZXModmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLmV2ZXJ5KCh2KSA9PiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIik7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVZlcnNpb24odjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHYudHJpbSgpLnJlcGxhY2UoL152L2ksIFwiXCIpO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlVmVyc2lvbnMoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBhdiA9IFZFUlNJT05fUkUuZXhlYyhhKTtcbiAgY29uc3QgYnYgPSBWRVJTSU9OX1JFLmV4ZWMoYik7XG4gIGlmICghYXYgfHwgIWJ2KSByZXR1cm4gMDtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPD0gMzsgaSsrKSB7XG4gICAgY29uc3QgZGlmZiA9IE51bWJlcihhdltpXSkgLSBOdW1iZXIoYnZbaV0pO1xuICAgIGlmIChkaWZmICE9PSAwKSByZXR1cm4gZGlmZjtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuZnVuY3Rpb24gZmFsbGJhY2tTb3VyY2VSb290KCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgIGpvaW4oaG9tZWRpcigpLCBcIi5jb2RleC1wbHVzcGx1c1wiLCBcInNvdXJjZVwiKSxcbiAgICBqb2luKHVzZXJSb290ISwgXCJzb3VyY2VcIiksXG4gIF07XG4gIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICBpZiAoZXhpc3RzU3luYyhqb2luKGNhbmRpZGF0ZSwgXCJwYWNrYWdlc1wiLCBcImluc3RhbGxlclwiLCBcImRpc3RcIiwgXCJjbGkuanNcIikpKSByZXR1cm4gY2FuZGlkYXRlO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBkZXNjcmliZUluc3RhbGxhdGlvblNvdXJjZShzb3VyY2VSb290OiBzdHJpbmcgfCBudWxsKTogSW5zdGFsbGF0aW9uU291cmNlIHtcbiAgaWYgKCFzb3VyY2VSb290KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6IFwidW5rbm93blwiLFxuICAgICAgbGFiZWw6IFwiVW5rbm93blwiLFxuICAgICAgZGV0YWlsOiBcIkNvZGV4Kysgc291cmNlIGxvY2F0aW9uIGlzIG5vdCByZWNvcmRlZCB5ZXQuXCIsXG4gICAgfTtcbiAgfVxuICBjb25zdCBub3JtYWxpemVkID0gc291cmNlUm9vdC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKTtcbiAgaWYgKC9cXC8oPzpIb21lYnJld3xob21lYnJldylcXC9DZWxsYXJcXC9jb2RleHBsdXNwbHVzXFwvLy50ZXN0KG5vcm1hbGl6ZWQpKSB7XG4gICAgcmV0dXJuIHsga2luZDogXCJob21lYnJld1wiLCBsYWJlbDogXCJIb21lYnJld1wiLCBkZXRhaWw6IHNvdXJjZVJvb3QgfTtcbiAgfVxuICBpZiAoZXhpc3RzU3luYyhqb2luKHNvdXJjZVJvb3QsIFwiLmdpdFwiKSkpIHtcbiAgICByZXR1cm4geyBraW5kOiBcImxvY2FsLWRldlwiLCBsYWJlbDogXCJMb2NhbCBkZXZlbG9wbWVudCBjaGVja291dFwiLCBkZXRhaWw6IHNvdXJjZVJvb3QgfTtcbiAgfVxuICBpZiAobm9ybWFsaXplZC5lbmRzV2l0aChcIi8uY29kZXgtcGx1c3BsdXMvc291cmNlXCIpIHx8IG5vcm1hbGl6ZWQuaW5jbHVkZXMoXCIvLmNvZGV4LXBsdXNwbHVzL3NvdXJjZS9cIikpIHtcbiAgICByZXR1cm4geyBraW5kOiBcImdpdGh1Yi1zb3VyY2VcIiwgbGFiZWw6IFwiR2l0SHViIHNvdXJjZSBpbnN0YWxsZXJcIiwgZGV0YWlsOiBzb3VyY2VSb290IH07XG4gIH1cbiAgaWYgKGV4aXN0c1N5bmMoam9pbihzb3VyY2VSb290LCBcInBhY2thZ2UuanNvblwiKSkpIHtcbiAgICByZXR1cm4geyBraW5kOiBcInNvdXJjZS1hcmNoaXZlXCIsIGxhYmVsOiBcIlNvdXJjZSBhcmNoaXZlXCIsIGRldGFpbDogc291cmNlUm9vdCB9O1xuICB9XG4gIHJldHVybiB7IGtpbmQ6IFwidW5rbm93blwiLCBsYWJlbDogXCJVbmtub3duXCIsIGRldGFpbDogc291cmNlUm9vdCB9O1xufVxuXG5mdW5jdGlvbiBydW5JbnN0YWxsZWRDbGkoY2xpOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZVJ1biwgcmVqZWN0UnVuKSA9PiB7XG4gICAgY29uc3QgY2hpbGQgPSBzcGF3bihwcm9jZXNzLmV4ZWNQYXRoLCBbY2xpLCAuLi5hcmdzXSwge1xuICAgICAgY3dkOiByZXNvbHZlKGRpcm5hbWUoY2xpKSwgXCIuLlwiLCBcIi4uXCIsIFwiLi5cIiksXG4gICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIENPREVYX1BMVVNQTFVTX01BTlVBTF9VUERBVEU6IFwiMVwiIH0sXG4gICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXG4gICAgfSk7XG4gICAgbGV0IG91dHB1dCA9IFwiXCI7XG4gICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICBvdXRwdXQgKz0gU3RyaW5nKGNodW5rKTtcbiAgICB9KTtcbiAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgIG91dHB1dCArPSBTdHJpbmcoY2h1bmspO1xuICAgIH0pO1xuICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgcmVqZWN0UnVuKTtcbiAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XG4gICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICByZXNvbHZlUnVuKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhaWwgPSBvdXRwdXQudHJpbSgpLnNwbGl0KC9cXHI/XFxuLykuc2xpY2UoLTEyKS5qb2luKFwiXFxuXCIpO1xuICAgICAgcmVqZWN0UnVuKG5ldyBFcnJvcih0YWlsIHx8IGBjb2RleHBsdXNwbHVzICR7YXJncy5qb2luKFwiIFwiKX0gZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7Y29kZX1gKSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBicm9hZGNhc3RSZWxvYWQoKTogdm9pZCB7XG4gIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgYXQ6IERhdGUubm93KCksXG4gICAgdHdlYWtzOiB0d2Vha1N0YXRlLmRpc2NvdmVyZWQubWFwKCh0KSA9PiB0Lm1hbmlmZXN0LmlkKSxcbiAgfTtcbiAgZm9yIChjb25zdCB3YyBvZiB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdjLnNlbmQoXCJjb2RleHBwOnR3ZWFrcy1jaGFuZ2VkXCIsIHBheWxvYWQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZyhcIndhcm5cIiwgXCJicm9hZGNhc3Qgc2VuZCBmYWlsZWQ6XCIsIGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBtYWtlTG9nZ2VyKHNjb3BlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHtcbiAgICBkZWJ1ZzogKC4uLmE6IHVua25vd25bXSkgPT4gbG9nKFwiaW5mb1wiLCBgWyR7c2NvcGV9XWAsIC4uLmEpLFxuICAgIGluZm86ICguLi5hOiB1bmtub3duW10pID0+IGxvZyhcImluZm9cIiwgYFske3Njb3BlfV1gLCAuLi5hKSxcbiAgICB3YXJuOiAoLi4uYTogdW5rbm93bltdKSA9PiBsb2coXCJ3YXJuXCIsIGBbJHtzY29wZX1dYCwgLi4uYSksXG4gICAgZXJyb3I6ICguLi5hOiB1bmtub3duW10pID0+IGxvZyhcImVycm9yXCIsIGBbJHtzY29wZX1dYCwgLi4uYSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1ha2VNYWluSXBjKGlkOiBzdHJpbmcpIHtcbiAgY29uc3QgY2ggPSAoYzogc3RyaW5nKSA9PiBgY29kZXhwcDoke2lkfToke2N9YDtcbiAgcmV0dXJuIHtcbiAgICBvbjogKGM6IHN0cmluZywgaDogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgY29uc3Qgd3JhcHBlZCA9IChfZTogdW5rbm93biwgLi4uYXJnczogdW5rbm93bltdKSA9PiBoKC4uLmFyZ3MpO1xuICAgICAgaXBjTWFpbi5vbihjaChjKSwgd3JhcHBlZCk7XG4gICAgICByZXR1cm4gKCkgPT4gaXBjTWFpbi5yZW1vdmVMaXN0ZW5lcihjaChjKSwgd3JhcHBlZCBhcyBuZXZlcik7XG4gICAgfSxcbiAgICBzZW5kOiAoX2M6IHN0cmluZykgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaXBjLnNlbmQgaXMgcmVuZGVyZXJcdTIxOTJtYWluOyBtYWluIHNpZGUgdXNlcyBoYW5kbGUvb25cIik7XG4gICAgfSxcbiAgICBpbnZva2U6IChfYzogc3RyaW5nKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpcGMuaW52b2tlIGlzIHJlbmRlcmVyXHUyMTkybWFpbjsgbWFpbiBzaWRlIHVzZXMgaGFuZGxlXCIpO1xuICAgIH0sXG4gICAgaGFuZGxlOiAoYzogc3RyaW5nLCBoYW5kbGVyOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duKSA9PiB7XG4gICAgICBpcGNNYWluLmhhbmRsZShjaChjKSwgKF9lOiB1bmtub3duLCAuLi5hcmdzOiB1bmtub3duW10pID0+IGhhbmRsZXIoLi4uYXJncykpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1ha2VNYWluRnMoaWQ6IHN0cmluZykge1xuICBjb25zdCBkaXIgPSBqb2luKHVzZXJSb290ISwgXCJ0d2Vhay1kYXRhXCIsIGlkKTtcbiAgbWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGNvbnN0IGZzID0gcmVxdWlyZShcIm5vZGU6ZnMvcHJvbWlzZXNcIikgYXMgdHlwZW9mIGltcG9ydChcIm5vZGU6ZnMvcHJvbWlzZXNcIik7XG4gIHJldHVybiB7XG4gICAgZGF0YURpcjogZGlyLFxuICAgIHJlYWQ6IChwOiBzdHJpbmcpID0+IGZzLnJlYWRGaWxlKGpvaW4oZGlyLCBwKSwgXCJ1dGY4XCIpLFxuICAgIHdyaXRlOiAocDogc3RyaW5nLCBjOiBzdHJpbmcpID0+IGZzLndyaXRlRmlsZShqb2luKGRpciwgcCksIGMsIFwidXRmOFwiKSxcbiAgICBleGlzdHM6IGFzeW5jIChwOiBzdHJpbmcpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLmFjY2Vzcyhqb2luKGRpciwgcCkpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWFrZUNvZGV4QXBpKCkge1xuICByZXR1cm4ge1xuICAgIGNyZWF0ZUJyb3dzZXJWaWV3OiBhc3luYyAob3B0czogQ29kZXhDcmVhdGVWaWV3T3B0aW9ucykgPT4ge1xuICAgICAgY29uc3Qgc2VydmljZXMgPSBnZXRDb2RleFdpbmRvd1NlcnZpY2VzKCk7XG4gICAgICBjb25zdCB3aW5kb3dNYW5hZ2VyID0gc2VydmljZXM/LndpbmRvd01hbmFnZXI7XG4gICAgICBpZiAoIXNlcnZpY2VzIHx8ICF3aW5kb3dNYW5hZ2VyPy5yZWdpc3RlcldpbmRvdykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgXCJDb2RleCBlbWJlZGRlZCB2aWV3IHNlcnZpY2VzIGFyZSBub3QgYXZhaWxhYmxlLiBSZWluc3RhbGwgQ29kZXgrKyAwLjEuMSBvciBsYXRlci5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgcm91dGUgPSBub3JtYWxpemVDb2RleFJvdXRlKG9wdHMucm91dGUpO1xuICAgICAgY29uc3QgaG9zdElkID0gb3B0cy5ob3N0SWQgfHwgXCJsb2NhbFwiO1xuICAgICAgY29uc3QgYXBwZWFyYW5jZSA9IG9wdHMuYXBwZWFyYW5jZSB8fCBcInNlY29uZGFyeVwiO1xuICAgICAgY29uc3QgdmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgcHJlbG9hZDogd2luZG93TWFuYWdlci5vcHRpb25zPy5wcmVsb2FkUGF0aCxcbiAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgIG5vZGVJbnRlZ3JhdGlvbjogZmFsc2UsXG4gICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgZGV2VG9vbHM6IHdpbmRvd01hbmFnZXIub3B0aW9ucz8uYWxsb3dEZXZ0b29scyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3Qgd2luZG93TGlrZSA9IG1ha2VXaW5kb3dMaWtlRm9yVmlldyh2aWV3KTtcbiAgICAgIHdpbmRvd01hbmFnZXIucmVnaXN0ZXJXaW5kb3cod2luZG93TGlrZSwgaG9zdElkLCBmYWxzZSwgYXBwZWFyYW5jZSk7XG4gICAgICBzZXJ2aWNlcy5nZXRDb250ZXh0Py4oaG9zdElkKT8ucmVnaXN0ZXJXaW5kb3c/Lih3aW5kb3dMaWtlKTtcbiAgICAgIGF3YWl0IHZpZXcud2ViQ29udGVudHMubG9hZFVSTChjb2RleEFwcFVybChyb3V0ZSwgaG9zdElkKSk7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuXG4gICAgY3JlYXRlV2luZG93OiBhc3luYyAob3B0czogQ29kZXhDcmVhdGVXaW5kb3dPcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBzZXJ2aWNlcyA9IGdldENvZGV4V2luZG93U2VydmljZXMoKTtcbiAgICAgIGlmICghc2VydmljZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiQ29kZXggd2luZG93IHNlcnZpY2VzIGFyZSBub3QgYXZhaWxhYmxlLiBSZWluc3RhbGwgQ29kZXgrKyAwLjEuMSBvciBsYXRlci5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgcm91dGUgPSBub3JtYWxpemVDb2RleFJvdXRlKG9wdHMucm91dGUpO1xuICAgICAgY29uc3QgaG9zdElkID0gb3B0cy5ob3N0SWQgfHwgXCJsb2NhbFwiO1xuICAgICAgY29uc3QgcGFyZW50ID0gdHlwZW9mIG9wdHMucGFyZW50V2luZG93SWQgPT09IFwibnVtYmVyXCJcbiAgICAgICAgPyBCcm93c2VyV2luZG93LmZyb21JZChvcHRzLnBhcmVudFdpbmRvd0lkKVxuICAgICAgICA6IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICAgICAgY29uc3QgY3JlYXRlV2luZG93ID0gc2VydmljZXMud2luZG93TWFuYWdlcj8uY3JlYXRlV2luZG93O1xuXG4gICAgICBsZXQgd2luOiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0eXBlb2YgY3JlYXRlV2luZG93ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgd2luID0gYXdhaXQgY3JlYXRlV2luZG93LmNhbGwoc2VydmljZXMud2luZG93TWFuYWdlciwge1xuICAgICAgICAgIGluaXRpYWxSb3V0ZTogcm91dGUsXG4gICAgICAgICAgaG9zdElkLFxuICAgICAgICAgIHNob3c6IG9wdHMuc2hvdyAhPT0gZmFsc2UsXG4gICAgICAgICAgYXBwZWFyYW5jZTogb3B0cy5hcHBlYXJhbmNlIHx8IFwic2Vjb25kYXJ5XCIsXG4gICAgICAgICAgcGFyZW50LFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaG9zdElkID09PSBcImxvY2FsXCIgJiYgdHlwZW9mIHNlcnZpY2VzLmNyZWF0ZUZyZXNoTG9jYWxXaW5kb3cgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB3aW4gPSBhd2FpdCBzZXJ2aWNlcy5jcmVhdGVGcmVzaExvY2FsV2luZG93KHJvdXRlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlcnZpY2VzLmVuc3VyZUhvc3RXaW5kb3cgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB3aW4gPSBhd2FpdCBzZXJ2aWNlcy5lbnN1cmVIb3N0V2luZG93KGhvc3RJZCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghd2luIHx8IHdpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvZGV4IGRpZCBub3QgcmV0dXJuIGEgd2luZG93IGZvciB0aGUgcmVxdWVzdGVkIHJvdXRlXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0cy5ib3VuZHMpIHtcbiAgICAgICAgd2luLnNldEJvdW5kcyhvcHRzLmJvdW5kcyk7XG4gICAgICB9XG4gICAgICBpZiAocGFyZW50ICYmICFwYXJlbnQuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdpbi5zZXRQYXJlbnRXaW5kb3cocGFyZW50KTtcbiAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgfVxuICAgICAgaWYgKG9wdHMuc2hvdyAhPT0gZmFsc2UpIHtcbiAgICAgICAgd2luLnNob3coKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgd2luZG93SWQ6IHdpbi5pZCxcbiAgICAgICAgd2ViQ29udGVudHNJZDogd2luLndlYkNvbnRlbnRzLmlkLFxuICAgICAgfTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBtYWtlV2luZG93TGlrZUZvclZpZXcodmlldzogRWxlY3Ryb24uQnJvd3NlclZpZXcpOiBDb2RleFdpbmRvd0xpa2Uge1xuICBjb25zdCB2aWV3Qm91bmRzID0gKCkgPT4gdmlldy5nZXRCb3VuZHMoKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogdmlldy53ZWJDb250ZW50cy5pZCxcbiAgICB3ZWJDb250ZW50czogdmlldy53ZWJDb250ZW50cyxcbiAgICBvbjogKGV2ZW50OiBcImNsb3NlZFwiLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgaWYgKGV2ZW50ID09PSBcImNsb3NlZFwiKSB7XG4gICAgICAgIHZpZXcud2ViQ29udGVudHMub25jZShcImRlc3Ryb3llZFwiLCBsaXN0ZW5lcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2aWV3LndlYkNvbnRlbnRzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIG9uY2U6IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgdmlldy53ZWJDb250ZW50cy5vbmNlKGV2ZW50IGFzIFwiZGVzdHJveWVkXCIsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB2aWV3O1xuICAgIH0sXG4gICAgb2ZmOiAoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpID0+IHtcbiAgICAgIHZpZXcud2ViQ29udGVudHMub2ZmKGV2ZW50IGFzIFwiZGVzdHJveWVkXCIsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB2aWV3O1xuICAgIH0sXG4gICAgcmVtb3ZlTGlzdGVuZXI6IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkgPT4ge1xuICAgICAgdmlldy53ZWJDb250ZW50cy5yZW1vdmVMaXN0ZW5lcihldmVudCBhcyBcImRlc3Ryb3llZFwiLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdmlldztcbiAgICB9LFxuICAgIGlzRGVzdHJveWVkOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmlzRGVzdHJveWVkKCksXG4gICAgaXNGb2N1c2VkOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmlzRm9jdXNlZCgpLFxuICAgIGZvY3VzOiAoKSA9PiB2aWV3LndlYkNvbnRlbnRzLmZvY3VzKCksXG4gICAgc2hvdzogKCkgPT4ge30sXG4gICAgaGlkZTogKCkgPT4ge30sXG4gICAgZ2V0Qm91bmRzOiB2aWV3Qm91bmRzLFxuICAgIGdldENvbnRlbnRCb3VuZHM6IHZpZXdCb3VuZHMsXG4gICAgZ2V0U2l6ZTogKCkgPT4ge1xuICAgICAgY29uc3QgYiA9IHZpZXdCb3VuZHMoKTtcbiAgICAgIHJldHVybiBbYi53aWR0aCwgYi5oZWlnaHRdO1xuICAgIH0sXG4gICAgZ2V0Q29udGVudFNpemU6ICgpID0+IHtcbiAgICAgIGNvbnN0IGIgPSB2aWV3Qm91bmRzKCk7XG4gICAgICByZXR1cm4gW2Iud2lkdGgsIGIuaGVpZ2h0XTtcbiAgICB9LFxuICAgIHNldFRpdGxlOiAoKSA9PiB7fSxcbiAgICBnZXRUaXRsZTogKCkgPT4gXCJcIixcbiAgICBzZXRSZXByZXNlbnRlZEZpbGVuYW1lOiAoKSA9PiB7fSxcbiAgICBzZXREb2N1bWVudEVkaXRlZDogKCkgPT4ge30sXG4gICAgc2V0V2luZG93QnV0dG9uVmlzaWJpbGl0eTogKCkgPT4ge30sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvZGV4QXBwVXJsKHJvdXRlOiBzdHJpbmcsIGhvc3RJZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgdXJsID0gbmV3IFVSTChcImFwcDovLy0vaW5kZXguaHRtbFwiKTtcbiAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJob3N0SWRcIiwgaG9zdElkKTtcbiAgaWYgKHJvdXRlICE9PSBcIi9cIikgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJpbml0aWFsUm91dGVcIiwgcm91dGUpO1xuICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG59XG5cbmZ1bmN0aW9uIGdldENvZGV4V2luZG93U2VydmljZXMoKTogQ29kZXhXaW5kb3dTZXJ2aWNlcyB8IG51bGwge1xuICBjb25zdCBzZXJ2aWNlcyA9IChnbG9iYWxUaGlzIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW0NPREVYX1dJTkRPV19TRVJWSUNFU19LRVldO1xuICByZXR1cm4gc2VydmljZXMgJiYgdHlwZW9mIHNlcnZpY2VzID09PSBcIm9iamVjdFwiID8gKHNlcnZpY2VzIGFzIENvZGV4V2luZG93U2VydmljZXMpIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29kZXhSb3V0ZShyb3V0ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiByb3V0ZSAhPT0gXCJzdHJpbmdcIiB8fCAhcm91dGUuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2RleCByb3V0ZSBtdXN0IGJlIGFuIGFic29sdXRlIGFwcCByb3V0ZVwiKTtcbiAgfVxuICBpZiAocm91dGUuaW5jbHVkZXMoXCI6Ly9cIikgfHwgcm91dGUuaW5jbHVkZXMoXCJcXG5cIikgfHwgcm91dGUuaW5jbHVkZXMoXCJcXHJcIikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2RleCByb3V0ZSBtdXN0IG5vdCBpbmNsdWRlIGEgcHJvdG9jb2wgb3IgY29udHJvbCBjaGFyYWN0ZXJzXCIpO1xuICB9XG4gIHJldHVybiByb3V0ZTtcbn1cblxuLy8gVG91Y2ggQnJvd3NlcldpbmRvdyB0byBrZWVwIGl0cyBpbXBvcnQgXHUyMDE0IG9sZGVyIEVsZWN0cm9uIGxpbnQgcnVsZXMuXG52b2lkIEJyb3dzZXJXaW5kb3c7XG4iLCAiLyohIGNob2tpZGFyIC0gTUlUIExpY2Vuc2UgKGMpIDIwMTIgUGF1bCBNaWxsZXIgKHBhdWxtaWxsci5jb20pICovXG5pbXBvcnQgeyBzdGF0IGFzIHN0YXRjYiB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IHN0YXQsIHJlYWRkaXIgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0ICogYXMgc3lzUGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHJlYWRkaXJwIH0gZnJvbSAncmVhZGRpcnAnO1xuaW1wb3J0IHsgTm9kZUZzSGFuZGxlciwgRVZFTlRTIGFzIEVWLCBpc1dpbmRvd3MsIGlzSUJNaSwgRU1QVFlfRk4sIFNUUl9DTE9TRSwgU1RSX0VORCwgfSBmcm9tICcuL2hhbmRsZXIuanMnO1xuY29uc3QgU0xBU0ggPSAnLyc7XG5jb25zdCBTTEFTSF9TTEFTSCA9ICcvLyc7XG5jb25zdCBPTkVfRE9UID0gJy4nO1xuY29uc3QgVFdPX0RPVFMgPSAnLi4nO1xuY29uc3QgU1RSSU5HX1RZUEUgPSAnc3RyaW5nJztcbmNvbnN0IEJBQ0tfU0xBU0hfUkUgPSAvXFxcXC9nO1xuY29uc3QgRE9VQkxFX1NMQVNIX1JFID0gL1xcL1xcLy87XG5jb25zdCBET1RfUkUgPSAvXFwuLipcXC4oc3dbcHhdKSR8fiR8XFwuc3VibC4qXFwudG1wLztcbmNvbnN0IFJFUExBQ0VSX1JFID0gL15cXC5bL1xcXFxdLztcbmZ1bmN0aW9uIGFycmlmeShpdGVtKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtIDogW2l0ZW1dO1xufVxuY29uc3QgaXNNYXRjaGVyT2JqZWN0ID0gKG1hdGNoZXIpID0+IHR5cGVvZiBtYXRjaGVyID09PSAnb2JqZWN0JyAmJiBtYXRjaGVyICE9PSBudWxsICYmICEobWF0Y2hlciBpbnN0YW5jZW9mIFJlZ0V4cCk7XG5mdW5jdGlvbiBjcmVhdGVQYXR0ZXJuKG1hdGNoZXIpIHtcbiAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiBtYXRjaGVyO1xuICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiAoc3RyaW5nKSA9PiBtYXRjaGVyID09PSBzdHJpbmc7XG4gICAgaWYgKG1hdGNoZXIgaW5zdGFuY2VvZiBSZWdFeHApXG4gICAgICAgIHJldHVybiAoc3RyaW5nKSA9PiBtYXRjaGVyLnRlc3Qoc3RyaW5nKTtcbiAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09ICdvYmplY3QnICYmIG1hdGNoZXIgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIChzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChtYXRjaGVyLnBhdGggPT09IHN0cmluZylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChtYXRjaGVyLnJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aXZlID0gc3lzUGF0aC5yZWxhdGl2ZShtYXRjaGVyLnBhdGgsIHN0cmluZyk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhcmVsYXRpdmUuc3RhcnRzV2l0aCgnLi4nKSAmJiAhc3lzUGF0aC5pc0Fic29sdXRlKHJlbGF0aXZlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IGZhbHNlO1xufVxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aChwYXRoKSB7XG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdHJpbmcgZXhwZWN0ZWQnKTtcbiAgICBwYXRoID0gc3lzUGF0aC5ub3JtYWxpemUocGF0aCk7XG4gICAgcGF0aCA9IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGxldCBwcmVwZW5kID0gZmFsc2U7XG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLy8nKSlcbiAgICAgICAgcHJlcGVuZCA9IHRydWU7XG4gICAgY29uc3QgRE9VQkxFX1NMQVNIX1JFID0gL1xcL1xcLy87XG4gICAgd2hpbGUgKHBhdGgubWF0Y2goRE9VQkxFX1NMQVNIX1JFKSlcbiAgICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZShET1VCTEVfU0xBU0hfUkUsICcvJyk7XG4gICAgaWYgKHByZXBlbmQpXG4gICAgICAgIHBhdGggPSAnLycgKyBwYXRoO1xuICAgIHJldHVybiBwYXRoO1xufVxuZnVuY3Rpb24gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZywgc3RhdHMpIHtcbiAgICBjb25zdCBwYXRoID0gbm9ybWFsaXplUGF0aCh0ZXN0U3RyaW5nKTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcGF0dGVybnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBwYXR0ZXJuc1tpbmRleF07XG4gICAgICAgIGlmIChwYXR0ZXJuKHBhdGgsIHN0YXRzKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gYW55bWF0Y2gobWF0Y2hlcnMsIHRlc3RTdHJpbmcpIHtcbiAgICBpZiAobWF0Y2hlcnMgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdhbnltYXRjaDogc3BlY2lmeSBmaXJzdCBhcmd1bWVudCcpO1xuICAgIH1cbiAgICAvLyBFYXJseSBjYWNoZSBmb3IgbWF0Y2hlcnMuXG4gICAgY29uc3QgbWF0Y2hlcnNBcnJheSA9IGFycmlmeShtYXRjaGVycyk7XG4gICAgY29uc3QgcGF0dGVybnMgPSBtYXRjaGVyc0FycmF5Lm1hcCgobWF0Y2hlcikgPT4gY3JlYXRlUGF0dGVybihtYXRjaGVyKSk7XG4gICAgaWYgKHRlc3RTdHJpbmcgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gKHRlc3RTdHJpbmcsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZywgc3RhdHMpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hQYXR0ZXJucyhwYXR0ZXJucywgdGVzdFN0cmluZyk7XG59XG5jb25zdCB1bmlmeVBhdGhzID0gKHBhdGhzXykgPT4ge1xuICAgIGNvbnN0IHBhdGhzID0gYXJyaWZ5KHBhdGhzXykuZmxhdCgpO1xuICAgIGlmICghcGF0aHMuZXZlcnkoKHApID0+IHR5cGVvZiBwID09PSBTVFJJTkdfVFlQRSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm9uLXN0cmluZyBwcm92aWRlZCBhcyB3YXRjaCBwYXRoOiAke3BhdGhzfWApO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aHMubWFwKG5vcm1hbGl6ZVBhdGhUb1VuaXgpO1xufTtcbi8vIElmIFNMQVNIX1NMQVNIIG9jY3VycyBhdCB0aGUgYmVnaW5uaW5nIG9mIHBhdGgsIGl0IGlzIG5vdCByZXBsYWNlZFxuLy8gICAgIGJlY2F1c2UgXCIvL1N0b3JhZ2VQQy9Ecml2ZVBvb2wvTW92aWVzXCIgaXMgYSB2YWxpZCBuZXR3b3JrIHBhdGhcbmNvbnN0IHRvVW5peCA9IChzdHJpbmcpID0+IHtcbiAgICBsZXQgc3RyID0gc3RyaW5nLnJlcGxhY2UoQkFDS19TTEFTSF9SRSwgU0xBU0gpO1xuICAgIGxldCBwcmVwZW5kID0gZmFsc2U7XG4gICAgaWYgKHN0ci5zdGFydHNXaXRoKFNMQVNIX1NMQVNIKSkge1xuICAgICAgICBwcmVwZW5kID0gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHN0ci5tYXRjaChET1VCTEVfU0xBU0hfUkUpKSB7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKERPVUJMRV9TTEFTSF9SRSwgU0xBU0gpO1xuICAgIH1cbiAgICBpZiAocHJlcGVuZCkge1xuICAgICAgICBzdHIgPSBTTEFTSCArIHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbn07XG4vLyBPdXIgdmVyc2lvbiBvZiB1cGF0aC5ub3JtYWxpemVcbi8vIFRPRE86IHRoaXMgaXMgbm90IGVxdWFsIHRvIHBhdGgtbm9ybWFsaXplIG1vZHVsZSAtIGludmVzdGlnYXRlIHdoeVxuY29uc3Qgbm9ybWFsaXplUGF0aFRvVW5peCA9IChwYXRoKSA9PiB0b1VuaXgoc3lzUGF0aC5ub3JtYWxpemUodG9Vbml4KHBhdGgpKSk7XG4vLyBUT0RPOiByZWZhY3RvclxuY29uc3Qgbm9ybWFsaXplSWdub3JlZCA9IChjd2QgPSAnJykgPT4gKHBhdGgpID0+IHtcbiAgICBpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBub3JtYWxpemVQYXRoVG9Vbml4KHN5c1BhdGguaXNBYnNvbHV0ZShwYXRoKSA/IHBhdGggOiBzeXNQYXRoLmpvaW4oY3dkLCBwYXRoKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG59O1xuY29uc3QgZ2V0QWJzb2x1dGVQYXRoID0gKHBhdGgsIGN3ZCkgPT4ge1xuICAgIGlmIChzeXNQYXRoLmlzQWJzb2x1dGUocGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxuICAgIHJldHVybiBzeXNQYXRoLmpvaW4oY3dkLCBwYXRoKTtcbn07XG5jb25zdCBFTVBUWV9TRVQgPSBPYmplY3QuZnJlZXplKG5ldyBTZXQoKSk7XG4vKipcbiAqIERpcmVjdG9yeSBlbnRyeS5cbiAqL1xuY2xhc3MgRGlyRW50cnkge1xuICAgIGNvbnN0cnVjdG9yKGRpciwgcmVtb3ZlV2F0Y2hlcikge1xuICAgICAgICB0aGlzLnBhdGggPSBkaXI7XG4gICAgICAgIHRoaXMuX3JlbW92ZVdhdGNoZXIgPSByZW1vdmVXYXRjaGVyO1xuICAgICAgICB0aGlzLml0ZW1zID0gbmV3IFNldCgpO1xuICAgIH1cbiAgICBhZGQoaXRlbSkge1xuICAgICAgICBjb25zdCB7IGl0ZW1zIH0gPSB0aGlzO1xuICAgICAgICBpZiAoIWl0ZW1zKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAoaXRlbSAhPT0gT05FX0RPVCAmJiBpdGVtICE9PSBUV09fRE9UUylcbiAgICAgICAgICAgIGl0ZW1zLmFkZChpdGVtKTtcbiAgICB9XG4gICAgYXN5bmMgcmVtb3ZlKGl0ZW0pIHtcbiAgICAgICAgY29uc3QgeyBpdGVtcyB9ID0gdGhpcztcbiAgICAgICAgaWYgKCFpdGVtcylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgaXRlbXMuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBpZiAoaXRlbXMuc2l6ZSA+IDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IGRpciA9IHRoaXMucGF0aDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHJlYWRkaXIoZGlyKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcmVtb3ZlV2F0Y2hlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZVdhdGNoZXIoc3lzUGF0aC5kaXJuYW1lKGRpciksIHN5c1BhdGguYmFzZW5hbWUoZGlyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaGFzKGl0ZW0pIHtcbiAgICAgICAgY29uc3QgeyBpdGVtcyB9ID0gdGhpcztcbiAgICAgICAgaWYgKCFpdGVtcylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGl0ZW1zLmhhcyhpdGVtKTtcbiAgICB9XG4gICAgZ2V0Q2hpbGRyZW4oKSB7XG4gICAgICAgIGNvbnN0IHsgaXRlbXMgfSA9IHRoaXM7XG4gICAgICAgIGlmICghaXRlbXMpXG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIHJldHVybiBbLi4uaXRlbXMudmFsdWVzKCldO1xuICAgIH1cbiAgICBkaXNwb3NlKCkge1xuICAgICAgICB0aGlzLml0ZW1zLmNsZWFyKCk7XG4gICAgICAgIHRoaXMucGF0aCA9ICcnO1xuICAgICAgICB0aGlzLl9yZW1vdmVXYXRjaGVyID0gRU1QVFlfRk47XG4gICAgICAgIHRoaXMuaXRlbXMgPSBFTVBUWV9TRVQ7XG4gICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gICAgfVxufVxuY29uc3QgU1RBVF9NRVRIT0RfRiA9ICdzdGF0JztcbmNvbnN0IFNUQVRfTUVUSE9EX0wgPSAnbHN0YXQnO1xuZXhwb3J0IGNsYXNzIFdhdGNoSGVscGVyIHtcbiAgICBjb25zdHJ1Y3RvcihwYXRoLCBmb2xsb3csIGZzdykge1xuICAgICAgICB0aGlzLmZzdyA9IGZzdztcbiAgICAgICAgY29uc3Qgd2F0Y2hQYXRoID0gcGF0aDtcbiAgICAgICAgdGhpcy5wYXRoID0gcGF0aCA9IHBhdGgucmVwbGFjZShSRVBMQUNFUl9SRSwgJycpO1xuICAgICAgICB0aGlzLndhdGNoUGF0aCA9IHdhdGNoUGF0aDtcbiAgICAgICAgdGhpcy5mdWxsV2F0Y2hQYXRoID0gc3lzUGF0aC5yZXNvbHZlKHdhdGNoUGF0aCk7XG4gICAgICAgIHRoaXMuZGlyUGFydHMgPSBbXTtcbiAgICAgICAgdGhpcy5kaXJQYXJ0cy5mb3JFYWNoKChwYXJ0cykgPT4ge1xuICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpXG4gICAgICAgICAgICAgICAgcGFydHMucG9wKCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmZvbGxvd1N5bWxpbmtzID0gZm9sbG93O1xuICAgICAgICB0aGlzLnN0YXRNZXRob2QgPSBmb2xsb3cgPyBTVEFUX01FVEhPRF9GIDogU1RBVF9NRVRIT0RfTDtcbiAgICB9XG4gICAgZW50cnlQYXRoKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiBzeXNQYXRoLmpvaW4odGhpcy53YXRjaFBhdGgsIHN5c1BhdGgucmVsYXRpdmUodGhpcy53YXRjaFBhdGgsIGVudHJ5LmZ1bGxQYXRoKSk7XG4gICAgfVxuICAgIGZpbHRlclBhdGgoZW50cnkpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0cyB9ID0gZW50cnk7XG4gICAgICAgIGlmIChzdGF0cyAmJiBzdGF0cy5pc1N5bWJvbGljTGluaygpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyRGlyKGVudHJ5KTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gdGhpcy5lbnRyeVBhdGgoZW50cnkpO1xuICAgICAgICAvLyBUT0RPOiB3aGF0IGlmIHN0YXRzIGlzIHVuZGVmaW5lZD8gcmVtb3ZlICFcbiAgICAgICAgcmV0dXJuIHRoaXMuZnN3Ll9pc250SWdub3JlZChyZXNvbHZlZFBhdGgsIHN0YXRzKSAmJiB0aGlzLmZzdy5faGFzUmVhZFBlcm1pc3Npb25zKHN0YXRzKTtcbiAgICB9XG4gICAgZmlsdGVyRGlyKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZzdy5faXNudElnbm9yZWQodGhpcy5lbnRyeVBhdGgoZW50cnkpLCBlbnRyeS5zdGF0cyk7XG4gICAgfVxufVxuLyoqXG4gKiBXYXRjaGVzIGZpbGVzICYgZGlyZWN0b3JpZXMgZm9yIGNoYW5nZXMuIEVtaXR0ZWQgZXZlbnRzOlxuICogYGFkZGAsIGBhZGREaXJgLCBgY2hhbmdlYCwgYHVubGlua2AsIGB1bmxpbmtEaXJgLCBgYWxsYCwgYGVycm9yYFxuICpcbiAqICAgICBuZXcgRlNXYXRjaGVyKClcbiAqICAgICAgIC5hZGQoZGlyZWN0b3JpZXMpXG4gKiAgICAgICAub24oJ2FkZCcsIHBhdGggPT4gbG9nKCdGaWxlJywgcGF0aCwgJ3dhcyBhZGRlZCcpKVxuICovXG5leHBvcnQgY2xhc3MgRlNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICAvLyBOb3QgaW5kZW50aW5nIG1ldGhvZHMgZm9yIGhpc3Rvcnkgc2FrZTsgZm9yIG5vdy5cbiAgICBjb25zdHJ1Y3Rvcihfb3B0cyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuY2xvc2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fdGhyb3R0bGVkID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9zeW1saW5rUGF0aHMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3dhdGNoZWQgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3BlbmRpbmdXcml0ZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuX3BlbmRpbmdVbmxpbmtzID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLl9yZWFkeUNvdW50ID0gMDtcbiAgICAgICAgdGhpcy5fcmVhZHlFbWl0dGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGF3ZiA9IF9vcHRzLmF3YWl0V3JpdGVGaW5pc2g7XG4gICAgICAgIGNvbnN0IERFRl9BV0YgPSB7IHN0YWJpbGl0eVRocmVzaG9sZDogMjAwMCwgcG9sbEludGVydmFsOiAxMDAgfTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC8vIERlZmF1bHRzXG4gICAgICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLFxuICAgICAgICAgICAgaWdub3JlSW5pdGlhbDogZmFsc2UsXG4gICAgICAgICAgICBpZ25vcmVQZXJtaXNzaW9uRXJyb3JzOiBmYWxzZSxcbiAgICAgICAgICAgIGludGVydmFsOiAxMDAsXG4gICAgICAgICAgICBiaW5hcnlJbnRlcnZhbDogMzAwLFxuICAgICAgICAgICAgZm9sbG93U3ltbGlua3M6IHRydWUsXG4gICAgICAgICAgICB1c2VQb2xsaW5nOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHVzZUFzeW5jOiBmYWxzZSxcbiAgICAgICAgICAgIGF0b21pYzogdHJ1ZSwgLy8gTk9URTogb3ZlcndyaXR0ZW4gbGF0ZXIgKGRlcGVuZHMgb24gdXNlUG9sbGluZylcbiAgICAgICAgICAgIC4uLl9vcHRzLFxuICAgICAgICAgICAgLy8gQ2hhbmdlIGZvcm1hdFxuICAgICAgICAgICAgaWdub3JlZDogX29wdHMuaWdub3JlZCA/IGFycmlmeShfb3B0cy5pZ25vcmVkKSA6IGFycmlmeShbXSksXG4gICAgICAgICAgICBhd2FpdFdyaXRlRmluaXNoOiBhd2YgPT09IHRydWUgPyBERUZfQVdGIDogdHlwZW9mIGF3ZiA9PT0gJ29iamVjdCcgPyB7IC4uLkRFRl9BV0YsIC4uLmF3ZiB9IDogZmFsc2UsXG4gICAgICAgIH07XG4gICAgICAgIC8vIEFsd2F5cyBkZWZhdWx0IHRvIHBvbGxpbmcgb24gSUJNIGkgYmVjYXVzZSBmcy53YXRjaCgpIGlzIG5vdCBhdmFpbGFibGUgb24gSUJNIGkuXG4gICAgICAgIGlmIChpc0lCTWkpXG4gICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAvLyBFZGl0b3IgYXRvbWljIHdyaXRlIG5vcm1hbGl6YXRpb24gZW5hYmxlZCBieSBkZWZhdWx0IHdpdGggZnMud2F0Y2hcbiAgICAgICAgaWYgKG9wdHMuYXRvbWljID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICBvcHRzLmF0b21pYyA9ICFvcHRzLnVzZVBvbGxpbmc7XG4gICAgICAgIC8vIG9wdHMuYXRvbWljID0gdHlwZW9mIF9vcHRzLmF0b21pYyA9PT0gJ251bWJlcicgPyBfb3B0cy5hdG9taWMgOiAxMDA7XG4gICAgICAgIC8vIEdsb2JhbCBvdmVycmlkZS4gVXNlZnVsIGZvciBkZXZlbG9wZXJzLCB3aG8gbmVlZCB0byBmb3JjZSBwb2xsaW5nIGZvciBhbGxcbiAgICAgICAgLy8gaW5zdGFuY2VzIG9mIGNob2tpZGFyLCByZWdhcmRsZXNzIG9mIHVzYWdlIC8gZGVwZW5kZW5jeSBkZXB0aFxuICAgICAgICBjb25zdCBlbnZQb2xsID0gcHJvY2Vzcy5lbnYuQ0hPS0lEQVJfVVNFUE9MTElORztcbiAgICAgICAgaWYgKGVudlBvbGwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgZW52TG93ZXIgPSBlbnZQb2xsLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAoZW52TG93ZXIgPT09ICdmYWxzZScgfHwgZW52TG93ZXIgPT09ICcwJylcbiAgICAgICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGVsc2UgaWYgKGVudkxvd2VyID09PSAndHJ1ZScgfHwgZW52TG93ZXIgPT09ICcxJylcbiAgICAgICAgICAgICAgICBvcHRzLnVzZVBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIG9wdHMudXNlUG9sbGluZyA9ICEhZW52TG93ZXI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW52SW50ZXJ2YWwgPSBwcm9jZXNzLmVudi5DSE9LSURBUl9JTlRFUlZBTDtcbiAgICAgICAgaWYgKGVudkludGVydmFsKVxuICAgICAgICAgICAgb3B0cy5pbnRlcnZhbCA9IE51bWJlci5wYXJzZUludChlbnZJbnRlcnZhbCwgMTApO1xuICAgICAgICAvLyBUaGlzIGlzIGRvbmUgdG8gZW1pdCByZWFkeSBvbmx5IG9uY2UsIGJ1dCBlYWNoICdhZGQnIHdpbGwgaW5jcmVhc2UgdGhhdD9cbiAgICAgICAgbGV0IHJlYWR5Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9lbWl0UmVhZHkgPSAoKSA9PiB7XG4gICAgICAgICAgICByZWFkeUNhbGxzKys7XG4gICAgICAgICAgICBpZiAocmVhZHlDYWxscyA+PSB0aGlzLl9yZWFkeUNvdW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdFJlYWR5ID0gRU1QVFlfRk47XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVhZHlFbWl0dGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyB1c2UgcHJvY2Vzcy5uZXh0VGljayB0byBhbGxvdyB0aW1lIGZvciBsaXN0ZW5lciB0byBiZSBib3VuZFxuICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KEVWLlJFQURZKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2VtaXRSYXcgPSAoLi4uYXJncykgPT4gdGhpcy5lbWl0KEVWLlJBVywgLi4uYXJncyk7XG4gICAgICAgIHRoaXMuX2JvdW5kUmVtb3ZlID0gdGhpcy5fcmVtb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdHM7XG4gICAgICAgIHRoaXMuX25vZGVGc0hhbmRsZXIgPSBuZXcgTm9kZUZzSGFuZGxlcih0aGlzKTtcbiAgICAgICAgLy8gWW91XHUyMDE5cmUgZnJvemVuIHdoZW4geW91ciBoZWFydFx1MjAxOXMgbm90IG9wZW4uXG4gICAgICAgIE9iamVjdC5mcmVlemUob3B0cyk7XG4gICAgfVxuICAgIF9hZGRJZ25vcmVkUGF0aChtYXRjaGVyKSB7XG4gICAgICAgIGlmIChpc01hdGNoZXJPYmplY3QobWF0Y2hlcikpIHtcbiAgICAgICAgICAgIC8vIHJldHVybiBlYXJseSBpZiB3ZSBhbHJlYWR5IGhhdmUgYSBkZWVwbHkgZXF1YWwgbWF0Y2hlciBvYmplY3RcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWdub3JlZCBvZiB0aGlzLl9pZ25vcmVkUGF0aHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNNYXRjaGVyT2JqZWN0KGlnbm9yZWQpICYmXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQucGF0aCA9PT0gbWF0Y2hlci5wYXRoICYmXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQucmVjdXJzaXZlID09PSBtYXRjaGVyLnJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocy5hZGQobWF0Y2hlcik7XG4gICAgfVxuICAgIF9yZW1vdmVJZ25vcmVkUGF0aChtYXRjaGVyKSB7XG4gICAgICAgIHRoaXMuX2lnbm9yZWRQYXRocy5kZWxldGUobWF0Y2hlcik7XG4gICAgICAgIC8vIG5vdyBmaW5kIGFueSBtYXRjaGVyIG9iamVjdHMgd2l0aCB0aGUgbWF0Y2hlciBhcyBwYXRoXG4gICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWdub3JlZCBvZiB0aGlzLl9pZ25vcmVkUGF0aHMpIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPICg0MzA4MWopOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQuXG4gICAgICAgICAgICAgICAgLy8gcHJvYmFibHkganVzdCBtYWtlIGEgYHRoaXMuX2lnbm9yZWREaXJlY3Rvcmllc2Agb3Igc29tZVxuICAgICAgICAgICAgICAgIC8vIHN1Y2ggdGhpbmcuXG4gICAgICAgICAgICAgICAgaWYgKGlzTWF0Y2hlck9iamVjdChpZ25vcmVkKSAmJiBpZ25vcmVkLnBhdGggPT09IG1hdGNoZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faWdub3JlZFBhdGhzLmRlbGV0ZShpZ25vcmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gUHVibGljIG1ldGhvZHNcbiAgICAvKipcbiAgICAgKiBBZGRzIHBhdGhzIHRvIGJlIHdhdGNoZWQgb24gYW4gZXhpc3RpbmcgRlNXYXRjaGVyIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSBwYXRoc18gZmlsZSBvciBmaWxlIGxpc3QuIE90aGVyIGFyZ3VtZW50cyBhcmUgdW51c2VkXG4gICAgICovXG4gICAgYWRkKHBhdGhzXywgX29yaWdBZGQsIF9pbnRlcm5hbCkge1xuICAgICAgICBjb25zdCB7IGN3ZCB9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgICB0aGlzLmNsb3NlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jbG9zZVByb21pc2UgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBwYXRocyA9IHVuaWZ5UGF0aHMocGF0aHNfKTtcbiAgICAgICAgaWYgKGN3ZCkge1xuICAgICAgICAgICAgcGF0aHMgPSBwYXRocy5tYXAoKHBhdGgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhYnNQYXRoID0gZ2V0QWJzb2x1dGVQYXRoKHBhdGgsIGN3ZCk7XG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgYHBhdGhgIGluc3RlYWQgb2YgYGFic1BhdGhgIGJlY2F1c2UgdGhlIGN3ZCBwb3J0aW9uIGNhbid0IGJlIGEgZ2xvYlxuICAgICAgICAgICAgICAgIHJldHVybiBhYnNQYXRoO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlSWdub3JlZFBhdGgocGF0aCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeUNvdW50KVxuICAgICAgICAgICAgdGhpcy5fcmVhZHlDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuX3JlYWR5Q291bnQgKz0gcGF0aHMubGVuZ3RoO1xuICAgICAgICBQcm9taXNlLmFsbChwYXRocy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuX25vZGVGc0hhbmRsZXIuX2FkZFRvTm9kZUZzKHBhdGgsICFfaW50ZXJuYWwsIHVuZGVmaW5lZCwgMCwgX29yaWdBZGQpO1xuICAgICAgICAgICAgaWYgKHJlcylcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0UmVhZHkoKTtcbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0pKS50aGVuKChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkKHN5c1BhdGguZGlybmFtZShpdGVtKSwgc3lzUGF0aC5iYXNlbmFtZShfb3JpZ0FkZCB8fCBpdGVtKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZSB3YXRjaGVycyBvciBzdGFydCBpZ25vcmluZyBldmVudHMgZnJvbSBzcGVjaWZpZWQgcGF0aHMuXG4gICAgICovXG4gICAgdW53YXRjaChwYXRoc18pIHtcbiAgICAgICAgaWYgKHRoaXMuY2xvc2VkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gdW5pZnlQYXRocyhwYXRoc18pO1xuICAgICAgICBjb25zdCB7IGN3ZCB9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBwYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRvIGFic29sdXRlIHBhdGggdW5sZXNzIHJlbGF0aXZlIHBhdGggYWxyZWFkeSBtYXRjaGVzXG4gICAgICAgICAgICBpZiAoIXN5c1BhdGguaXNBYnNvbHV0ZShwYXRoKSAmJiAhdGhpcy5fY2xvc2Vycy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoY3dkKVxuICAgICAgICAgICAgICAgICAgICBwYXRoID0gc3lzUGF0aC5qb2luKGN3ZCwgcGF0aCk7XG4gICAgICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGgucmVzb2x2ZShwYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2Nsb3NlUGF0aChwYXRoKTtcbiAgICAgICAgICAgIHRoaXMuX2FkZElnbm9yZWRQYXRoKHBhdGgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3dhdGNoZWQuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkSWdub3JlZFBhdGgoe1xuICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICByZWN1cnNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZXNldCB0aGUgY2FjaGVkIHVzZXJJZ25vcmVkIGFueW1hdGNoIGZuXG4gICAgICAgICAgICAvLyB0byBtYWtlIGlnbm9yZWRQYXRocyBjaGFuZ2VzIGVmZmVjdGl2ZVxuICAgICAgICAgICAgdGhpcy5fdXNlcklnbm9yZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xvc2Ugd2F0Y2hlcnMgYW5kIHJlbW92ZSBhbGwgbGlzdGVuZXJzIGZyb20gd2F0Y2hlZCBwYXRocy5cbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nsb3NlUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2Nsb3NlUHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgICAgIC8vIE1lbW9yeSBtYW5hZ2VtZW50LlxuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgICBjb25zdCBjbG9zZXJzID0gW107XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuZm9yRWFjaCgoY2xvc2VyTGlzdCkgPT4gY2xvc2VyTGlzdC5mb3JFYWNoKChjbG9zZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb21pc2UgPSBjbG9zZXIoKTtcbiAgICAgICAgICAgIGlmIChwcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSlcbiAgICAgICAgICAgICAgICBjbG9zZXJzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgdGhpcy5fc3RyZWFtcy5mb3JFYWNoKChzdHJlYW0pID0+IHN0cmVhbS5kZXN0cm95KCkpO1xuICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fcmVhZHlDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuX3JlYWR5RW1pdHRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl93YXRjaGVkLmZvckVhY2goKGRpcmVudCkgPT4gZGlyZW50LmRpc3Bvc2UoKSk7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fd2F0Y2hlZC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zLmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX3N5bWxpbmtQYXRocy5jbGVhcigpO1xuICAgICAgICB0aGlzLl90aHJvdHRsZWQuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fY2xvc2VQcm9taXNlID0gY2xvc2Vycy5sZW5ndGhcbiAgICAgICAgICAgID8gUHJvbWlzZS5hbGwoY2xvc2VycykudGhlbigoKSA9PiB1bmRlZmluZWQpXG4gICAgICAgICAgICA6IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xvc2VQcm9taXNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBFeHBvc2UgbGlzdCBvZiB3YXRjaGVkIHBhdGhzXG4gICAgICogQHJldHVybnMgZm9yIGNoYWluaW5nXG4gICAgICovXG4gICAgZ2V0V2F0Y2hlZCgpIHtcbiAgICAgICAgY29uc3Qgd2F0Y2hMaXN0ID0ge307XG4gICAgICAgIHRoaXMuX3dhdGNoZWQuZm9yRWFjaCgoZW50cnksIGRpcikgPT4ge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5vcHRpb25zLmN3ZCA/IHN5c1BhdGgucmVsYXRpdmUodGhpcy5vcHRpb25zLmN3ZCwgZGlyKSA6IGRpcjtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0ga2V5IHx8IE9ORV9ET1Q7XG4gICAgICAgICAgICB3YXRjaExpc3RbaW5kZXhdID0gZW50cnkuZ2V0Q2hpbGRyZW4oKS5zb3J0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gd2F0Y2hMaXN0O1xuICAgIH1cbiAgICBlbWl0V2l0aEFsbChldmVudCwgYXJncykge1xuICAgICAgICB0aGlzLmVtaXQoZXZlbnQsIC4uLmFyZ3MpO1xuICAgICAgICBpZiAoZXZlbnQgIT09IEVWLkVSUk9SKVxuICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkFMTCwgZXZlbnQsIC4uLmFyZ3MpO1xuICAgIH1cbiAgICAvLyBDb21tb24gaGVscGVyc1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tXG4gICAgLyoqXG4gICAgICogTm9ybWFsaXplIGFuZCBlbWl0IGV2ZW50cy5cbiAgICAgKiBDYWxsaW5nIF9lbWl0IERPRVMgTk9UIE1FQU4gZW1pdCgpIHdvdWxkIGJlIGNhbGxlZCFcbiAgICAgKiBAcGFyYW0gZXZlbnQgVHlwZSBvZiBldmVudFxuICAgICAqIEBwYXJhbSBwYXRoIEZpbGUgb3IgZGlyZWN0b3J5IHBhdGhcbiAgICAgKiBAcGFyYW0gc3RhdHMgYXJndW1lbnRzIHRvIGJlIHBhc3NlZCB3aXRoIGV2ZW50XG4gICAgICogQHJldHVybnMgdGhlIGVycm9yIGlmIGRlZmluZWQsIG90aGVyd2lzZSB0aGUgdmFsdWUgb2YgdGhlIEZTV2F0Y2hlciBpbnN0YW5jZSdzIGBjbG9zZWRgIGZsYWdcbiAgICAgKi9cbiAgICBhc3luYyBfZW1pdChldmVudCwgcGF0aCwgc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2xvc2VkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBvcHRzID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBpZiAoaXNXaW5kb3dzKVxuICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGgubm9ybWFsaXplKHBhdGgpO1xuICAgICAgICBpZiAob3B0cy5jd2QpXG4gICAgICAgICAgICBwYXRoID0gc3lzUGF0aC5yZWxhdGl2ZShvcHRzLmN3ZCwgcGF0aCk7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBbcGF0aF07XG4gICAgICAgIGlmIChzdGF0cyAhPSBudWxsKVxuICAgICAgICAgICAgYXJncy5wdXNoKHN0YXRzKTtcbiAgICAgICAgY29uc3QgYXdmID0gb3B0cy5hd2FpdFdyaXRlRmluaXNoO1xuICAgICAgICBsZXQgcHc7XG4gICAgICAgIGlmIChhd2YgJiYgKHB3ID0gdGhpcy5fcGVuZGluZ1dyaXRlcy5nZXQocGF0aCkpKSB7XG4gICAgICAgICAgICBwdy5sYXN0Q2hhbmdlID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRzLmF0b21pYykge1xuICAgICAgICAgICAgaWYgKGV2ZW50ID09PSBFVi5VTkxJTkspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wZW5kaW5nVW5saW5rcy5zZXQocGF0aCwgW2V2ZW50LCAuLi5hcmdzXSk7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3BlbmRpbmdVbmxpbmtzLmZvckVhY2goKGVudHJ5LCBwYXRoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoLi4uZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkFMTCwgLi4uZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcGVuZGluZ1VubGlua3MuZGVsZXRlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LCB0eXBlb2Ygb3B0cy5hdG9taWMgPT09ICdudW1iZXInID8gb3B0cy5hdG9taWMgOiAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGV2ZW50ID09PSBFVi5BREQgJiYgdGhpcy5fcGVuZGluZ1VubGlua3MuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQgPSBFVi5DSEFOR0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGVuZGluZ1VubGlua3MuZGVsZXRlKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChhd2YgJiYgKGV2ZW50ID09PSBFVi5BREQgfHwgZXZlbnQgPT09IEVWLkNIQU5HRSkgJiYgdGhpcy5fcmVhZHlFbWl0dGVkKSB7XG4gICAgICAgICAgICBjb25zdCBhd2ZFbWl0ID0gKGVyciwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gRVYuRVJST1I7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3NbMF0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFdpdGhBbGwoZXZlbnQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBzdGF0cyBkb2Vzbid0IGV4aXN0IHRoZSBmaWxlIG11c3QgaGF2ZSBiZWVuIGRlbGV0ZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJnc1sxXSA9IHN0YXRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKHN0YXRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRXaXRoQWxsKGV2ZW50LCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5fYXdhaXRXcml0ZUZpbmlzaChwYXRoLCBhd2Yuc3RhYmlsaXR5VGhyZXNob2xkLCBldmVudCwgYXdmRW1pdCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQgPT09IEVWLkNIQU5HRSkge1xuICAgICAgICAgICAgY29uc3QgaXNUaHJvdHRsZWQgPSAhdGhpcy5fdGhyb3R0bGUoRVYuQ0hBTkdFLCBwYXRoLCA1MCk7XG4gICAgICAgICAgICBpZiAoaXNUaHJvdHRsZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMuYWx3YXlzU3RhdCAmJlxuICAgICAgICAgICAgc3RhdHMgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgKGV2ZW50ID09PSBFVi5BREQgfHwgZXZlbnQgPT09IEVWLkFERF9ESVIgfHwgZXZlbnQgPT09IEVWLkNIQU5HRSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gb3B0cy5jd2QgPyBzeXNQYXRoLmpvaW4ob3B0cy5jd2QsIHBhdGgpIDogcGF0aDtcbiAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBzdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTdXBwcmVzcyBldmVudCB3aGVuIGZzX3N0YXQgZmFpbHMsIHRvIGF2b2lkIHNlbmRpbmcgdW5kZWZpbmVkICdzdGF0J1xuICAgICAgICAgICAgaWYgKCFzdGF0cyB8fCB0aGlzLmNsb3NlZClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBhcmdzLnB1c2goc3RhdHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW1pdFdpdGhBbGwoZXZlbnQsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29tbW9uIGhhbmRsZXIgZm9yIGVycm9yc1xuICAgICAqIEByZXR1cm5zIFRoZSBlcnJvciBpZiBkZWZpbmVkLCBvdGhlcndpc2UgdGhlIHZhbHVlIG9mIHRoZSBGU1dhdGNoZXIgaW5zdGFuY2UncyBgY2xvc2VkYCBmbGFnXG4gICAgICovXG4gICAgX2hhbmRsZUVycm9yKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBlcnJvciAmJiBlcnJvci5jb2RlO1xuICAgICAgICBpZiAoZXJyb3IgJiZcbiAgICAgICAgICAgIGNvZGUgIT09ICdFTk9FTlQnICYmXG4gICAgICAgICAgICBjb2RlICE9PSAnRU5PVERJUicgJiZcbiAgICAgICAgICAgICghdGhpcy5vcHRpb25zLmlnbm9yZVBlcm1pc3Npb25FcnJvcnMgfHwgKGNvZGUgIT09ICdFUEVSTScgJiYgY29kZSAhPT0gJ0VBQ0NFUycpKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KEVWLkVSUk9SLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVycm9yIHx8IHRoaXMuY2xvc2VkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgdXRpbGl0eSBmb3IgdGhyb3R0bGluZ1xuICAgICAqIEBwYXJhbSBhY3Rpb25UeXBlIHR5cGUgYmVpbmcgdGhyb3R0bGVkXG4gICAgICogQHBhcmFtIHBhdGggYmVpbmcgYWN0ZWQgdXBvblxuICAgICAqIEBwYXJhbSB0aW1lb3V0IGR1cmF0aW9uIG9mIHRpbWUgdG8gc3VwcHJlc3MgZHVwbGljYXRlIGFjdGlvbnNcbiAgICAgKiBAcmV0dXJucyB0cmFja2luZyBvYmplY3Qgb3IgZmFsc2UgaWYgYWN0aW9uIHNob3VsZCBiZSBzdXBwcmVzc2VkXG4gICAgICovXG4gICAgX3Rocm90dGxlKGFjdGlvblR5cGUsIHBhdGgsIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl90aHJvdHRsZWQuaGFzKGFjdGlvblR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl90aHJvdHRsZWQuc2V0KGFjdGlvblR5cGUsIG5ldyBNYXAoKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5fdGhyb3R0bGVkLmdldChhY3Rpb25UeXBlKTtcbiAgICAgICAgaWYgKCFhY3Rpb24pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgdGhyb3R0bGUnKTtcbiAgICAgICAgY29uc3QgYWN0aW9uUGF0aCA9IGFjdGlvbi5nZXQocGF0aCk7XG4gICAgICAgIGlmIChhY3Rpb25QYXRoKSB7XG4gICAgICAgICAgICBhY3Rpb25QYXRoLmNvdW50Kys7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByZWZlci1jb25zdFxuICAgICAgICBsZXQgdGltZW91dE9iamVjdDtcbiAgICAgICAgY29uc3QgY2xlYXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gYWN0aW9uLmdldChwYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gaXRlbSA/IGl0ZW0uY291bnQgOiAwO1xuICAgICAgICAgICAgYWN0aW9uLmRlbGV0ZShwYXRoKTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0T2JqZWN0KTtcbiAgICAgICAgICAgIGlmIChpdGVtKVxuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChpdGVtLnRpbWVvdXRPYmplY3QpO1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgICAgICB9O1xuICAgICAgICB0aW1lb3V0T2JqZWN0ID0gc2V0VGltZW91dChjbGVhciwgdGltZW91dCk7XG4gICAgICAgIGNvbnN0IHRociA9IHsgdGltZW91dE9iamVjdCwgY2xlYXIsIGNvdW50OiAwIH07XG4gICAgICAgIGFjdGlvbi5zZXQocGF0aCwgdGhyKTtcbiAgICAgICAgcmV0dXJuIHRocjtcbiAgICB9XG4gICAgX2luY3JSZWFkeUNvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVhZHlDb3VudCsrO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBd2FpdHMgd3JpdGUgb3BlcmF0aW9uIHRvIGZpbmlzaC5cbiAgICAgKiBQb2xscyBhIG5ld2x5IGNyZWF0ZWQgZmlsZSBmb3Igc2l6ZSB2YXJpYXRpb25zLiBXaGVuIGZpbGVzIHNpemUgZG9lcyBub3QgY2hhbmdlIGZvciAndGhyZXNob2xkJyBtaWxsaXNlY29uZHMgY2FsbHMgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHBhdGggYmVpbmcgYWN0ZWQgdXBvblxuICAgICAqIEBwYXJhbSB0aHJlc2hvbGQgVGltZSBpbiBtaWxsaXNlY29uZHMgYSBmaWxlIHNpemUgbXVzdCBiZSBmaXhlZCBiZWZvcmUgYWNrbm93bGVkZ2luZyB3cml0ZSBPUCBpcyBmaW5pc2hlZFxuICAgICAqIEBwYXJhbSBldmVudFxuICAgICAqIEBwYXJhbSBhd2ZFbWl0IENhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIHJlYWR5IGZvciBldmVudCB0byBiZSBlbWl0dGVkLlxuICAgICAqL1xuICAgIF9hd2FpdFdyaXRlRmluaXNoKHBhdGgsIHRocmVzaG9sZCwgZXZlbnQsIGF3ZkVtaXQpIHtcbiAgICAgICAgY29uc3QgYXdmID0gdGhpcy5vcHRpb25zLmF3YWl0V3JpdGVGaW5pc2g7XG4gICAgICAgIGlmICh0eXBlb2YgYXdmICE9PSAnb2JqZWN0JylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgcG9sbEludGVydmFsID0gYXdmLnBvbGxJbnRlcnZhbDtcbiAgICAgICAgbGV0IHRpbWVvdXRIYW5kbGVyO1xuICAgICAgICBsZXQgZnVsbFBhdGggPSBwYXRoO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmN3ZCAmJiAhc3lzUGF0aC5pc0Fic29sdXRlKHBhdGgpKSB7XG4gICAgICAgICAgICBmdWxsUGF0aCA9IHN5c1BhdGguam9pbih0aGlzLm9wdGlvbnMuY3dkLCBwYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBjb25zdCB3cml0ZXMgPSB0aGlzLl9wZW5kaW5nV3JpdGVzO1xuICAgICAgICBmdW5jdGlvbiBhd2FpdFdyaXRlRmluaXNoRm4ocHJldlN0YXQpIHtcbiAgICAgICAgICAgIHN0YXRjYihmdWxsUGF0aCwgKGVyciwgY3VyU3RhdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIgfHwgIXdyaXRlcy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyciAmJiBlcnIuY29kZSAhPT0gJ0VOT0VOVCcpXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2ZFbWl0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgbm93ID0gTnVtYmVyKG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgICAgIGlmIChwcmV2U3RhdCAmJiBjdXJTdGF0LnNpemUgIT09IHByZXZTdGF0LnNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVzLmdldChwYXRoKS5sYXN0Q2hhbmdlID0gbm93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwdyA9IHdyaXRlcy5nZXQocGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGYgPSBub3cgLSBwdy5sYXN0Q2hhbmdlO1xuICAgICAgICAgICAgICAgIGlmIChkZiA+PSB0aHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVzLmRlbGV0ZShwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdmRW1pdCh1bmRlZmluZWQsIGN1clN0YXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dEhhbmRsZXIgPSBzZXRUaW1lb3V0KGF3YWl0V3JpdGVGaW5pc2hGbiwgcG9sbEludGVydmFsLCBjdXJTdGF0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXdyaXRlcy5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgIHdyaXRlcy5zZXQocGF0aCwge1xuICAgICAgICAgICAgICAgIGxhc3RDaGFuZ2U6IG5vdyxcbiAgICAgICAgICAgICAgICBjYW5jZWxXYWl0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlcy5kZWxldGUocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBldmVudDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aW1lb3V0SGFuZGxlciA9IHNldFRpbWVvdXQoYXdhaXRXcml0ZUZpbmlzaEZuLCBwb2xsSW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgd2hldGhlciB1c2VyIGhhcyBhc2tlZCB0byBpZ25vcmUgdGhpcyBwYXRoLlxuICAgICAqL1xuICAgIF9pc0lnbm9yZWQocGF0aCwgc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdG9taWMgJiYgRE9UX1JFLnRlc3QocGF0aCkpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKCF0aGlzLl91c2VySWdub3JlZCkge1xuICAgICAgICAgICAgY29uc3QgeyBjd2QgfSA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgICAgIGNvbnN0IGlnbiA9IHRoaXMub3B0aW9ucy5pZ25vcmVkO1xuICAgICAgICAgICAgY29uc3QgaWdub3JlZCA9IChpZ24gfHwgW10pLm1hcChub3JtYWxpemVJZ25vcmVkKGN3ZCkpO1xuICAgICAgICAgICAgY29uc3QgaWdub3JlZFBhdGhzID0gWy4uLnRoaXMuX2lnbm9yZWRQYXRoc107XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gWy4uLmlnbm9yZWRQYXRocy5tYXAobm9ybWFsaXplSWdub3JlZChjd2QpKSwgLi4uaWdub3JlZF07XG4gICAgICAgICAgICB0aGlzLl91c2VySWdub3JlZCA9IGFueW1hdGNoKGxpc3QsIHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZXJJZ25vcmVkKHBhdGgsIHN0YXRzKTtcbiAgICB9XG4gICAgX2lzbnRJZ25vcmVkKHBhdGgsIHN0YXQpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLl9pc0lnbm9yZWQocGF0aCwgc3RhdCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGEgc2V0IG9mIGNvbW1vbiBoZWxwZXJzIGFuZCBwcm9wZXJ0aWVzIHJlbGF0aW5nIHRvIHN5bWxpbmsgaGFuZGxpbmcuXG4gICAgICogQHBhcmFtIHBhdGggZmlsZSBvciBkaXJlY3RvcnkgcGF0dGVybiBiZWluZyB3YXRjaGVkXG4gICAgICovXG4gICAgX2dldFdhdGNoSGVscGVycyhwYXRoKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2F0Y2hIZWxwZXIocGF0aCwgdGhpcy5vcHRpb25zLmZvbGxvd1N5bWxpbmtzLCB0aGlzKTtcbiAgICB9XG4gICAgLy8gRGlyZWN0b3J5IGhlbHBlcnNcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGRpcmVjdG9yeSB0cmFja2luZyBvYmplY3RzXG4gICAgICogQHBhcmFtIGRpcmVjdG9yeSBwYXRoIG9mIHRoZSBkaXJlY3RvcnlcbiAgICAgKi9cbiAgICBfZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGlyID0gc3lzUGF0aC5yZXNvbHZlKGRpcmVjdG9yeSk7XG4gICAgICAgIGlmICghdGhpcy5fd2F0Y2hlZC5oYXMoZGlyKSlcbiAgICAgICAgICAgIHRoaXMuX3dhdGNoZWQuc2V0KGRpciwgbmV3IERpckVudHJ5KGRpciwgdGhpcy5fYm91bmRSZW1vdmUpKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dhdGNoZWQuZ2V0KGRpcik7XG4gICAgfVxuICAgIC8vIEZpbGUgaGVscGVyc1xuICAgIC8vIC0tLS0tLS0tLS0tLVxuICAgIC8qKlxuICAgICAqIENoZWNrIGZvciByZWFkIHBlcm1pc3Npb25zOiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTE3ODE0MDQvMTM1ODQwNVxuICAgICAqL1xuICAgIF9oYXNSZWFkUGVybWlzc2lvbnMoc3RhdHMpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5pZ25vcmVQZXJtaXNzaW9uRXJyb3JzKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiBCb29sZWFuKE51bWJlcihzdGF0cy5tb2RlKSAmIDBvNDAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSGFuZGxlcyBlbWl0dGluZyB1bmxpbmsgZXZlbnRzIGZvclxuICAgICAqIGZpbGVzIGFuZCBkaXJlY3RvcmllcywgYW5kIHZpYSByZWN1cnNpb24sIGZvclxuICAgICAqIGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aXRoaW4gZGlyZWN0b3JpZXMgdGhhdCBhcmUgdW5saW5rZWRcbiAgICAgKiBAcGFyYW0gZGlyZWN0b3J5IHdpdGhpbiB3aGljaCB0aGUgZm9sbG93aW5nIGl0ZW0gaXMgbG9jYXRlZFxuICAgICAqIEBwYXJhbSBpdGVtICAgICAgYmFzZSBwYXRoIG9mIGl0ZW0vZGlyZWN0b3J5XG4gICAgICovXG4gICAgX3JlbW92ZShkaXJlY3RvcnksIGl0ZW0sIGlzRGlyZWN0b3J5KSB7XG4gICAgICAgIC8vIGlmIHdoYXQgaXMgYmVpbmcgZGVsZXRlZCBpcyBhIGRpcmVjdG9yeSwgZ2V0IHRoYXQgZGlyZWN0b3J5J3MgcGF0aHNcbiAgICAgICAgLy8gZm9yIHJlY3Vyc2l2ZSBkZWxldGluZyBhbmQgY2xlYW5pbmcgb2Ygd2F0Y2hlZCBvYmplY3RcbiAgICAgICAgLy8gaWYgaXQgaXMgbm90IGEgZGlyZWN0b3J5LCBuZXN0ZWREaXJlY3RvcnlDaGlsZHJlbiB3aWxsIGJlIGVtcHR5IGFycmF5XG4gICAgICAgIGNvbnN0IHBhdGggPSBzeXNQYXRoLmpvaW4oZGlyZWN0b3J5LCBpdGVtKTtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBzeXNQYXRoLnJlc29sdmUocGF0aCk7XG4gICAgICAgIGlzRGlyZWN0b3J5ID1cbiAgICAgICAgICAgIGlzRGlyZWN0b3J5ICE9IG51bGwgPyBpc0RpcmVjdG9yeSA6IHRoaXMuX3dhdGNoZWQuaGFzKHBhdGgpIHx8IHRoaXMuX3dhdGNoZWQuaGFzKGZ1bGxQYXRoKTtcbiAgICAgICAgLy8gcHJldmVudCBkdXBsaWNhdGUgaGFuZGxpbmcgaW4gY2FzZSBvZiBhcnJpdmluZyBoZXJlIG5lYXJseSBzaW11bHRhbmVvdXNseVxuICAgICAgICAvLyB2aWEgbXVsdGlwbGUgcGF0aHMgKHN1Y2ggYXMgX2hhbmRsZUZpbGUgYW5kIF9oYW5kbGVEaXIpXG4gICAgICAgIGlmICghdGhpcy5fdGhyb3R0bGUoJ3JlbW92ZScsIHBhdGgsIDEwMCkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIC8vIGlmIHRoZSBvbmx5IHdhdGNoZWQgZmlsZSBpcyByZW1vdmVkLCB3YXRjaCBmb3IgaXRzIHJldHVyblxuICAgICAgICBpZiAoIWlzRGlyZWN0b3J5ICYmIHRoaXMuX3dhdGNoZWQuc2l6ZSA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5hZGQoZGlyZWN0b3J5LCBpdGVtLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIHdpbGwgY3JlYXRlIGEgbmV3IGVudHJ5IGluIHRoZSB3YXRjaGVkIG9iamVjdCBpbiBlaXRoZXIgY2FzZVxuICAgICAgICAvLyBzbyB3ZSBnb3QgdG8gZG8gdGhlIGRpcmVjdG9yeSBjaGVjayBiZWZvcmVoYW5kXG4gICAgICAgIGNvbnN0IHdwID0gdGhpcy5fZ2V0V2F0Y2hlZERpcihwYXRoKTtcbiAgICAgICAgY29uc3QgbmVzdGVkRGlyZWN0b3J5Q2hpbGRyZW4gPSB3cC5nZXRDaGlsZHJlbigpO1xuICAgICAgICAvLyBSZWN1cnNpdmVseSByZW1vdmUgY2hpbGRyZW4gZGlyZWN0b3JpZXMgLyBmaWxlcy5cbiAgICAgICAgbmVzdGVkRGlyZWN0b3J5Q2hpbGRyZW4uZm9yRWFjaCgobmVzdGVkKSA9PiB0aGlzLl9yZW1vdmUocGF0aCwgbmVzdGVkKSk7XG4gICAgICAgIC8vIENoZWNrIGlmIGl0ZW0gd2FzIG9uIHRoZSB3YXRjaGVkIGxpc3QgYW5kIHJlbW92ZSBpdFxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRXYXRjaGVkRGlyKGRpcmVjdG9yeSk7XG4gICAgICAgIGNvbnN0IHdhc1RyYWNrZWQgPSBwYXJlbnQuaGFzKGl0ZW0pO1xuICAgICAgICBwYXJlbnQucmVtb3ZlKGl0ZW0pO1xuICAgICAgICAvLyBGaXhlcyBpc3N1ZSAjMTA0MiAtPiBSZWxhdGl2ZSBwYXRocyB3ZXJlIGRldGVjdGVkIGFuZCBhZGRlZCBhcyBzeW1saW5rc1xuICAgICAgICAvLyAoaHR0cHM6Ly9naXRodWIuY29tL3BhdWxtaWxsci9jaG9raWRhci9ibG9iL2UxNzUzZGRiYzk1NzFiZGMzM2I0YTRhZjE3MmQ1MmNiNmU2MTFjMTAvbGliL25vZGVmcy1oYW5kbGVyLmpzI0w2MTIpLFxuICAgICAgICAvLyBidXQgbmV2ZXIgcmVtb3ZlZCBmcm9tIHRoZSBtYXAgaW4gY2FzZSB0aGUgcGF0aCB3YXMgZGVsZXRlZC5cbiAgICAgICAgLy8gVGhpcyBsZWFkcyB0byBhbiBpbmNvcnJlY3Qgc3RhdGUgaWYgdGhlIHBhdGggd2FzIHJlY3JlYXRlZDpcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BhdWxtaWxsci9jaG9raWRhci9ibG9iL2UxNzUzZGRiYzk1NzFiZGMzM2I0YTRhZjE3MmQ1MmNiNmU2MTFjMTAvbGliL25vZGVmcy1oYW5kbGVyLmpzI0w1NTNcbiAgICAgICAgaWYgKHRoaXMuX3N5bWxpbmtQYXRocy5oYXMoZnVsbFBhdGgpKSB7XG4gICAgICAgICAgICB0aGlzLl9zeW1saW5rUGF0aHMuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB3ZSB3YWl0IGZvciB0aGlzIGZpbGUgdG8gYmUgZnVsbHkgd3JpdHRlbiwgY2FuY2VsIHRoZSB3YWl0LlxuICAgICAgICBsZXQgcmVsUGF0aCA9IHBhdGg7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY3dkKVxuICAgICAgICAgICAgcmVsUGF0aCA9IHN5c1BhdGgucmVsYXRpdmUodGhpcy5vcHRpb25zLmN3ZCwgcGF0aCk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXdhaXRXcml0ZUZpbmlzaCAmJiB0aGlzLl9wZW5kaW5nV3JpdGVzLmhhcyhyZWxQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLl9wZW5kaW5nV3JpdGVzLmdldChyZWxQYXRoKS5jYW5jZWxXYWl0KCk7XG4gICAgICAgICAgICBpZiAoZXZlbnQgPT09IEVWLkFERClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIEVudHJ5IHdpbGwgZWl0aGVyIGJlIGEgZGlyZWN0b3J5IHRoYXQganVzdCBnb3QgcmVtb3ZlZFxuICAgICAgICAvLyBvciBhIGJvZ3VzIGVudHJ5IHRvIGEgZmlsZSwgaW4gZWl0aGVyIGNhc2Ugd2UgaGF2ZSB0byByZW1vdmUgaXRcbiAgICAgICAgdGhpcy5fd2F0Y2hlZC5kZWxldGUocGF0aCk7XG4gICAgICAgIHRoaXMuX3dhdGNoZWQuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgY29uc3QgZXZlbnROYW1lID0gaXNEaXJlY3RvcnkgPyBFVi5VTkxJTktfRElSIDogRVYuVU5MSU5LO1xuICAgICAgICBpZiAod2FzVHJhY2tlZCAmJiAhdGhpcy5faXNJZ25vcmVkKHBhdGgpKVxuICAgICAgICAgICAgdGhpcy5fZW1pdChldmVudE5hbWUsIHBhdGgpO1xuICAgICAgICAvLyBBdm9pZCBjb25mbGljdHMgaWYgd2UgbGF0ZXIgY3JlYXRlIGFub3RoZXIgZmlsZSB3aXRoIHRoZSBzYW1lIG5hbWVcbiAgICAgICAgdGhpcy5fY2xvc2VQYXRoKHBhdGgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgYWxsIHdhdGNoZXJzIGZvciBhIHBhdGhcbiAgICAgKi9cbiAgICBfY2xvc2VQYXRoKHBhdGgpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VGaWxlKHBhdGgpO1xuICAgICAgICBjb25zdCBkaXIgPSBzeXNQYXRoLmRpcm5hbWUocGF0aCk7XG4gICAgICAgIHRoaXMuX2dldFdhdGNoZWREaXIoZGlyKS5yZW1vdmUoc3lzUGF0aC5iYXNlbmFtZShwYXRoKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENsb3NlcyBvbmx5IGZpbGUtc3BlY2lmaWMgd2F0Y2hlcnNcbiAgICAgKi9cbiAgICBfY2xvc2VGaWxlKHBhdGgpIHtcbiAgICAgICAgY29uc3QgY2xvc2VycyA9IHRoaXMuX2Nsb3NlcnMuZ2V0KHBhdGgpO1xuICAgICAgICBpZiAoIWNsb3NlcnMpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNsb3NlcnMuZm9yRWFjaCgoY2xvc2VyKSA9PiBjbG9zZXIoKSk7XG4gICAgICAgIHRoaXMuX2Nsb3NlcnMuZGVsZXRlKHBhdGgpO1xuICAgIH1cbiAgICBfYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpIHtcbiAgICAgICAgaWYgKCFjbG9zZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBsaXN0ID0gdGhpcy5fY2xvc2Vycy5nZXQocGF0aCk7XG4gICAgICAgIGlmICghbGlzdCkge1xuICAgICAgICAgICAgbGlzdCA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fY2xvc2Vycy5zZXQocGF0aCwgbGlzdCk7XG4gICAgICAgIH1cbiAgICAgICAgbGlzdC5wdXNoKGNsb3Nlcik7XG4gICAgfVxuICAgIF9yZWFkZGlycChyb290LCBvcHRzKSB7XG4gICAgICAgIGlmICh0aGlzLmNsb3NlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgdHlwZTogRVYuQUxMLCBhbHdheXNTdGF0OiB0cnVlLCBsc3RhdDogdHJ1ZSwgLi4ub3B0cywgZGVwdGg6IDAgfTtcbiAgICAgICAgbGV0IHN0cmVhbSA9IHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9zdHJlYW1zLmFkZChzdHJlYW0pO1xuICAgICAgICBzdHJlYW0ub25jZShTVFJfQ0xPU0UsICgpID0+IHtcbiAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgICAgIHN0cmVhbS5vbmNlKFNUUl9FTkQsICgpID0+IHtcbiAgICAgICAgICAgIGlmIChzdHJlYW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdHJlYW1zLmRlbGV0ZShzdHJlYW0pO1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBzdHJlYW07XG4gICAgfVxufVxuLyoqXG4gKiBJbnN0YW50aWF0ZXMgd2F0Y2hlciB3aXRoIHBhdGhzIHRvIGJlIHRyYWNrZWQuXG4gKiBAcGFyYW0gcGF0aHMgZmlsZSAvIGRpcmVjdG9yeSBwYXRoc1xuICogQHBhcmFtIG9wdGlvbnMgb3B0cywgc3VjaCBhcyBgYXRvbWljYCwgYGF3YWl0V3JpdGVGaW5pc2hgLCBgaWdub3JlZGAsIGFuZCBvdGhlcnNcbiAqIEByZXR1cm5zIGFuIGluc3RhbmNlIG9mIEZTV2F0Y2hlciBmb3IgY2hhaW5pbmcuXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgd2F0Y2hlciA9IHdhdGNoKCcuJykub24oJ2FsbCcsIChldmVudCwgcGF0aCkgPT4geyBjb25zb2xlLmxvZyhldmVudCwgcGF0aCk7IH0pO1xuICogd2F0Y2goJy4nLCB7IGF0b21pYzogdHJ1ZSwgYXdhaXRXcml0ZUZpbmlzaDogdHJ1ZSwgaWdub3JlZDogKGYsIHN0YXRzKSA9PiBzdGF0cz8uaXNGaWxlKCkgJiYgIWYuZW5kc1dpdGgoJy5qcycpIH0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaChwYXRocywgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIob3B0aW9ucyk7XG4gICAgd2F0Y2hlci5hZGQocGF0aHMpO1xuICAgIHJldHVybiB3YXRjaGVyO1xufVxuZXhwb3J0IGRlZmF1bHQgeyB3YXRjaCwgRlNXYXRjaGVyIH07XG4iLCAiaW1wb3J0IHsgc3RhdCwgbHN0YXQsIHJlYWRkaXIsIHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gJ25vZGU6c3RyZWFtJztcbmltcG9ydCB7IHJlc29sdmUgYXMgcHJlc29sdmUsIHJlbGF0aXZlIGFzIHByZWxhdGl2ZSwgam9pbiBhcyBwam9pbiwgc2VwIGFzIHBzZXAgfSBmcm9tICdub2RlOnBhdGgnO1xuZXhwb3J0IGNvbnN0IEVudHJ5VHlwZXMgPSB7XG4gICAgRklMRV9UWVBFOiAnZmlsZXMnLFxuICAgIERJUl9UWVBFOiAnZGlyZWN0b3JpZXMnLFxuICAgIEZJTEVfRElSX1RZUEU6ICdmaWxlc19kaXJlY3RvcmllcycsXG4gICAgRVZFUllUSElOR19UWVBFOiAnYWxsJyxcbn07XG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICByb290OiAnLicsXG4gICAgZmlsZUZpbHRlcjogKF9lbnRyeUluZm8pID0+IHRydWUsXG4gICAgZGlyZWN0b3J5RmlsdGVyOiAoX2VudHJ5SW5mbykgPT4gdHJ1ZSxcbiAgICB0eXBlOiBFbnRyeVR5cGVzLkZJTEVfVFlQRSxcbiAgICBsc3RhdDogZmFsc2UsXG4gICAgZGVwdGg6IDIxNDc0ODM2NDgsXG4gICAgYWx3YXlzU3RhdDogZmFsc2UsXG4gICAgaGlnaFdhdGVyTWFyazogNDA5Nixcbn07XG5PYmplY3QuZnJlZXplKGRlZmF1bHRPcHRpb25zKTtcbmNvbnN0IFJFQ1VSU0lWRV9FUlJPUl9DT0RFID0gJ1JFQURESVJQX1JFQ1VSU0lWRV9FUlJPUic7XG5jb25zdCBOT1JNQUxfRkxPV19FUlJPUlMgPSBuZXcgU2V0KFsnRU5PRU5UJywgJ0VQRVJNJywgJ0VBQ0NFUycsICdFTE9PUCcsIFJFQ1VSU0lWRV9FUlJPUl9DT0RFXSk7XG5jb25zdCBBTExfVFlQRVMgPSBbXG4gICAgRW50cnlUeXBlcy5ESVJfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG4gICAgRW50cnlUeXBlcy5GSUxFX1RZUEUsXG5dO1xuY29uc3QgRElSX1RZUEVTID0gbmV3IFNldChbXG4gICAgRW50cnlUeXBlcy5ESVJfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG5dKTtcbmNvbnN0IEZJTEVfVFlQRVMgPSBuZXcgU2V0KFtcbiAgICBFbnRyeVR5cGVzLkVWRVJZVEhJTkdfVFlQRSxcbiAgICBFbnRyeVR5cGVzLkZJTEVfRElSX1RZUEUsXG4gICAgRW50cnlUeXBlcy5GSUxFX1RZUEUsXG5dKTtcbmNvbnN0IGlzTm9ybWFsRmxvd0Vycm9yID0gKGVycm9yKSA9PiBOT1JNQUxfRkxPV19FUlJPUlMuaGFzKGVycm9yLmNvZGUpO1xuY29uc3Qgd2FudEJpZ2ludEZzU3RhdHMgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xuY29uc3QgZW1wdHlGbiA9IChfZW50cnlJbmZvKSA9PiB0cnVlO1xuY29uc3Qgbm9ybWFsaXplRmlsdGVyID0gKGZpbHRlcikgPT4ge1xuICAgIGlmIChmaWx0ZXIgPT09IHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuIGVtcHR5Rm47XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiBmaWx0ZXI7XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGZsID0gZmlsdGVyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIChlbnRyeSkgPT4gZW50cnkuYmFzZW5hbWUgPT09IGZsO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIGNvbnN0IHRySXRlbXMgPSBmaWx0ZXIubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSk7XG4gICAgICAgIHJldHVybiAoZW50cnkpID0+IHRySXRlbXMuc29tZSgoZikgPT4gZW50cnkuYmFzZW5hbWUgPT09IGYpO1xuICAgIH1cbiAgICByZXR1cm4gZW1wdHlGbjtcbn07XG4vKiogUmVhZGFibGUgcmVhZGRpciBzdHJlYW0sIGVtaXR0aW5nIG5ldyBmaWxlcyBhcyB0aGV5J3JlIGJlaW5nIGxpc3RlZC4gKi9cbmV4cG9ydCBjbGFzcyBSZWFkZGlycFN0cmVhbSBleHRlbmRzIFJlYWRhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoe1xuICAgICAgICAgICAgb2JqZWN0TW9kZTogdHJ1ZSxcbiAgICAgICAgICAgIGF1dG9EZXN0cm95OiB0cnVlLFxuICAgICAgICAgICAgaGlnaFdhdGVyTWFyazogb3B0aW9ucy5oaWdoV2F0ZXJNYXJrLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHsgLi4uZGVmYXVsdE9wdGlvbnMsIC4uLm9wdGlvbnMgfTtcbiAgICAgICAgY29uc3QgeyByb290LCB0eXBlIH0gPSBvcHRzO1xuICAgICAgICB0aGlzLl9maWxlRmlsdGVyID0gbm9ybWFsaXplRmlsdGVyKG9wdHMuZmlsZUZpbHRlcik7XG4gICAgICAgIHRoaXMuX2RpcmVjdG9yeUZpbHRlciA9IG5vcm1hbGl6ZUZpbHRlcihvcHRzLmRpcmVjdG9yeUZpbHRlcik7XG4gICAgICAgIGNvbnN0IHN0YXRNZXRob2QgPSBvcHRzLmxzdGF0ID8gbHN0YXQgOiBzdGF0O1xuICAgICAgICAvLyBVc2UgYmlnaW50IHN0YXRzIGlmIGl0J3Mgd2luZG93cyBhbmQgc3RhdCgpIHN1cHBvcnRzIG9wdGlvbnMgKG5vZGUgMTArKS5cbiAgICAgICAgaWYgKHdhbnRCaWdpbnRGc1N0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ID0gKHBhdGgpID0+IHN0YXRNZXRob2QocGF0aCwgeyBiaWdpbnQ6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ID0gc3RhdE1ldGhvZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9tYXhEZXB0aCA9IG9wdHMuZGVwdGggPz8gZGVmYXVsdE9wdGlvbnMuZGVwdGg7XG4gICAgICAgIHRoaXMuX3dhbnRzRGlyID0gdHlwZSA/IERJUl9UWVBFUy5oYXModHlwZSkgOiBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2FudHNGaWxlID0gdHlwZSA/IEZJTEVfVFlQRVMuaGFzKHR5cGUpIDogZmFsc2U7XG4gICAgICAgIHRoaXMuX3dhbnRzRXZlcnl0aGluZyA9IHR5cGUgPT09IEVudHJ5VHlwZXMuRVZFUllUSElOR19UWVBFO1xuICAgICAgICB0aGlzLl9yb290ID0gcHJlc29sdmUocm9vdCk7XG4gICAgICAgIHRoaXMuX2lzRGlyZW50ID0gIW9wdHMuYWx3YXlzU3RhdDtcbiAgICAgICAgdGhpcy5fc3RhdHNQcm9wID0gdGhpcy5faXNEaXJlbnQgPyAnZGlyZW50JyA6ICdzdGF0cyc7XG4gICAgICAgIHRoaXMuX3JkT3B0aW9ucyA9IHsgZW5jb2Rpbmc6ICd1dGY4Jywgd2l0aEZpbGVUeXBlczogdGhpcy5faXNEaXJlbnQgfTtcbiAgICAgICAgLy8gTGF1bmNoIHN0cmVhbSB3aXRoIG9uZSBwYXJlbnQsIHRoZSByb290IGRpci5cbiAgICAgICAgdGhpcy5wYXJlbnRzID0gW3RoaXMuX2V4cGxvcmVEaXIocm9vdCwgMSldO1xuICAgICAgICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGFzeW5jIF9yZWFkKGJhdGNoKSB7XG4gICAgICAgIGlmICh0aGlzLnJlYWRpbmcpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMucmVhZGluZyA9IHRydWU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3aGlsZSAoIXRoaXMuZGVzdHJveWVkICYmIGJhdGNoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhciA9IHRoaXMucGFyZW50O1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbCA9IHBhciAmJiBwYXIuZmlsZXM7XG4gICAgICAgICAgICAgICAgaWYgKGZpbCAmJiBmaWwubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHBhdGgsIGRlcHRoIH0gPSBwYXI7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNsaWNlID0gZmlsLnNwbGljZSgwLCBiYXRjaCkubWFwKChkaXJlbnQpID0+IHRoaXMuX2Zvcm1hdEVudHJ5KGRpcmVudCwgcGF0aCkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhd2FpdGVkID0gYXdhaXQgUHJvbWlzZS5hbGwoc2xpY2UpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZW50cnkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlUeXBlID0gYXdhaXQgdGhpcy5fZ2V0RW50cnlUeXBlKGVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRyeVR5cGUgPT09ICdkaXJlY3RvcnknICYmIHRoaXMuX2RpcmVjdG9yeUZpbHRlcihlbnRyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVwdGggPD0gdGhpcy5fbWF4RGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRzLnB1c2godGhpcy5fZXhwbG9yZURpcihlbnRyeS5mdWxsUGF0aCwgZGVwdGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl93YW50c0Rpcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnB1c2goZW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYXRjaC0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKChlbnRyeVR5cGUgPT09ICdmaWxlJyB8fCB0aGlzLl9pbmNsdWRlQXNGaWxlKGVudHJ5KSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9maWxlRmlsdGVyKGVudHJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl93YW50c0ZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wdXNoKGVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmF0Y2gtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMucGFyZW50cy5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGFyZW50ID0gYXdhaXQgcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIF9leHBsb3JlRGlyKHBhdGgsIGRlcHRoKSB7XG4gICAgICAgIGxldCBmaWxlcztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbGVzID0gYXdhaXQgcmVhZGRpcihwYXRoLCB0aGlzLl9yZE9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5fb25FcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgZmlsZXMsIGRlcHRoLCBwYXRoIH07XG4gICAgfVxuICAgIGFzeW5jIF9mb3JtYXRFbnRyeShkaXJlbnQsIHBhdGgpIHtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBjb25zdCBiYXNlbmFtZSA9IHRoaXMuX2lzRGlyZW50ID8gZGlyZW50Lm5hbWUgOiBkaXJlbnQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHByZXNvbHZlKHBqb2luKHBhdGgsIGJhc2VuYW1lKSk7XG4gICAgICAgICAgICBlbnRyeSA9IHsgcGF0aDogcHJlbGF0aXZlKHRoaXMuX3Jvb3QsIGZ1bGxQYXRoKSwgZnVsbFBhdGgsIGJhc2VuYW1lIH07XG4gICAgICAgICAgICBlbnRyeVt0aGlzLl9zdGF0c1Byb3BdID0gdGhpcy5faXNEaXJlbnQgPyBkaXJlbnQgOiBhd2FpdCB0aGlzLl9zdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLl9vbkVycm9yKGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVudHJ5O1xuICAgIH1cbiAgICBfb25FcnJvcihlcnIpIHtcbiAgICAgICAgaWYgKGlzTm9ybWFsRmxvd0Vycm9yKGVycikgJiYgIXRoaXMuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3dhcm4nLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95KGVycik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgX2dldEVudHJ5VHlwZShlbnRyeSkge1xuICAgICAgICAvLyBlbnRyeSBtYXkgYmUgdW5kZWZpbmVkLCBiZWNhdXNlIGEgd2FybmluZyBvciBhbiBlcnJvciB3ZXJlIGVtaXR0ZWRcbiAgICAgICAgLy8gYW5kIHRoZSBzdGF0c1Byb3AgaXMgdW5kZWZpbmVkXG4gICAgICAgIGlmICghZW50cnkgJiYgdGhpcy5fc3RhdHNQcm9wIGluIGVudHJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhdHMgPSBlbnRyeVt0aGlzLl9zdGF0c1Byb3BdO1xuICAgICAgICBpZiAoc3RhdHMuaXNGaWxlKCkpXG4gICAgICAgICAgICByZXR1cm4gJ2ZpbGUnO1xuICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgIHJldHVybiAnZGlyZWN0b3J5JztcbiAgICAgICAgaWYgKHN0YXRzICYmIHN0YXRzLmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGwgPSBlbnRyeS5mdWxsUGF0aDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnlSZWFsUGF0aCA9IGF3YWl0IHJlYWxwYXRoKGZ1bGwpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5UmVhbFBhdGhTdGF0cyA9IGF3YWl0IGxzdGF0KGVudHJ5UmVhbFBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeVJlYWxQYXRoU3RhdHMuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdmaWxlJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5UmVhbFBhdGhTdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbiA9IGVudHJ5UmVhbFBhdGgubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnVsbC5zdGFydHNXaXRoKGVudHJ5UmVhbFBhdGgpICYmIGZ1bGwuc3Vic3RyKGxlbiwgMSkgPT09IHBzZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3Vyc2l2ZUVycm9yID0gbmV3IEVycm9yKGBDaXJjdWxhciBzeW1saW5rIGRldGVjdGVkOiBcIiR7ZnVsbH1cIiBwb2ludHMgdG8gXCIke2VudHJ5UmVhbFBhdGh9XCJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZUVycm9yLmNvZGUgPSBSRUNVUlNJVkVfRVJST1JfQ09ERTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9vbkVycm9yKHJlY3Vyc2l2ZUVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2RpcmVjdG9yeSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb25FcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIF9pbmNsdWRlQXNGaWxlKGVudHJ5KSB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gZW50cnkgJiYgZW50cnlbdGhpcy5fc3RhdHNQcm9wXTtcbiAgICAgICAgcmV0dXJuIHN0YXRzICYmIHRoaXMuX3dhbnRzRXZlcnl0aGluZyAmJiAhc3RhdHMuaXNEaXJlY3RvcnkoKTtcbiAgICB9XG59XG4vKipcbiAqIFN0cmVhbWluZyB2ZXJzaW9uOiBSZWFkcyBhbGwgZmlsZXMgYW5kIGRpcmVjdG9yaWVzIGluIGdpdmVuIHJvb3QgcmVjdXJzaXZlbHkuXG4gKiBDb25zdW1lcyB+Y29uc3RhbnQgc21hbGwgYW1vdW50IG9mIFJBTS5cbiAqIEBwYXJhbSByb290IFJvb3QgZGlyZWN0b3J5XG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRvIHNwZWNpZnkgcm9vdCAoc3RhcnQgZGlyZWN0b3J5KSwgZmlsdGVycyBhbmQgcmVjdXJzaW9uIGRlcHRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkZGlycChyb290LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgbGV0IHR5cGUgPSBvcHRpb25zLmVudHJ5VHlwZSB8fCBvcHRpb25zLnR5cGU7XG4gICAgaWYgKHR5cGUgPT09ICdib3RoJylcbiAgICAgICAgdHlwZSA9IEVudHJ5VHlwZXMuRklMRV9ESVJfVFlQRTsgLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHlcbiAgICBpZiAodHlwZSlcbiAgICAgICAgb3B0aW9ucy50eXBlID0gdHlwZTtcbiAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZWFkZGlycDogcm9vdCBhcmd1bWVudCBpcyByZXF1aXJlZC4gVXNhZ2U6IHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpJyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiByb290ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWFkZGlycDogcm9vdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLiBVc2FnZTogcmVhZGRpcnAocm9vdCwgb3B0aW9ucyknKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSAmJiAhQUxMX1RZUEVTLmluY2x1ZGVzKHR5cGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgcmVhZGRpcnA6IEludmFsaWQgdHlwZSBwYXNzZWQuIFVzZSBvbmUgb2YgJHtBTExfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICB9XG4gICAgb3B0aW9ucy5yb290ID0gcm9vdDtcbiAgICByZXR1cm4gbmV3IFJlYWRkaXJwU3RyZWFtKG9wdGlvbnMpO1xufVxuLyoqXG4gKiBQcm9taXNlIHZlcnNpb246IFJlYWRzIGFsbCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgaW4gZ2l2ZW4gcm9vdCByZWN1cnNpdmVseS5cbiAqIENvbXBhcmVkIHRvIHN0cmVhbWluZyB2ZXJzaW9uLCB3aWxsIGNvbnN1bWUgYSBsb3Qgb2YgUkFNIGUuZy4gd2hlbiAxIG1pbGxpb24gZmlsZXMgYXJlIGxpc3RlZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIHBhdGhzIGFuZCB0aGVpciBlbnRyeSBpbmZvc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpcnBQcm9taXNlKHJvb3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gW107XG4gICAgICAgIHJlYWRkaXJwKHJvb3QsIG9wdGlvbnMpXG4gICAgICAgICAgICAub24oJ2RhdGEnLCAoZW50cnkpID0+IGZpbGVzLnB1c2goZW50cnkpKVxuICAgICAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKGZpbGVzKSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCAoZXJyb3IpID0+IHJlamVjdChlcnJvcikpO1xuICAgIH0pO1xufVxuZXhwb3J0IGRlZmF1bHQgcmVhZGRpcnA7XG4iLCAiaW1wb3J0IHsgd2F0Y2hGaWxlLCB1bndhdGNoRmlsZSwgd2F0Y2ggYXMgZnNfd2F0Y2ggfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBvcGVuLCBzdGF0LCBsc3RhdCwgcmVhbHBhdGggYXMgZnNyZWFscGF0aCB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHN5c1BhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB0eXBlIGFzIG9zVHlwZSB9IGZyb20gJ29zJztcbmV4cG9ydCBjb25zdCBTVFJfREFUQSA9ICdkYXRhJztcbmV4cG9ydCBjb25zdCBTVFJfRU5EID0gJ2VuZCc7XG5leHBvcnQgY29uc3QgU1RSX0NMT1NFID0gJ2Nsb3NlJztcbmV4cG9ydCBjb25zdCBFTVBUWV9GTiA9ICgpID0+IHsgfTtcbmV4cG9ydCBjb25zdCBJREVOVElUWV9GTiA9ICh2YWwpID0+IHZhbDtcbmNvbnN0IHBsID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbmV4cG9ydCBjb25zdCBpc1dpbmRvd3MgPSBwbCA9PT0gJ3dpbjMyJztcbmV4cG9ydCBjb25zdCBpc01hY29zID0gcGwgPT09ICdkYXJ3aW4nO1xuZXhwb3J0IGNvbnN0IGlzTGludXggPSBwbCA9PT0gJ2xpbnV4JztcbmV4cG9ydCBjb25zdCBpc0ZyZWVCU0QgPSBwbCA9PT0gJ2ZyZWVic2QnO1xuZXhwb3J0IGNvbnN0IGlzSUJNaSA9IG9zVHlwZSgpID09PSAnT1M0MDAnO1xuZXhwb3J0IGNvbnN0IEVWRU5UUyA9IHtcbiAgICBBTEw6ICdhbGwnLFxuICAgIFJFQURZOiAncmVhZHknLFxuICAgIEFERDogJ2FkZCcsXG4gICAgQ0hBTkdFOiAnY2hhbmdlJyxcbiAgICBBRERfRElSOiAnYWRkRGlyJyxcbiAgICBVTkxJTks6ICd1bmxpbmsnLFxuICAgIFVOTElOS19ESVI6ICd1bmxpbmtEaXInLFxuICAgIFJBVzogJ3JhdycsXG4gICAgRVJST1I6ICdlcnJvcicsXG59O1xuY29uc3QgRVYgPSBFVkVOVFM7XG5jb25zdCBUSFJPVFRMRV9NT0RFX1dBVENIID0gJ3dhdGNoJztcbmNvbnN0IHN0YXRNZXRob2RzID0geyBsc3RhdCwgc3RhdCB9O1xuY29uc3QgS0VZX0xJU1RFTkVSUyA9ICdsaXN0ZW5lcnMnO1xuY29uc3QgS0VZX0VSUiA9ICdlcnJIYW5kbGVycyc7XG5jb25zdCBLRVlfUkFXID0gJ3Jhd0VtaXR0ZXJzJztcbmNvbnN0IEhBTkRMRVJfS0VZUyA9IFtLRVlfTElTVEVORVJTLCBLRVlfRVJSLCBLRVlfUkFXXTtcbi8vIHByZXR0aWVyLWlnbm9yZVxuY29uc3QgYmluYXJ5RXh0ZW5zaW9ucyA9IG5ldyBTZXQoW1xuICAgICczZG0nLCAnM2RzJywgJzNnMicsICczZ3AnLCAnN3onLCAnYScsICdhYWMnLCAnYWRwJywgJ2FmZGVzaWduJywgJ2FmcGhvdG8nLCAnYWZwdWInLCAnYWknLFxuICAgICdhaWYnLCAnYWlmZicsICdhbHonLCAnYXBlJywgJ2FwaycsICdhcHBpbWFnZScsICdhcicsICdhcmonLCAnYXNmJywgJ2F1JywgJ2F2aScsXG4gICAgJ2JhaycsICdiYW1sJywgJ2JoJywgJ2JpbicsICdiaycsICdibXAnLCAnYnRpZicsICdiejInLCAnYnppcDInLFxuICAgICdjYWInLCAnY2FmJywgJ2NnbScsICdjbGFzcycsICdjbXgnLCAnY3BpbycsICdjcjInLCAnY3VyJywgJ2RhdCcsICdkY20nLCAnZGViJywgJ2RleCcsICdkanZ1JyxcbiAgICAnZGxsJywgJ2RtZycsICdkbmcnLCAnZG9jJywgJ2RvY20nLCAnZG9jeCcsICdkb3QnLCAnZG90bScsICdkcmEnLCAnRFNfU3RvcmUnLCAnZHNrJywgJ2R0cycsXG4gICAgJ2R0c2hkJywgJ2R2YicsICdkd2cnLCAnZHhmJyxcbiAgICAnZWNlbHA0ODAwJywgJ2VjZWxwNzQ3MCcsICdlY2VscDk2MDAnLCAnZWdnJywgJ2VvbCcsICdlb3QnLCAnZXB1YicsICdleGUnLFxuICAgICdmNHYnLCAnZmJzJywgJ2ZoJywgJ2ZsYScsICdmbGFjJywgJ2ZsYXRwYWsnLCAnZmxpJywgJ2ZsdicsICdmcHgnLCAnZnN0JywgJ2Z2dCcsXG4gICAgJ2czJywgJ2doJywgJ2dpZicsICdncmFmZmxlJywgJ2d6JywgJ2d6aXAnLFxuICAgICdoMjYxJywgJ2gyNjMnLCAnaDI2NCcsICdpY25zJywgJ2ljbycsICdpZWYnLCAnaW1nJywgJ2lwYScsICdpc28nLFxuICAgICdqYXInLCAnanBlZycsICdqcGcnLCAnanBndicsICdqcG0nLCAnanhyJywgJ2tleScsICdrdHgnLFxuICAgICdsaGEnLCAnbGliJywgJ2x2cCcsICdseicsICdsemgnLCAnbHptYScsICdsem8nLFxuICAgICdtM3UnLCAnbTRhJywgJ200dicsICdtYXInLCAnbWRpJywgJ21odCcsICdtaWQnLCAnbWlkaScsICdtajInLCAnbWthJywgJ21rdicsICdtbXInLCAnbW5nJyxcbiAgICAnbW9iaScsICdtb3YnLCAnbW92aWUnLCAnbXAzJyxcbiAgICAnbXA0JywgJ21wNGEnLCAnbXBlZycsICdtcGcnLCAnbXBnYScsICdteHUnLFxuICAgICduZWYnLCAnbnB4JywgJ251bWJlcnMnLCAnbnVwa2cnLFxuICAgICdvJywgJ29kcCcsICdvZHMnLCAnb2R0JywgJ29nYScsICdvZ2cnLCAnb2d2JywgJ290ZicsICdvdHQnLFxuICAgICdwYWdlcycsICdwYm0nLCAncGN4JywgJ3BkYicsICdwZGYnLCAncGVhJywgJ3BnbScsICdwaWMnLCAncG5nJywgJ3BubScsICdwb3QnLCAncG90bScsXG4gICAgJ3BvdHgnLCAncHBhJywgJ3BwYW0nLFxuICAgICdwcG0nLCAncHBzJywgJ3Bwc20nLCAncHBzeCcsICdwcHQnLCAncHB0bScsICdwcHR4JywgJ3BzZCcsICdweWEnLCAncHljJywgJ3B5bycsICdweXYnLFxuICAgICdxdCcsXG4gICAgJ3JhcicsICdyYXMnLCAncmF3JywgJ3Jlc291cmNlcycsICdyZ2InLCAncmlwJywgJ3JsYycsICdybWYnLCAncm12YicsICdycG0nLCAncnRmJywgJ3J6JyxcbiAgICAnczNtJywgJ3M3eicsICdzY3B0JywgJ3NnaScsICdzaGFyJywgJ3NuYXAnLCAnc2lsJywgJ3NrZXRjaCcsICdzbGsnLCAnc212JywgJ3NuaycsICdzbycsXG4gICAgJ3N0bCcsICdzdW8nLCAnc3ViJywgJ3N3ZicsXG4gICAgJ3RhcicsICd0YnonLCAndGJ6MicsICd0Z2EnLCAndGd6JywgJ3RobXgnLCAndGlmJywgJ3RpZmYnLCAndGx6JywgJ3R0YycsICd0dGYnLCAndHh6JyxcbiAgICAndWRmJywgJ3V2aCcsICd1dmknLCAndXZtJywgJ3V2cCcsICd1dnMnLCAndXZ1JyxcbiAgICAndml2JywgJ3ZvYicsXG4gICAgJ3dhcicsICd3YXYnLCAnd2F4JywgJ3dibXAnLCAnd2RwJywgJ3dlYmEnLCAnd2VibScsICd3ZWJwJywgJ3dobCcsICd3aW0nLCAnd20nLCAnd21hJyxcbiAgICAnd212JywgJ3dteCcsICd3b2ZmJywgJ3dvZmYyJywgJ3dybScsICd3dngnLFxuICAgICd4Ym0nLCAneGlmJywgJ3hsYScsICd4bGFtJywgJ3hscycsICd4bHNiJywgJ3hsc20nLCAneGxzeCcsICd4bHQnLCAneGx0bScsICd4bHR4JywgJ3htJyxcbiAgICAneG1pbmQnLCAneHBpJywgJ3hwbScsICd4d2QnLCAneHonLFxuICAgICd6JywgJ3ppcCcsICd6aXB4Jyxcbl0pO1xuY29uc3QgaXNCaW5hcnlQYXRoID0gKGZpbGVQYXRoKSA9PiBiaW5hcnlFeHRlbnNpb25zLmhhcyhzeXNQYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpO1xuLy8gVE9ETzogZW1pdCBlcnJvcnMgcHJvcGVybHkuIEV4YW1wbGU6IEVNRklMRSBvbiBNYWNvcy5cbmNvbnN0IGZvcmVhY2ggPSAodmFsLCBmbikgPT4ge1xuICAgIGlmICh2YWwgaW5zdGFuY2VvZiBTZXQpIHtcbiAgICAgICAgdmFsLmZvckVhY2goZm4pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZm4odmFsKTtcbiAgICB9XG59O1xuY29uc3QgYWRkQW5kQ29udmVydCA9IChtYWluLCBwcm9wLCBpdGVtKSA9PiB7XG4gICAgbGV0IGNvbnRhaW5lciA9IG1haW5bcHJvcF07XG4gICAgaWYgKCEoY29udGFpbmVyIGluc3RhbmNlb2YgU2V0KSkge1xuICAgICAgICBtYWluW3Byb3BdID0gY29udGFpbmVyID0gbmV3IFNldChbY29udGFpbmVyXSk7XG4gICAgfVxuICAgIGNvbnRhaW5lci5hZGQoaXRlbSk7XG59O1xuY29uc3QgY2xlYXJJdGVtID0gKGNvbnQpID0+IChrZXkpID0+IHtcbiAgICBjb25zdCBzZXQgPSBjb250W2tleV07XG4gICAgaWYgKHNldCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICBzZXQuY2xlYXIoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGV0ZSBjb250W2tleV07XG4gICAgfVxufTtcbmNvbnN0IGRlbEZyb21TZXQgPSAobWFpbiwgcHJvcCwgaXRlbSkgPT4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IG1haW5bcHJvcF07XG4gICAgaWYgKGNvbnRhaW5lciBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICBjb250YWluZXIuZGVsZXRlKGl0ZW0pO1xuICAgIH1cbiAgICBlbHNlIGlmIChjb250YWluZXIgPT09IGl0ZW0pIHtcbiAgICAgICAgZGVsZXRlIG1haW5bcHJvcF07XG4gICAgfVxufTtcbmNvbnN0IGlzRW1wdHlTZXQgPSAodmFsKSA9PiAodmFsIGluc3RhbmNlb2YgU2V0ID8gdmFsLnNpemUgPT09IDAgOiAhdmFsKTtcbmNvbnN0IEZzV2F0Y2hJbnN0YW5jZXMgPSBuZXcgTWFwKCk7XG4vKipcbiAqIEluc3RhbnRpYXRlcyB0aGUgZnNfd2F0Y2ggaW50ZXJmYWNlXG4gKiBAcGFyYW0gcGF0aCB0byBiZSB3YXRjaGVkXG4gKiBAcGFyYW0gb3B0aW9ucyB0byBiZSBwYXNzZWQgdG8gZnNfd2F0Y2hcbiAqIEBwYXJhbSBsaXN0ZW5lciBtYWluIGV2ZW50IGhhbmRsZXJcbiAqIEBwYXJhbSBlcnJIYW5kbGVyIGVtaXRzIGluZm8gYWJvdXQgZXJyb3JzXG4gKiBAcGFyYW0gZW1pdFJhdyBlbWl0cyByYXcgZXZlbnQgZGF0YVxuICogQHJldHVybnMge05hdGl2ZUZzV2F0Y2hlcn1cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRnNXYXRjaEluc3RhbmNlKHBhdGgsIG9wdGlvbnMsIGxpc3RlbmVyLCBlcnJIYW5kbGVyLCBlbWl0UmF3KSB7XG4gICAgY29uc3QgaGFuZGxlRXZlbnQgPSAocmF3RXZlbnQsIGV2UGF0aCkgPT4ge1xuICAgICAgICBsaXN0ZW5lcihwYXRoKTtcbiAgICAgICAgZW1pdFJhdyhyYXdFdmVudCwgZXZQYXRoLCB7IHdhdGNoZWRQYXRoOiBwYXRoIH0pO1xuICAgICAgICAvLyBlbWl0IGJhc2VkIG9uIGV2ZW50cyBvY2N1cnJpbmcgZm9yIGZpbGVzIGZyb20gYSBkaXJlY3RvcnkncyB3YXRjaGVyIGluXG4gICAgICAgIC8vIGNhc2UgdGhlIGZpbGUncyB3YXRjaGVyIG1pc3NlcyBpdCAoYW5kIHJlbHkgb24gdGhyb3R0bGluZyB0byBkZS1kdXBlKVxuICAgICAgICBpZiAoZXZQYXRoICYmIHBhdGggIT09IGV2UGF0aCkge1xuICAgICAgICAgICAgZnNXYXRjaEJyb2FkY2FzdChzeXNQYXRoLnJlc29sdmUocGF0aCwgZXZQYXRoKSwgS0VZX0xJU1RFTkVSUywgc3lzUGF0aC5qb2luKHBhdGgsIGV2UGF0aCkpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZnNfd2F0Y2gocGF0aCwge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogb3B0aW9ucy5wZXJzaXN0ZW50LFxuICAgICAgICB9LCBoYW5kbGVFdmVudCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBlcnJIYW5kbGVyKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG4vKipcbiAqIEhlbHBlciBmb3IgcGFzc2luZyBmc193YXRjaCBldmVudCBkYXRhIHRvIGEgY29sbGVjdGlvbiBvZiBsaXN0ZW5lcnNcbiAqIEBwYXJhbSBmdWxsUGF0aCBhYnNvbHV0ZSBwYXRoIGJvdW5kIHRvIGZzX3dhdGNoIGluc3RhbmNlXG4gKi9cbmNvbnN0IGZzV2F0Y2hCcm9hZGNhc3QgPSAoZnVsbFBhdGgsIGxpc3RlbmVyVHlwZSwgdmFsMSwgdmFsMiwgdmFsMykgPT4ge1xuICAgIGNvbnN0IGNvbnQgPSBGc1dhdGNoSW5zdGFuY2VzLmdldChmdWxsUGF0aCk7XG4gICAgaWYgKCFjb250KVxuICAgICAgICByZXR1cm47XG4gICAgZm9yZWFjaChjb250W2xpc3RlbmVyVHlwZV0sIChsaXN0ZW5lcikgPT4ge1xuICAgICAgICBsaXN0ZW5lcih2YWwxLCB2YWwyLCB2YWwzKTtcbiAgICB9KTtcbn07XG4vKipcbiAqIEluc3RhbnRpYXRlcyB0aGUgZnNfd2F0Y2ggaW50ZXJmYWNlIG9yIGJpbmRzIGxpc3RlbmVyc1xuICogdG8gYW4gZXhpc3Rpbmcgb25lIGNvdmVyaW5nIHRoZSBzYW1lIGZpbGUgc3lzdGVtIGVudHJ5XG4gKiBAcGFyYW0gcGF0aFxuICogQHBhcmFtIGZ1bGxQYXRoIGFic29sdXRlIHBhdGhcbiAqIEBwYXJhbSBvcHRpb25zIHRvIGJlIHBhc3NlZCB0byBmc193YXRjaFxuICogQHBhcmFtIGhhbmRsZXJzIGNvbnRhaW5lciBmb3IgZXZlbnQgbGlzdGVuZXIgZnVuY3Rpb25zXG4gKi9cbmNvbnN0IHNldEZzV2F0Y2hMaXN0ZW5lciA9IChwYXRoLCBmdWxsUGF0aCwgb3B0aW9ucywgaGFuZGxlcnMpID0+IHtcbiAgICBjb25zdCB7IGxpc3RlbmVyLCBlcnJIYW5kbGVyLCByYXdFbWl0dGVyIH0gPSBoYW5kbGVycztcbiAgICBsZXQgY29udCA9IEZzV2F0Y2hJbnN0YW5jZXMuZ2V0KGZ1bGxQYXRoKTtcbiAgICBsZXQgd2F0Y2hlcjtcbiAgICBpZiAoIW9wdGlvbnMucGVyc2lzdGVudCkge1xuICAgICAgICB3YXRjaGVyID0gY3JlYXRlRnNXYXRjaEluc3RhbmNlKHBhdGgsIG9wdGlvbnMsIGxpc3RlbmVyLCBlcnJIYW5kbGVyLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKCF3YXRjaGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICByZXR1cm4gd2F0Y2hlci5jbG9zZS5iaW5kKHdhdGNoZXIpO1xuICAgIH1cbiAgICBpZiAoY29udCkge1xuICAgICAgICBhZGRBbmRDb252ZXJ0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgYWRkQW5kQ29udmVydChjb250LCBLRVlfRVJSLCBlcnJIYW5kbGVyKTtcbiAgICAgICAgYWRkQW5kQ29udmVydChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHdhdGNoZXIgPSBjcmVhdGVGc1dhdGNoSW5zdGFuY2UocGF0aCwgb3B0aW9ucywgZnNXYXRjaEJyb2FkY2FzdC5iaW5kKG51bGwsIGZ1bGxQYXRoLCBLRVlfTElTVEVORVJTKSwgZXJySGFuZGxlciwgLy8gbm8gbmVlZCB0byB1c2UgYnJvYWRjYXN0IGhlcmVcbiAgICAgICAgZnNXYXRjaEJyb2FkY2FzdC5iaW5kKG51bGwsIGZ1bGxQYXRoLCBLRVlfUkFXKSk7XG4gICAgICAgIGlmICghd2F0Y2hlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgd2F0Y2hlci5vbihFVi5FUlJPUiwgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm9hZGNhc3RFcnIgPSBmc1dhdGNoQnJvYWRjYXN0LmJpbmQobnVsbCwgZnVsbFBhdGgsIEtFWV9FUlIpO1xuICAgICAgICAgICAgaWYgKGNvbnQpXG4gICAgICAgICAgICAgICAgY29udC53YXRjaGVyVW51c2FibGUgPSB0cnVlOyAvLyBkb2N1bWVudGVkIHNpbmNlIE5vZGUgMTAuNC4xXG4gICAgICAgICAgICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzQzMzdcbiAgICAgICAgICAgIGlmIChpc1dpbmRvd3MgJiYgZXJyb3IuY29kZSA9PT0gJ0VQRVJNJykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZkID0gYXdhaXQgb3BlbihwYXRoLCAncicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmZC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICBicm9hZGNhc3RFcnIoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBicm9hZGNhc3RFcnIoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29udCA9IHtcbiAgICAgICAgICAgIGxpc3RlbmVyczogbGlzdGVuZXIsXG4gICAgICAgICAgICBlcnJIYW5kbGVyczogZXJySGFuZGxlcixcbiAgICAgICAgICAgIHJhd0VtaXR0ZXJzOiByYXdFbWl0dGVyLFxuICAgICAgICAgICAgd2F0Y2hlcixcbiAgICAgICAgfTtcbiAgICAgICAgRnNXYXRjaEluc3RhbmNlcy5zZXQoZnVsbFBhdGgsIGNvbnQpO1xuICAgIH1cbiAgICAvLyBjb25zdCBpbmRleCA9IGNvbnQubGlzdGVuZXJzLmluZGV4T2YobGlzdGVuZXIpO1xuICAgIC8vIHJlbW92ZXMgdGhpcyBpbnN0YW5jZSdzIGxpc3RlbmVycyBhbmQgY2xvc2VzIHRoZSB1bmRlcmx5aW5nIGZzX3dhdGNoXG4gICAgLy8gaW5zdGFuY2UgaWYgdGhlcmUgYXJlIG5vIG1vcmUgbGlzdGVuZXJzIGxlZnRcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBkZWxGcm9tU2V0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfRVJSLCBlcnJIYW5kbGVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKGlzRW1wdHlTZXQoY29udC5saXN0ZW5lcnMpKSB7XG4gICAgICAgICAgICAvLyBDaGVjayB0byBwcm90ZWN0IGFnYWluc3QgaXNzdWUgZ2gtNzMwLlxuICAgICAgICAgICAgLy8gaWYgKGNvbnQud2F0Y2hlclVudXNhYmxlKSB7XG4gICAgICAgICAgICBjb250LndhdGNoZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIEZzV2F0Y2hJbnN0YW5jZXMuZGVsZXRlKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIEhBTkRMRVJfS0VZUy5mb3JFYWNoKGNsZWFySXRlbShjb250KSk7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb250LndhdGNoZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBPYmplY3QuZnJlZXplKGNvbnQpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4vLyBmc193YXRjaEZpbGUgaGVscGVyc1xuLy8gb2JqZWN0IHRvIGhvbGQgcGVyLXByb2Nlc3MgZnNfd2F0Y2hGaWxlIGluc3RhbmNlc1xuLy8gKG1heSBiZSBzaGFyZWQgYWNyb3NzIGNob2tpZGFyIEZTV2F0Y2hlciBpbnN0YW5jZXMpXG5jb25zdCBGc1dhdGNoRmlsZUluc3RhbmNlcyA9IG5ldyBNYXAoKTtcbi8qKlxuICogSW5zdGFudGlhdGVzIHRoZSBmc193YXRjaEZpbGUgaW50ZXJmYWNlIG9yIGJpbmRzIGxpc3RlbmVyc1xuICogdG8gYW4gZXhpc3Rpbmcgb25lIGNvdmVyaW5nIHRoZSBzYW1lIGZpbGUgc3lzdGVtIGVudHJ5XG4gKiBAcGFyYW0gcGF0aCB0byBiZSB3YXRjaGVkXG4gKiBAcGFyYW0gZnVsbFBhdGggYWJzb2x1dGUgcGF0aFxuICogQHBhcmFtIG9wdGlvbnMgb3B0aW9ucyB0byBiZSBwYXNzZWQgdG8gZnNfd2F0Y2hGaWxlXG4gKiBAcGFyYW0gaGFuZGxlcnMgY29udGFpbmVyIGZvciBldmVudCBsaXN0ZW5lciBmdW5jdGlvbnNcbiAqIEByZXR1cm5zIGNsb3NlclxuICovXG5jb25zdCBzZXRGc1dhdGNoRmlsZUxpc3RlbmVyID0gKHBhdGgsIGZ1bGxQYXRoLCBvcHRpb25zLCBoYW5kbGVycykgPT4ge1xuICAgIGNvbnN0IHsgbGlzdGVuZXIsIHJhd0VtaXR0ZXIgfSA9IGhhbmRsZXJzO1xuICAgIGxldCBjb250ID0gRnNXYXRjaEZpbGVJbnN0YW5jZXMuZ2V0KGZ1bGxQYXRoKTtcbiAgICAvLyBsZXQgbGlzdGVuZXJzID0gbmV3IFNldCgpO1xuICAgIC8vIGxldCByYXdFbWl0dGVycyA9IG5ldyBTZXQoKTtcbiAgICBjb25zdCBjb3B0cyA9IGNvbnQgJiYgY29udC5vcHRpb25zO1xuICAgIGlmIChjb3B0cyAmJiAoY29wdHMucGVyc2lzdGVudCA8IG9wdGlvbnMucGVyc2lzdGVudCB8fCBjb3B0cy5pbnRlcnZhbCA+IG9wdGlvbnMuaW50ZXJ2YWwpKSB7XG4gICAgICAgIC8vIFwiVXBncmFkZVwiIHRoZSB3YXRjaGVyIHRvIHBlcnNpc3RlbmNlIG9yIGEgcXVpY2tlciBpbnRlcnZhbC5cbiAgICAgICAgLy8gVGhpcyBjcmVhdGVzIHNvbWUgdW5saWtlbHkgZWRnZSBjYXNlIGlzc3VlcyBpZiB0aGUgdXNlciBtaXhlc1xuICAgICAgICAvLyBzZXR0aW5ncyBpbiBhIHZlcnkgd2VpcmQgd2F5LCBidXQgc29sdmluZyBmb3IgdGhvc2UgY2FzZXNcbiAgICAgICAgLy8gZG9lc24ndCBzZWVtIHdvcnRod2hpbGUgZm9yIHRoZSBhZGRlZCBjb21wbGV4aXR5LlxuICAgICAgICAvLyBsaXN0ZW5lcnMgPSBjb250Lmxpc3RlbmVycztcbiAgICAgICAgLy8gcmF3RW1pdHRlcnMgPSBjb250LnJhd0VtaXR0ZXJzO1xuICAgICAgICB1bndhdGNoRmlsZShmdWxsUGF0aCk7XG4gICAgICAgIGNvbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmIChjb250KSB7XG4gICAgICAgIGFkZEFuZENvbnZlcnQoY29udCwgS0VZX0xJU1RFTkVSUywgbGlzdGVuZXIpO1xuICAgICAgICBhZGRBbmRDb252ZXJ0KGNvbnQsIEtFWV9SQVcsIHJhd0VtaXR0ZXIpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyBsaXN0ZW5lcnMuYWRkKGxpc3RlbmVyKTtcbiAgICAgICAgLy8gcmF3RW1pdHRlcnMuYWRkKHJhd0VtaXR0ZXIpO1xuICAgICAgICBjb250ID0ge1xuICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcixcbiAgICAgICAgICAgIHJhd0VtaXR0ZXJzOiByYXdFbWl0dGVyLFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIHdhdGNoZXI6IHdhdGNoRmlsZShmdWxsUGF0aCwgb3B0aW9ucywgKGN1cnIsIHByZXYpID0+IHtcbiAgICAgICAgICAgICAgICBmb3JlYWNoKGNvbnQucmF3RW1pdHRlcnMsIChyYXdFbWl0dGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJhd0VtaXR0ZXIoRVYuQ0hBTkdFLCBmdWxsUGF0aCwgeyBjdXJyLCBwcmV2IH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJtdGltZSA9IGN1cnIubXRpbWVNcztcbiAgICAgICAgICAgICAgICBpZiAoY3Vyci5zaXplICE9PSBwcmV2LnNpemUgfHwgY3Vycm10aW1lID4gcHJldi5tdGltZU1zIHx8IGN1cnJtdGltZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3JlYWNoKGNvbnQubGlzdGVuZXJzLCAobGlzdGVuZXIpID0+IGxpc3RlbmVyKHBhdGgsIGN1cnIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfTtcbiAgICAgICAgRnNXYXRjaEZpbGVJbnN0YW5jZXMuc2V0KGZ1bGxQYXRoLCBjb250KTtcbiAgICB9XG4gICAgLy8gY29uc3QgaW5kZXggPSBjb250Lmxpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAvLyBSZW1vdmVzIHRoaXMgaW5zdGFuY2UncyBsaXN0ZW5lcnMgYW5kIGNsb3NlcyB0aGUgdW5kZXJseWluZyBmc193YXRjaEZpbGVcbiAgICAvLyBpbnN0YW5jZSBpZiB0aGVyZSBhcmUgbm8gbW9yZSBsaXN0ZW5lcnMgbGVmdC5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBkZWxGcm9tU2V0KGNvbnQsIEtFWV9MSVNURU5FUlMsIGxpc3RlbmVyKTtcbiAgICAgICAgZGVsRnJvbVNldChjb250LCBLRVlfUkFXLCByYXdFbWl0dGVyKTtcbiAgICAgICAgaWYgKGlzRW1wdHlTZXQoY29udC5saXN0ZW5lcnMpKSB7XG4gICAgICAgICAgICBGc1dhdGNoRmlsZUluc3RhbmNlcy5kZWxldGUoZnVsbFBhdGgpO1xuICAgICAgICAgICAgdW53YXRjaEZpbGUoZnVsbFBhdGgpO1xuICAgICAgICAgICAgY29udC5vcHRpb25zID0gY29udC53YXRjaGVyID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgT2JqZWN0LmZyZWV6ZShjb250KTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuLyoqXG4gKiBAbWl4aW5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vZGVGc0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yKGZzVykge1xuICAgICAgICB0aGlzLmZzdyA9IGZzVztcbiAgICAgICAgdGhpcy5fYm91bmRIYW5kbGVFcnJvciA9IChlcnJvcikgPT4gZnNXLl9oYW5kbGVFcnJvcihlcnJvcik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdhdGNoIGZpbGUgZm9yIGNoYW5nZXMgd2l0aCBmc193YXRjaEZpbGUgb3IgZnNfd2F0Y2guXG4gICAgICogQHBhcmFtIHBhdGggdG8gZmlsZSBvciBkaXJcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXIgb24gZnMgY2hhbmdlXG4gICAgICogQHJldHVybnMgY2xvc2VyIGZvciB0aGUgd2F0Y2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIF93YXRjaFdpdGhOb2RlRnMocGF0aCwgbGlzdGVuZXIpIHtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHRoaXMuZnN3Lm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGRpcmVjdG9yeSA9IHN5c1BhdGguZGlybmFtZShwYXRoKTtcbiAgICAgICAgY29uc3QgYmFzZW5hbWUgPSBzeXNQYXRoLmJhc2VuYW1lKHBhdGgpO1xuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpO1xuICAgICAgICBwYXJlbnQuYWRkKGJhc2VuYW1lKTtcbiAgICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gc3lzUGF0aC5yZXNvbHZlKHBhdGgpO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogb3B0cy5wZXJzaXN0ZW50LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIWxpc3RlbmVyKVxuICAgICAgICAgICAgbGlzdGVuZXIgPSBFTVBUWV9GTjtcbiAgICAgICAgbGV0IGNsb3NlcjtcbiAgICAgICAgaWYgKG9wdHMudXNlUG9sbGluZykge1xuICAgICAgICAgICAgY29uc3QgZW5hYmxlQmluID0gb3B0cy5pbnRlcnZhbCAhPT0gb3B0cy5iaW5hcnlJbnRlcnZhbDtcbiAgICAgICAgICAgIG9wdGlvbnMuaW50ZXJ2YWwgPSBlbmFibGVCaW4gJiYgaXNCaW5hcnlQYXRoKGJhc2VuYW1lKSA/IG9wdHMuYmluYXJ5SW50ZXJ2YWwgOiBvcHRzLmludGVydmFsO1xuICAgICAgICAgICAgY2xvc2VyID0gc2V0RnNXYXRjaEZpbGVMaXN0ZW5lcihwYXRoLCBhYnNvbHV0ZVBhdGgsIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcixcbiAgICAgICAgICAgICAgICByYXdFbWl0dGVyOiB0aGlzLmZzdy5fZW1pdFJhdyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2xvc2VyID0gc2V0RnNXYXRjaExpc3RlbmVyKHBhdGgsIGFic29sdXRlUGF0aCwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLFxuICAgICAgICAgICAgICAgIGVyckhhbmRsZXI6IHRoaXMuX2JvdW5kSGFuZGxlRXJyb3IsXG4gICAgICAgICAgICAgICAgcmF3RW1pdHRlcjogdGhpcy5mc3cuX2VtaXRSYXcsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2xvc2VyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXYXRjaCBhIGZpbGUgYW5kIGVtaXQgYWRkIGV2ZW50IGlmIHdhcnJhbnRlZC5cbiAgICAgKiBAcmV0dXJucyBjbG9zZXIgZm9yIHRoZSB3YXRjaGVyIGluc3RhbmNlXG4gICAgICovXG4gICAgX2hhbmRsZUZpbGUoZmlsZSwgc3RhdHMsIGluaXRpYWxBZGQpIHtcbiAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRpcm5hbWUgPSBzeXNQYXRoLmRpcm5hbWUoZmlsZSk7XG4gICAgICAgIGNvbnN0IGJhc2VuYW1lID0gc3lzUGF0aC5iYXNlbmFtZShmaWxlKTtcbiAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5mc3cuX2dldFdhdGNoZWREaXIoZGlybmFtZSk7XG4gICAgICAgIC8vIHN0YXRzIGlzIGFsd2F5cyBwcmVzZW50XG4gICAgICAgIGxldCBwcmV2U3RhdHMgPSBzdGF0cztcbiAgICAgICAgLy8gaWYgdGhlIGZpbGUgaXMgYWxyZWFkeSBiZWluZyB3YXRjaGVkLCBkbyBub3RoaW5nXG4gICAgICAgIGlmIChwYXJlbnQuaGFzKGJhc2VuYW1lKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBhc3luYyAocGF0aCwgbmV3U3RhdHMpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5mc3cuX3Rocm90dGxlKFRIUk9UVExFX01PREVfV0FUQ0gsIGZpbGUsIDUpKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGlmICghbmV3U3RhdHMgfHwgbmV3U3RhdHMubXRpbWVNcyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1N0YXRzID0gYXdhaXQgc3RhdChmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgdGhhdCBjaGFuZ2UgZXZlbnQgd2FzIG5vdCBmaXJlZCBiZWNhdXNlIG9mIGNoYW5nZWQgb25seSBhY2Nlc3NUaW1lLlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdCA9IG5ld1N0YXRzLmF0aW1lTXM7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG10ID0gbmV3U3RhdHMubXRpbWVNcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhdCB8fCBhdCA8PSBtdCB8fCBtdCAhPT0gcHJldlN0YXRzLm10aW1lTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgZmlsZSwgbmV3U3RhdHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICgoaXNNYWNvcyB8fCBpc0xpbnV4IHx8IGlzRnJlZUJTRCkgJiYgcHJldlN0YXRzLmlubyAhPT0gbmV3U3RhdHMuaW5vKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fY2xvc2VGaWxlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldlN0YXRzID0gbmV3U3RhdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbG9zZXIgPSB0aGlzLl93YXRjaFdpdGhOb2RlRnMoZmlsZSwgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsb3NlcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldlN0YXRzID0gbmV3U3RhdHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpeCBpc3N1ZXMgd2hlcmUgbXRpbWUgaXMgbnVsbCBidXQgZmlsZSBpcyBzdGlsbCBwcmVzZW50XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9yZW1vdmUoZGlybmFtZSwgYmFzZW5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhZGQgaXMgYWJvdXQgdG8gYmUgZW1pdHRlZCBpZiBmaWxlIG5vdCBhbHJlYWR5IHRyYWNrZWQgaW4gcGFyZW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChwYXJlbnQuaGFzKGJhc2VuYW1lKSkge1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIHRoYXQgY2hhbmdlIGV2ZW50IHdhcyBub3QgZmlyZWQgYmVjYXVzZSBvZiBjaGFuZ2VkIG9ubHkgYWNjZXNzVGltZS5cbiAgICAgICAgICAgICAgICBjb25zdCBhdCA9IG5ld1N0YXRzLmF0aW1lTXM7XG4gICAgICAgICAgICAgICAgY29uc3QgbXQgPSBuZXdTdGF0cy5tdGltZU1zO1xuICAgICAgICAgICAgICAgIGlmICghYXQgfHwgYXQgPD0gbXQgfHwgbXQgIT09IHByZXZTdGF0cy5tdGltZU1zKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgZmlsZSwgbmV3U3RhdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcmV2U3RhdHMgPSBuZXdTdGF0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLy8ga2ljayBvZmYgdGhlIHdhdGNoZXJcbiAgICAgICAgY29uc3QgY2xvc2VyID0gdGhpcy5fd2F0Y2hXaXRoTm9kZUZzKGZpbGUsIGxpc3RlbmVyKTtcbiAgICAgICAgLy8gZW1pdCBhbiBhZGQgZXZlbnQgaWYgd2UncmUgc3VwcG9zZWQgdG9cbiAgICAgICAgaWYgKCEoaW5pdGlhbEFkZCAmJiB0aGlzLmZzdy5vcHRpb25zLmlnbm9yZUluaXRpYWwpICYmIHRoaXMuZnN3Ll9pc250SWdub3JlZChmaWxlKSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmZzdy5fdGhyb3R0bGUoRVYuQURELCBmaWxlLCAwKSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLmZzdy5fZW1pdChFVi5BREQsIGZpbGUsIHN0YXRzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2xvc2VyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgc3ltbGlua3MgZW5jb3VudGVyZWQgd2hpbGUgcmVhZGluZyBhIGRpci5cbiAgICAgKiBAcGFyYW0gZW50cnkgcmV0dXJuZWQgYnkgcmVhZGRpcnBcbiAgICAgKiBAcGFyYW0gZGlyZWN0b3J5IHBhdGggb2YgZGlyIGJlaW5nIHJlYWRcbiAgICAgKiBAcGFyYW0gcGF0aCBvZiB0aGlzIGl0ZW1cbiAgICAgKiBAcGFyYW0gaXRlbSBiYXNlbmFtZSBvZiB0aGlzIGl0ZW1cbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIG5vIG1vcmUgcHJvY2Vzc2luZyBpcyBuZWVkZWQgZm9yIHRoaXMgZW50cnkuXG4gICAgICovXG4gICAgYXN5bmMgX2hhbmRsZVN5bWxpbmsoZW50cnksIGRpcmVjdG9yeSwgcGF0aCwgaXRlbSkge1xuICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVsbCA9IGVudHJ5LmZ1bGxQYXRoO1xuICAgICAgICBjb25zdCBkaXIgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXJlY3RvcnkpO1xuICAgICAgICBpZiAoIXRoaXMuZnN3Lm9wdGlvbnMuZm9sbG93U3ltbGlua3MpIHtcbiAgICAgICAgICAgIC8vIHdhdGNoIHN5bWxpbmsgZGlyZWN0bHkgKGRvbid0IGZvbGxvdykgYW5kIGRldGVjdCBjaGFuZ2VzXG4gICAgICAgICAgICB0aGlzLmZzdy5faW5jclJlYWR5Q291bnQoKTtcbiAgICAgICAgICAgIGxldCBsaW5rUGF0aDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGlua1BhdGggPSBhd2FpdCBmc3JlYWxwYXRoKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fZW1pdFJlYWR5KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGlmIChkaXIuaGFzKGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuZ2V0KGZ1bGwpICE9PSBsaW5rUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChmdWxsLCBsaW5rUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkNIQU5HRSwgcGF0aCwgZW50cnkuc3RhdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRpci5hZGQoaXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5mc3cuX3N5bWxpbmtQYXRocy5zZXQoZnVsbCwgbGlua1BhdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkFERCwgcGF0aCwgZW50cnkuc3RhdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5mc3cuX2VtaXRSZWFkeSgpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZG9uJ3QgZm9sbG93IHRoZSBzYW1lIHN5bWxpbmsgbW9yZSB0aGFuIG9uY2VcbiAgICAgICAgaWYgKHRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuaGFzKGZ1bGwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChmdWxsLCB0cnVlKTtcbiAgICB9XG4gICAgX2hhbmRsZVJlYWQoZGlyZWN0b3J5LCBpbml0aWFsQWRkLCB3aCwgdGFyZ2V0LCBkaXIsIGRlcHRoLCB0aHJvdHRsZXIpIHtcbiAgICAgICAgLy8gTm9ybWFsaXplIHRoZSBkaXJlY3RvcnkgbmFtZSBvbiBXaW5kb3dzXG4gICAgICAgIGRpcmVjdG9yeSA9IHN5c1BhdGguam9pbihkaXJlY3RvcnksICcnKTtcbiAgICAgICAgdGhyb3R0bGVyID0gdGhpcy5mc3cuX3Rocm90dGxlKCdyZWFkZGlyJywgZGlyZWN0b3J5LCAxMDAwKTtcbiAgICAgICAgaWYgKCF0aHJvdHRsZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHByZXZpb3VzID0gdGhpcy5mc3cuX2dldFdhdGNoZWREaXIod2gucGF0aCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXcgU2V0KCk7XG4gICAgICAgIGxldCBzdHJlYW0gPSB0aGlzLmZzdy5fcmVhZGRpcnAoZGlyZWN0b3J5LCB7XG4gICAgICAgICAgICBmaWxlRmlsdGVyOiAoZW50cnkpID0+IHdoLmZpbHRlclBhdGgoZW50cnkpLFxuICAgICAgICAgICAgZGlyZWN0b3J5RmlsdGVyOiAoZW50cnkpID0+IHdoLmZpbHRlckRpcihlbnRyeSksXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIXN0cmVhbSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgc3RyZWFtXG4gICAgICAgICAgICAub24oU1RSX0RBVEEsIGFzeW5jIChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gZW50cnkucGF0aDtcbiAgICAgICAgICAgIGxldCBwYXRoID0gc3lzUGF0aC5qb2luKGRpcmVjdG9yeSwgaXRlbSk7XG4gICAgICAgICAgICBjdXJyZW50LmFkZChpdGVtKTtcbiAgICAgICAgICAgIGlmIChlbnRyeS5zdGF0cy5pc1N5bWJvbGljTGluaygpICYmXG4gICAgICAgICAgICAgICAgKGF3YWl0IHRoaXMuX2hhbmRsZVN5bWxpbmsoZW50cnksIGRpcmVjdG9yeSwgcGF0aCwgaXRlbSkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBGaWxlcyB0aGF0IHByZXNlbnQgaW4gY3VycmVudCBkaXJlY3Rvcnkgc25hcHNob3RcbiAgICAgICAgICAgIC8vIGJ1dCBhYnNlbnQgaW4gcHJldmlvdXMgYXJlIGFkZGVkIHRvIHdhdGNoIGxpc3QgYW5kXG4gICAgICAgICAgICAvLyBlbWl0IGBhZGRgIGV2ZW50LlxuICAgICAgICAgICAgaWYgKGl0ZW0gPT09IHRhcmdldCB8fCAoIXRhcmdldCAmJiAhcHJldmlvdXMuaGFzKGl0ZW0pKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9pbmNyUmVhZHlDb3VudCgpO1xuICAgICAgICAgICAgICAgIC8vIGVuc3VyZSByZWxhdGl2ZW5lc3Mgb2YgcGF0aCBpcyBwcmVzZXJ2ZWQgaW4gY2FzZSBvZiB3YXRjaGVyIHJldXNlXG4gICAgICAgICAgICAgICAgcGF0aCA9IHN5c1BhdGguam9pbihkaXIsIHN5c1BhdGgucmVsYXRpdmUoZGlyLCBwYXRoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkVG9Ob2RlRnMocGF0aCwgaW5pdGlhbEFkZCwgd2gsIGRlcHRoICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgICAgICAub24oRVYuRVJST1IsIHRoaXMuX2JvdW5kSGFuZGxlRXJyb3IpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzdHJlYW0pXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgICAgICAgICAgc3RyZWFtLm9uY2UoU1RSX0VORCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHdhc1Rocm90dGxlZCA9IHRocm90dGxlciA/IHRocm90dGxlci5jbGVhcigpIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIC8vIEZpbGVzIHRoYXQgYWJzZW50IGluIGN1cnJlbnQgZGlyZWN0b3J5IHNuYXBzaG90XG4gICAgICAgICAgICAgICAgLy8gYnV0IHByZXNlbnQgaW4gcHJldmlvdXMgZW1pdCBgcmVtb3ZlYCBldmVudFxuICAgICAgICAgICAgICAgIC8vIGFuZCBhcmUgcmVtb3ZlZCBmcm9tIEB3YXRjaGVkW2RpcmVjdG9yeV0uXG4gICAgICAgICAgICAgICAgcHJldmlvdXNcbiAgICAgICAgICAgICAgICAgICAgLmdldENoaWxkcmVuKClcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbSAhPT0gZGlyZWN0b3J5ICYmICFjdXJyZW50LmhhcyhpdGVtKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fcmVtb3ZlKGRpcmVjdG9yeSwgaXRlbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3RyZWFtID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIC8vIG9uZSBtb3JlIHRpbWUgZm9yIGFueSBtaXNzZWQgaW4gY2FzZSBjaGFuZ2VzIGNhbWUgaW4gZXh0cmVtZWx5IHF1aWNrbHlcbiAgICAgICAgICAgICAgICBpZiAod2FzVGhyb3R0bGVkKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVSZWFkKGRpcmVjdG9yeSwgZmFsc2UsIHdoLCB0YXJnZXQsIGRpciwgZGVwdGgsIHRocm90dGxlcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgZGlyZWN0b3J5IHRvIGFkZCAvIHJlbW92ZSBmaWxlcyBmcm9tIGBAd2F0Y2hlZGAgbGlzdCBhbmQgcmUtcmVhZCBpdCBvbiBjaGFuZ2UuXG4gICAgICogQHBhcmFtIGRpciBmcyBwYXRoXG4gICAgICogQHBhcmFtIHN0YXRzXG4gICAgICogQHBhcmFtIGluaXRpYWxBZGRcbiAgICAgKiBAcGFyYW0gZGVwdGggcmVsYXRpdmUgdG8gdXNlci1zdXBwbGllZCBwYXRoXG4gICAgICogQHBhcmFtIHRhcmdldCBjaGlsZCBwYXRoIHRhcmdldGVkIGZvciB3YXRjaFxuICAgICAqIEBwYXJhbSB3aCBDb21tb24gd2F0Y2ggaGVscGVycyBmb3IgdGhpcyBwYXRoXG4gICAgICogQHBhcmFtIHJlYWxwYXRoXG4gICAgICogQHJldHVybnMgY2xvc2VyIGZvciB0aGUgd2F0Y2hlciBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBhc3luYyBfaGFuZGxlRGlyKGRpciwgc3RhdHMsIGluaXRpYWxBZGQsIGRlcHRoLCB0YXJnZXQsIHdoLCByZWFscGF0aCkge1xuICAgICAgICBjb25zdCBwYXJlbnREaXIgPSB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihzeXNQYXRoLmRpcm5hbWUoZGlyKSk7XG4gICAgICAgIGNvbnN0IHRyYWNrZWQgPSBwYXJlbnREaXIuaGFzKHN5c1BhdGguYmFzZW5hbWUoZGlyKSk7XG4gICAgICAgIGlmICghKGluaXRpYWxBZGQgJiYgdGhpcy5mc3cub3B0aW9ucy5pZ25vcmVJbml0aWFsKSAmJiAhdGFyZ2V0ICYmICF0cmFja2VkKSB7XG4gICAgICAgICAgICB0aGlzLmZzdy5fZW1pdChFVi5BRERfRElSLCBkaXIsIHN0YXRzKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlbnN1cmUgZGlyIGlzIHRyYWNrZWQgKGhhcm1sZXNzIGlmIHJlZHVuZGFudClcbiAgICAgICAgcGFyZW50RGlyLmFkZChzeXNQYXRoLmJhc2VuYW1lKGRpcikpO1xuICAgICAgICB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihkaXIpO1xuICAgICAgICBsZXQgdGhyb3R0bGVyO1xuICAgICAgICBsZXQgY2xvc2VyO1xuICAgICAgICBjb25zdCBvRGVwdGggPSB0aGlzLmZzdy5vcHRpb25zLmRlcHRoO1xuICAgICAgICBpZiAoKG9EZXB0aCA9PSBudWxsIHx8IGRlcHRoIDw9IG9EZXB0aCkgJiYgIXRoaXMuZnN3Ll9zeW1saW5rUGF0aHMuaGFzKHJlYWxwYXRoKSkge1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9oYW5kbGVSZWFkKGRpciwgaW5pdGlhbEFkZCwgd2gsIHRhcmdldCwgZGlyLCBkZXB0aCwgdGhyb3R0bGVyKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5mc3cuY2xvc2VkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbG9zZXIgPSB0aGlzLl93YXRjaFdpdGhOb2RlRnMoZGlyLCAoZGlyUGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBpZiBjdXJyZW50IGRpcmVjdG9yeSBpcyByZW1vdmVkLCBkbyBub3RoaW5nXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzICYmIHN0YXRzLm10aW1lTXMgPT09IDApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVSZWFkKGRpclBhdGgsIGZhbHNlLCB3aCwgdGFyZ2V0LCBkaXIsIGRlcHRoLCB0aHJvdHRsZXIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNsb3NlcjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSGFuZGxlIGFkZGVkIGZpbGUsIGRpcmVjdG9yeSwgb3IgZ2xvYiBwYXR0ZXJuLlxuICAgICAqIERlbGVnYXRlcyBjYWxsIHRvIF9oYW5kbGVGaWxlIC8gX2hhbmRsZURpciBhZnRlciBjaGVja3MuXG4gICAgICogQHBhcmFtIHBhdGggdG8gZmlsZSBvciBpclxuICAgICAqIEBwYXJhbSBpbml0aWFsQWRkIHdhcyB0aGUgZmlsZSBhZGRlZCBhdCB3YXRjaCBpbnN0YW50aWF0aW9uP1xuICAgICAqIEBwYXJhbSBwcmlvcldoIGRlcHRoIHJlbGF0aXZlIHRvIHVzZXItc3VwcGxpZWQgcGF0aFxuICAgICAqIEBwYXJhbSBkZXB0aCBDaGlsZCBwYXRoIGFjdHVhbGx5IHRhcmdldGVkIGZvciB3YXRjaFxuICAgICAqIEBwYXJhbSB0YXJnZXQgQ2hpbGQgcGF0aCBhY3R1YWxseSB0YXJnZXRlZCBmb3Igd2F0Y2hcbiAgICAgKi9cbiAgICBhc3luYyBfYWRkVG9Ob2RlRnMocGF0aCwgaW5pdGlhbEFkZCwgcHJpb3JXaCwgZGVwdGgsIHRhcmdldCkge1xuICAgICAgICBjb25zdCByZWFkeSA9IHRoaXMuZnN3Ll9lbWl0UmVhZHk7XG4gICAgICAgIGlmICh0aGlzLmZzdy5faXNJZ25vcmVkKHBhdGgpIHx8IHRoaXMuZnN3LmNsb3NlZCkge1xuICAgICAgICAgICAgcmVhZHkoKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3aCA9IHRoaXMuZnN3Ll9nZXRXYXRjaEhlbHBlcnMocGF0aCk7XG4gICAgICAgIGlmIChwcmlvcldoKSB7XG4gICAgICAgICAgICB3aC5maWx0ZXJQYXRoID0gKGVudHJ5KSA9PiBwcmlvcldoLmZpbHRlclBhdGgoZW50cnkpO1xuICAgICAgICAgICAgd2guZmlsdGVyRGlyID0gKGVudHJ5KSA9PiBwcmlvcldoLmZpbHRlckRpcihlbnRyeSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXZhbHVhdGUgd2hhdCBpcyBhdCB0aGUgcGF0aCB3ZSdyZSBiZWluZyBhc2tlZCB0byB3YXRjaFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBzdGF0TWV0aG9kc1t3aC5zdGF0TWV0aG9kXSh3aC53YXRjaFBhdGgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBpZiAodGhpcy5mc3cuX2lzSWdub3JlZCh3aC53YXRjaFBhdGgsIHN0YXRzKSkge1xuICAgICAgICAgICAgICAgIHJlYWR5KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZm9sbG93ID0gdGhpcy5mc3cub3B0aW9ucy5mb2xsb3dTeW1saW5rcztcbiAgICAgICAgICAgIGxldCBjbG9zZXI7XG4gICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFic1BhdGggPSBzeXNQYXRoLnJlc29sdmUocGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGxvdyA/IGF3YWl0IGZzcmVhbHBhdGgocGF0aCkgOiBwYXRoO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjbG9zZXIgPSBhd2FpdCB0aGlzLl9oYW5kbGVEaXIod2gud2F0Y2hQYXRoLCBzdGF0cywgaW5pdGlhbEFkZCwgZGVwdGgsIHRhcmdldCwgd2gsIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAvLyBwcmVzZXJ2ZSB0aGlzIHN5bWxpbmsncyB0YXJnZXQgcGF0aFxuICAgICAgICAgICAgICAgIGlmIChhYnNQYXRoICE9PSB0YXJnZXRQYXRoICYmIHRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChhYnNQYXRoLCB0YXJnZXRQYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzdGF0cy5pc1N5bWJvbGljTGluaygpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGxvdyA/IGF3YWl0IGZzcmVhbHBhdGgocGF0aCkgOiBwYXRoO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZzdy5jbG9zZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBzeXNQYXRoLmRpcm5hbWUod2gud2F0Y2hQYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fZ2V0V2F0Y2hlZERpcihwYXJlbnQpLmFkZCh3aC53YXRjaFBhdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZnN3Ll9lbWl0KEVWLkFERCwgd2gud2F0Y2hQYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgY2xvc2VyID0gYXdhaXQgdGhpcy5faGFuZGxlRGlyKHBhcmVudCwgc3RhdHMsIGluaXRpYWxBZGQsIGRlcHRoLCBwYXRoLCB3aCwgdGFyZ2V0UGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZnN3LmNsb3NlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIC8vIHByZXNlcnZlIHRoaXMgc3ltbGluaydzIHRhcmdldCBwYXRoXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZzdy5fc3ltbGlua1BhdGhzLnNldChzeXNQYXRoLnJlc29sdmUocGF0aCksIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsb3NlciA9IHRoaXMuX2hhbmRsZUZpbGUod2gud2F0Y2hQYXRoLCBzdGF0cywgaW5pdGlhbEFkZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkeSgpO1xuICAgICAgICAgICAgaWYgKGNsb3NlcilcbiAgICAgICAgICAgICAgICB0aGlzLmZzdy5fYWRkUGF0aENsb3NlcihwYXRoLCBjbG9zZXIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgaWYgKHRoaXMuZnN3Ll9oYW5kbGVFcnJvcihlcnJvcikpIHtcbiAgICAgICAgICAgICAgICByZWFkeSgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwgIi8qKlxuICogRGlzY292ZXIgdHdlYWtzIHVuZGVyIDx1c2VyUm9vdD4vdHdlYWtzLiBFYWNoIHR3ZWFrIGlzIGEgZGlyZWN0b3J5IHdpdGggYVxuICogbWFuaWZlc3QuanNvbiBhbmQgYW4gZW50cnkgc2NyaXB0LiBFbnRyeSByZXNvbHV0aW9uIGlzIG1hbmlmZXN0Lm1haW4gZmlyc3QsXG4gKiB0aGVuIGluZGV4LmpzLCBpbmRleC5tanMsIGFuZCBpbmRleC5janMuXG4gKlxuICogVGhlIG1hbmlmZXN0IGdhdGUgaXMgaW50ZW50aW9uYWxseSBzdHJpY3QuIEEgdHdlYWsgbXVzdCBpZGVudGlmeSBpdHMgR2l0SHViXG4gKiByZXBvc2l0b3J5IHNvIHRoZSBtYW5hZ2VyIGNhbiBjaGVjayByZWxlYXNlcyB3aXRob3V0IGdyYW50aW5nIHRoZSB0d2VhayBhblxuICogdXBkYXRlL2luc3RhbGwgY2hhbm5lbC4gVXBkYXRlIGNoZWNrcyBhcmUgYWR2aXNvcnkgb25seS5cbiAqL1xuaW1wb3J0IHsgcmVhZGRpclN5bmMsIHN0YXRTeW5jLCByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHsgVHdlYWtNYW5pZmVzdCB9IGZyb20gXCJAY29kZXgtcGx1c3BsdXMvc2RrXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlzY292ZXJlZFR3ZWFrIHtcbiAgZGlyOiBzdHJpbmc7XG4gIGVudHJ5OiBzdHJpbmc7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xufVxuXG5jb25zdCBFTlRSWV9DQU5ESURBVEVTID0gW1wiaW5kZXguanNcIiwgXCJpbmRleC5janNcIiwgXCJpbmRleC5tanNcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXNjb3ZlclR3ZWFrcyh0d2Vha3NEaXI6IHN0cmluZyk6IERpc2NvdmVyZWRUd2Vha1tdIHtcbiAgaWYgKCFleGlzdHNTeW5jKHR3ZWFrc0RpcikpIHJldHVybiBbXTtcbiAgY29uc3Qgb3V0OiBEaXNjb3ZlcmVkVHdlYWtbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG5hbWUgb2YgcmVhZGRpclN5bmModHdlYWtzRGlyKSkge1xuICAgIGNvbnN0IGRpciA9IGpvaW4odHdlYWtzRGlyLCBuYW1lKTtcbiAgICBpZiAoIXN0YXRTeW5jKGRpcikuaXNEaXJlY3RvcnkoKSkgY29udGludWU7XG4gICAgY29uc3QgbWFuaWZlc3RQYXRoID0gam9pbihkaXIsIFwibWFuaWZlc3QuanNvblwiKTtcbiAgICBpZiAoIWV4aXN0c1N5bmMobWFuaWZlc3RQYXRoKSkgY29udGludWU7XG4gICAgbGV0IG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICAgIHRyeSB7XG4gICAgICBtYW5pZmVzdCA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKG1hbmlmZXN0UGF0aCwgXCJ1dGY4XCIpKSBhcyBUd2Vha01hbmlmZXN0O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghaXNWYWxpZE1hbmlmZXN0KG1hbmlmZXN0KSkgY29udGludWU7XG4gICAgY29uc3QgZW50cnkgPSByZXNvbHZlRW50cnkoZGlyLCBtYW5pZmVzdCk7XG4gICAgaWYgKCFlbnRyeSkgY29udGludWU7XG4gICAgb3V0LnB1c2goeyBkaXIsIGVudHJ5LCBtYW5pZmVzdCB9KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBpc1ZhbGlkTWFuaWZlc3QobTogVHdlYWtNYW5pZmVzdCk6IGJvb2xlYW4ge1xuICBpZiAoIW0uaWQgfHwgIW0ubmFtZSB8fCAhbS52ZXJzaW9uIHx8ICFtLmdpdGh1YlJlcG8pIHJldHVybiBmYWxzZTtcbiAgaWYgKCEvXlthLXpBLVowLTkuXy1dK1xcL1thLXpBLVowLTkuXy1dKyQvLnRlc3QobS5naXRodWJSZXBvKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAobS5zY29wZSAmJiAhW1wicmVuZGVyZXJcIiwgXCJtYWluXCIsIFwiYm90aFwiXS5pbmNsdWRlcyhtLnNjb3BlKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUVudHJ5KGRpcjogc3RyaW5nLCBtOiBUd2Vha01hbmlmZXN0KTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmIChtLm1haW4pIHtcbiAgICBjb25zdCBwID0gam9pbihkaXIsIG0ubWFpbik7XG4gICAgcmV0dXJuIGV4aXN0c1N5bmMocCkgPyBwIDogbnVsbDtcbiAgfVxuICBmb3IgKGNvbnN0IGMgb2YgRU5UUllfQ0FORElEQVRFUykge1xuICAgIGNvbnN0IHAgPSBqb2luKGRpciwgYyk7XG4gICAgaWYgKGV4aXN0c1N5bmMocCkpIHJldHVybiBwO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuIiwgIi8qKlxuICogRGlzay1iYWNrZWQga2V5L3ZhbHVlIHN0b3JhZ2UgZm9yIG1haW4tcHJvY2VzcyB0d2Vha3MuXG4gKlxuICogRWFjaCB0d2VhayBnZXRzIG9uZSBKU09OIGZpbGUgdW5kZXIgYDx1c2VyUm9vdD4vc3RvcmFnZS88aWQ+Lmpzb25gLlxuICogV3JpdGVzIGFyZSBkZWJvdW5jZWQgKDUwIG1zKSBhbmQgYXRvbWljICh3cml0ZSB0byA8ZmlsZT4udG1wIHRoZW4gcmVuYW1lKS5cbiAqIFJlYWRzIGFyZSBlYWdlciArIGNhY2hlZCBpbi1tZW1vcnk7IHdlIGxvYWQgb24gZmlyc3QgYWNjZXNzLlxuICovXG5pbXBvcnQge1xuICBleGlzdHNTeW5jLFxuICBta2RpclN5bmMsXG4gIHJlYWRGaWxlU3luYyxcbiAgcmVuYW1lU3luYyxcbiAgd3JpdGVGaWxlU3luYyxcbn0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlza1N0b3JhZ2Uge1xuICBnZXQ8VD4oa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZT86IFQpOiBUO1xuICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiB1bmtub3duKTogdm9pZDtcbiAgZGVsZXRlKGtleTogc3RyaW5nKTogdm9pZDtcbiAgYWxsKCk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBmbHVzaCgpOiB2b2lkO1xufVxuXG5jb25zdCBGTFVTSF9ERUxBWV9NUyA9IDUwO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlza1N0b3JhZ2Uocm9vdERpcjogc3RyaW5nLCBpZDogc3RyaW5nKTogRGlza1N0b3JhZ2Uge1xuICBjb25zdCBkaXIgPSBqb2luKHJvb3REaXIsIFwic3RvcmFnZVwiKTtcbiAgbWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGNvbnN0IGZpbGUgPSBqb2luKGRpciwgYCR7c2FuaXRpemUoaWQpfS5qc29uYCk7XG5cbiAgbGV0IGRhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGlmIChleGlzdHNTeW5jKGZpbGUpKSB7XG4gICAgdHJ5IHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhmaWxlLCBcInV0ZjhcIikpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gQ29ycnVwdCBmaWxlIFx1MjAxNCBzdGFydCBmcmVzaCwgYnV0IGRvbid0IGNsb2JiZXIgdGhlIG9yaWdpbmFsIHVudGlsIHdlXG4gICAgICAvLyBzdWNjZXNzZnVsbHkgd3JpdGUgYWdhaW4uIChNb3ZlIGl0IGFzaWRlIGZvciBmb3JlbnNpY3MuKVxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVuYW1lU3luYyhmaWxlLCBgJHtmaWxlfS5jb3JydXB0LSR7RGF0ZS5ub3coKX1gKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICAgIGRhdGEgPSB7fTtcbiAgICB9XG4gIH1cblxuICBsZXQgZGlydHkgPSBmYWxzZTtcbiAgbGV0IHRpbWVyOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0IHNjaGVkdWxlRmx1c2ggPSAoKSA9PiB7XG4gICAgZGlydHkgPSB0cnVlO1xuICAgIGlmICh0aW1lcikgcmV0dXJuO1xuICAgIHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aW1lciA9IG51bGw7XG4gICAgICBpZiAoZGlydHkpIGZsdXNoKCk7XG4gICAgfSwgRkxVU0hfREVMQVlfTVMpO1xuICB9O1xuXG4gIGNvbnN0IGZsdXNoID0gKCk6IHZvaWQgPT4ge1xuICAgIGlmICghZGlydHkpIHJldHVybjtcbiAgICBjb25zdCB0bXAgPSBgJHtmaWxlfS50bXBgO1xuICAgIHRyeSB7XG4gICAgICB3cml0ZUZpbGVTeW5jKHRtcCwgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMiksIFwidXRmOFwiKTtcbiAgICAgIHJlbmFtZVN5bmModG1wLCBmaWxlKTtcbiAgICAgIGRpcnR5ID0gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTGVhdmUgZGlydHk9dHJ1ZSBzbyBhIGZ1dHVyZSBmbHVzaCByZXRyaWVzLlxuICAgICAgY29uc29sZS5lcnJvcihcIltjb2RleC1wbHVzcGx1c10gc3RvcmFnZSBmbHVzaCBmYWlsZWQ6XCIsIGlkLCBlKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQ6IDxUPihrOiBzdHJpbmcsIGQ/OiBUKTogVCA9PlxuICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGRhdGEsIGspID8gKGRhdGFba10gYXMgVCkgOiAoZCBhcyBUKSxcbiAgICBzZXQoaywgdikge1xuICAgICAgZGF0YVtrXSA9IHY7XG4gICAgICBzY2hlZHVsZUZsdXNoKCk7XG4gICAgfSxcbiAgICBkZWxldGUoaykge1xuICAgICAgaWYgKGsgaW4gZGF0YSkge1xuICAgICAgICBkZWxldGUgZGF0YVtrXTtcbiAgICAgICAgc2NoZWR1bGVGbHVzaCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgYWxsOiAoKSA9PiAoeyAuLi5kYXRhIH0pLFxuICAgIGZsdXNoLFxuICB9O1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZShpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gVHdlYWsgaWRzIGFyZSBhdXRob3ItY29udHJvbGxlZDsgY2xhbXAgdG8gYSBzYWZlIGZpbGVuYW1lLlxuICByZXR1cm4gaWQucmVwbGFjZSgvW15hLXpBLVowLTkuX0AtXS9nLCBcIl9cIik7XG59XG4iLCAiaW1wb3J0IHsgZXhpc3RzU3luYywgbWtkaXJTeW5jLCByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgZGlybmFtZSwgaXNBYnNvbHV0ZSwgcmVzb2x2ZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHsgVHdlYWtNY3BTZXJ2ZXIgfSBmcm9tIFwiQGNvZGV4LXBsdXNwbHVzL3Nka1wiO1xuXG5leHBvcnQgY29uc3QgTUNQX01BTkFHRURfU1RBUlQgPSBcIiMgQkVHSU4gQ09ERVgrKyBNQU5BR0VEIE1DUCBTRVJWRVJTXCI7XG5leHBvcnQgY29uc3QgTUNQX01BTkFHRURfRU5EID0gXCIjIEVORCBDT0RFWCsrIE1BTkFHRUQgTUNQIFNFUlZFUlNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNY3BTeW5jVHdlYWsge1xuICBkaXI6IHN0cmluZztcbiAgbWFuaWZlc3Q6IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIG1jcD86IFR3ZWFrTWNwU2VydmVyO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0TWFuYWdlZE1jcEJsb2NrIHtcbiAgYmxvY2s6IHN0cmluZztcbiAgc2VydmVyTmFtZXM6IHN0cmluZ1tdO1xuICBza2lwcGVkU2VydmVyTmFtZXM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1hbmFnZWRNY3BTeW5jUmVzdWx0IGV4dGVuZHMgQnVpbHRNYW5hZ2VkTWNwQmxvY2sge1xuICBjaGFuZ2VkOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3luY01hbmFnZWRNY3BTZXJ2ZXJzKHtcbiAgY29uZmlnUGF0aCxcbiAgdHdlYWtzLFxufToge1xuICBjb25maWdQYXRoOiBzdHJpbmc7XG4gIHR3ZWFrczogTWNwU3luY1R3ZWFrW107XG59KTogTWFuYWdlZE1jcFN5bmNSZXN1bHQge1xuICBjb25zdCBjdXJyZW50ID0gZXhpc3RzU3luYyhjb25maWdQYXRoKSA/IHJlYWRGaWxlU3luYyhjb25maWdQYXRoLCBcInV0ZjhcIikgOiBcIlwiO1xuICBjb25zdCBidWlsdCA9IGJ1aWxkTWFuYWdlZE1jcEJsb2NrKHR3ZWFrcywgY3VycmVudCk7XG4gIGNvbnN0IG5leHQgPSBtZXJnZU1hbmFnZWRNY3BCbG9jayhjdXJyZW50LCBidWlsdC5ibG9jayk7XG5cbiAgaWYgKG5leHQgIT09IGN1cnJlbnQpIHtcbiAgICBta2RpclN5bmMoZGlybmFtZShjb25maWdQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgd3JpdGVGaWxlU3luYyhjb25maWdQYXRoLCBuZXh0LCBcInV0ZjhcIik7XG4gIH1cblxuICByZXR1cm4geyAuLi5idWlsdCwgY2hhbmdlZDogbmV4dCAhPT0gY3VycmVudCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYW5hZ2VkTWNwQmxvY2soXG4gIHR3ZWFrczogTWNwU3luY1R3ZWFrW10sXG4gIGV4aXN0aW5nVG9tbCA9IFwiXCIsXG4pOiBCdWlsdE1hbmFnZWRNY3BCbG9jayB7XG4gIGNvbnN0IG1hbnVhbFRvbWwgPSBzdHJpcE1hbmFnZWRNY3BCbG9jayhleGlzdGluZ1RvbWwpO1xuICBjb25zdCBtYW51YWxOYW1lcyA9IGZpbmRNY3BTZXJ2ZXJOYW1lcyhtYW51YWxUb21sKTtcbiAgY29uc3QgdXNlZE5hbWVzID0gbmV3IFNldChtYW51YWxOYW1lcyk7XG4gIGNvbnN0IHNlcnZlck5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBza2lwcGVkU2VydmVyTmFtZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG5cbiAgZm9yIChjb25zdCB0d2VhayBvZiB0d2Vha3MpIHtcbiAgICBjb25zdCBtY3AgPSBub3JtYWxpemVNY3BTZXJ2ZXIodHdlYWsubWFuaWZlc3QubWNwKTtcbiAgICBpZiAoIW1jcCkgY29udGludWU7XG5cbiAgICBjb25zdCBiYXNlTmFtZSA9IG1jcFNlcnZlck5hbWVGcm9tVHdlYWtJZCh0d2Vhay5tYW5pZmVzdC5pZCk7XG4gICAgaWYgKG1hbnVhbE5hbWVzLmhhcyhiYXNlTmFtZSkpIHtcbiAgICAgIHNraXBwZWRTZXJ2ZXJOYW1lcy5wdXNoKGJhc2VOYW1lKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlck5hbWUgPSByZXNlcnZlVW5pcXVlTmFtZShiYXNlTmFtZSwgdXNlZE5hbWVzKTtcbiAgICBzZXJ2ZXJOYW1lcy5wdXNoKHNlcnZlck5hbWUpO1xuICAgIGVudHJpZXMucHVzaChmb3JtYXRNY3BTZXJ2ZXIoc2VydmVyTmFtZSwgdHdlYWsuZGlyLCBtY3ApKTtcbiAgfVxuXG4gIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7IGJsb2NrOiBcIlwiLCBzZXJ2ZXJOYW1lcywgc2tpcHBlZFNlcnZlck5hbWVzIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGJsb2NrOiBbTUNQX01BTkFHRURfU1RBUlQsIC4uLmVudHJpZXMsIE1DUF9NQU5BR0VEX0VORF0uam9pbihcIlxcblwiKSxcbiAgICBzZXJ2ZXJOYW1lcyxcbiAgICBza2lwcGVkU2VydmVyTmFtZXMsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZU1hbmFnZWRNY3BCbG9jayhjdXJyZW50VG9tbDogc3RyaW5nLCBtYW5hZ2VkQmxvY2s6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghbWFuYWdlZEJsb2NrICYmICFjdXJyZW50VG9tbC5pbmNsdWRlcyhNQ1BfTUFOQUdFRF9TVEFSVCkpIHJldHVybiBjdXJyZW50VG9tbDtcbiAgY29uc3Qgc3RyaXBwZWQgPSBzdHJpcE1hbmFnZWRNY3BCbG9jayhjdXJyZW50VG9tbCkudHJpbUVuZCgpO1xuICBpZiAoIW1hbmFnZWRCbG9jaykgcmV0dXJuIHN0cmlwcGVkID8gYCR7c3RyaXBwZWR9XFxuYCA6IFwiXCI7XG4gIHJldHVybiBgJHtzdHJpcHBlZCA/IGAke3N0cmlwcGVkfVxcblxcbmAgOiBcIlwifSR7bWFuYWdlZEJsb2NrfVxcbmA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcE1hbmFnZWRNY3BCbG9jayh0b21sOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlZ0V4cChcbiAgICBgXFxcXG4/JHtlc2NhcGVSZWdFeHAoTUNQX01BTkFHRURfU1RBUlQpfVtcXFxcc1xcXFxTXSo/JHtlc2NhcGVSZWdFeHAoTUNQX01BTkFHRURfRU5EKX1cXFxcbj9gLFxuICAgIFwiZ1wiLFxuICApO1xuICByZXR1cm4gdG9tbC5yZXBsYWNlKHBhdHRlcm4sIFwiXFxuXCIpLnJlcGxhY2UoL1xcbnszLH0vZywgXCJcXG5cXG5cIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtY3BTZXJ2ZXJOYW1lRnJvbVR3ZWFrSWQoaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdpdGhvdXRQdWJsaXNoZXIgPSBpZC5yZXBsYWNlKC9eY29cXC5iZW5uZXR0XFwuLywgXCJcIik7XG4gIGNvbnN0IHNsdWcgPSB3aXRob3V0UHVibGlzaGVyXG4gICAgLnJlcGxhY2UoL1teYS16QS1aMC05Xy1dKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCBcIlwiKVxuICAgIC50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gc2x1ZyB8fCBcInR3ZWFrLW1jcFwiO1xufVxuXG5mdW5jdGlvbiBmaW5kTWNwU2VydmVyTmFtZXModG9tbDogc3RyaW5nKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBuYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCB0YWJsZVBhdHRlcm4gPSAvXlxccypcXFttY3Bfc2VydmVyc1xcLihbXlxcXVxcc10rKVxcXVxccyokL2dtO1xuICBsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgobWF0Y2ggPSB0YWJsZVBhdHRlcm4uZXhlYyh0b21sKSkgIT09IG51bGwpIHtcbiAgICBuYW1lcy5hZGQodW5xdW90ZVRvbWxLZXkobWF0Y2hbMV0gPz8gXCJcIikpO1xuICB9XG4gIHJldHVybiBuYW1lcztcbn1cblxuZnVuY3Rpb24gcmVzZXJ2ZVVuaXF1ZU5hbWUoYmFzZU5hbWU6IHN0cmluZywgdXNlZE5hbWVzOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB7XG4gIGlmICghdXNlZE5hbWVzLmhhcyhiYXNlTmFtZSkpIHtcbiAgICB1c2VkTmFtZXMuYWRkKGJhc2VOYW1lKTtcbiAgICByZXR1cm4gYmFzZU5hbWU7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDI7IDsgaSArPSAxKSB7XG4gICAgY29uc3QgY2FuZGlkYXRlID0gYCR7YmFzZU5hbWV9LSR7aX1gO1xuICAgIGlmICghdXNlZE5hbWVzLmhhcyhjYW5kaWRhdGUpKSB7XG4gICAgICB1c2VkTmFtZXMuYWRkKGNhbmRpZGF0ZSk7XG4gICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVNY3BTZXJ2ZXIodmFsdWU6IFR3ZWFrTWNwU2VydmVyIHwgdW5kZWZpbmVkKTogVHdlYWtNY3BTZXJ2ZXIgfCBudWxsIHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUuY29tbWFuZCAhPT0gXCJzdHJpbmdcIiB8fCB2YWx1ZS5jb21tYW5kLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gIGlmICh2YWx1ZS5hcmdzICE9PSB1bmRlZmluZWQgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUuYXJncykpIHJldHVybiBudWxsO1xuICBpZiAodmFsdWUuYXJncz8uc29tZSgoYXJnKSA9PiB0eXBlb2YgYXJnICE9PSBcInN0cmluZ1wiKSkgcmV0dXJuIG51bGw7XG4gIGlmICh2YWx1ZS5lbnYgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICghdmFsdWUuZW52IHx8IHR5cGVvZiB2YWx1ZS5lbnYgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZS5lbnYpKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoT2JqZWN0LnZhbHVlcyh2YWx1ZS5lbnYpLnNvbWUoKGVudlZhbHVlKSA9PiB0eXBlb2YgZW52VmFsdWUgIT09IFwic3RyaW5nXCIpKSByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1jcFNlcnZlcihzZXJ2ZXJOYW1lOiBzdHJpbmcsIHR3ZWFrRGlyOiBzdHJpbmcsIG1jcDogVHdlYWtNY3BTZXJ2ZXIpOiBzdHJpbmcge1xuICBjb25zdCBsaW5lcyA9IFtcbiAgICBgW21jcF9zZXJ2ZXJzLiR7Zm9ybWF0VG9tbEtleShzZXJ2ZXJOYW1lKX1dYCxcbiAgICBgY29tbWFuZCA9ICR7Zm9ybWF0VG9tbFN0cmluZyhyZXNvbHZlQ29tbWFuZCh0d2Vha0RpciwgbWNwLmNvbW1hbmQpKX1gLFxuICBdO1xuXG4gIGlmIChtY3AuYXJncyAmJiBtY3AuYXJncy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaChgYXJncyA9ICR7Zm9ybWF0VG9tbFN0cmluZ0FycmF5KG1jcC5hcmdzLm1hcCgoYXJnKSA9PiByZXNvbHZlQXJnKHR3ZWFrRGlyLCBhcmcpKSl9YCk7XG4gIH1cblxuICBpZiAobWNwLmVudiAmJiBPYmplY3Qua2V5cyhtY3AuZW52KS5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaChgZW52ID0gJHtmb3JtYXRUb21sSW5saW5lVGFibGUobWNwLmVudil9YCk7XG4gIH1cblxuICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmQodHdlYWtEaXI6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKGlzQWJzb2x1dGUoY29tbWFuZCkgfHwgIWxvb2tzTGlrZVJlbGF0aXZlUGF0aChjb21tYW5kKSkgcmV0dXJuIGNvbW1hbmQ7XG4gIHJldHVybiByZXNvbHZlKHR3ZWFrRGlyLCBjb21tYW5kKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFyZyh0d2Vha0Rpcjogc3RyaW5nLCBhcmc6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChpc0Fic29sdXRlKGFyZykgfHwgYXJnLnN0YXJ0c1dpdGgoXCItXCIpKSByZXR1cm4gYXJnO1xuICBjb25zdCBjYW5kaWRhdGUgPSByZXNvbHZlKHR3ZWFrRGlyLCBhcmcpO1xuICByZXR1cm4gZXhpc3RzU3luYyhjYW5kaWRhdGUpID8gY2FuZGlkYXRlIDogYXJnO1xufVxuXG5mdW5jdGlvbiBsb29rc0xpa2VSZWxhdGl2ZVBhdGgodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFsdWUuc3RhcnRzV2l0aChcIi4vXCIpIHx8IHZhbHVlLnN0YXJ0c1dpdGgoXCIuLi9cIikgfHwgdmFsdWUuaW5jbHVkZXMoXCIvXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sU3RyaW5nQXJyYXkodmFsdWVzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBgWyR7dmFsdWVzLm1hcChmb3JtYXRUb21sU3RyaW5nKS5qb2luKFwiLCBcIil9XWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRvbWxJbmxpbmVUYWJsZShyZWNvcmQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBzdHJpbmcge1xuICByZXR1cm4gYHsgJHtPYmplY3QuZW50cmllcyhyZWNvcmQpXG4gICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBgJHtmb3JtYXRUb21sS2V5KGtleSl9ID0gJHtmb3JtYXRUb21sU3RyaW5nKHZhbHVlKX1gKVxuICAgIC5qb2luKFwiLCBcIil9IH1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUb21sS2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIC9eW2EtekEtWjAtOV8tXSskLy50ZXN0KGtleSkgPyBrZXkgOiBmb3JtYXRUb21sU3RyaW5nKGtleSk7XG59XG5cbmZ1bmN0aW9uIHVucXVvdGVUb21sS2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFrZXkuc3RhcnRzV2l0aCgnXCInKSB8fCAha2V5LmVuZHNXaXRoKCdcIicpKSByZXR1cm4ga2V5O1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGtleSkgYXMgc3RyaW5nO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ga2V5O1xuICB9XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbn1cbiIsICJpbXBvcnQgeyBleGVjRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgaG9tZWRpciwgcGxhdGZvcm0gfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxudHlwZSBDaGVja1N0YXR1cyA9IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIG5hbWU6IHN0cmluZztcbiAgc3RhdHVzOiBDaGVja1N0YXR1cztcbiAgZGV0YWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2F0Y2hlckhlYWx0aCB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBzdGF0dXM6IENoZWNrU3RhdHVzO1xuICB0aXRsZTogc3RyaW5nO1xuICBzdW1tYXJ5OiBzdHJpbmc7XG4gIHdhdGNoZXI6IHN0cmluZztcbiAgY2hlY2tzOiBXYXRjaGVySGVhbHRoQ2hlY2tbXTtcbn1cblxuaW50ZXJmYWNlIEluc3RhbGxlclN0YXRlIHtcbiAgYXBwUm9vdD86IHN0cmluZztcbiAgdmVyc2lvbj86IHN0cmluZztcbiAgd2F0Y2hlcj86IFwibGF1bmNoZFwiIHwgXCJsb2dpbi1pdGVtXCIgfCBcInNjaGVkdWxlZC10YXNrXCIgfCBcInN5c3RlbWRcIiB8IFwibm9uZVwiO1xufVxuXG5pbnRlcmZhY2UgUnVudGltZUNvbmZpZyB7XG4gIGNvZGV4UGx1c1BsdXM/OiB7XG4gICAgYXV0b1VwZGF0ZT86IGJvb2xlYW47XG4gIH07XG59XG5cbmludGVyZmFjZSBTZWxmVXBkYXRlU3RhdGUge1xuICBzdGF0dXM/OiBcImNoZWNraW5nXCIgfCBcInVwLXRvLWRhdGVcIiB8IFwidXBkYXRlZFwiIHwgXCJmYWlsZWRcIiB8IFwiZGlzYWJsZWRcIjtcbiAgY29tcGxldGVkQXQ/OiBzdHJpbmc7XG4gIGNoZWNrZWRBdD86IHN0cmluZztcbiAgbGF0ZXN0VmVyc2lvbj86IHN0cmluZyB8IG51bGw7XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG5jb25zdCBMQVVOQ0hEX0xBQkVMID0gXCJjb20uY29kZXhwbHVzcGx1cy53YXRjaGVyXCI7XG5jb25zdCBXQVRDSEVSX0xPRyA9IGpvaW4oaG9tZWRpcigpLCBcIkxpYnJhcnlcIiwgXCJMb2dzXCIsIFwiY29kZXgtcGx1c3BsdXMtd2F0Y2hlci5sb2dcIik7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXYXRjaGVySGVhbHRoKHVzZXJSb290OiBzdHJpbmcpOiBXYXRjaGVySGVhbHRoIHtcbiAgY29uc3QgY2hlY2tzOiBXYXRjaGVySGVhbHRoQ2hlY2tbXSA9IFtdO1xuICBjb25zdCBzdGF0ZSA9IHJlYWRKc29uPEluc3RhbGxlclN0YXRlPihqb2luKHVzZXJSb290LCBcInN0YXRlLmpzb25cIikpO1xuICBjb25zdCBjb25maWcgPSByZWFkSnNvbjxSdW50aW1lQ29uZmlnPihqb2luKHVzZXJSb290LCBcImNvbmZpZy5qc29uXCIpKSA/PyB7fTtcbiAgY29uc3Qgc2VsZlVwZGF0ZSA9IHJlYWRKc29uPFNlbGZVcGRhdGVTdGF0ZT4oam9pbih1c2VyUm9vdCwgXCJzZWxmLXVwZGF0ZS1zdGF0ZS5qc29uXCIpKTtcblxuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJJbnN0YWxsIHN0YXRlXCIsXG4gICAgc3RhdHVzOiBzdGF0ZSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICBkZXRhaWw6IHN0YXRlID8gYENvZGV4KysgJHtzdGF0ZS52ZXJzaW9uID8/IFwiKHVua25vd24gdmVyc2lvbilcIn1gIDogXCJzdGF0ZS5qc29uIGlzIG1pc3NpbmdcIixcbiAgfSk7XG5cbiAgaWYgKCFzdGF0ZSkgcmV0dXJuIHN1bW1hcml6ZShcIm5vbmVcIiwgY2hlY2tzKTtcblxuICBjb25zdCBhdXRvVXBkYXRlID0gY29uZmlnLmNvZGV4UGx1c1BsdXM/LmF1dG9VcGRhdGUgIT09IGZhbHNlO1xuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJBdXRvbWF0aWMgcmVmcmVzaFwiLFxuICAgIHN0YXR1czogYXV0b1VwZGF0ZSA/IFwib2tcIiA6IFwid2FyblwiLFxuICAgIGRldGFpbDogYXV0b1VwZGF0ZSA/IFwiZW5hYmxlZFwiIDogXCJkaXNhYmxlZCBpbiBDb2RleCsrIGNvbmZpZ1wiLFxuICB9KTtcblxuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJXYXRjaGVyIGtpbmRcIixcbiAgICBzdGF0dXM6IHN0YXRlLndhdGNoZXIgJiYgc3RhdGUud2F0Y2hlciAhPT0gXCJub25lXCIgPyBcIm9rXCIgOiBcImVycm9yXCIsXG4gICAgZGV0YWlsOiBzdGF0ZS53YXRjaGVyID8/IFwibm9uZVwiLFxuICB9KTtcblxuICBpZiAoc2VsZlVwZGF0ZSkge1xuICAgIGNoZWNrcy5wdXNoKHNlbGZVcGRhdGVDaGVjayhzZWxmVXBkYXRlKSk7XG4gIH1cblxuICBjb25zdCBhcHBSb290ID0gc3RhdGUuYXBwUm9vdCA/PyBcIlwiO1xuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJDb2RleCBhcHBcIixcbiAgICBzdGF0dXM6IGFwcFJvb3QgJiYgZXhpc3RzU3luYyhhcHBSb290KSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICBkZXRhaWw6IGFwcFJvb3QgfHwgXCJtaXNzaW5nIGFwcFJvb3QgaW4gc3RhdGVcIixcbiAgfSk7XG5cbiAgc3dpdGNoIChwbGF0Zm9ybSgpKSB7XG4gICAgY2FzZSBcImRhcndpblwiOlxuICAgICAgY2hlY2tzLnB1c2goLi4uY2hlY2tMYXVuY2hkV2F0Y2hlcihhcHBSb290KSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwibGludXhcIjpcbiAgICAgIGNoZWNrcy5wdXNoKC4uLmNoZWNrU3lzdGVtZFdhdGNoZXIoYXBwUm9vdCkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcIndpbjMyXCI6XG4gICAgICBjaGVja3MucHVzaCguLi5jaGVja1NjaGVkdWxlZFRhc2tXYXRjaGVyKCkpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGNoZWNrcy5wdXNoKHtcbiAgICAgICAgbmFtZTogXCJQbGF0Zm9ybSB3YXRjaGVyXCIsXG4gICAgICAgIHN0YXR1czogXCJ3YXJuXCIsXG4gICAgICAgIGRldGFpbDogYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3BsYXRmb3JtKCl9YCxcbiAgICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHN1bW1hcml6ZShzdGF0ZS53YXRjaGVyID8/IFwibm9uZVwiLCBjaGVja3MpO1xufVxuXG5mdW5jdGlvbiBzZWxmVXBkYXRlQ2hlY2soc3RhdGU6IFNlbGZVcGRhdGVTdGF0ZSk6IFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIGNvbnN0IGF0ID0gc3RhdGUuY29tcGxldGVkQXQgPz8gc3RhdGUuY2hlY2tlZEF0ID8/IFwidW5rbm93biB0aW1lXCI7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwiZmFpbGVkXCIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogXCJsYXN0IENvZGV4KysgdXBkYXRlXCIsXG4gICAgICBzdGF0dXM6IFwid2FyblwiLFxuICAgICAgZGV0YWlsOiBzdGF0ZS5lcnJvciA/IGBmYWlsZWQgJHthdH06ICR7c3RhdGUuZXJyb3J9YCA6IGBmYWlsZWQgJHthdH1gLFxuICAgIH07XG4gIH1cbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gXCJkaXNhYmxlZFwiKSB7XG4gICAgcmV0dXJuIHsgbmFtZTogXCJsYXN0IENvZGV4KysgdXBkYXRlXCIsIHN0YXR1czogXCJ3YXJuXCIsIGRldGFpbDogYHNraXBwZWQgJHthdH06IGF1dG9tYXRpYyByZWZyZXNoIGRpc2FibGVkYCB9O1xuICB9XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwidXBkYXRlZFwiKSB7XG4gICAgcmV0dXJuIHsgbmFtZTogXCJsYXN0IENvZGV4KysgdXBkYXRlXCIsIHN0YXR1czogXCJva1wiLCBkZXRhaWw6IGB1cGRhdGVkICR7YXR9IHRvICR7c3RhdGUubGF0ZXN0VmVyc2lvbiA/PyBcIm5ldyByZWxlYXNlXCJ9YCB9O1xuICB9XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwidXAtdG8tZGF0ZVwiKSB7XG4gICAgcmV0dXJuIHsgbmFtZTogXCJsYXN0IENvZGV4KysgdXBkYXRlXCIsIHN0YXR1czogXCJva1wiLCBkZXRhaWw6IGB1cCB0byBkYXRlICR7YXR9YCB9O1xuICB9XG4gIHJldHVybiB7IG5hbWU6IFwibGFzdCBDb2RleCsrIHVwZGF0ZVwiLCBzdGF0dXM6IFwid2FyblwiLCBkZXRhaWw6IGBjaGVja2luZyBzaW5jZSAke2F0fWAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tMYXVuY2hkV2F0Y2hlcihhcHBSb290OiBzdHJpbmcpOiBXYXRjaGVySGVhbHRoQ2hlY2tbXSB7XG4gIGNvbnN0IGNoZWNrczogV2F0Y2hlckhlYWx0aENoZWNrW10gPSBbXTtcbiAgY29uc3QgcGxpc3RQYXRoID0gam9pbihob21lZGlyKCksIFwiTGlicmFyeVwiLCBcIkxhdW5jaEFnZW50c1wiLCBgJHtMQVVOQ0hEX0xBQkVMfS5wbGlzdGApO1xuICBjb25zdCBwbGlzdCA9IGV4aXN0c1N5bmMocGxpc3RQYXRoKSA/IHJlYWRGaWxlU2FmZShwbGlzdFBhdGgpIDogXCJcIjtcbiAgY29uc3QgYXNhclBhdGggPSBhcHBSb290ID8gam9pbihhcHBSb290LCBcIkNvbnRlbnRzXCIsIFwiUmVzb3VyY2VzXCIsIFwiYXBwLmFzYXJcIikgOiBcIlwiO1xuXG4gIGNoZWNrcy5wdXNoKHtcbiAgICBuYW1lOiBcImxhdW5jaGQgcGxpc3RcIixcbiAgICBzdGF0dXM6IHBsaXN0ID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgIGRldGFpbDogcGxpc3RQYXRoLFxuICB9KTtcblxuICBpZiAocGxpc3QpIHtcbiAgICBjaGVja3MucHVzaCh7XG4gICAgICBuYW1lOiBcImxhdW5jaGQgbGFiZWxcIixcbiAgICAgIHN0YXR1czogcGxpc3QuaW5jbHVkZXMoTEFVTkNIRF9MQUJFTCkgPyBcIm9rXCIgOiBcImVycm9yXCIsXG4gICAgICBkZXRhaWw6IExBVU5DSERfTEFCRUwsXG4gICAgfSk7XG4gICAgY2hlY2tzLnB1c2goe1xuICAgICAgbmFtZTogXCJsYXVuY2hkIHRyaWdnZXJcIixcbiAgICAgIHN0YXR1czogYXNhclBhdGggJiYgcGxpc3QuaW5jbHVkZXMoYXNhclBhdGgpID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgICAgZGV0YWlsOiBhc2FyUGF0aCB8fCBcIm1pc3NpbmcgYXBwUm9vdFwiLFxuICAgIH0pO1xuICAgIGNoZWNrcy5wdXNoKHtcbiAgICAgIG5hbWU6IFwid2F0Y2hlciBjb21tYW5kXCIsXG4gICAgICBzdGF0dXM6IHBsaXN0LmluY2x1ZGVzKFwiQ09ERVhfUExVU1BMVVNfV0FUQ0hFUj0xXCIpICYmIHBsaXN0LmluY2x1ZGVzKFwiIHVwZGF0ZSAtLXdhdGNoZXIgLS1xdWlldFwiKVxuICAgICAgICA/IFwib2tcIlxuICAgICAgICA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogY29tbWFuZFN1bW1hcnkocGxpc3QpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2xpUGF0aCA9IGV4dHJhY3RGaXJzdChwbGlzdCwgLycoW14nXSpwYWNrYWdlc1xcL2luc3RhbGxlclxcL2Rpc3RcXC9jbGlcXC5qcyknLyk7XG4gICAgaWYgKGNsaVBhdGgpIHtcbiAgICAgIGNoZWNrcy5wdXNoKHtcbiAgICAgICAgbmFtZTogXCJyZXBhaXIgQ0xJXCIsXG4gICAgICAgIHN0YXR1czogZXhpc3RzU3luYyhjbGlQYXRoKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgICAgZGV0YWlsOiBjbGlQYXRoLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbG9hZGVkID0gY29tbWFuZFN1Y2NlZWRzKFwibGF1bmNoY3RsXCIsIFtcImxpc3RcIiwgTEFVTkNIRF9MQUJFTF0pO1xuICBjaGVja3MucHVzaCh7XG4gICAgbmFtZTogXCJsYXVuY2hkIGxvYWRlZFwiLFxuICAgIHN0YXR1czogbG9hZGVkID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgIGRldGFpbDogbG9hZGVkID8gXCJzZXJ2aWNlIGlzIGxvYWRlZFwiIDogXCJsYXVuY2hjdGwgY2Fubm90IGZpbmQgdGhlIHdhdGNoZXJcIixcbiAgfSk7XG5cbiAgY2hlY2tzLnB1c2god2F0Y2hlckxvZ0NoZWNrKCkpO1xuICByZXR1cm4gY2hlY2tzO1xufVxuXG5mdW5jdGlvbiBjaGVja1N5c3RlbWRXYXRjaGVyKGFwcFJvb3Q6IHN0cmluZyk6IFdhdGNoZXJIZWFsdGhDaGVja1tdIHtcbiAgY29uc3QgZGlyID0gam9pbihob21lZGlyKCksIFwiLmNvbmZpZ1wiLCBcInN5c3RlbWRcIiwgXCJ1c2VyXCIpO1xuICBjb25zdCBzZXJ2aWNlID0gam9pbihkaXIsIFwiY29kZXgtcGx1c3BsdXMtd2F0Y2hlci5zZXJ2aWNlXCIpO1xuICBjb25zdCB0aW1lciA9IGpvaW4oZGlyLCBcImNvZGV4LXBsdXNwbHVzLXdhdGNoZXIudGltZXJcIik7XG4gIGNvbnN0IHBhdGhVbml0ID0gam9pbihkaXIsIFwiY29kZXgtcGx1c3BsdXMtd2F0Y2hlci5wYXRoXCIpO1xuICBjb25zdCBleHBlY3RlZFBhdGggPSBhcHBSb290ID8gam9pbihhcHBSb290LCBcInJlc291cmNlc1wiLCBcImFwcC5hc2FyXCIpIDogXCJcIjtcbiAgY29uc3QgcGF0aEJvZHkgPSBleGlzdHNTeW5jKHBhdGhVbml0KSA/IHJlYWRGaWxlU2FmZShwYXRoVW5pdCkgOiBcIlwiO1xuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgbmFtZTogXCJzeXN0ZW1kIHNlcnZpY2VcIixcbiAgICAgIHN0YXR1czogZXhpc3RzU3luYyhzZXJ2aWNlKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogc2VydmljZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6IFwic3lzdGVtZCB0aW1lclwiLFxuICAgICAgc3RhdHVzOiBleGlzdHNTeW5jKHRpbWVyKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogdGltZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiBcInN5c3RlbWQgcGF0aFwiLFxuICAgICAgc3RhdHVzOiBwYXRoQm9keSAmJiBleHBlY3RlZFBhdGggJiYgcGF0aEJvZHkuaW5jbHVkZXMoZXhwZWN0ZWRQYXRoKSA/IFwib2tcIiA6IFwiZXJyb3JcIixcbiAgICAgIGRldGFpbDogZXhwZWN0ZWRQYXRoIHx8IHBhdGhVbml0LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogXCJwYXRoIHVuaXQgYWN0aXZlXCIsXG4gICAgICBzdGF0dXM6IGNvbW1hbmRTdWNjZWVkcyhcInN5c3RlbWN0bFwiLCBbXCItLXVzZXJcIiwgXCJpcy1hY3RpdmVcIiwgXCItLXF1aWV0XCIsIFwiY29kZXgtcGx1c3BsdXMtd2F0Y2hlci5wYXRoXCJdKSA/IFwib2tcIiA6IFwid2FyblwiLFxuICAgICAgZGV0YWlsOiBcInN5c3RlbWN0bCAtLXVzZXIgaXMtYWN0aXZlIGNvZGV4LXBsdXNwbHVzLXdhdGNoZXIucGF0aFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogXCJ0aW1lciBhY3RpdmVcIixcbiAgICAgIHN0YXR1czogY29tbWFuZFN1Y2NlZWRzKFwic3lzdGVtY3RsXCIsIFtcIi0tdXNlclwiLCBcImlzLWFjdGl2ZVwiLCBcIi0tcXVpZXRcIiwgXCJjb2RleC1wbHVzcGx1cy13YXRjaGVyLnRpbWVyXCJdKSA/IFwib2tcIiA6IFwid2FyblwiLFxuICAgICAgZGV0YWlsOiBcInN5c3RlbWN0bCAtLXVzZXIgaXMtYWN0aXZlIGNvZGV4LXBsdXNwbHVzLXdhdGNoZXIudGltZXJcIixcbiAgICB9LFxuICBdO1xufVxuXG5mdW5jdGlvbiBjaGVja1NjaGVkdWxlZFRhc2tXYXRjaGVyKCk6IFdhdGNoZXJIZWFsdGhDaGVja1tdIHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBuYW1lOiBcImxvZ29uIHRhc2tcIixcbiAgICAgIHN0YXR1czogY29tbWFuZFN1Y2NlZWRzKFwic2NodGFza3MuZXhlXCIsIFtcIi9RdWVyeVwiLCBcIi9UTlwiLCBcImNvZGV4LXBsdXNwbHVzLXdhdGNoZXJcIl0pID8gXCJva1wiIDogXCJlcnJvclwiLFxuICAgICAgZGV0YWlsOiBcImNvZGV4LXBsdXNwbHVzLXdhdGNoZXJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6IFwiaG91cmx5IHRhc2tcIixcbiAgICAgIHN0YXR1czogY29tbWFuZFN1Y2NlZWRzKFwic2NodGFza3MuZXhlXCIsIFtcIi9RdWVyeVwiLCBcIi9UTlwiLCBcImNvZGV4LXBsdXNwbHVzLXdhdGNoZXItaG91cmx5XCJdKSA/IFwib2tcIiA6IFwid2FyblwiLFxuICAgICAgZGV0YWlsOiBcImNvZGV4LXBsdXNwbHVzLXdhdGNoZXItaG91cmx5XCIsXG4gICAgfSxcbiAgXTtcbn1cblxuZnVuY3Rpb24gd2F0Y2hlckxvZ0NoZWNrKCk6IFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIGlmICghZXhpc3RzU3luYyhXQVRDSEVSX0xPRykpIHtcbiAgICByZXR1cm4geyBuYW1lOiBcIndhdGNoZXIgbG9nXCIsIHN0YXR1czogXCJ3YXJuXCIsIGRldGFpbDogXCJubyB3YXRjaGVyIGxvZyB5ZXRcIiB9O1xuICB9XG4gIGNvbnN0IHRhaWwgPSByZWFkRmlsZVNhZmUoV0FUQ0hFUl9MT0cpLnNwbGl0KC9cXHI/XFxuLykuc2xpY2UoLTQwKS5qb2luKFwiXFxuXCIpO1xuICBjb25zdCBoYXNFcnJvciA9IC9cdTI3MTcgY29kZXgtcGx1c3BsdXMgZmFpbGVkfGNvZGV4LXBsdXNwbHVzIGZhaWxlZHxlcnJvcnxmYWlsZWQvaS50ZXN0KHRhaWwpO1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwid2F0Y2hlciBsb2dcIixcbiAgICBzdGF0dXM6IGhhc0Vycm9yID8gXCJ3YXJuXCIgOiBcIm9rXCIsXG4gICAgZGV0YWlsOiBoYXNFcnJvciA/IFwicmVjZW50IHdhdGNoZXIgbG9nIGNvbnRhaW5zIGFuIGVycm9yXCIgOiBXQVRDSEVSX0xPRyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc3VtbWFyaXplKHdhdGNoZXI6IHN0cmluZywgY2hlY2tzOiBXYXRjaGVySGVhbHRoQ2hlY2tbXSk6IFdhdGNoZXJIZWFsdGgge1xuICBjb25zdCBoYXNFcnJvciA9IGNoZWNrcy5zb21lKChjKSA9PiBjLnN0YXR1cyA9PT0gXCJlcnJvclwiKTtcbiAgY29uc3QgaGFzV2FybiA9IGNoZWNrcy5zb21lKChjKSA9PiBjLnN0YXR1cyA9PT0gXCJ3YXJuXCIpO1xuICBjb25zdCBzdGF0dXM6IENoZWNrU3RhdHVzID0gaGFzRXJyb3IgPyBcImVycm9yXCIgOiBoYXNXYXJuID8gXCJ3YXJuXCIgOiBcIm9rXCI7XG4gIGNvbnN0IGZhaWxlZCA9IGNoZWNrcy5maWx0ZXIoKGMpID0+IGMuc3RhdHVzID09PSBcImVycm9yXCIpLmxlbmd0aDtcbiAgY29uc3Qgd2FybmVkID0gY2hlY2tzLmZpbHRlcigoYykgPT4gYy5zdGF0dXMgPT09IFwid2FyblwiKS5sZW5ndGg7XG4gIGNvbnN0IHRpdGxlID1cbiAgICBzdGF0dXMgPT09IFwib2tcIlxuICAgICAgPyBcIkF1dG8tcmVwYWlyIHdhdGNoZXIgaXMgcmVhZHlcIlxuICAgICAgOiBzdGF0dXMgPT09IFwid2FyblwiXG4gICAgICAgID8gXCJBdXRvLXJlcGFpciB3YXRjaGVyIG5lZWRzIHJldmlld1wiXG4gICAgICAgIDogXCJBdXRvLXJlcGFpciB3YXRjaGVyIGlzIG5vdCByZWFkeVwiO1xuICBjb25zdCBzdW1tYXJ5ID1cbiAgICBzdGF0dXMgPT09IFwib2tcIlxuICAgICAgPyBcIkNvZGV4Kysgc2hvdWxkIGF1dG9tYXRpY2FsbHkgcmVwYWlyIGl0c2VsZiBhZnRlciBDb2RleCB1cGRhdGVzLlwiXG4gICAgICA6IGAke2ZhaWxlZH0gZmFpbGluZyBjaGVjayhzKSwgJHt3YXJuZWR9IHdhcm5pbmcocykuYDtcblxuICByZXR1cm4ge1xuICAgIGNoZWNrZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIHN0YXR1cyxcbiAgICB0aXRsZSxcbiAgICBzdW1tYXJ5LFxuICAgIHdhdGNoZXIsXG4gICAgY2hlY2tzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb21tYW5kU3VjY2VlZHMoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIGV4ZWNGaWxlU3luYyhjb21tYW5kLCBhcmdzLCB7IHN0ZGlvOiBcImlnbm9yZVwiLCB0aW1lb3V0OiA1XzAwMCB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1hbmRTdW1tYXJ5KHBsaXN0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBjb21tYW5kID0gZXh0cmFjdEZpcnN0KHBsaXN0LCAvPHN0cmluZz4oW148XSooPzp1cGRhdGUgLS13YXRjaGVyIC0tcXVpZXR8cmVwYWlyIC0tcXVpZXQpW148XSopPFxcL3N0cmluZz4vKTtcbiAgcmV0dXJuIGNvbW1hbmQgPyB1bmVzY2FwZVhtbChjb21tYW5kKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCkgOiBcIndhdGNoZXIgY29tbWFuZCBub3QgZm91bmRcIjtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEZpcnN0KHNvdXJjZTogc3RyaW5nLCBwYXR0ZXJuOiBSZWdFeHApOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIHNvdXJjZS5tYXRjaChwYXR0ZXJuKT8uWzFdID8/IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRKc29uPFQ+KHBhdGg6IHN0cmluZyk6IFQgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocGF0aCwgXCJ1dGY4XCIpKSBhcyBUO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkRmlsZVNhZmUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVhZEZpbGVTeW5jKHBhdGgsIFwidXRmOFwiKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW5lc2NhcGVYbWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mcXVvdDsvZywgXCJcXFwiXCIpXG4gICAgLnJlcGxhY2UoLyZhcG9zOy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJmx0Oy9nLCBcIjxcIilcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCBcIj5cIilcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpO1xufVxuIiwgImV4cG9ydCB0eXBlIFR3ZWFrU2NvcGUgPSBcInJlbmRlcmVyXCIgfCBcIm1haW5cIiB8IFwiYm90aFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbG9hZFR3ZWFrc0RlcHMge1xuICBsb2dJbmZvKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG4gIHN0b3BBbGxNYWluVHdlYWtzKCk6IHZvaWQ7XG4gIGNsZWFyVHdlYWtNb2R1bGVDYWNoZSgpOiB2b2lkO1xuICBsb2FkQWxsTWFpblR3ZWFrcygpOiB2b2lkO1xuICBicm9hZGNhc3RSZWxvYWQoKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTZXRUd2Vha0VuYWJsZWRBbmRSZWxvYWREZXBzIGV4dGVuZHMgUmVsb2FkVHdlYWtzRGVwcyB7XG4gIHNldFR3ZWFrRW5hYmxlZChpZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTWFpblByb2Nlc3NUd2Vha1Njb3BlKHNjb3BlOiBUd2Vha1Njb3BlIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gIHJldHVybiBzY29wZSAhPT0gXCJyZW5kZXJlclwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsb2FkVHdlYWtzKHJlYXNvbjogc3RyaW5nLCBkZXBzOiBSZWxvYWRUd2Vha3NEZXBzKTogdm9pZCB7XG4gIGRlcHMubG9nSW5mbyhgcmVsb2FkaW5nIHR3ZWFrcyAoJHtyZWFzb259KWApO1xuICBkZXBzLnN0b3BBbGxNYWluVHdlYWtzKCk7XG4gIGRlcHMuY2xlYXJUd2Vha01vZHVsZUNhY2hlKCk7XG4gIGRlcHMubG9hZEFsbE1haW5Ud2Vha3MoKTtcbiAgZGVwcy5icm9hZGNhc3RSZWxvYWQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFR3ZWFrRW5hYmxlZEFuZFJlbG9hZChcbiAgaWQ6IHN0cmluZyxcbiAgZW5hYmxlZDogdW5rbm93bixcbiAgZGVwczogU2V0VHdlYWtFbmFibGVkQW5kUmVsb2FkRGVwcyxcbik6IHRydWUge1xuICBjb25zdCBub3JtYWxpemVkRW5hYmxlZCA9ICEhZW5hYmxlZDtcbiAgZGVwcy5zZXRUd2Vha0VuYWJsZWQoaWQsIG5vcm1hbGl6ZWRFbmFibGVkKTtcbiAgZGVwcy5sb2dJbmZvKGB0d2VhayAke2lkfSBlbmFibGVkPSR7bm9ybWFsaXplZEVuYWJsZWR9YCk7XG4gIHJlbG9hZFR3ZWFrcyhcImVuYWJsZWQtdG9nZ2xlXCIsIGRlcHMpO1xuICByZXR1cm4gdHJ1ZTtcbn1cbiIsICJpbXBvcnQgeyBhcHBlbmRGaWxlU3luYywgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jLCBzdGF0U3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5cbmV4cG9ydCBjb25zdCBNQVhfTE9HX0JZVEVTID0gMTAgKiAxMDI0ICogMTAyNDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZENhcHBlZExvZyhwYXRoOiBzdHJpbmcsIGxpbmU6IHN0cmluZywgbWF4Qnl0ZXMgPSBNQVhfTE9HX0JZVEVTKTogdm9pZCB7XG4gIGNvbnN0IGluY29taW5nID0gQnVmZmVyLmZyb20obGluZSk7XG4gIGlmIChpbmNvbWluZy5ieXRlTGVuZ3RoID49IG1heEJ5dGVzKSB7XG4gICAgd3JpdGVGaWxlU3luYyhwYXRoLCBpbmNvbWluZy5zdWJhcnJheShpbmNvbWluZy5ieXRlTGVuZ3RoIC0gbWF4Qnl0ZXMpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChleGlzdHNTeW5jKHBhdGgpKSB7XG4gICAgICBjb25zdCBzaXplID0gc3RhdFN5bmMocGF0aCkuc2l6ZTtcbiAgICAgIGNvbnN0IGFsbG93ZWRFeGlzdGluZyA9IG1heEJ5dGVzIC0gaW5jb21pbmcuYnl0ZUxlbmd0aDtcbiAgICAgIGlmIChzaXplID4gYWxsb3dlZEV4aXN0aW5nKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gcmVhZEZpbGVTeW5jKHBhdGgpO1xuICAgICAgICB3cml0ZUZpbGVTeW5jKHBhdGgsIGV4aXN0aW5nLnN1YmFycmF5KE1hdGgubWF4KDAsIGV4aXN0aW5nLmJ5dGVMZW5ndGggLSBhbGxvd2VkRXhpc3RpbmcpKSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvLyBJZiB0cmltbWluZyBmYWlscywgc3RpbGwgdHJ5IHRvIGFwcGVuZCBiZWxvdzsgbG9nZ2luZyBtdXN0IGJlIGJlc3QtZWZmb3J0LlxuICB9XG5cbiAgYXBwZW5kRmlsZVN5bmMocGF0aCwgaW5jb21pbmcpO1xufVxuIiwgImltcG9ydCB0eXBlIHsgVHdlYWtNYW5pZmVzdCB9IGZyb20gXCJAY29kZXgtcGx1c3BsdXMvc2RrXCI7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1RXRUFLX1NUT1JFX0lOREVYX1VSTCA9XG4gIFwiaHR0cHM6Ly9iLW5uZXR0LmdpdGh1Yi5pby9jb2RleC1wbHVzcGx1cy9zdG9yZS9pbmRleC5qc29uXCI7XG5leHBvcnQgY29uc3QgVFdFQUtfU1RPUkVfUkVWSUVXX0lTU1VFX1VSTCA9XG4gIFwiaHR0cHM6Ly9naXRodWIuY29tL2Itbm5ldHQvY29kZXgtcGx1c3BsdXMvaXNzdWVzL25ld1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVSZWdpc3RyeSB7XG4gIHNjaGVtYVZlcnNpb246IDE7XG4gIGdlbmVyYXRlZEF0Pzogc3RyaW5nO1xuICBlbnRyaWVzOiBUd2Vha1N0b3JlRW50cnlbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUd2Vha1N0b3JlRW50cnkge1xuICBpZDogc3RyaW5nO1xuICBtYW5pZmVzdDogVHdlYWtNYW5pZmVzdDtcbiAgcmVwbzogc3RyaW5nO1xuICBhcHByb3ZlZENvbW1pdFNoYTogc3RyaW5nO1xuICBhcHByb3ZlZEF0OiBzdHJpbmc7XG4gIGFwcHJvdmVkQnk6IHN0cmluZztcbiAgcGxhdGZvcm1zPzogVHdlYWtTdG9yZVBsYXRmb3JtW107XG4gIHJlbGVhc2VVcmw/OiBzdHJpbmc7XG4gIHJldmlld1VybD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHdlYWtTdG9yZVBsYXRmb3JtID0gXCJkYXJ3aW5cIiB8IFwid2luMzJcIiB8IFwibGludXhcIjtcblxuZXhwb3J0IGludGVyZmFjZSBUd2Vha1N0b3JlUHVibGlzaFN1Ym1pc3Npb24ge1xuICByZXBvOiBzdHJpbmc7XG4gIGRlZmF1bHRCcmFuY2g6IHN0cmluZztcbiAgY29tbWl0U2hhOiBzdHJpbmc7XG4gIGNvbW1pdFVybDogc3RyaW5nO1xuICBtYW5pZmVzdD86IHtcbiAgICBpZD86IHN0cmluZztcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHZlcnNpb24/OiBzdHJpbmc7XG4gICAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gICAgaWNvblVybD86IHN0cmluZztcbiAgfTtcbn1cblxuY29uc3QgR0lUSFVCX1JFUE9fUkUgPSAvXltBLVphLXowLTlfLi1dK1xcL1tBLVphLXowLTlfLi1dKyQvO1xuY29uc3QgRlVMTF9TSEFfUkUgPSAvXlthLWYwLTldezQwfSQvaTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUdpdEh1YlJlcG8oaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHJhdyA9IGlucHV0LnRyaW0oKTtcbiAgaWYgKCFyYXcpIHRocm93IG5ldyBFcnJvcihcIkdpdEh1YiByZXBvIGlzIHJlcXVpcmVkXCIpO1xuXG4gIGNvbnN0IHNzaCA9IC9eZ2l0QGdpdGh1YlxcLmNvbTooW14vXStcXC9bXi9dKz8pKD86XFwuZ2l0KT8kL2kuZXhlYyhyYXcpO1xuICBpZiAoc3NoKSByZXR1cm4gbm9ybWFsaXplUmVwb1BhcnQoc3NoWzFdKTtcblxuICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChyYXcpKSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChyYXcpO1xuICAgIGlmICh1cmwuaG9zdG5hbWUgIT09IFwiZ2l0aHViLmNvbVwiKSB0aHJvdyBuZXcgRXJyb3IoXCJPbmx5IGdpdGh1Yi5jb20gcmVwb3NpdG9yaWVzIGFyZSBzdXBwb3J0ZWRcIik7XG4gICAgY29uc3QgcGFydHMgPSB1cmwucGF0aG5hbWUucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgXCJcIikuc3BsaXQoXCIvXCIpO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPCAyKSB0aHJvdyBuZXcgRXJyb3IoXCJHaXRIdWIgcmVwbyBVUkwgbXVzdCBpbmNsdWRlIG93bmVyIGFuZCByZXBvc2l0b3J5XCIpO1xuICAgIHJldHVybiBub3JtYWxpemVSZXBvUGFydChgJHtwYXJ0c1swXX0vJHtwYXJ0c1sxXX1gKTtcbiAgfVxuXG4gIHJldHVybiBub3JtYWxpemVSZXBvUGFydChyYXcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU3RvcmVSZWdpc3RyeShpbnB1dDogdW5rbm93bik6IFR3ZWFrU3RvcmVSZWdpc3RyeSB7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gaW5wdXQgYXMgUGFydGlhbDxUd2Vha1N0b3JlUmVnaXN0cnk+IHwgbnVsbDtcbiAgaWYgKCFyZWdpc3RyeSB8fCByZWdpc3RyeS5zY2hlbWFWZXJzaW9uICE9PSAxIHx8ICFBcnJheS5pc0FycmF5KHJlZ2lzdHJ5LmVudHJpZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgdHdlYWsgc3RvcmUgcmVnaXN0cnlcIik7XG4gIH1cbiAgY29uc3QgZW50cmllcyA9IHJlZ2lzdHJ5LmVudHJpZXMubWFwKG5vcm1hbGl6ZVN0b3JlRW50cnkpO1xuICBlbnRyaWVzLnNvcnQoKGEsIGIpID0+IGEubWFuaWZlc3QubmFtZS5sb2NhbGVDb21wYXJlKGIubWFuaWZlc3QubmFtZSkpO1xuICByZXR1cm4ge1xuICAgIHNjaGVtYVZlcnNpb246IDEsXG4gICAgZ2VuZXJhdGVkQXQ6IHR5cGVvZiByZWdpc3RyeS5nZW5lcmF0ZWRBdCA9PT0gXCJzdHJpbmdcIiA/IHJlZ2lzdHJ5LmdlbmVyYXRlZEF0IDogdW5kZWZpbmVkLFxuICAgIGVudHJpZXMsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTdG9yZUVudHJ5KGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZUVudHJ5IHtcbiAgY29uc3QgZW50cnkgPSBpbnB1dCBhcyBQYXJ0aWFsPFR3ZWFrU3RvcmVFbnRyeT4gfCBudWxsO1xuICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0d2VhayBzdG9yZSBlbnRyeVwiKTtcbiAgY29uc3QgcmVwbyA9IG5vcm1hbGl6ZUdpdEh1YlJlcG8oU3RyaW5nKGVudHJ5LnJlcG8gPz8gZW50cnkubWFuaWZlc3Q/LmdpdGh1YlJlcG8gPz8gXCJcIikpO1xuICBjb25zdCBtYW5pZmVzdCA9IGVudHJ5Lm1hbmlmZXN0IGFzIFR3ZWFrTWFuaWZlc3QgfCB1bmRlZmluZWQ7XG4gIGlmICghbWFuaWZlc3Q/LmlkIHx8ICFtYW5pZmVzdC5uYW1lIHx8ICFtYW5pZmVzdC52ZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSBmb3IgJHtyZXBvfSBpcyBtaXNzaW5nIG1hbmlmZXN0IGZpZWxkc2ApO1xuICB9XG4gIGlmIChub3JtYWxpemVHaXRIdWJSZXBvKG1hbmlmZXN0LmdpdGh1YlJlcG8pICE9PSByZXBvKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSAke21hbmlmZXN0LmlkfSByZXBvIGRvZXMgbm90IG1hdGNoIG1hbmlmZXN0IGdpdGh1YlJlcG9gKTtcbiAgfVxuICBpZiAoIWlzRnVsbENvbW1pdFNoYShTdHJpbmcoZW50cnkuYXBwcm92ZWRDb21taXRTaGEgPz8gXCJcIikpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSAke21hbmlmZXN0LmlkfSBtdXN0IHBpbiBhIGZ1bGwgYXBwcm92ZWQgY29tbWl0IFNIQWApO1xuICB9XG4gIHJldHVybiB7XG4gICAgaWQ6IG1hbmlmZXN0LmlkLFxuICAgIG1hbmlmZXN0LFxuICAgIHJlcG8sXG4gICAgYXBwcm92ZWRDb21taXRTaGE6IFN0cmluZyhlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSksXG4gICAgYXBwcm92ZWRBdDogdHlwZW9mIGVudHJ5LmFwcHJvdmVkQXQgPT09IFwic3RyaW5nXCIgPyBlbnRyeS5hcHByb3ZlZEF0IDogXCJcIixcbiAgICBhcHByb3ZlZEJ5OiB0eXBlb2YgZW50cnkuYXBwcm92ZWRCeSA9PT0gXCJzdHJpbmdcIiA/IGVudHJ5LmFwcHJvdmVkQnkgOiBcIlwiLFxuICAgIHBsYXRmb3Jtczogbm9ybWFsaXplU3RvcmVQbGF0Zm9ybXMoKGVudHJ5IGFzIHsgcGxhdGZvcm1zPzogdW5rbm93biB9KS5wbGF0Zm9ybXMpLFxuICAgIHJlbGVhc2VVcmw6IG9wdGlvbmFsR2l0aHViVXJsKGVudHJ5LnJlbGVhc2VVcmwpLFxuICAgIHJldmlld1VybDogb3B0aW9uYWxHaXRodWJVcmwoZW50cnkucmV2aWV3VXJsKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0b3JlQXJjaGl2ZVVybChlbnRyeTogVHdlYWtTdG9yZUVudHJ5KTogc3RyaW5nIHtcbiAgaWYgKCFpc0Z1bGxDb21taXRTaGEoZW50cnkuYXBwcm92ZWRDb21taXRTaGEpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSAke2VudHJ5LmlkfSBpcyBub3QgcGlubmVkIHRvIGEgZnVsbCBjb21taXQgU0hBYCk7XG4gIH1cbiAgcmV0dXJuIGBodHRwczovL2NvZGVsb2FkLmdpdGh1Yi5jb20vJHtlbnRyeS5yZXBvfS90YXIuZ3ovJHtlbnRyeS5hcHByb3ZlZENvbW1pdFNoYX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRUd2Vha1B1Ymxpc2hJc3N1ZVVybChzdWJtaXNzaW9uOiBUd2Vha1N0b3JlUHVibGlzaFN1Ym1pc3Npb24pOiBzdHJpbmcge1xuICBjb25zdCByZXBvID0gbm9ybWFsaXplR2l0SHViUmVwbyhzdWJtaXNzaW9uLnJlcG8pO1xuICBpZiAoIWlzRnVsbENvbW1pdFNoYShzdWJtaXNzaW9uLmNvbW1pdFNoYSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTdWJtaXNzaW9uIG11c3QgaW5jbHVkZSB0aGUgZnVsbCBjb21taXQgU0hBIHRvIHJldmlld1wiKTtcbiAgfVxuICBjb25zdCB0aXRsZSA9IGBUd2VhayBzdG9yZSByZXZpZXc6ICR7cmVwb31gO1xuICBjb25zdCBib2R5ID0gW1xuICAgIFwiIyMgVHdlYWsgcmVwb1wiLFxuICAgIGBodHRwczovL2dpdGh1Yi5jb20vJHtyZXBvfWAsXG4gICAgXCJcIixcbiAgICBcIiMjIENvbW1pdCB0byByZXZpZXdcIixcbiAgICBzdWJtaXNzaW9uLmNvbW1pdFNoYSxcbiAgICBzdWJtaXNzaW9uLmNvbW1pdFVybCxcbiAgICBcIlwiLFxuICAgIFwiRG8gbm90IGFwcHJvdmUgYSBkaWZmZXJlbnQgY29tbWl0LiBJZiB0aGUgYXV0aG9yIHB1c2hlcyBjaGFuZ2VzLCBhc2sgdGhlbSB0byByZXN1Ym1pdC5cIixcbiAgICBcIlwiLFxuICAgIFwiIyMgTWFuaWZlc3RcIixcbiAgICBgLSBpZDogJHtzdWJtaXNzaW9uLm1hbmlmZXN0Py5pZCA/PyBcIihub3QgZGV0ZWN0ZWQpXCJ9YCxcbiAgICBgLSBuYW1lOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/Lm5hbWUgPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gdmVyc2lvbjogJHtzdWJtaXNzaW9uLm1hbmlmZXN0Py52ZXJzaW9uID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIGAtIGRlc2NyaXB0aW9uOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LmRlc2NyaXB0aW9uID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIGAtIGljb25Vcmw6ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8uaWNvblVybCA/PyBcIihub3QgZGV0ZWN0ZWQpXCJ9YCxcbiAgICBcIlwiLFxuICAgIFwiIyMgQWRtaW4gY2hlY2tsaXN0XCIsXG4gICAgXCItIFsgXSBtYW5pZmVzdC5qc29uIGlzIHZhbGlkXCIsXG4gICAgXCItIFsgXSBtYW5pZmVzdC5pY29uVXJsIGlzIHVzYWJsZSBhcyB0aGUgc3RvcmUgaWNvblwiLFxuICAgIFwiLSBbIF0gc291cmNlIHdhcyByZXZpZXdlZCBhdCB0aGUgZXhhY3QgY29tbWl0IGFib3ZlXCIsXG4gICAgXCItIFsgXSBgc3RvcmUvaW5kZXguanNvbmAgZW50cnkgcGlucyBgYXBwcm92ZWRDb21taXRTaGFgIHRvIHRoZSBleGFjdCBjb21taXQgYWJvdmVcIixcbiAgXS5qb2luKFwiXFxuXCIpO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKFRXRUFLX1NUT1JFX1JFVklFV19JU1NVRV9VUkwpO1xuICB1cmwuc2VhcmNoUGFyYW1zLnNldChcInRlbXBsYXRlXCIsIFwidHdlYWstc3RvcmUtcmV2aWV3Lm1kXCIpO1xuICB1cmwuc2VhcmNoUGFyYW1zLnNldChcInRpdGxlXCIsIHRpdGxlKTtcbiAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJib2R5XCIsIGJvZHkpO1xuICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Z1bGxDb21taXRTaGEodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gRlVMTF9TSEFfUkUudGVzdCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVJlcG9QYXJ0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCByZXBvID0gdmFsdWUudHJpbSgpLnJlcGxhY2UoL1xcLmdpdCQvaSwgXCJcIikucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgXCJcIik7XG4gIGlmICghR0lUSFVCX1JFUE9fUkUudGVzdChyZXBvKSkgdGhyb3cgbmV3IEVycm9yKFwiR2l0SHViIHJlcG8gbXVzdCBiZSBpbiBvd25lci9yZXBvIGZvcm1cIik7XG4gIHJldHVybiByZXBvO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVTdG9yZVBsYXRmb3JtcyhpbnB1dDogdW5rbm93bik6IFR3ZWFrU3RvcmVQbGF0Zm9ybVtdIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGlucHV0ID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWQ7XG4gIGlmICghQXJyYXkuaXNBcnJheShpbnB1dCkpIHRocm93IG5ldyBFcnJvcihcIlN0b3JlIGVudHJ5IHBsYXRmb3JtcyBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICBjb25zdCBhbGxvd2VkID0gbmV3IFNldDxUd2Vha1N0b3JlUGxhdGZvcm0+KFtcImRhcndpblwiLCBcIndpbjMyXCIsIFwibGludXhcIl0pO1xuICBjb25zdCBwbGF0Zm9ybXMgPSBBcnJheS5mcm9tKG5ldyBTZXQoaW5wdXQubWFwKCh2YWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIgfHwgIWFsbG93ZWQuaGFzKHZhbHVlIGFzIFR3ZWFrU3RvcmVQbGF0Zm9ybSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgc3RvcmUgcGxhdGZvcm06ICR7U3RyaW5nKHZhbHVlKX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlIGFzIFR3ZWFrU3RvcmVQbGF0Zm9ybTtcbiAgfSkpKTtcbiAgcmV0dXJuIHBsYXRmb3Jtcy5sZW5ndGggPiAwID8gcGxhdGZvcm1zIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBvcHRpb25hbEdpdGh1YlVybCh2YWx1ZTogdW5rbm93bik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIgfHwgIXZhbHVlLnRyaW0oKSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgdXJsID0gbmV3IFVSTCh2YWx1ZSk7XG4gIGlmICh1cmwucHJvdG9jb2wgIT09IFwiaHR0cHM6XCIgfHwgdXJsLmhvc3RuYW1lICE9PSBcImdpdGh1Yi5jb21cIikgcmV0dXJuIHVuZGVmaW5lZDtcbiAgcmV0dXJuIHVybC50b1N0cmluZygpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLHNCQUFpRztBQUNqRyxJQUFBQSxrQkFBdUg7QUFDdkgsSUFBQUMsNkJBQStDO0FBQy9DLHlCQUEyQjtBQUMzQixJQUFBQyxvQkFBNkQ7QUFDN0QsSUFBQUMsa0JBQWdDOzs7QUNiaEMsSUFBQUMsYUFBK0I7QUFDL0IsSUFBQUMsbUJBQThCO0FBQzlCLG9CQUE2QjtBQUM3QixJQUFBQyxXQUF5Qjs7O0FDSnpCLHNCQUErQztBQUMvQyx5QkFBeUI7QUFDekIsdUJBQXVGO0FBQ2hGLElBQU0sYUFBYTtBQUFBLEVBQ3RCLFdBQVc7QUFBQSxFQUNYLFVBQVU7QUFBQSxFQUNWLGVBQWU7QUFBQSxFQUNmLGlCQUFpQjtBQUNyQjtBQUNBLElBQU0saUJBQWlCO0FBQUEsRUFDbkIsTUFBTTtBQUFBLEVBQ04sWUFBWSxDQUFDLGVBQWU7QUFBQSxFQUM1QixpQkFBaUIsQ0FBQyxlQUFlO0FBQUEsRUFDakMsTUFBTSxXQUFXO0FBQUEsRUFDakIsT0FBTztBQUFBLEVBQ1AsT0FBTztBQUFBLEVBQ1AsWUFBWTtBQUFBLEVBQ1osZUFBZTtBQUNuQjtBQUNBLE9BQU8sT0FBTyxjQUFjO0FB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QUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFTO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUN2RjtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFPO0FBQUEsRUFDckY7QUFBQSxFQUFTO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUN2QjtBQUFBLEVBQWE7QUFBQSxFQUFhO0FBQUEsRUFBYTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUNwRTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUMxRTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTztBQUFBLEVBQVc7QUFBQSxFQUFNO0FBQUEsRUFDcEM7QUFBQSxFQUFRO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQzVEO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ25EO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFDMUM7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUNyRjtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUztBQUFBLEVBQ3hCO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUN0QztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBVztBQUFBLEVBQ3pCO0FBQUEsRUFBSztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUN0RDtBQUFBLEVBQVM7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDL0U7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQ2Y7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ2pGO0FBQUEsRUFDQTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQWE7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDcEY7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBVTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQ25GO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDckI7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVB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TUFBTSxTQUFTLElBQUksS0FBSyxNQUFNLFNBQVMsSUFBSSxHQUFHO0FBQ3pFLFVBQU0sSUFBSSxNQUFNLCtEQUErRDtBQUFBLEVBQ2pGO0FBQ0EsU0FBTztBQUNUOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9jaGlsZF9wcm9jZXNzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfb3MiLCAiaW1wb3J0X2ZzIiwgImltcG9ydF9wcm9taXNlcyIsICJzeXNQYXRoIiwgInByZXNvbHZlIiwgImJhc2VuYW1lIiwgInBqb2luIiwgInByZWxhdGl2ZSIsICJwc2VwIiwgImltcG9ydF9wcm9taXNlcyIsICJvc1R5cGUiLCAiZnNfd2F0Y2giLCAicmF3RW1pdHRlciIsICJsaXN0ZW5lciIsICJiYXNlbmFtZSIsICJkaXJuYW1lIiwgIm5ld1N0YXRzIiwgImNsb3NlciIsICJmc3JlYWxwYXRoIiwgInJlc29sdmUiLCAicmVhbHBhdGgiLCAic3RhdHMiLCAicmVsYXRpdmUiLCAiRE9VQkxFX1NMQVNIX1JFIiwgInRlc3RTdHJpbmciLCAicGF0aCIsICJzdGF0cyIsICJzdGF0Y2IiLCAibm93IiwgInN0YXQiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJ1c2VyUm9vdCIsICJpbXBvcnRfbm9kZV9mcyIsICJleHBvcnRzIiwgInBsYXRmb3JtIiwgInN0YXQiXQp9Cg==
