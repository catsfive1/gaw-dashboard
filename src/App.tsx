import { Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { LeadGuard } from './components/LeadGuard';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Placeholder } from './pages/Placeholder';
import { Home } from './pages/Home';
import { Features } from './pages/Features';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/audit" element={<Placeholder title="Audit" />} />
        <Route path="/firehose" element={<Placeholder title="Firehose" />} />
        <Route path="/modmail" element={<Placeholder title="Modmail" />} />
        <Route
          path="/mods"
          element={
            <LeadGuard>
              <Placeholder title="Mods" />
            </LeadGuard>
          }
        />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
