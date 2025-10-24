import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import './renderer/styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
