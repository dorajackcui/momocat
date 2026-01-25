import React, { useRef, useEffect } from 'react'
import { Segment } from '../types'

interface EditorRowProps {
  segment: Segment
  isActive: boolean
  onActivate: (id: number) => void
  onChange: (id: number, value: string) => void
  onNext: () => void
  onPrev: () => void
}

export const EditorRow: React.FC<EditorRowProps> = ({ 
  segment, 
  isActive, 
  onActivate, 
  onChange,
  onNext,
  onPrev
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to go to next
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onNext()
    }
    // Up arrow to go to prev (if cursor is at start or with modifier)
    // For simplicity, let's use Ctrl+Up/Down for navigation
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
      e.preventDefault()
      onNext()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
      e.preventDefault()
      onPrev()
    }
  }

  return (
    <React.Fragment>
      <div 
        onClick={() => onActivate(segment.id)}
        style={{ 
          padding: '10px', 
          backgroundColor: isActive ? '#e6f7ff' : '#f9f9f9', 
          whiteSpace: 'pre-wrap',
          borderBottom: '1px solid #eee',
          cursor: 'pointer'
        }}
      >
        {segment.source}
      </div>
      <div 
        style={{ 
          padding: '10px',
          backgroundColor: isActive ? '#e6f7ff' : '#fff',
          borderBottom: '1px solid #eee',
          position: 'relative'
        }}
      >
        <textarea 
          ref={textareaRef}
          style={{ 
            width: '100%', 
            minHeight: '60px', 
            resize: 'vertical',
            padding: '8px',
            borderRadius: '4px',
            border: isActive ? '1px solid #1890ff' : '1px solid #d9d9d9',
            outline: 'none',
            backgroundColor: segment.isTmMatch ? '#f6ffed' : '#fff'
          }}
          value={segment.target}
          onChange={(e) => onChange(segment.id, e.target.value)}
          onFocus={() => onActivate(segment.id)}
          onKeyDown={handleKeyDown}
          placeholder="Type translation here..."
        />
        {segment.isTmMatch && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '15px',
            fontSize: '10px',
            color: '#52c41a',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '2px',
            padding: '1px 4px',
            pointerEvents: 'none'
          }}>
            TM Match
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
