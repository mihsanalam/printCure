import { createRoot } from 'react-dom/client';
import Provider from '@hi-ui/provider';
import AdminApp from './AdminApp.jsx';
import '../styles/base.css';

createRoot(document.getElementById('root')).render(
  <Provider accentColor="brandblue">
    <AdminApp />
  </Provider>
);
