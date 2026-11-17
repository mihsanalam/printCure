// IPC channel names shared by the main process (the preload inlines the same strings).
module.exports = {
  IPC: {
    SESSION_INFO: 'session:info',
    PRINT_FILE: 'print:file',
    PRINTERS_LIST: 'printers:list',
    PRINTER_GET: 'printer:get',
    PRINTER_SET: 'printer:set',
    FILE_OPEN: 'file:open',
  },
};
