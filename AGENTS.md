# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Start the development server on port 3000
- `npm run dev` - Alias for npm start

### Testing
- `node server.test.js` - Run server tests (also runs automatically when starting server)
- Tests run automatically when the server starts via server.js

### Server Operation
The server automatically runs tests on startup. If tests fail, the server will not start.

## Architecture

This is a Norwegian coffee pairing web application with Slack integration. The application generates random coffee pairings from Slack channel members.

### Core Components

**server.js** - Express server with Slack API integration
- Main entry point that creates Express app and runs tests on startup
- `/api/slack/channel-members` POST endpoint for fetching Slack channel members
- Slack API client with pagination support and parallel user data fetching (35x performance improvement)
- Filters out bots and deleted users, prioritizes display_name over real_name over username
- Comprehensive error handling for Slack API responses

**main.js** - Frontend coffee pairing logic
- Handles user input persistence via localStorage
- Core pairing algorithm: creates pairs, handles odd numbers by making a trio
- Built-in client-side tests that run on page load
- Fisher-Yates shuffle algorithm for randomization

**api.js** - Slack API integration frontend
- Handles Slack token and channel ID persistence
- Fetches channel members via backend API with 30-second timeout
- Transfers member list to main app via localStorage

**server.test.js** - Comprehensive test suite
- Tests Slack API integration, pagination, user filtering, error handling
- Mock Slack API responses for reliable testing
- Can be run standalone or via server startup

### Data Flow
1. User enters Slack token and channel ID in api.html
2. Frontend calls `/api/slack/channel-members` with credentials
3. Server fetches all channel members using Slack API with pagination
4. Server filters users (removes bots/deleted) and formats handles
5. Member list transferred to main app via localStorage
6. Main app generates random pairings using Fisher-Yates shuffle

### File Structure
- `index.html` + `main.js` - Main pairing interface (Norwegian UI)
- `api.html` + `api.js` - Slack integration interface
- `server.js` - Backend API and Express server
- `server.test.js` - Test suite with mock Slack responses
- `styles.css` - Shared styling

### Language and UI
- All user-facing text is in Norwegian
- Error messages and success messages are localized
- Application designed for Norwegian Slack workspaces