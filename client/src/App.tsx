import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import NavigationMenu from './components/NavigationMenu';
import Workspace from './components/Workspace';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <main id="main-content">
          <Routes>
            <Route path="/" element={<NavigationMenu />} />
            <Route path="/trees/:treeId" element={<Workspace />} />
          </Routes>
        </main>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
