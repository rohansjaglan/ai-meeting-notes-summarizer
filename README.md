# AI Meeting Notes Summarizer

A modern web application that transforms meeting transcripts into structured, actionable summaries using Google's Gemini AI. Upload text, customize instructions, generate AI summaries, edit content, and share via email.

## 🚀 Features

### Core Functionality
- **Text Upload**: Upload transcript files (.txt, .md, .doc, .docx) or paste text directly
- **Custom Instructions**: Use predefined templates or write custom AI prompts
- **AI Summarization**: Powered by Google Gemini API for intelligent content analysis
- **Editable Summaries**: Full editing capabilities with version history and auto-save
- **Email Sharing**: Share summaries directly via email with multiple recipients
- **Export Options**: Download summaries as text files

### AI-Powered Analysis
- **Structured Summaries**: Automatically extracts key points, decisions, and action items
- **Custom Prompts**: 8+ predefined templates (Executive, Technical, Action Items, etc.)
- **Smart Parsing**: Identifies quotes, topics, and important discussions
- **Processing Metrics**: Shows confidence levels and processing time

### User Experience
- **Step-by-Step Workflow**: Guided process from upload to sharing
- **Real-time Editing**: Inline editing with undo/redo and keyboard shortcuts
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Automatic theme switching based on system preferences

## 🛠 Technology Stack

- **Frontend**: React 18 + Material-UI (MUI)
- **AI Integration**: Google Gemini API (@google/generative-ai)
- **Styling**: Material-UI + Emotion + Tailwind CSS
- **Build Tool**: Create React App
- **State Management**: React Hooks + Context
- **File Processing**: Native File API
- **Email Integration**: Custom email service (extensible)

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key (free from [Google AI Studio](https://makersuite.google.com/app/apikey))

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-meeting-notes-summarizer

# Install dependencies
npm install
```

### 2. Get Your API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key for use in the application

### 3. Run the Application

```bash
# Start development server
npm start

# The app will open at http://localhost:3000
```

### 4. Build for Production

```bash
# Build the application
npm run build

# Serve the built application
npm run serve
```

## 📖 How to Use

### Step 1: Upload Transcript
- **File Upload**: Drag and drop or click to upload transcript files
- **Direct Input**: Paste meeting notes directly into the text area
- **Supported Formats**: .txt, .md, .doc, .docx files up to 5MB

### Step 2: Customize Instructions
- **Templates**: Choose from 8 predefined prompt templates:
  - Executive Summary (for leadership)
  - Action Items Focus (tasks and responsibilities)
  - Decisions Made (outcomes and choices)
  - Technical Discussion (technical details)
  - Project Status (progress updates)
  - Client Meeting (client-focused summary)
  - Brainstorming Session (ideas and concepts)
  - Retrospective (team feedback)
- **Custom Prompts**: Write your own instructions for specific needs

### Step 3: Generate Summary
- Click "Generate Summary" to process your transcript
- AI analyzes content and creates structured output
- Processing typically takes 5-15 seconds depending on length

### Step 4: Edit & Refine
- **Inline Editing**: Click anywhere in the summary to edit
- **Version History**: Undo/redo changes with Ctrl+Z/Ctrl+Shift+Z
- **Auto-save**: Changes are automatically saved as you type
- **Keyboard Shortcuts**: Full keyboard support for power users

### Step 5: Share & Export
- **Email Sharing**: Send to multiple recipients with personal message
- **Export**: Download as .txt file for offline use
- **Copy**: One-click copy to clipboard

## 🔧 Development Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run lint       # Check code quality
npm run lint:fix   # Fix linting issues
npm run serve      # Serve production build
npm run deploy     # Build and serve
```

## 📁 Project Structure

```
src/
├── components/              # React components
│   ├── TextUpload.jsx      # File upload and text input
│   ├── CustomPromptInput.jsx # AI instruction templates
│   ├── EditableSummary.jsx # Summary editing interface
│   ├── EmailShare.jsx      # Email sharing dialog
│   ├── MeetingNotesDashboard.jsx # Main application
│   └── ...                 # Other UI components
├── services/               # Business logic
│   └── summaryService.js   # AI summarization service
├── hooks/                  # Custom React hooks
├── assets/                 # Static assets
├── App.js                  # Application entry point
└── index.js               # React DOM entry point
```

## 🔑 API Configuration

The application requires a Google Gemini API key:

1. **First Run**: The app will prompt you to enter your API key
2. **Storage**: API key is stored securely in browser localStorage
3. **Management**: Click the settings chip to update your API key anytime

### API Key Security
- Keys are stored locally in your browser only
- No server-side storage or transmission
- You maintain full control of your API credentials

## 🎯 Use Cases

### Business Meetings
- Transform meeting recordings into executive summaries
- Extract action items and assign responsibilities
- Share outcomes with stakeholders via email

### Technical Discussions
- Document architecture decisions and technical choices
- Capture implementation details and requirements
- Create technical specifications from brainstorming sessions

### Client Calls
- Generate client-ready summaries with key agreements
- Highlight client feedback and requirements
- Share professional summaries with project teams

### Project Reviews
- Extract project status updates and milestones
- Identify blockers and resource needs
- Create progress reports for management

## 🔒 Privacy & Security

- **Local Processing**: All text processing happens in your browser
- **No Data Storage**: No meeting content is stored on external servers
- **API Security**: Direct communication with Google's API only
- **User Control**: You control all data and can clear it anytime

## 🚀 Deployment Options

### Static Hosting
Deploy to any static hosting service:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront

### Build Command
```bash
npm run build
```

### Environment Variables
No environment variables required - API key is managed client-side.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Documentation**: Check this README for comprehensive guidance
- **API Help**: Visit [Google AI Studio](https://makersuite.google.com/) for API support

## 🎉 Acknowledgments

- Google Gemini AI for powerful text analysis
- Material-UI team for excellent React components
- React community for amazing ecosystem and tools