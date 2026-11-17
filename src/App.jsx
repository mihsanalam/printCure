import { useState } from 'react';
import {
  getAppInfo,
  isDesktop,
  notify,
  platformLabel,
} from './services/system/index.js';

export default function App() {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('');

  async function handleNotification() {
    setStatus('');
    const result = await notify('PrintCure', 'Hello from your PrintCure app!');
    setStatus(
      result?.ok
        ? 'Notification sent.'
        : `Could not send notification: ${result?.reason ?? 'unknown reason'}`
    );
  }

  async function handleInfo() {
    setStatus('');
    try {
      setInfo(await getAppInfo());
    } catch (error) {
      setStatus(`Could not read app info: ${error.message}`);
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <p className={`badge ${isDesktop ? 'badge--desktop' : 'badge--web'}`}>
          {platformLabel}
        </p>

        <h1>PrintCure</h1>

        <p className="lead">
          One app, two targets. This same code runs in the browser and inside
          the Windows desktop shell.
        </p>

        <div className="actions">
          <button type="button" onClick={handleNotification}>
            Send test notification
          </button>
          <button type="button" className="secondary" onClick={handleInfo}>
            Show environment info
          </button>
        </div>

        {status && <p className="status">{status}</p>}

        {info && <pre className="info">{JSON.stringify(info, null, 2)}</pre>}
      </section>

      <footer className="footer">
        Printing made simple &middot; Version 0.1.0
      </footer>
    </main>
  );
}
