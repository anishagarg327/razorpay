import { useState, useEffect } from 'react'

function App() {
  const [backendMessage, setBackendMessage] = useState('Loading...')

  useEffect(() => {
    fetch('http://localhost:8000/')
      .then(res => res.json())
      .then(data => setBackendMessage(data.message))
      .catch(err => setBackendMessage('Error connecting to backend: ' + err.message))
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Risk Guard Dashboard
        </h1>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-blue-700 font-medium">Backend Status:</p>
          <p className="text-gray-700 mt-1">{backendMessage}</p>
        </div>
      </div>
    </div>
  )
}

export default App
