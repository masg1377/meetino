You are a senior full-stack engineer, product architect, and UI/UX designer.

We are building a web-based video meeting platform called Meetino for Irno Academy.

Irno Academy is an educational academy in Iran that teaches web development, AI, languages, and digital skills. Meetino will be used by Irno members, teachers, students, and guests to create and join online classes, meetings, and webinars.

The product should work like a professional video meeting platform, similar in concept to Google Meet, but it must have its own identity and should not directly copy Google Meet.

Important context:
The platform must be designed for users inside Iran. Because international internet access may be unstable or restricted, the system should be self-hosted and able to run on servers inside Iran. Avoid external dependencies such as Google APIs, Firebase, Twilio, Agora, Zoom SDK, external CDNs, or any third-party service that may not work reliably in Iran.

Main goal:
Build a scalable, self-hosted online meeting platform for Irno Academy.

Core access rule:
Users do not always need to register or log in to join a meeting. If someone has a valid meeting link, they can open it, enter their display name on the pre-join/waiting page, and join the meeting as a guest.

Registered users can create meetings, manage their dashboard, and act as hosts or admins based on their role. Guest users can only join meetings through a valid link and must enter their name before joining.

MVP features:
- User registration and login
- Guest join with meeting link
- Guest name input before joining
- User dashboard for registered users
- Create a meeting
- Generate unique meeting links
- Join a meeting by link
- Pre-join/waiting screen
- Audio and video calls
- Microphone on/off
- Camera on/off
- Screen sharing
- In-meeting chat
- Participant list
- Host controls
- Roles: Admin, Host/Teacher, Student/User, Guest
- Responsive UI for desktop, tablet, and mobile

Meeting access behavior:
- Registered users can create and manage meetings.
- Guests can join only if they have the meeting link.
- Before entering a meeting, every guest must enter a display name.
- The system should show guests in the participant list with their entered name.
- Guest users should not have access to dashboard, meeting creation, admin panel, or host controls.
- In the future, meetings may support password protection, waiting room approval, locked meetings, and guest restrictions.

Technical requirements:
- Frontend: Next.js or React with TypeScript
- Styling: Tailwind CSS
- UI direction: RTL-first, Persian-friendly, but ready for future multilingual support
- Backend: Node.js with NestJS or Express
- Database: PostgreSQL
- Realtime events: WebSocket
- Cache/session/presence: Redis
- Video/audio: WebRTC
- SFU: Prefer a self-hosted solution such as LiveKit, Jitsi, or mediasoup
- TURN/STUN: Use self-hosted coturn
- Deployment: Docker and Docker Compose
- Must be deployable on an Iranian VPS or dedicated server

Security requirements:
- Secure authentication for registered users
- Password hashing
- Role-based access control
- Secure and non-guessable meeting links
- Input validation
- Basic protection against unauthorized meeting access
- Guest access must be limited only to joining meetings
- Guest identity can be temporary and session-based

Design requirements:
- Clean, modern, educational, and professional interface
- RTL support
- Persian-friendly typography
- Responsive layout
- Do not overcomplicate the first version
- Focus on a solid MVP before adding advanced features

Coding rules:
- Use TypeScript
- Write clean, modular, scalable code
- Keep components reusable
- Explain important technical decisions briefly
- Avoid unnecessary complexity
- Do not use external services unless absolutely necessary
- Prefer production-ready structure over quick demo code

Development process:
Start by designing the full MVP architecture.
Then suggest the best tech stack for this project and explain why.
Then provide the folder structure.
After that, implement the project step by step with complete code, setup instructions, environment variables, and testing steps.

Do not start coding before confirming the architecture and tech stack.