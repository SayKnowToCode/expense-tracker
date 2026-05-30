import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import AnalyticsPage from './pages/AnalyticsPage';
import DashboardPage from './pages/DashboardPage';
import ImportCsvPage from './pages/ImportCsvPage';
import TransactionsPage from './pages/TransactionsPage';
import MonthlyAnalyticsPage from './pages/MonthlyAnalyticsPage';

const App = () => (
  <BrowserRouter>
    <div style={{ minHeight: '100vh', background: '#fafafa', color: '#222' }}>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/monthly-analytics" element={<MonthlyAnalyticsPage />} />
        <Route path="/import" element={<ImportCsvPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  </BrowserRouter>
);

const Nav = () => {
  const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    padding: '10px 14px',
    color: isActive ? '#1f6feb' : '#333',
    fontWeight: isActive ? 600 : 400,
    textDecoration: 'none',
  });
  return (
    <nav
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        background: 'white',
        borderBottom: '1px solid #eee',
      }}
    >
      <div style={{ padding: '10px 14px', fontWeight: 700, marginRight: 12 }}>
        expense-tracker
      </div>
      <NavLink to="/dashboard" style={linkStyle}>
        Dashboard
      </NavLink>
      <NavLink to="/transactions" style={linkStyle}>
        Transactions
      </NavLink>
      <NavLink to="/analytics" style={linkStyle}>
        Analytics
      </NavLink>
      <NavLink to="/monthly-analytics" style={linkStyle}>
        Monthly Analytics
      </NavLink>
      <NavLink to="/import" style={linkStyle}>
        Import CSV
      </NavLink>
    </nav>
  );
};

export default App;
