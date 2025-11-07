# Nodemon Setup Complete ✓

Nodemon has been successfully configured for the backend development environment.

## What Changed

### 1. Updated `package.json`

Added nodemon and ts-node as dev dependencies:
```json
"devDependencies": {
  "nodemon": "^3.0.2",
  "ts-node": "^10.9.2",
  ...
}
```

Updated scripts:
```json
"scripts": {
  "dev": "nodemon",           // New: Uses nodemon with config
  "dev:tsx": "tsx watch src/index.ts",  // Kept as alternative
  ...
}
```

### 2. Created `nodemon.json`

Main nodemon configuration file:
```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts", "src/**/*.test.ts", "node_modules"],
  "exec": "tsx src/index.ts",
  "env": {
    "NODE_ENV": "development"
  },
  "restartable": "rs",
  "delay": 1000,
  "verbose": true,
  "colours": true
}
```

### 3. Created `nodemon.ts-node.json`

Alternative configuration using ts-node instead of tsx:
```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts", "src/**/*.test.ts", "node_modules"],
  "exec": "ts-node -r tsconfig-paths/register src/index.ts",
  ...
}
```

### 4. Created Documentation

- `README.md` - Main backend documentation
- `DEV_SETUP.md` - Detailed development setup guide
- `NODEMON_SETUP.md` - This file

## How to Use

### Install Dependencies

First, install the new dependencies:
```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

This will:
- Start the server using nodemon
- Watch for changes in the `src` directory
- Automatically restart on `.ts` and `.json` file changes
- Show colored output with verbose logging

### Manual Restart

While the server is running:
- Type `rs` and press Enter to manually restart
- Press `Ctrl+C` to stop the server

### Alternative: Use tsx watch

If you prefer the original tsx watch:
```bash
npm run dev:tsx
```

## Benefits of Nodemon

1. **Automatic Restart**: Detects file changes and restarts automatically
2. **Configurable**: Fine-tune what files to watch and ignore
3. **Manual Restart**: Type `rs` to restart without stopping
4. **Delay Support**: Batches rapid changes with configurable delay
5. **Colored Output**: Better visibility of logs and errors
6. **Industry Standard**: Widely used and well-documented

## Configuration Options

### Watch Specific Directories

Edit `nodemon.json`:
```json
{
  "watch": ["src", "config", "lib"]
}
```

### Watch Additional File Types

```json
{
  "ext": "ts,json,yaml,env"
}
```

### Ignore More Files

```json
{
  "ignore": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/temp/*",
    "node_modules"
  ]
}
```

### Change Restart Delay

```json
{
  "delay": 2000  // 2 seconds
}
```

### Use Different Executor

```json
{
  "exec": "ts-node src/index.ts"  // Use ts-node instead of tsx
}
```

## Troubleshooting

### Nodemon Not Found

Install dependencies:
```bash
npm install
```

### Too Many Restarts

Increase the delay:
```json
{
  "delay": 2000
}
```

Or ignore more files:
```json
{
  "ignore": ["src/**/*.test.ts", "logs/*", "*.log"]
}
```

### Environment Variables Not Loading

Ensure your `.env` file is in the correct location:
```
packages/backend/.env
```

The config file at `src/config/env.ts` loads it automatically.

### Want to Use ts-node Instead of tsx

Update `nodemon.json`:
```json
{
  "exec": "ts-node src/index.ts"
}
```

Or use the alternative config:
```bash
nodemon --config nodemon.ts-node.json
```

## Comparison: tsx vs ts-node

### tsx (Current Default)
- ✅ Faster startup and execution
- ✅ Better for development
- ✅ Simpler configuration
- ❌ Less mature than ts-node

### ts-node
- ✅ More mature and stable
- ✅ Better TypeScript support
- ✅ More configuration options
- ❌ Slower than tsx

Both work great with nodemon. tsx is set as default for speed, but you can easily switch to ts-node if preferred.

## Next Steps

1. Install dependencies: `npm install`
2. Set up your `.env` file
3. Run the dev server: `npm run dev`
4. Make changes to your code and watch it auto-reload!

## Additional Resources

- [Nodemon Documentation](https://nodemon.io/)
- [tsx Documentation](https://github.com/esbuild-kit/tsx)
- [ts-node Documentation](https://typestrong.org/ts-node/)

---

**Setup completed successfully!** 🎉

You can now run `npm run dev` to start developing with automatic reloading.
