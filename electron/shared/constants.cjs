// IPC channel names shared by the main process and (via copy) the preload.
module.exports = {
  IPC: {
    APP_INFO: 'app:info',
    NOTIFY: 'system:notify',
  },
};
