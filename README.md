# Golf Simulation

A small 3D golf hole in the browser. Aim with the camera, hold the power bar, and hit the ball onto a generated course.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints (port 5173).

| Action | Control |
| --- | --- |
| Look around and aim | Drag to orbit the camera. The golfer turns to face you, and the shot follows the camera direction. |
| Hit the ball | Press and hold the bar at the bottom. It fills and empties. Release to swing. A fuller bar hits harder. |
| Next shot | After the ball stops, the golfer walks up to it and sets up again. |
| Finish the hole | Sink the ball slowly near the cup. A banner shows the stroke count. |
| Play again | Press **Play again** to return to the tee. |

## Features

### Course

- One hole with a gentle dogleg. The tee sits higher than the green, with a soft rise onto the putting surface.
- Rolling fairway and rougher ground off the line of play, colored by height sample: rough, fairway, fringe, green, tee box, and sand.
- Three bunkers: two beside the green and one along the fairway.
- A flat tee box so the opening stance sits level.
- Trees scattered in the rough, kept off the fairway and green.
- A cup, white pin, and red flag on the green.

### Golfer

- A side-view golfer drawn on a canvas and placed in the scene as a sprite.
- The sprite yaws to face the camera while you aim.
- A white ball sits on a tee at the club head.
- A soft ground shadow sits under the stance.

### Shot

- Hold-to-charge power. Release reads how full the bar is and uses that as shot speed.
- The swing plays a short backswing, strike, and follow-through. The ball leaves the tee at impact.
- The camera leaves orbit and follows the ball through the air.

### Ball

- Flight uses gravity and a little air drag.
- The ball bounces, then rolls. Ground slope pushes it downhill, and friction slows it until it stops.
- Play stays inside the course bounds.
- A putt counts when the ball is on the ground, moving slowly, and close to the cup.

### After each shot

- The golfer walks to the ball, plants a stance facing the hole, and the camera resets behind that stance.
- Strokes accumulate until the hole is finished.
- A hole in one and a longer score each get their own banner.
- On the last putt the golfer walks up beside the cup and hops. **Play again** resets the ball, tee, score, and camera.

### Look

- Daylight sky, distance fog, hemisphere fill, and a sun that casts soft shadows.
- Filmic tone mapping on the renderer.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Build the static app into `dist`, plus a small Node server for hosting. |
| `npm start` | Serve `dist` (default `127.0.0.1:3000`). `PORT` and `IP` override the address. |
| `npm run preview` | Preview the Vite build. |

Node 18 or newer. The only runtime dependency is Three.js.
