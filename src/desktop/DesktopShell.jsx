import TitleBar from './TitleBar.jsx';

export default function DesktopShell({ children, title, showOwnerButton }) {
  return (
    <div className="desktop-shell">
      <TitleBar label={title} showOwnerButton={showOwnerButton} />
      <main className="desktop-scroll">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
