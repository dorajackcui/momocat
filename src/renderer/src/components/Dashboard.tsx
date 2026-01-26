import React from 'react';
import { ProjectFile } from '../types';

interface DashboardProps {
  files: ProjectFile[];
  onOpenFile: (id: number) => void;
  onAddFiles: () => void;
  onDeleteFile: (id: number) => void;
  onBatchMatch: (id: number) => void;
}

export function Dashboard({
  files,
  onOpenFile,
  onAddFiles,
  onDeleteFile,
  onBatchMatch,
}: DashboardProps) {
  return (
    <div className="p-10 max-w-[1000px] mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl text-gray-800">Project Files</h1>
        <button
          onClick={onAddFiles}
          className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-md text-sm cursor-pointer shadow-sm hover:bg-blue-600 transition-colors"
        >
          + Add Files
        </button>
      </div>

      {files.length === 0 ? (
        <div className="text-center p-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-gray-500">
          <div className="text-5xl mb-5">📂</div>
          <h3 className="m-0 mb-2.5 text-lg font-medium">No files yet</h3>
          <p>Click the "Add Files" button to import Excel documents for translation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl text-blue-500 mr-4">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="m-0 text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                    title={file.name}
                  >
                    {file.name}
                  </h3>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1.5 text-gray-500">
                  <span>Progress</span>
                  <span>{file.progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex gap-2.5">
                <button
                  onClick={() => onOpenFile(file.id)}
                  className="flex-1 py-2 bg-blue-500 text-white border-none rounded hover:bg-blue-600 transition-colors cursor-pointer text-sm"
                >
                  Open
                </button>
                <button
                  onClick={() => onBatchMatch(file.id)}
                  className="px-3 py-2 bg-yellow-500 text-white border-none rounded hover:bg-yellow-600 transition-colors cursor-pointer text-sm"
                  title="Pre-translate with TM"
                >
                  TM
                </button>
                <button
                  onClick={() => onDeleteFile(file.id)}
                  className="px-3 py-2 bg-red-500 text-white border-none rounded hover:bg-red-600 transition-colors cursor-pointer text-sm"
                  title="Delete File"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
