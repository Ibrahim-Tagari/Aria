# ARIA - AI Robot Assistant

ARIA (Autonomous Robotic Intelligence Assistant) is an ASP.NET Core MVC web application that 
provides an interactive AI-powered chat and voice interface.

The application supports real-time streaming responses, conversation history, 
voice transcription, rate limiting, and secure server-side API communication.

## Features

### AI Chat

* Real-time conversational AI assistant
* Context-aware conversations with conversation history support
* Streaming responses using SSE
* Input validation and sanitisation

### Voice Transcription

* Upload or record audio directly from the browser
* Speech-to-text transcription.
* Supports audio file uploads up to 25 MB

### Security Features

* Server-side API key management
* Request rate limiting
* Content Security Policy (CSP) headers
* Input sanitisation
* HTTPS redirection
* Protection against API key exposure

### User Experience

* Real-time token streaming
* Persistent conversation context
* Responsive web interface
* Fast AI response generation

---

## Technology Stack

### Backend

* ASP.NET Core 8 MVC
* C#
* Dependency Injection
* IHttpClientFactory

### AI Services

* Groq API
* Llama 3.3 70B Versatile
* Whisper Large V3 Turbo

### Frontend

* HTML
* CSS
* JavaScript
* Server-Sent Events (SSE)

### Security

* ASP.NET Rate Limiting Middleware
* HTTP Security Headers
* User Secrets
* HTTPS Enforcement

---

## Architecture

The application follows a traditional ASP.NET MVC architecture.

### Controllers

#### RobotController

Responsible for:

* Processing chat requests
* Streaming AI responses
* Handling audio transcription uploads
* Request validation
* Error handling

### Services

#### OpenAiService

Responsible for:

* Communicating with Groq APIs
* Managing chat completions
* Streaming response tokens
* Audio transcription
* Building AI conversation context

### Models

#### ChatRequest

Represents incoming chat requests and conversation history.

#### ConversationTurn

Stores user and assistant conversation messages.

---

## Project Structure

```text
AiRobotDemo
│
├── Controllers
│   └── RobotController.cs
│
├── Models
│
├── Services
│   └── OpenAiService.cs
│
├── Views
│   └── Robot
│
├── wwwroot
│   ├── css
│   ├── js
│   └── assets
│
├── Program.cs
├── appsettings.json
└── AiRobotDemo.csproj
```

---

## Getting Started

### Prerequisites

Install:

* .NET 8 SDK
* Visual Studio 2022 or later
* A Groq API key

---

## Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

---

## Configure

Add your Groq API key:

```bash
dotnet user-secrets set "Groq:ApiKey" "YOUR_API_KEY"
```

---

## Build the Application

```bash
dotnet restore
dotnet build
```

---

## Run the Application

```bash
dotnet run
```

The application will start locally and can be accessed through:

```text
https://localhost:xxxx
```

---

## API Configuration

The application uses the following Groq models:

### Chat Model

```text
llama-3.3-70b-versatile
```

### Speech-to-Text Model

```text
whisper-large-v3-turbo
```

These can be modified in:

```text
OpenAiService.cs
```

---

## Rate Limiting

The application includes built-in protection against abuse.

### Chat Requests

```text
60 requests per minute
```

### Transcription Requests

```text
10 requests per minute
```

These limits can be configured in:

```text
Program.cs
```

---

## Security Considerations

This project follows several security best practices:

* User input is sanitised before processing
* HTTPS redirection is enabled
* Rate limiting protects API resources
* Sensitive errors are hidden from users

---

## Future Improvements

Potential future enhancements include:

* User authentication
* Conversation persistence using a database
* Multiple AI model support
* Voice synthesis (text-to-speech)
* User profiles and settings
* Docker deployment
* Azure deployment pipeline
* Unit and integration testing

---

## Educational Purpose

This project was developed to explore:

* ASP.NET Core MVC
* AI API integration
* Streaming responses
* Speech-to-text processing
* Modern backend architecture

---

## License

This project is provided for educational and portfolio purposes.
