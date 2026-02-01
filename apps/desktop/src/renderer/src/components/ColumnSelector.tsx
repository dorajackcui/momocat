import React, { useState } from 'react';

interface ColumnSelectorProps {
  headers: string[];
  previewData: any[][];
  onConfirm: (sourceIndex: number, targetIndex: number) => void;
  onCancel: () => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  headers,
  previewData,
  onConfirm,
  onCancel,
}) => {
  const [sourceCol, setSourceCol] = useState<number>(0);
  const [targetCol, setTargetCol] = useState<number>(1);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '8px',
          width: '500px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Select Columns</h3>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Source Text Column
            </label>
            <select
              value={sourceCol}
              onChange={(e) => setSourceCol(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
              }}
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  Column {String.fromCharCode(65 + i)}: {h || `(Empty)`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Target Translation Column
            </label>
            <select
              value={targetCol}
              onChange={(e) => setTargetCol(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
              }}
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  Column {String.fromCharCode(65 + i)}: {h || `(Empty)`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            marginBottom: '20px',
            border: '1px solid #eee',
            borderRadius: '4px',
            padding: '10px',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '12px', color: '#666' }}>
            Preview (First Row)
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#999' }}>Source</div>
              <div
                style={{
                  padding: '5px',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '2px',
                  marginTop: '2px',
                }}
              >
                {previewData[0] ? previewData[0][sourceCol] : ''}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#999' }}>Target</div>
              <div
                style={{
                  padding: '5px',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '2px',
                  marginTop: '2px',
                }}
              >
                {previewData[0] ? previewData[0][targetCol] : ''}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(sourceCol, targetCol)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#1890ff',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
