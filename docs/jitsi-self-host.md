# Self-Hosted Jitsi Setup

The current public-Jitsi mode can be enabled with:

```env
JITSI_BASE_URL=https://meet.jit.si
```

With public `meet.jit.si`, the veterinarian may need to log in as moderator when opening the room. The app cannot disable that because the public Jitsi server is controlled by Jitsi/8x8.

The app can generate consultation rooms for a self-hosted Jitsi server by setting:

```env
JITSI_BASE_URL=https://your-jitsi-domain.example
```

For local testing with Jitsi Docker, this can be a local HTTPS URL such as:

```env
JITSI_BASE_URL=https://localhost:8443
```

Newly approved online consultations will store meeting URLs using this base URL.
Existing rows in `online_consultations` keep their old `meeting_url`; approve a new booking or update existing rows if you need to test the new host.

## No Moderator Login Mode

To remove the moderator/login requirement for development, configure the self-hosted Jitsi server with authentication disabled:

```env
ENABLE_AUTH=0
```

With this mode, anyone with the private room link can join. The app already generates random per-booking room names, so this is acceptable for local development and demos.

## Production Mode

For production, use either:

```env
ENABLE_AUTH=1
AUTH_TYPE=jwt
```

or another authenticated Jitsi setup. That requires token generation from this PHP app so the veterinarian can be the moderator and the pet owner can join as a guest/participant.
