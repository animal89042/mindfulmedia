import { MantineProvider } from '@mantine/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import ThemeProvider from "./app/Theme";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </MantineProvider>
);