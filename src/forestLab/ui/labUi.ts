import type { CameraId, CandidateId, PatchId } from '../labTypes';

export interface LabUiStatus {
  candidate: CandidateId;
  camera: CameraId;
  patch: PatchId;
  shellTriangleCount: number;
  detailCount: number;
  buildMs: number;
  clusterCount?: number;
  memberCount?: number;
  visibleInstanceCount?: number;
}

export interface LabUi {
  element: HTMLDivElement;
  setStatus(status: LabUiStatus): void;
  hide(): void;
  show(): void;
  dispose(): void;
}

type Callback<T> = (value: T) => void | Promise<void>;

export function createLabUi({
  container,
  onCandidate,
  onCamera,
  onPatch,
  onReset,
  patches,
}: {
  container: HTMLElement;
  onCandidate: Callback<CandidateId>;
  onCamera: Callback<CameraId>;
  onPatch: Callback<PatchId>;
  onReset: () => void | Promise<void>;
  patches: readonly PatchId[];
}): LabUi {
  const element = document.createElement('div');
  element.dataset.forestLabUi = 'true';
  Object.assign(element.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    zIndex: '10',
    padding: '8px',
    font: '12px monospace',
  });

  const invoke = <T>(callback: Callback<T>, value: T): void => {
    Promise.resolve(callback(value)).catch((error) => console.error('[forest-lab-ui]', error));
  };
  const addButton = (label: string, action: () => void): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    element.appendChild(button);
  };
  const addBreak = (): void => {
    element.appendChild(document.createElement('br'));
  };

  ([
    [0, '0 CONTROL'],
    [4, '4 CLUSTER_ONLY'],
    [5, '5 HIERARCHICAL_FOREST'],
  ] as const).forEach(([id, label]) => addButton(label, () => invoke(onCandidate, id)));
  addBreak();
  ([
    [1, '1 SHELL_BASE (LEGACY)'],
    [2, '2 SHELL_CROWN_FIELD (LEGACY)'],
    [3, '3 HYBRID (LEGACY)'],
  ] as const).forEach(([id, label]) => addButton(label, () => invoke(onCandidate, id)));
  addBreak();
  (['PRIMARY', 'OVERVIEW', 'CLOSE'] as const).forEach((id) =>
    addButton(id, () => invoke(onCamera, id))
  );
  addBreak();
  patches.forEach((id) => addButton(`PATCH ${id}`, () => invoke(onPatch, id)));
  addBreak();

  const statusElement = document.createElement('pre');
  statusElement.dataset.forestLabStatus = 'true';
  statusElement.style.margin = '6px 0 0';
  element.appendChild(statusElement);

  const keydown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key >= '0' && event.key <= '5') {
      invoke(onCandidate, Number(event.key) as CandidateId);
      return;
    }
    const key = event.key.toUpperCase();
    if (key === 'P') invoke(onCamera, 'PRIMARY');
    else if (key === 'O') invoke(onCamera, 'OVERVIEW');
    else if (key === 'C') invoke(onCamera, 'CLOSE');
    else if ((key === 'A' || key === 'B') && patches.includes(key)) {
      invoke(onPatch, key);
    } else if (key === 'R') {
      Promise.resolve(onReset()).catch((error) => console.error('[forest-lab-ui]', error));
    } else if (key === 'H') {
      if (element.style.display === 'none') element.style.display = '';
      else element.style.display = 'none';
    }
  };

  window.addEventListener('keydown', keydown);
  container.appendChild(element);

  return {
    element,
    setStatus(status) {
      const lines = [
        `candidate: ${status.candidate}`,
        `camera: ${status.camera}`,
        `patch: ${status.patch}`,
        `shell tri: ${status.shellTriangleCount}`,
        `detail count: ${status.detailCount}`,
        `buildMs: ${status.buildMs.toFixed(2)}`,
      ];
      if (status.clusterCount !== undefined) lines.push(`cluster count: ${status.clusterCount}`);
      if (status.memberCount !== undefined) lines.push(`member count: ${status.memberCount}`);
      if (status.visibleInstanceCount !== undefined) {
        lines.push(`visible instances: ${status.visibleInstanceCount}`);
      }
      statusElement.textContent = lines.join('\n');
    },
    hide() {
      element.style.display = 'none';
    },
    show() {
      element.style.display = '';
    },
    dispose() {
      window.removeEventListener('keydown', keydown);
      element.remove();
    },
  };
}
