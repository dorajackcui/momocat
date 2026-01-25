import React from 'react'

export interface TMMatch {
  source: string
  target: string
  score: number
}

interface TMPanelProps {
  matches: TMMatch[]
  onApply: (target: string) => void
  loading?: boolean
}

export const TMPanel: React.FC<TMPanelProps> = ({ matches, onApply, loading }) => {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#f5f5f5', 
      borderLeft: '1px solid #ddd' 
    }}>
      <div style={{ 
        padding: '10px 15px', 
        borderBottom: '1px solid #ddd', 
        fontWeight: 'bold',
        backgroundColor: '#fff'
      }}>
        Translation Memory
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>Searching...</div>}
        
        {!loading && matches.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>No matches found</div>
        )}

        {matches.map((match, index) => (
          <div 
            key={index}
            onClick={() => onApply(match.target)}
            style={{ 
              backgroundColor: '#fff', 
              borderRadius: '6px', 
              padding: '10px', 
              marginBottom: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              border: '1px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1890ff'
              e.currentTarget.style.backgroundColor = '#e6f7ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.backgroundColor = '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ 
                backgroundColor: match.score >= 90 ? '#52c41a' : match.score >= 70 ? '#faad14' : '#ff4d4f', 
                color: '#fff', 
                padding: '1px 6px', 
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                {match.score}%
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>{match.source}</div>
            <div style={{ fontSize: '14px', color: '#333' }}>{match.target}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
