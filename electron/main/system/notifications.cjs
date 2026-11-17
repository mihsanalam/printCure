const { Notification } = require('electron');

function showNotification({ title, body } = {}) {
  if (!Notification.isSupported()) {
    return { ok: false, reason: 'Notifications are not supported on this system' };
  }

  new Notification({
    title: title || 'PrintCure',
    body: body || '',
  }).show();

  return { ok: true };
}

module.exports = { showNotification };
