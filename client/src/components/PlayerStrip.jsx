import { memo } from "react";
import { SketchIcon } from "./ui/sketch-icon.jsx";

function tint(id) {
  let sum = 0;
  for (const char of id) sum += char.codePointAt(0);
  return sum % 6;
}

export const PlayerStrip = memo(function PlayerStrip({ room }) {
  const finished = room.round.status === "finished";
  const started = room.round.status !== "waiting";
  return (
    <section className="players" aria-label="玩家与积分">
      <header>
        <h2>玩家</h2>
        <small>{room.players.length} / 10</small>
      </header>
      <ol className="player-list">
        {room.players.map((player) => {
          const drawer = started && player.id === room.round.drawerId,
            prompter = started && player.id === room.round.prompterId,
            self = player.id === room.me.id;
          const delta = finished ? room.round.scoreChanges?.[player.id] : 0;
          return (
            <li
              key={player.id}
              className={`player ${self ? "player-self" : ""} ${drawer ? "player-drawer" : ""} ${prompter ? "player-prompter" : ""}`}
            >
              <span className={`avatar tint-${tint(player.id)}`} aria-hidden="true">
                {Array.from(player.id)[0]}
                {(drawer || prompter) && (
                  <i className="avatar-badge">
                    <SketchIcon name={drawer ? "pen" : "star"} size={13} />
                  </i>
                )}
              </span>
              <div className="player-name">
                <strong>
                  <span>{player.id}</span>
                  {self && <small>我</small>}
                </strong>
                <span>
                  {player.id === room.hostId && (
                    <SketchIcon name="crown" size={13} role="img" aria-hidden={false} aria-label="房主" />
                  )}
                  {drawer ? "画师" : prompter ? "出题者" : started ? "猜词" : player.id === room.hostId ? "房主" : "已加入"}
                </span>
              </div>
              <b className="player-score">
                {player.score}
                <small>分</small>
                {delta > 0 && <em key={room.round.id}>+{delta}</em>}
              </b>
            </li>
          );
        })}
      </ol>
      <p className="score-rule">猜中 +2 · 画师 / 出题者 +1</p>
    </section>
  );
}, (before, after) => before.room.players === after.room.players && before.room.round === after.room.round && before.room.me.id === after.room.me.id && before.room.hostId === after.room.hostId);
