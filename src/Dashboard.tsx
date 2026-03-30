import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardList, History as HistoryIcon } from 'lucide-react';
import Header from './Header';
import './Dashboard.css';
import DashboardSidebar from './DashboardSidebar';
import { useAccessControl } from './hooks/useAccessControl';

const Dashboard: React.FC = () => {
  const { user } = useAccessControl();
  const navigate = useNavigate();

  if (!user) {
    navigate('/signin');
    return null;
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />
      <main className="dashboard-main">
        <Header />
        <div className="dashboard-container">
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1>Welcome, {user.displayName || 'Clinical User'}!</h1>
              <p>Track patterns, update records, and export data for your care team.</p>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-icon"><ClipboardList /></div>
                <h3>Log Condition</h3>
                <p>Log a new allergic condition or symptom to track potential triggers.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/log-reaction')}>
                  Go to Log Condition
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><BarChart3 /></div>
                <h3>Analysis</h3>
                <p>Get AI-powered insights into your potential allergens and personalized reports.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/analysis')}>
                  Go to Analysis
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><HistoryIcon /></div>
                <h3>History</h3>
                <p>Review your past reactions and allergen analysis history.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/history')}>
                  Go to History
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 