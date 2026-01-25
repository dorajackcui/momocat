# Simple CAT Tool Demo

This is a simple Computer-Assisted Translation (CAT) tool built with Electron, React, and TypeScript.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (or yarn/pnpm)

## Setup

1. Open your terminal.
2. Navigate to this directory: `cd simple-cat-tool`
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the App

To start the development server:

```bash
npm run dev
```

## Features

- **Open File**: Load an Excel (`.xlsx`) file. The tool expects a file with source text in the first column.
- **Translate**: Enter translation in the target column. The interface supports easy navigation.
- **Export**: Save the translated text to a new Excel file (appends `_translated.xlsx`).
