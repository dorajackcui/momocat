export const IPC_CHANNELS = {
  project: {
    list: 'project-list',
    create: 'project-create',
    get: 'project-get',
    updatePrompt: 'project-update-prompt',
    updateAISettings: 'project-update-ai-settings',
    remove: 'project-delete',
    getFiles: 'project-get-files',
    addFile: 'project-add-file'
  },
  file: {
    get: 'file-get',
    remove: 'file-delete',
    getSegments: 'file-get-segments',
    getPreview: 'file-get-preview',
    export: 'file-export'
  },
  segment: {
    update: 'segment-update'
  },
  tm: {
    get100Match: 'tm-get-100-match',
    getMatches: 'tm-get-matches',
    concordance: 'tm-concordance',
    list: 'tm-list',
    create: 'tm-create',
    remove: 'tm-delete',
    getMountedByProject: 'tm-project-mounted',
    mount: 'tm-mount',
    unmount: 'tm-unmount',
    commitFile: 'tm-commit-file',
    matchFile: 'tm-match-file',
    importPreview: 'tm-import-preview',
    importExecute: 'tm-import-execute'
  },
  tb: {
    getMatches: 'tb-get-matches',
    list: 'tb-list',
    create: 'tb-create',
    remove: 'tb-delete',
    getMountedByProject: 'tb-project-mounted',
    mount: 'tb-mount',
    unmount: 'tb-unmount',
    importPreview: 'tb-import-preview',
    importExecute: 'tb-import-execute'
  },
  ai: {
    getSettings: 'ai-settings-get',
    setKey: 'ai-settings-set',
    clearKey: 'ai-settings-clear',
    testConnection: 'ai-test-connection',
    translateFile: 'ai-translate-file',
    testTranslate: 'ai-test-translate'
  },
  dialog: {
    openFile: 'dialog-open-file',
    saveFile: 'dialog-save-file'
  },
  events: {
    segmentsUpdated: 'segments-updated',
    appProgress: 'app-progress',
    jobProgress: 'job-progress'
  }
} as const;

export type IpcChannelMap = typeof IPC_CHANNELS;
