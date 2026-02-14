import { describe, expect, it, vi } from 'vitest';
import type { TMBatchMatchResult } from '../../../../shared/ipc';
import { createProjectDetailActions } from './useProjectDetailData';

vi.mock('../../services/apiClient', () => ({
  apiClient: {},
}));

function createMutationHarness() {
  const order: string[] = [];
  const runMutation = vi.fn(async <T>(fn: () => Promise<T>): Promise<T> => {
    order.push('mutation:start');
    const result = await fn();
    order.push('mutation:end');
    return result;
  });
  const loadData = vi.fn(async () => {
    order.push('loadData');
  });
  return { order, runMutation, loadData };
}

describe('useProjectDetailData behavior helpers', () => {
  it('mountTM runs inside mutation and refreshes data', async () => {
    const { order, runMutation, loadData } = createMutationHarness();
    const api = {
      mountTMToProject: vi.fn(async () => {
        order.push('api:mountTMToProject');
      }),
      unmountTMFromProject: vi.fn(async () => {}),
      mountTBToProject: vi.fn(async () => {}),
      unmountTBFromProject: vi.fn(async () => {}),
      commitToMainTM: vi.fn(async () => 0),
      matchFileWithTM: vi.fn(async () => ({ total: 0, matched: 0, applied: 0, skipped: 0 })),
    };
    const actions = createProjectDetailActions({ projectId: 7, api, loadData, runMutation });

    await actions.mountTM('tm-1');

    expect(api.mountTMToProject).toHaveBeenCalledWith(7, 'tm-1');
    expect(loadData).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['mutation:start', 'api:mountTMToProject', 'loadData', 'mutation:end']);
  });

  it('commitToMainTM returns API result and refreshes', async () => {
    const { runMutation, loadData } = createMutationHarness();
    const api = {
      mountTMToProject: vi.fn(async () => {}),
      unmountTMFromProject: vi.fn(async () => {}),
      mountTBToProject: vi.fn(async () => {}),
      unmountTBFromProject: vi.fn(async () => {}),
      commitToMainTM: vi.fn(async () => 23),
      matchFileWithTM: vi.fn(async () => ({ total: 0, matched: 0, applied: 0, skipped: 0 })),
    };
    const actions = createProjectDetailActions({ projectId: 11, api, loadData, runMutation });

    const count = await actions.commitToMainTM('tm-main', 101);

    expect(count).toBe(23);
    expect(api.commitToMainTM).toHaveBeenCalledWith('tm-main', 101);
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('matchFileWithTM returns batch result and refreshes', async () => {
    const { runMutation, loadData } = createMutationHarness();
    const expected: TMBatchMatchResult = { total: 100, matched: 80, applied: 70, skipped: 10 };
    const api = {
      mountTMToProject: vi.fn(async () => {}),
      unmountTMFromProject: vi.fn(async () => {}),
      mountTBToProject: vi.fn(async () => {}),
      unmountTBFromProject: vi.fn(async () => {}),
      commitToMainTM: vi.fn(async () => 0),
      matchFileWithTM: vi.fn(async () => expected),
    };
    const actions = createProjectDetailActions({ projectId: 1, api, loadData, runMutation });

    const result = await actions.matchFileWithTM(9, 'tm-2');

    expect(result).toEqual(expected);
    expect(api.matchFileWithTM).toHaveBeenCalledWith(9, 'tm-2');
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('propagates mutation failure and does not refresh', async () => {
    const { runMutation, loadData } = createMutationHarness();
    const api = {
      mountTMToProject: vi.fn(async () => {}),
      unmountTMFromProject: vi.fn(async () => {}),
      mountTBToProject: vi.fn(async () => {
        throw new Error('mount failed');
      }),
      unmountTBFromProject: vi.fn(async () => {}),
      commitToMainTM: vi.fn(async () => 0),
      matchFileWithTM: vi.fn(async () => ({ total: 0, matched: 0, applied: 0, skipped: 0 })),
    };
    const actions = createProjectDetailActions({ projectId: 1, api, loadData, runMutation });

    await expect(actions.mountTB('tb-1')).rejects.toThrow('mount failed');
    expect(loadData).not.toHaveBeenCalled();
  });
});
