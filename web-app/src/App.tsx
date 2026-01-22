import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { useAppStore } from '@/store/appStore'
import { ConnectPage, PlanPage, BuildPage, ValidatePage, DeployPage } from '@/pages'

function AppLayout({ children }: { children: React.ReactNode }) {
  const { projectName, currentPhase, chapters } = useAppStore()

  const currentChapterIndex = chapters.findIndex(c => c.status === 'current')

  return (
    <Layout
      projectName={projectName || 'New Project'}
      currentPhase={currentPhase}
      chapters={chapters}
      buildProgress={
        currentPhase === 'build' && chapters.length > 0
          ? {
              currentChapter: currentChapterIndex + 1,
              totalChapters: chapters.length,
            }
          : undefined
      }
    >
      {children}
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/connect" replace />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/validate" element={<ValidatePage />} />
          <Route path="/deploy" element={<DeployPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
