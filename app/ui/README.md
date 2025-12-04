# Frontend Setup Guide

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root of the `app/ui` directory:

```env
VITE_API_URL=http://localhost:3001/api
VITE_API_TIMEOUT=30000
```

### Configuration Options

- `VITE_API_URL`: Backend API URL (default: `http://localhost:3001/api`)
- `VITE_API_TIMEOUT`: API request timeout in milliseconds (default: `30000`)

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The production build will be in the `dist` folder.

## Preview Production Build

```bash
npm run preview
```

## Linting

```bash
npm run lint
```


### Dark / Light  Mode
