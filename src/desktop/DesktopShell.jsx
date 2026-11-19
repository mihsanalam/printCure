import TitleBar from './TitleBar.jsx';

export default function DesktopShell({ children }) {
  return (
    <div className="desktop-shell">
      <TitleBar />
      <main className="desktop-scroll">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
