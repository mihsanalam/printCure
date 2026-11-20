// IPC channel names shared by the main process (the preload inlines the same strings).
module.exports = {
  IPC: {
    SESSION_INFO: 'session:info',
    PRINT_FILE: 'print:file',
    PRINTERS_LIST: 'printers:list',
    PRINTER_GET: 'printer:get',
    PRINTER_SET: 'printer:set',
    FILE_OPEN: 'file:open',
    WINDOW_MINIMIZE: 'win:minimize',
    WINDOW_MAXIMIZE: 'win:maximize',
    WINDOW_CLOSE: 'win:close',
    WINDOW_IS_MAXIMIZED: 'win:is-maximized',
    PRICING_GET: 'pricing:get',
    PRICING_SET: 'pricing:set',
    ADMIN_HAS_PIN: 'admin:has-pin',
    ADMIN_UNLOCK: 'admin:unlock',
    ADMIN_SET_PIN: 'admin:set-pin',
    ADMIN_OPEN: 'admin:open',
  },
};
