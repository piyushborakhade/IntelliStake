import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Phase1 from './components/Phase1';
import Phase2Finance from './components/Phase2Finance';
import Phase2Blockchain from './components/Phase2Blockchain';
import Phase2Oracle from './components/Phase2Oracle';
import Architecture from './components/Architecture';
import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/phase1" element={<Phase1 />} />
          <Route path="/phase2-finance" element={<Phase2Finance />} />
          <Route path="/phase2-blockchain" element={<Phase2Blockchain />} />
          <Route path="/phase2-oracle" element={<Phase2Oracle />} />
          <Route path="/architecture" element={<Architecture />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
