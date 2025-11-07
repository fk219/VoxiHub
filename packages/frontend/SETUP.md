# Frontend Setup Instructions

## Install Dependencies

```bash
cd packages/frontend
npm install
```

This will install:
- React & React Router
- Tailwind CSS (for styling)
- Lucide React (for icons)
- TanStack Query (for data fetching)
- React Hot Toast (for notifications)

## Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

## Troubleshooting

If styles are not loading:
1. Make sure you've run `npm install`
2. Restart the dev server
3. Clear browser cache
4. Check that `tailwind.config.js` and `postcss.config.js` exist
