import { createRoot } from 'react-dom/client';
import Provider from '@hi-ui/provider';
import DesktopApp from './DesktopApp.jsx';
import '../styles/base.css';

createRoot(document.getElementById('root')).render(
  <Provider accentColor="brandblue">
    <DesktopApp />
  </Provider>
);
