import React from 'react';

const DashboardPage = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {/* Summary, charts, analytics will go here */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded shadow p-4">Total Income</div>
        <div className="bg-white dark:bg-gray-800 rounded shadow p-4">Total Expenses</div>
        <div className="bg-white dark:bg-gray-800 rounded shadow p-4">Net Savings</div>
      </div>
      {/* More dashboard widgets */}
    </div>
  );
};

export default DashboardPage;
