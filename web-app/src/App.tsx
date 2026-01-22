import { Layout } from '@/components/layout'
import { useAppStore } from '@/store'
import {
  ConnectStep,
  SourceStep,
  TablesStep,
  FieldsStep,
  IncrementalStep,
  ExtractStep,
  AnalyzeStep,
  ModelTypeStep,
  BuildStep,
  ReviewStep,
  DeployStep,
} from '@/features'

const stepComponents: Record<number, React.ComponentType> = {
  1: ConnectStep,
  2: SourceStep,
  3: TablesStep,
  4: FieldsStep,
  5: IncrementalStep,
  6: ExtractStep,
  7: AnalyzeStep,
  8: ModelTypeStep,
  9: BuildStep,
  10: ReviewStep,
  11: DeployStep,
}

function App() {
  const { projectName, currentStep, maxReachedStep, setStep } = useAppStore()

  const StepComponent = stepComponents[currentStep] || ConnectStep

  return (
    <Layout
      projectName={projectName || 'New Project'}
      currentStep={currentStep}
      maxReachedStep={maxReachedStep}
      onStepClick={setStep}
    >
      <StepComponent />
    </Layout>
  )
}

export default App
