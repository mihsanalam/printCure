import { createRoot } from 'react-dom/client';
import Provider from '@hi-ui/provider';
import WebApp from './WebApp.jsx';
import '../styles/base.css';

createRoot(document.getElementById('root')).render(
  <Provider accentColor="brandblue">
    <WebApp />
  </Provider>
);
