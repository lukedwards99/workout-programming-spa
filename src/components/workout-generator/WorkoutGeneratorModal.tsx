import { useState, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';
import type { Mesocycle, Workout } from '../../types/domain';
import type { PlanningAlgorithmId, WorkoutPlan } from '../../planning/types';
import type { SimplePlanConfig } from '../../planning/simplePlan';
import { validateSimplePlan, computeSimplePlan, maxPossibleOccurrences } from '../../planning/simplePlan';
import { executeWorkoutPlan } from '../../api/workoutGenerationApi';
import PlanningTypePicker from './PlanningTypePicker';
import SimplePlanForm from './SimplePlanForm';
import PlanPreview from './PlanPreview';

interface WorkoutGeneratorModalProps {
  show: boolean;
  mesocycle: Mesocycle;
  workouts: Workout[];
  onHide: () => void;
  onGenerated: (count: number) => void;
}

type Stage = 'select' | 'configure' | 'preview';

export default function WorkoutGeneratorModal({
  show,
  mesocycle,
  workouts,
  onHide,
  onGenerated,
}: WorkoutGeneratorModalProps) {
  const [stage, setStage] = useState<Stage>('select');
  const [selectedAlgo, setSelectedAlgo] = useState<PlanningAlgorithmId>('simple-plan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [simpleConfig, setSimpleConfig] = useState<SimplePlanConfig>({
    selectedWorkoutIds: [],
    repeatEveryDays: 7,
    totalOccurrences: 2,
  });

  const planContext = useMemo(
    () => ({ mesocycle, workouts, exerciseGroups: [], exercises: [] }),
    [mesocycle, workouts]
  );

  const plan: WorkoutPlan | null = useMemo(() => {
    if (stage !== 'preview') return null;
    const validation = validateSimplePlan(simpleConfig, planContext);
    if (!validation.valid) return null;
    return computeSimplePlan(simpleConfig, planContext);
  }, [stage, simpleConfig, planContext]);

  const previewErrors = useMemo(() => {
    if (stage === 'select') return [];
    return validateSimplePlan(simpleConfig, planContext).errors;
  }, [stage, simpleConfig, planContext]);

  const canContinue = stage === 'select'
    ? !!selectedAlgo
    : stage === 'configure'
      ? validateSimplePlan(simpleConfig, planContext).valid
      : stage === 'preview'
        ? plan !== null && plan.copies.length > 0
        : false;

  const handleClose = () => {
    if (busy) return;
    setStage('select');
    setSelectedAlgo('simple-plan');
    setSimpleConfig({ selectedWorkoutIds: [], repeatEveryDays: 7, totalOccurrences: 2 });
    setError(null);
    onHide();
  };

  const handleNext = () => {
    if (stage === 'select') {
      if (selectedAlgo === 'simple-plan') {
        const validation = validateSimplePlan(
          { ...simpleConfig, totalOccurrences: 2 },
          planContext
        );
        let max = 2;
        if (
          validation.valid ||
          (simpleConfig.selectedWorkoutIds.length > 0 &&
           Number.isInteger(simpleConfig.repeatEveryDays) &&
           simpleConfig.repeatEveryDays >= 1)
        ) {
          max = maxPossibleOccurrences(
            { selectedWorkoutIds: simpleConfig.selectedWorkoutIds, repeatEveryDays: simpleConfig.repeatEveryDays },
            planContext
          );
        }
        const defOcc = Math.max(2, max);
        setSimpleConfig((prev) => ({
          ...prev,
          totalOccurrences: prev.totalOccurrences >= 2 ? prev.totalOccurrences : defOcc,
        }));
        setStage('configure');
      }
    } else if (stage === 'configure') {
      setStage('preview');
    }
  };

  const handleBack = () => {
    if (stage === 'configure') setStage('select');
    else if (stage === 'preview') setStage('configure');
  };

  const handleGenerate = async () => {
    if (!plan || plan.copies.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = executeWorkoutPlan(plan, mesocycle.id);
      handleClose();
      onGenerated(result.totalCopied);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const workoutList = [...workouts].sort(
    (a, b) => a.day_offset - b.day_offset || a.sort_order - b.sort_order
  );

  return (
    <Modal show={show} onHide={handleClose} dialogClassName="modal-fullscreen-md-down" centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {stage === 'select' && 'Choose Planning Type'}
          {stage === 'configure' && `Configure: ${selectedAlgo === 'simple-plan' ? 'Simple plan' : selectedAlgo}`}
          {stage === 'preview' && 'Preview & Confirm'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <div className="alert alert-danger">{error}</div>}

        {stage === 'select' && (
          <PlanningTypePicker selectedId={selectedAlgo} onSelect={setSelectedAlgo} />
        )}

        {stage === 'configure' && selectedAlgo === 'simple-plan' && (
          <SimplePlanForm
            mesocycle={mesocycle}
            workouts={workoutList}
            config={simpleConfig}
            errors={previewErrors}
            onConfigChange={(c) => {
              setSimpleConfig(c);
              setError(null);
            }}
          />
        )}

        {stage === 'preview' && plan && (
          <PlanPreview mesocycle={mesocycle} plan={plan} />
        )}

        {stage === 'preview' && !plan && (
          <div className="empty-state">
            <p>No valid plan to preview. Go back and check your configuration.</p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleClose}
          disabled={busy}
        >
          Cancel
        </button>

        {stage !== 'select' && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleBack}
            disabled={busy}
          >
            Back
          </button>
        )}

        {stage !== 'preview' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!canContinue || busy}
          >
            {stage === 'select' ? 'Next' : 'Preview'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-success"
            onClick={handleGenerate}
            disabled={!canContinue || busy}
          >
            {busy ? 'Generating...' : `Generate ${plan?.copies.length ?? 0} workouts`}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
