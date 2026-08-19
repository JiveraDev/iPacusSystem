# iPawcus Video Consultation Operations

## Current deployment: 8x8 JaaS

The application uses the clinic's 8x8 Jitsi as a Service (JaaS) tenant when `JAAS_APP_ID` is set:

```dotenv
JAAS_APP_ID=vpaas-magic-cookie-d85e8a95d306429d864bca4f9aed5ad8
JITSI_BASE_URL=https://8x8.vc/vpaas-magic-cookie-d85e8a95d306429d864bca4f9aed5ad8
```

Each approved booking keeps its own high-entropy `meeting_code`. The PHP API combines that code with the configured AppID, and the React call shell loads the tenant-specific 8x8 IFrame API. Do not reuse the sample room name from the JaaS console for real consultations.

The JaaS console currently permits unauthenticated participants, so ordinary guest meetings work without a JWT. For trusted veterinarian moderator identity, generate an RSA 4096-bit key pair, convert the public key to PEM, and upload only the public key in the JaaS console:

```text
ssh-keygen -t rsa -b 4096 -m PEM -f jaasauth.key
openssl rsa -in jaasauth.key -pubout -outform PEM -out jaasauth.key.pub
```

Reference: [8x8 API key generation](https://developer.8x8.com/jaas/docs/api-keys-generate-add/) and [JaaS JWT claims](https://developer.8x8.com/jaas/docs/api-keys-jwt/).

Copy the resulting Key ID from 8x8 and configure PHP with the private key stored outside the repository and public web root:

```dotenv
JAAS_KEY_ID=vpaas-magic-cookie-d85e8a95d306429d864bca4f9aed5ad8/KEY_ID_FROM_8X8
JAAS_PRIVATE_KEY_PATH=/absolute/private/path/jaasauth.key
JAAS_JWT_TTL_SECONDS=7200
```

`JAAS_KEY_ID` and `JAAS_PRIVATE_KEY_PATH` must either both be set or both be empty. Never put the private key or a generated JWT in React, a `VITE_` variable, `public/`, a meeting URL, or source control. The PHP API issues short-lived, room-specific RS256 tokens; veterinarian and super-admin participants receive moderator status, while recording, transcription, outbound calling, file upload, and other premium features remain disabled.

After deployment, test one veterinarian and one pet-owner account on separate devices and networks. Confirm camera, microphone, prejoin, minimize/restore, leaving, and the consultation completion workflow.

## Legacy self-hosted fallback

This directory also contains the previous self-hosted Jitsi deployment. Keep it only as a documented fallback; it is not selected while `JAAS_APP_ID` is configured.

## Production flow

```text
Pet owner or veterinarian
        |
        v
https://meet.ipawcus.com
        |
        v
Public clinic IP and router
        |
        +-- TCP 80    -> Jitsi computer TCP 8088
        +-- TCP 443   -> Jitsi computer TCP 8443
        +-- UDP 10000 -> Jitsi computer UDP 10000
        |
        v
Docker Jitsi on the clinic computer
```

The main `ipawcus.com` website remains on its existing host. Only the `meet` DNS record points to the clinic connection.

## Files and commands

- Compose project: `Jitsi/docker-jitsi-meet-stable-11031`
- Private deployment settings: `Jitsi/docker-jitsi-meet-stable-11031/.env`
- Active generated runtime data: `Jitsi/.jitsi-meet-cfg-stable-11031`
- Pre-repair runtime backup: `Jitsi/.jitsi-meet-cfg`
- Password generator: `Jitsi/docker-jitsi-meet-stable-11031/gen-passwords.ps1`
- Read-only host check: `Jitsi/check-jitsi-host.ps1`

Run Compose commands from the Compose project directory:

```powershell
docker compose --project-name docker-jitsi-meet ps --all
docker compose --project-name docker-jitsi-meet logs --tail 100
docker compose --project-name docker-jitsi-meet up -d
docker compose --project-name docker-jitsi-meet pull
```

Do not commit `.env`, generated certificates, or `.jitsi-meet-cfg*` runtime directories.

## Values that can change

| Value | Why it changes | Where it is used | Required action |
| --- | --- | --- | --- |
| Jitsi computer LAN IPv4 | Router DHCP lease or changing networks | Router port-forward destination | Reserve one address in the router. If it changes, update all three forwarding rules. |
| Public IPv4 | ISP reconnect, dynamic-IP lease, or changing ISP | Hostinger `meet` A record and `JVB_ADVERTISE_IPS` | Prefer a static public IP. Otherwise update DNS and Jitsi after every change, or configure supported dynamic DNS. |
| `meet.ipawcus.com` DNS | Manual DNS changes | Public meeting address and certificate | Keep one non-conflicting A record named `meet`. Do not change `@`, `www`, MX, or nameserver records. |
| TLS certificate | Normal renewal or domain/network failure | Browser trust and iframe camera/microphone access | Keep ports 80 and 443 reachable. Check renewal before expiry. |
| Jitsi image release | Security or compatibility update | All four Jitsi containers | Back up `.env` and runtime data, read release notes, pull, recreate, and test two participants before production use. |
| Internal Jitsi passwords | Manual rotation only | Prosody, Jicofo, and JVB authentication | Do not change one password independently. Regenerate all and recreate the complete stack during maintenance. |
| `JITSI_BASE_URL` | Only when changing meeting provider/domain | Deployed iPawcus PHP environment | Change only after the new Jitsi address passes production testing. Existing saved consultation URLs are not rewritten. |

The private Jitsi `.env` keeps the changeable host values together:

```dotenv
IPAWCUS_HOST_LAN_IP=LAN_ADDRESS_RESERVED_IN_THE_ROUTER
IPAWCUS_PUBLIC_IPV4=PUBLIC_IPV4_FROM_THE_ISP
IPAWCUS_JITSI_PUBLIC_URL=https://meet.ipawcus.com
IPAWCUS_JITSI_DOMAIN=meet.ipawcus.com
IPAWCUS_LETSENCRYPT_EMAIL=WORKING_CLINIC_EMAIL
ENABLE_LETSENCRYPT=1
```

`IPAWCUS_HOST_LAN_IP` is a maintenance reminder and is not used directly by Docker. The router forwarding rules must point to that address. The other maintained values feed Jitsi's `PUBLIC_URL`, `JVB_ADVERTISE_IPS`, and certificate settings.

For local or hotspot testing, keep `IPAWCUS_PUBLIC_IPV4`, `IPAWCUS_JITSI_DOMAIN`, and `IPAWCUS_LETSENCRYPT_EMAIL` empty, keep `ENABLE_LETSENCRYPT=0`, and use `IPAWCUS_JITSI_PUBLIC_URL=https://localhost:8443`.

## Initial public deployment checklist

1. Connect the Jitsi computer to the permanent clinic router using wired Ethernet when possible.
2. Reserve a fixed LAN IPv4 for the Jitsi computer in the router's DHCP settings.
3. Confirm the ISP provides a publicly reachable IPv4 address and does not place the connection behind CGNAT.
4. Add a Hostinger DNS A record named `meet` pointing to the public IPv4.
5. Forward public TCP 80 to computer TCP 8088.
6. Forward public TCP 443 to computer TCP 8443.
7. Forward public UDP 10000 to computer UDP 10000.
8. Allow computer firewall inbound traffic on TCP 8088, TCP 8443, and UDP 10000.
9. Set the following private `.env` values:

   ```dotenv
   PUBLIC_URL=https://meet.ipawcus.com
   JVB_ADVERTISE_IPS=PUBLIC_IPV4_HERE
   ENABLE_LETSENCRYPT=1
   LETSENCRYPT_DOMAIN=meet.ipawcus.com
   LETSENCRYPT_EMAIL=WORKING_CLINIC_EMAIL_HERE
   ```

10. Recreate the Jitsi stack and confirm all four containers remain running with zero restart loops.
11. Confirm `https://meet.ipawcus.com` has a valid trusted certificate.
12. Test a room with two devices on different networks, including camera, microphone, screen sharing, reconnect, and a call longer than one hour.
13. Test the same room inside the iPawcus iframe in desktop and mobile browsers.
14. Change the deployed iPawcus environment to `JITSI_BASE_URL=https://meet.ipawcus.com`.
15. Create a new test consultation. Do not rewrite previously stored meeting URLs.

## Routine checks

Weekly:

- Run `Jitsi/check-jitsi-host.ps1`.
- Confirm all four containers are running without restart loops.
- Confirm the public IP still matches the `meet` DNS A record.
- Confirm the clinic can open a test room from a device outside the clinic network.

Monthly:

- Check free disk space and Docker image usage.
- Review Jitsi container logs for repeated authentication, certificate, WebSocket, or UDP errors.
- Check for a stable Jitsi security release before updating.
- Verify the computer does not sleep and Docker starts after Windows restarts.

After an ISP, router, or computer change:

- Recheck the LAN IPv4 reservation.
- Recheck the public IPv4 and CGNAT status.
- Recheck all port forwards and Windows firewall rules.
- Recheck `JVB_ADVERTISE_IPS` and the Hostinger `meet` A record.
- Repeat the external two-device call test before accepting consultations.

## Important limitations

- A phone hotspot normally cannot provide the required inbound port forwarding.
- A connection behind CGNAT cannot expose this server using ordinary router forwarding.
- An HTTP-only tunnel does not replace the UDP 10000 media route.
- Stopping Docker, sleeping the computer, losing clinic power, or losing clinic internet interrupts active calls.
- Recording needs substantially more resources and must not be enabled without separate consent, storage, retention, and security controls.
