# Draw Party 🎨

A drawing game for events. The **Host** sets the prompts, times and rules. **Players** draw on their own phones. When time is up, everyone's drawings appear together on the **big screen**.

## What the Host controls
- Game name and the maximum number of players
- **Number of rounds**: up to 20, each with its own **prompt** (type your own or use 🎲 to pick a random one) and **time** (30 seconds to 15 minutes)
- Voting on/off (players vote for their favorite drawing after each round and can't vote for their own) and how long voting lasts
- Show or hide the artist's name on the big screen
- Show the prompt on players' phones, or only on the big screen
- During play: **+30 sec**, **End time now** (phones automatically send whatever they've drawn), **Next**, remove a player, and **Play again** in the same room

## Running it on your computer (players on the same Wi-Fi)
1. Install [Node.js](https://nodejs.org) version 18 or newer
2. Open a terminal in this folder, then run
   ```
   npm install
   npm start
   ```
3. On the computer connected to the projector/TV, open `http://localhost:3000/host.html`
4. Set up the game and press "Create game room". A QR code appears on screen, and players scan it with their phones to join. The phones must be on the **same Wi-Fi** as the computer.

> If phones can't connect, check that the computer's firewall allows port 3000, or deploy online using the method below instead.

## Putting it online (players can use any network, including mobile data)
Use a free Node.js host that supports WebSockets, such as **Render.com**:
1. Upload this folder to GitHub
2. On Render, create a **New → Web Service** and choose that repo
3. Build command `npm install`, start command `npm start`
4. Once it's live, open `https://your-name.onrender.com/host.html`

(Railway, Fly.io, or your own VPS also work.)

## Files
- `server.js`: rooms, timers, and real-time connections (Socket.IO)
- `public/host.html`, `host.js`: the Host page (setup + big screen)
- `public/play.html`, `play.js`: the player phone page (drawing canvas + voting)

Note: game data is kept in memory only. Restarting the server clears every room. If you want to keep drawings, save them from the big screen first (click a drawing to enlarge it, then right-click and save the image).
