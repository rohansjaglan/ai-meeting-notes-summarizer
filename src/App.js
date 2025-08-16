import React from 'react';
import ThemeProvider from './components/ThemeProvider';
import MeetingNotesDashboard from './components/MeetingNotesDashboard';
import './App.css';

/**
 * Main App component with theme provider
 */
function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <MeetingNotesDashboard />
      </div>
    </ThemeProvider>
  );
}

export default App;