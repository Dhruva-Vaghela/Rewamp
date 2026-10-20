import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LibraryPage from './pages/LibraryPage'
import ReaderPage from './pages/ReaderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/read/:bookId" element={<ReaderPage />} />
    </Routes>
  )
}
